import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, type QueryCtx, query } from "../_generated/server";
import { jobCardRecordGrant, PERMISSIONS, type PortalAccess, requireStaff } from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { boundedPaginationOptions, loadRowsByIdInBatches } from "./paginationPolicy";
import {
  resolveTravellerGroupScope,
  type TravellerGroupScope,
  travellerInGroupScope,
} from "./tourManagerGroupScope";

/**
 * Citius Connect field sync. The tour manager's phone keeps working offline and pushes each
 * headcount stop and announcement with a client-generated id; a repeated push upserts the same
 * row. Writers are limited to the travellers their Job Card scope allows (a Tour Manager-only
 * grant is their own group). Office readers need Operations access and office scope on the
 * Job Card. Nothing here sends a message to anyone.
 */

const MAX_FIELD_TRAVELLERS_PER_JOB_CARD = 2000;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_STOP_LABEL_LENGTH = 120;
const MAX_ANNOUNCEMENT_LENGTH = 4000;
const DEFAULT_HEADCOUNT_DAYS = 7;
const MAX_HEADCOUNT_DAYS = 31;
const MAX_HEADCOUNT_ROWS_READ = 400;

const pushResultFields = {
  applied: v.boolean(),
  ignoredTravellerIds: v.number(),
};

function requireClientId(raw: string, label: string) {
  const value = raw.trim();
  if (!CLIENT_ID_PATTERN.test(value)) {
    throw new ConvexError(
      `A ${label} id must be 1 to 128 letters, digits, dots, colons, dashes or underscores`
    );
  }
  return value;
}

function requireDay(raw: string) {
  const match = DAY_PATTERN.exec(raw.trim());
  if (!match) {
    throw new ConvexError("A headcount day must be a YYYY-MM-DD date");
  }
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new ConvexError("A headcount day must be a real calendar date");
  }
  return raw.trim();
}

function requireTimestamp(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConvexError(`${label} must be a positive timestamp`);
  }
  return value;
}

function requireRecorder(access: PortalAccess) {
  if (!access.staffId) {
    throw new ConvexError("Field sync needs a staff record for the signed-in user");
  }
  return access.staffId;
}

function requireIdListSize(ids: readonly string[]) {
  if (ids.length > MAX_FIELD_TRAVELLERS_PER_JOB_CARD) {
    throw new ConvexError("Too many travellers in one push");
  }
}

async function loadWritableJobCard(
  ctx: MutationCtx,
  access: PortalAccess,
  rawJobCardId: string
): Promise<{ jobCardId: Id<"jobCards">; scope: TravellerGroupScope }> {
  const jobCardId = ctx.db.normalizeId("jobCards", rawJobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  const scope = await resolveTravellerGroupScope(ctx, access, job, linkedQuery);
  if (!scope) {
    throw new ConvexError("FORBIDDEN");
  }
  return { jobCardId, scope };
}

async function resolveScopedBatch(
  ctx: MutationCtx,
  rawBatchId: string | undefined,
  jobCardId: Id<"jobCards">,
  scope: TravellerGroupScope
) {
  const value = rawBatchId?.trim();
  if (!value) {
    // No batch means the writer's whole group: the full Job Card for office scope, or every
    // batch a Tour Manager is assigned to.
    return;
  }
  const travelBatchId = ctx.db.normalizeId("travelBatches", value);
  const batch = travelBatchId ? await ctx.db.get("travelBatches", travelBatchId) : null;
  if (!(batch && String(batch.jobCardId) === String(jobCardId))) {
    throw new ConvexError("Travel Batch must belong to the selected Job Card");
  }
  if (!travellerInGroupScope(scope, { travelBatchId: batch._id })) {
    throw new ConvexError("FORBIDDEN");
  }
  return batch._id;
}

async function loadScopedTravellers(
  ctx: QueryCtx | MutationCtx,
  jobCardId: Id<"jobCards">,
  scope: TravellerGroupScope,
  travelBatchId: Id<"travelBatches"> | undefined
) {
  const travellers = await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .take(MAX_FIELD_TRAVELLERS_PER_JOB_CARD + 1);
  if (travellers.length > MAX_FIELD_TRAVELLERS_PER_JOB_CARD) {
    throw new ConvexError("This Job Card has more travellers than field sync supports");
  }
  return travellers.filter(
    (traveller) =>
      travellerInGroupScope(scope, traveller) &&
      (!travelBatchId || String(traveller.travelBatchId) === String(travelBatchId))
  );
}

const isTravelling = (traveller: Doc<"travellers">) =>
  !(traveller.cancellation || traveller.lastMinuteDrop);

/** Keeps known ids in input order, once each. */
function knownIds(raw: readonly string[], known: ReadonlyMap<string, Id<"travellers">>) {
  const unique = [...new Set(raw.map((id) => id.trim()))];
  const ids = unique.flatMap((id) => {
    const match = known.get(id);
    return match ? [match] : [];
  });
  return { ids, ignored: unique.length - ids.length };
}

const isStale = (existing: { clientUpdatedAt?: number }, incoming: number | undefined) =>
  incoming !== undefined &&
  existing.clientUpdatedAt !== undefined &&
  incoming < existing.clientUpdatedAt;

export const pushHeadcountStop = mutation({
  args: {
    clientStopId: v.string(),
    clientUpdatedAt: v.optional(v.number()),
    day: v.string(),
    jobCardId: v.string(),
    label: v.string(),
    presentTravellerIds: v.array(v.string()),
    startedAt: v.number(),
    travelBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const recordedByStaffId = requireRecorder(access);
    const clientStopId = requireClientId(args.clientStopId, "headcount stop");
    const day = requireDay(args.day);
    const startedAt = requireTimestamp(args.startedAt, "A headcount start time");
    requireIdListSize(args.presentTravellerIds);
    const { jobCardId, scope } = await loadWritableJobCard(ctx, access, args.jobCardId);
    const travelBatchId = await resolveScopedBatch(ctx, args.travelBatchId, jobCardId, scope);
    const travellers = await loadScopedTravellers(ctx, jobCardId, scope, travelBatchId);
    const present = knownIds(
      args.presentTravellerIds,
      new Map(travellers.map((traveller) => [String(traveller._id), traveller._id]))
    );
    const label = args.label.trim().slice(0, MAX_STOP_LABEL_LENGTH) || "Stop";
    const existing = await ctx.db
      .query("fieldHeadcountStops")
      .withIndex("by_recordedByStaffId_and_jobCardId_and_clientStopId", (q) =>
        q
          .eq("recordedByStaffId", recordedByStaffId)
          .eq("jobCardId", jobCardId)
          .eq("clientStopId", clientStopId)
      )
      .unique();
    const now = Date.now();
    const fields = {
      clientUpdatedAt: args.clientUpdatedAt,
      day,
      expectedTravellerIds: travellers.filter(isTravelling).map((traveller) => traveller._id),
      label,
      presentTravellerIds: present.ids,
      recordedByName: access.name,
      startedAt,
      travelBatchId,
      updatedAt: now,
    };
    if (existing) {
      if (existing.day !== day) {
        throw new ConvexError("A headcount stop cannot move to another day");
      }
      if (isStale(existing, args.clientUpdatedAt)) {
        return { applied: false, id: existing._id, ignoredTravellerIds: present.ignored };
      }
      await patchWithE2eOwnership(ctx, "fieldHeadcountStops", existing._id, fields);
      return { applied: true, id: existing._id, ignoredTravellerIds: present.ignored };
    }
    const id = await insertWithE2eOwnership(ctx, "fieldHeadcountStops", {
      ...fields,
      clientStopId,
      createdAt: now,
      jobCardId,
      recordedByStaffId,
    });
    return { applied: true, id, ignoredTravellerIds: present.ignored };
  },
  returns: v.object({ ...pushResultFields, id: v.id("fieldHeadcountStops") }),
});

export const recordAnnouncement = mutation({
  args: {
    body: v.string(),
    clientAnnouncementId: v.string(),
    clientUpdatedAt: v.optional(v.number()),
    jobCardId: v.string(),
    recipientTravellerIds: v.array(v.string()),
    seenByTravellerIds: v.array(v.string()),
    sharedAt: v.number(),
    travelBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const authorStaffId = requireRecorder(access);
    const clientAnnouncementId = requireClientId(args.clientAnnouncementId, "announcement");
    const body = args.body.trim();
    if (!body || body.length > MAX_ANNOUNCEMENT_LENGTH) {
      throw new ConvexError("An announcement must be 1 to 4000 characters");
    }
    const sharedAt = requireTimestamp(args.sharedAt, "An announcement's sent time");
    requireIdListSize(args.recipientTravellerIds);
    requireIdListSize(args.seenByTravellerIds);
    const { jobCardId, scope } = await loadWritableJobCard(ctx, access, args.jobCardId);
    const travelBatchId = await resolveScopedBatch(ctx, args.travelBatchId, jobCardId, scope);
    const existing = await ctx.db
      .query("fieldAnnouncements")
      .withIndex("by_authorStaffId_and_jobCardId_and_clientAnnouncementId", (q) =>
        q
          .eq("authorStaffId", authorStaffId)
          .eq("jobCardId", jobCardId)
          .eq("clientAnnouncementId", clientAnnouncementId)
      )
      .unique();
    const now = Date.now();
    if (existing) {
      if (
        existing.body !== body ||
        String(existing.travelBatchId ?? "") !== String(travelBatchId ?? "")
      ) {
        throw new ConvexError("An announcement's text and audience cannot change after it is sent");
      }
      const seenUpdate = knownIds(
        args.seenByTravellerIds,
        new Map(
          existing.recipientTravellerIds.map((travellerId) => [String(travellerId), travellerId])
        )
      );
      if (isStale(existing, args.clientUpdatedAt)) {
        return { applied: false, id: existing._id, ignoredTravellerIds: seenUpdate.ignored };
      }
      await patchWithE2eOwnership(ctx, "fieldAnnouncements", existing._id, {
        clientUpdatedAt: args.clientUpdatedAt,
        seenByTravellerIds: seenUpdate.ids,
        updatedAt: now,
      });
      return { applied: true, id: existing._id, ignoredTravellerIds: seenUpdate.ignored };
    }
    const travellers = await loadScopedTravellers(ctx, jobCardId, scope, travelBatchId);
    const recipients = knownIds(
      args.recipientTravellerIds,
      new Map(travellers.map((traveller) => [String(traveller._id), traveller._id]))
    );
    const seenBy = knownIds(
      args.seenByTravellerIds,
      new Map(recipients.ids.map((travellerId) => [String(travellerId), travellerId]))
    );
    const id = await insertWithE2eOwnership(ctx, "fieldAnnouncements", {
      authorName: access.name,
      authorStaffId,
      body,
      clientAnnouncementId,
      clientUpdatedAt: args.clientUpdatedAt,
      createdAt: now,
      jobCardId,
      recipientTravellerIds: recipients.ids,
      seenByTravellerIds: seenBy.ids,
      sharedAt,
      travelBatchId,
      updatedAt: now,
    });
    return { applied: true, id, ignoredTravellerIds: recipients.ignored + seenBy.ignored };
  },
  returns: v.object({ ...pushResultFields, id: v.id("fieldAnnouncements") }),
});

/**
 * Office readers: Operations access plus office scope on the Job Card. A Tour Manager-only
 * grant does not read other people's field records here; the phone keeps its own copy.
 */
async function loadOfficeReadableJobCard(ctx: QueryCtx, rawJobCardId: string) {
  const access = await requireStaff(ctx);
  if (
    !(
      access.permissions.includes(PERMISSIONS.VIEW_OPERATIONS) &&
      access.permissions.includes(PERMISSIONS.VIEW_TRAVELLERS)
    )
  ) {
    return null;
  }
  const jobCardId = ctx.db.normalizeId("jobCards", rawJobCardId);
  const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  return jobCardRecordGrant(access, job, linkedQuery) === "office" ? job : null;
}

async function batchLabels(ctx: QueryCtx, ids: readonly (Id<"travelBatches"> | undefined)[]) {
  const batches = await loadRowsByIdInBatches(ctx, "travelBatches", ids, Math.max(1, ids.length));
  return new Map(
    batches.map((batch) => [
      String(batch._id),
      batch.batchReference.trim() || batch.batchCode.trim() || "Travel batch",
    ])
  );
}

const headcountStopSummaryValidator = v.object({
  batchLabel: v.string(),
  expectedCount: v.number(),
  id: v.id("fieldHeadcountStops"),
  label: v.string(),
  missing: v.array(v.object({ fullName: v.string(), id: v.id("travellers") })),
  presentCount: v.number(),
  recordedByName: v.string(),
  startedAt: v.number(),
  travelBatchId: v.union(v.id("travelBatches"), v.null()),
  updatedAt: v.number(),
});

interface HeadcountDayGroup {
  day: string;
  latest: Doc<"fieldHeadcountStops">[];
  stopCount: number;
}

/** Groups stops (newest first) by day, keeping each recorder's latest stop, up to `dayLimit` days. */
function groupLatestStopsByDay(rows: readonly Doc<"fieldHeadcountStops">[], dayLimit: number) {
  const groups: HeadcountDayGroup[] = [];
  let current: HeadcountDayGroup | undefined;
  for (const row of rows) {
    if (current?.day !== row.day) {
      if (groups.length === dayLimit) {
        break;
      }
      current = { day: row.day, latest: [], stopCount: 0 };
      groups.push(current);
    }
    current.stopCount += 1;
    if (!current.latest.some((stop) => stop.recordedByStaffId === row.recordedByStaffId)) {
      current.latest.push(row);
    }
  }
  return groups;
}

/**
 * Latest headcount per local day, newest day first. Each day lists the most recent stop from
 * each recorder (several tour managers can count different batches of one Job Card). Reads at
 * most the newest 400 stops of the Job Card.
 */
export const listLatestHeadcounts = query({
  args: { dayLimit: v.optional(v.number()), jobCardId: v.string() },
  handler: async (ctx, args) => {
    const job = await loadOfficeReadableJobCard(ctx, args.jobCardId);
    if (!job) {
      return null;
    }
    const dayLimit = Math.min(
      Math.max(Math.floor(args.dayLimit ?? DEFAULT_HEADCOUNT_DAYS), 1),
      MAX_HEADCOUNT_DAYS
    );
    const rows = await ctx.db
      .query("fieldHeadcountStops")
      .withIndex("by_jobCardId_and_day_and_startedAt", (q) => q.eq("jobCardId", job._id))
      .order("desc")
      .take(MAX_HEADCOUNT_ROWS_READ);
    const days = groupLatestStopsByDay(rows, dayLimit);
    const stops = days.flatMap((group) => group.latest);
    const missingIds = stops.flatMap((stop) => {
      const present = new Set(stop.presentTravellerIds.map(String));
      return stop.expectedTravellerIds.filter((id) => !present.has(String(id)));
    });
    const travellers = await loadRowsByIdInBatches(
      ctx,
      "travellers",
      missingIds,
      Math.max(1, missingIds.length)
    );
    const nameById = new Map(travellers.map((row) => [String(row._id), row.fullName]));
    const labels = await batchLabels(
      ctx,
      stops.map((stop) => stop.travelBatchId)
    );
    return days.map((group) => ({
      day: group.day,
      latest: group.latest.map((stop) => {
        const present = new Set(stop.presentTravellerIds.map(String));
        const missing = stop.expectedTravellerIds.filter((id) => !present.has(String(id)));
        return {
          batchLabel: stop.travelBatchId ? (labels.get(String(stop.travelBatchId)) ?? "") : "",
          expectedCount: stop.expectedTravellerIds.length,
          id: stop._id,
          label: stop.label,
          missing: missing.map((id) => ({
            fullName: nameById.get(String(id)) ?? "Removed traveller",
            id,
          })),
          presentCount: stop.expectedTravellerIds.length - missing.length,
          recordedByName: stop.recordedByName,
          startedAt: stop.startedAt,
          travelBatchId: stop.travelBatchId ?? null,
          updatedAt: stop.updatedAt,
        };
      }),
      stopCount: group.stopCount,
    }));
  },
  returns: v.union(
    v.null(),
    v.array(
      v.object({
        day: v.string(),
        latest: v.array(headcountStopSummaryValidator),
        stopCount: v.number(),
      })
    )
  ),
});

const announcementRowValidator = v.object({
  authorName: v.string(),
  batchLabel: v.string(),
  body: v.string(),
  id: v.id("fieldAnnouncements"),
  recipientCount: v.number(),
  seenCount: v.number(),
  sharedAt: v.number(),
  travelBatchId: v.union(v.id("travelBatches"), v.null()),
  updatedAt: v.number(),
});

/** Announcements recorded for a Job Card, newest first. */
export const listAnnouncements = query({
  args: { jobCardId: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const job = await loadOfficeReadableJobCard(ctx, args.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const page = await ctx.db
      .query("fieldAnnouncements")
      .withIndex("by_jobCardId_and_sharedAt", (q) => q.eq("jobCardId", job._id))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const labels = await batchLabels(
      ctx,
      page.page.map((row) => row.travelBatchId)
    );
    return {
      ...page,
      page: page.page.map((row) => ({
        authorName: row.authorName,
        batchLabel: row.travelBatchId ? (labels.get(String(row.travelBatchId)) ?? "") : "",
        body: row.body,
        id: row._id,
        recipientCount: row.recipientTravellerIds.length,
        seenCount: row.seenByTravellerIds.length,
        sharedAt: row.sharedAt,
        travelBatchId: row.travelBatchId ?? null,
        updatedAt: row.updatedAt,
      })),
    };
  },
  returns: paginationResultValidator(announcementRowValidator),
});
