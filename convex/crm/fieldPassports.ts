import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx, query } from "../_generated/server";
import {
  hasRole,
  jobCardRecordGrant,
  ownsTourManagerJobCard,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import { boundedPaginationOptions, loadRowsByIdInBatches } from "./paginationPolicy";
import { canReadPassportInStaffWorkspace } from "./passportPolicy";
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

function tripDates(job: Doc<"jobCards">, batch: Doc<"travelBatches"> | null) {
  return {
    travelEndDate: batch?.travelEndDate || job.travelEndDate,
    travelStartDate: batch?.travelStartDate || job.travelStartDate,
  };
}

const isOpen = (window: { closesAt: number; opensAt: number } | null, now: number) =>
  Boolean(window && now >= window.opensAt && now < window.closesAt);

function requireFieldTourManager(access: PortalAccess) {
  if (!(hasRole(access, "Tour Manager") && access.staffId)) {
    throw new ConvexError("FORBIDDEN");
  }
  return access.staffId;
}

/** The Job Card when the caller reaches it through their own Tour Manager assignment. */
async function loadFieldJobCard(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards"> | null
) {
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(jobCardRecordGrant(access, job, linkedQuery) && ownsTourManagerJobCard(access, job))) {
    throw new ConvexError("FORBIDDEN");
  }
  return { job, scope: await loadTourManagerGroupScope(ctx, access, job) };
}

/**
 * Authorizes one field passport read and writes its audit row in the same transaction.
 * Called by `crm/fieldPassportActions:getFieldPassportFile` with the caller's identity.
 */
export const authorizeFieldPassportRead = internalMutation({
  args: { travellerId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const actorStaffId = requireFieldTourManager(access);
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
    if (!isOpen(fieldPassportWindow(tripDates(job, batch)), now)) {
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
    await ctx.db.insert("fieldPassportAccessAudit", {
      accessedAt: now,
      actorAuthUserId: access.authUserId ?? access.email,
      actorName: access.name,
      actorStaffId,
      jobCardId: job._id,
      travelBatchId: traveller.travelBatchId,
      travellerId: traveller._id,
    });
    return {
      fileName: passport.fileName || "passport.pdf",
      mimeType: passport.mimeType || "application/pdf",
      storageId: passport.storageId,
    };
  },
  returns: v.object({
    fileName: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
  }),
});

/**
 * The tour manager's own group on one Job Card with each traveller's passport availability.
 * Returns flags and window times only, never a file, number or storage id.
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
    return {
      timeZone: FIELD_PASSPORT_TIME_ZONE,
      travellers: inGroup.map((traveller) => {
        const batch = traveller.travelBatchId
          ? (batchById.get(String(traveller.travelBatchId)) ?? null)
          : null;
        const window = fieldPassportWindow(tripDates(job, batch));
        const hasPassportScan = traveller.hasPassportScan ?? false;
        return {
          available: hasPassportScan && isOpen(window, referenceNow),
          closesAt: window?.closesAt ?? null,
          hasPassportScan,
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
        opensAt: v.union(v.number(), v.null()),
        travellerId: v.id("travellers"),
      })
    ),
  }),
});

/** Office review of field passport reads on a Job Card, newest first. */
export const listFieldPassportAccess = query({
  args: { jobCardId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_VISA);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
    const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (
      !(
        job && canReadPassportInStaffWorkspace(access, jobCardRecordGrant(access, job, linkedQuery))
      )
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
