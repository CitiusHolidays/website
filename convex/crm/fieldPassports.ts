import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx, query } from "../_generated/server";
import { requireAppPilotOn } from "./appPilot";
import {
  FIELD_PASSPORT_OPEN_LOOKUP_LIMIT,
  FIELD_PASSPORT_OPEN_WINDOW_MS,
  type FieldPassportVariant,
  fieldPassportVariantValidator,
  isPreviewableFieldPassportMimeType,
  mergeFieldPassportVariants,
  normalizeFieldPassportOpenId,
} from "./fieldPassportOpenPolicy";
import { hasRole, jobCardRecordGrant, PERMISSIONS, type PortalAccess, requireStaff } from "./lib";
import { portalFileRateLimitedError } from "./lib/portalFileDownloadLimit";
import {
  FIELD_PASSPORT_AUDIT_RETENTION_DAYS,
  RETENTION_DAY_MS,
  tripDates,
} from "./lib/retentionSchedule";
import { boundedPaginationOptions, loadRowsByIdInBatches } from "./paginationPolicy";
import { canReadFieldPassportAccessLog } from "./passportPolicy";
import { consumePortalFileDownloadWindow } from "./rateLimitMaintenance";
import { assertReferenceNow } from "./referenceTimePolicy";
import { loadTourManagerGroupScope, travellerInGroupScope } from "./tourManagerGroupScope";

/**
 * Field passports (owner decision, 6 Nov 2026): a tour manager cannot open passports in the
 * Staff Workspace, but can in the field. The Connect app reads the passport scan of a
 * traveller in the tour manager's own group, only inside the trip window, and every read
 * leaves a `fieldPassportAccessAudit` row.
 *
 * Trip window. Citius records no trip time zone, so the window uses the office time zone,
 * India Standard Time (UTC+05:30, no daylight saving): it opens at 00:00 IST on the day before
 * travel starts and closes at 24:00 IST on the day after travel ends. The traveller's Travel
 * Batch dates apply where recorded, otherwise the Job Card's. The extra day at each end covers
 * trips in other time zones; without a start date the window stays closed.
 */
const FIELD_PASSPORT_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_FIELD_PASSPORT_TRAVELLERS = 2000;

function utcMidnight(date: string | null | undefined) {
  const match = DATE_PATTERN.exec(String(date ?? "").trim());
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const value = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const check = new Date(value);
  return check.getUTCMonth() === Number(month) - 1 && check.getUTCDate() === Number(day)
    ? value
    : null;
}

export function fieldPassportWindow(dates: {
  travelEndDate?: string | null;
  travelStartDate?: string | null;
}) {
  const start = utcMidnight(dates.travelStartDate);
  if (start === null) {
    return null;
  }
  const end = utcMidnight(dates.travelEndDate) ?? start;
  if (end < start) {
    return null;
  }
  return {
    closesAt: end + 2 * DAY_MS - IST_OFFSET_MS,
    opensAt: start - DAY_MS - IST_OFFSET_MS,
  };
}

/** The scan's stored type, with the same PDF default the file read returns. */
function passportMimeType(passport: Pick<Doc<"passportDetails">, "mimeType">) {
  return passport.mimeType || "application/pdf";
}

const isOpen = (window: { closesAt: number; opensAt: number } | null, now: number) =>
  Boolean(window && now >= window.opensAt && now < window.closesAt);

function requireFieldTourManager(access: PortalAccess) {
  if (!(hasRole(access, "Tour Manager") && access.staffId)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access.staffId;
}

/**
 * The Job Card and group when the caller holds their own active staff Tour Manager assignment on
 * it. No name match of any kind opens field passports.
 */
async function loadFieldJobCard(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards"> | null
) {
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!jobCardRecordGrant(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const scope = await loadTourManagerGroupScope(ctx, access, job, { legacyNames: false });
  if (scope.kind === "batches" && scope.travelBatchIds.size === 0) {
    throw new ConvexError("FORBIDDEN");
  }
  // Field passports exist only in the tour manager app, so the trip's app pilot must be on.
  requireAppPilotOn(job);
  return { job, scope };
}

/** The same actor's open of this traveller with this `openId`, still inside the open window. */
async function findRecentOpen(
  ctx: MutationCtx,
  open: {
    actorAuthUserId: string;
    now: number;
    openId: string;
    travellerId: Doc<"travellers">["_id"];
  }
) {
  const rows = await ctx.db
    .query("fieldPassportAccessAudit")
    .withIndex("by_openId_and_accessedAt", (q) =>
      q.eq("openId", open.openId).gt("accessedAt", open.now - FIELD_PASSPORT_OPEN_WINDOW_MS)
    )
    .take(FIELD_PASSPORT_OPEN_LOOKUP_LIMIT);
  return (
    rows.find(
      (row) => row.actorAuthUserId === open.actorAuthUserId && row.travellerId === open.travellerId
    ) ?? null
  );
}

/**
 * Authorizes one field passport read and writes its audit row in the same transaction.
 * Called by `crm/fieldPassportActions:getFieldPassportFile` with the caller's identity.
 *
 * Every call runs every check. A new open then counts once against the portal file rate limit
 * and inserts its audit row; a later call of the same open (same actor, traveller and `openId`
 * within `FIELD_PASSPORT_OPEN_WINDOW_MS`) only records the variant on that row. A preview of a
 * scan the server cannot downscale reads nothing, so it is neither counted nor audited.
 */
export const authorizeFieldPassportRead = internalMutation({
  args: {
    openId: v.optional(v.string()),
    travellerId: v.string(),
    variant: v.optional(fieldPassportVariantValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const actorStaffId = requireFieldTourManager(access);
    // The portal file rate limit and the audit row are keyed by the auth user.
    const actorAuthUserId = String(access.authUserId ?? "").trim();
    if (!actorAuthUserId) {
      throw new ConvexError("FORBIDDEN");
    }
    const openId = normalizeFieldPassportOpenId(args.openId);
    const variant: FieldPassportVariant = args.variant ?? "full";
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    const traveller = travellerId ? await ctx.db.get("travellers", travellerId) : null;
    if (!traveller) {
      throw new ConvexError("FORBIDDEN");
    }
    const { job, scope } = await loadFieldJobCard(
      ctx,
      access,
      await ctx.db.get("jobCards", traveller.jobCardId)
    );
    if (!travellerInGroupScope(scope, traveller)) {
      throw new ConvexError("FORBIDDEN");
    }
    const batch = traveller.travelBatchId
      ? await ctx.db.get("travelBatches", traveller.travelBatchId)
      : null;
    const now = Date.now();
    const window = fieldPassportWindow(tripDates(job, batch));
    if (!(window && isOpen(window, now))) {
      throw new ConvexError(
        "Passports open in the app from the day before the trip starts until the day after it ends"
      );
    }
    const passport = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
      .unique();
    if (!passport?.storageId) {
      throw new ConvexError("Passport document not found for this traveller");
    }
    const grant = {
      fileName: passport.fileName || "passport.pdf",
      mimeType: passportMimeType(passport),
      storageId: passport.storageId,
    };
    if (variant === "preview" && !isPreviewableFieldPassportMimeType(grant.mimeType)) {
      return { ...grant, serve: "none" as const };
    }
    const existing = openId
      ? await findRecentOpen(ctx, { actorAuthUserId, now, openId, travellerId: traveller._id })
      : null;
    if (existing) {
      const variants = mergeFieldPassportVariants(existing.variants, variant);
      if (variants.length !== (existing.variants?.length ?? 0)) {
        await ctx.db.patch("fieldPassportAccessAudit", existing._id, { variants });
      }
      return { ...grant, serve: variant };
    }
    const limit = await consumePortalFileDownloadWindow(ctx, actorAuthUserId);
    if (!limit.allowed) {
      throw portalFileRateLimitedError(limit.retryAfterSeconds);
    }
    await ctx.db.insert("fieldPassportAccessAudit", {
      accessedAt: now,
      actorAuthUserId,
      actorName: access.name,
      actorStaffId,
      jobCardId: job._id,
      openId,
      retainUntil: window.closesAt + FIELD_PASSPORT_AUDIT_RETENTION_DAYS * RETENTION_DAY_MS,
      travelBatchId: traveller.travelBatchId,
      travellerId: traveller._id,
      tripClosesAt: window.closesAt,
      variants: [variant],
    });
    return { ...grant, serve: variant };
  },
  returns: v.object({
    fileName: v.string(),
    mimeType: v.string(),
    // What the action returns: the requested variant, or "none" for a preview it cannot make.
    serve: v.union(v.literal("full"), v.literal("preview"), v.literal("none")),
    storageId: v.id("_storage"),
  }),
});

/**
 * The tour manager's own group on one Job Card with each traveller's passport availability and
 * scan file type (null without a scan). Returns flags, types and window times only, never a
 * file, number or storage id. The app offers in-app viewing only for types it can render, so it
 * does not trigger an audited read for a file it cannot show.
 */
export const listFieldPassports = query({
  args: { jobCardId: v.string(), referenceNow: v.number() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    requireFieldTourManager(access);
    const referenceNow = assertReferenceNow(args.referenceNow);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const { job, scope } = await loadFieldJobCard(
      ctx,
      access,
      jobCardId ? await ctx.db.get("jobCards", jobCardId) : null
    );
    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
      .take(MAX_FIELD_PASSPORT_TRAVELLERS + 1);
    if (travellers.length > MAX_FIELD_PASSPORT_TRAVELLERS) {
      throw new ConvexError("This Job Card has more travellers than field passports support");
    }
    const inGroup = travellers.filter((traveller) => travellerInGroupScope(scope, traveller));
    const batches = await loadRowsByIdInBatches(
      ctx,
      "travelBatches",
      inGroup.map((traveller) => traveller.travelBatchId),
      Math.max(1, inGroup.length)
    );
    const batchById = new Map(batches.map((batch) => [String(batch._id), batch]));
    // Same metadata row the field read uses; only the file type leaves the server.
    const scanTypes = new Map(
      await Promise.all(
        inGroup
          .filter((traveller) => traveller.hasPassportScan)
          .map(async (traveller) => {
            const passport = await ctx.db
              .query("passportDetails")
              .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
              .unique();
            return [
              String(traveller._id),
              passport?.storageId ? passportMimeType(passport) : null,
            ] as const;
          })
      )
    );
    return {
      timeZone: FIELD_PASSPORT_TIME_ZONE,
      travellers: inGroup.map((traveller) => {
        const batch = traveller.travelBatchId
          ? (batchById.get(String(traveller.travelBatchId)) ?? null)
          : null;
        const window = fieldPassportWindow(tripDates(job, batch));
        const mimeType = scanTypes.get(String(traveller._id)) ?? null;
        const hasPassportScan = mimeType !== null;
        return {
          available: hasPassportScan && isOpen(window, referenceNow),
          closesAt: window?.closesAt ?? null,
          hasPassportScan,
          mimeType,
          opensAt: window?.opensAt ?? null,
          travellerId: traveller._id,
        };
      }),
    };
  },
  returns: v.object({
    timeZone: v.string(),
    travellers: v.array(
      v.object({
        available: v.boolean(),
        closesAt: v.union(v.number(), v.null()),
        hasPassportScan: v.boolean(),
        mimeType: v.union(v.string(), v.null()),
        opensAt: v.union(v.number(), v.null()),
        travellerId: v.id("travellers"),
      })
    ),
  }),
});

/**
 * Office review of field passport reads on a Job Card, newest first. Only the Operations Head
 * and Admin read the log (director decision, 7 Nov 2026).
 */
export const listFieldPassportAccess = query({
  args: { jobCardId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
    const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (
      !(job && canReadFieldPassportAccessLog(access, jobCardRecordGrant(access, job, linkedQuery)))
    ) {
      throw new ConvexError("FORBIDDEN");
    }
    const page = await ctx.db
      .query("fieldPassportAccessAudit")
      .withIndex("by_jobCardId_and_accessedAt", (q) => q.eq("jobCardId", job._id))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const travellers = await loadRowsByIdInBatches(
      ctx,
      "travellers",
      page.page.map((row) => row.travellerId),
      Math.max(1, page.page.length)
    );
    const nameById = new Map(travellers.map((row) => [String(row._id), row.fullName]));
    return {
      ...page,
      page: page.page.map((row) => ({
        accessedAt: row.accessedAt,
        actorName: row.actorName,
        id: row._id,
        travellerId: row.travellerId,
        travellerName: nameById.get(String(row.travellerId)) ?? "Removed traveller",
      })),
    };
  },
  returns: paginationResultValidator(
    v.object({
      accessedAt: v.number(),
      actorName: v.string(),
      id: v.id("fieldPassportAccessAudit"),
      travellerId: v.id("travellers"),
      travellerName: v.string(),
    })
  ),
});
