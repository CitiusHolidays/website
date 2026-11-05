import { makeFunctionReference } from "convex/server";
import { type ObjectType, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { workDateFor } from "./officeCheckInVerification";

/**
 * Office check-in retention (decision 2026-11-05): attendance evidence is kept
 * for three months, implemented as 92 days. Check-ins are expired by their
 * office-default-time-zone work date; attendance audit events by their `at`
 * timestamp. Configuration history (`rule_saved`, `office_created`) is kept.
 */
export const OFFICE_CHECK_IN_RETENTION_DAYS = 92;
export const CHECK_IN_RETENTION_BATCH_SIZE = 100;
export const AUDIT_RETENTION_PAGE_SIZE = 200;

const DAY_MS = 24 * 60 * 60 * 1000;
const WORK_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type AuditKind = Doc<"officeCheckInAudit">["kind"];

export const RETAINED_CONFIGURATION_AUDIT_KINDS: ReadonlySet<AuditKind> = new Set<AuditKind>([
  "office_created",
  "rule_saved",
]);

const retentionCursorArgs = {
  auditBefore: v.number(),
  auditCursor: v.union(v.string(), v.null()),
  workDateBefore: v.string(),
};

type RetentionCursor = ObjectType<typeof retentionCursorArgs>;

interface RetentionBatchResult {
  deletedAuditEvents: number;
  deletedCheckIns: number;
  scheduledContinuation: boolean;
}

const continuePurgeRef = makeFunctionReference<"mutation", RetentionCursor, RetentionBatchResult>(
  "crm/officeCheckInRetention:continuePurge"
);

/** The first work date that is still retained, in the office default time zone. */
export function retainedWorkDateFrom(now: number) {
  const today = workDateFor(now);
  const match = WORK_DATE_PATTERN.exec(today);
  if (!match) {
    throw new Error(`Unexpected office work date format: ${today}`);
  }
  const cutoff = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) - OFFICE_CHECK_IN_RETENTION_DAYS
    )
  );
  return cutoff.toISOString().slice(0, 10);
}

function retentionCursorFor(now: number): RetentionCursor {
  return {
    auditBefore: now - OFFICE_CHECK_IN_RETENTION_DAYS * DAY_MS,
    auditCursor: null,
    workDateBefore: retainedWorkDateFrom(now),
  };
}

async function purgeCheckInBatch(ctx: MutationCtx, workDateBefore: string) {
  const expired = await ctx.db
    .query("officeCheckIns")
    .withIndex("by_workDate", (q) => q.lt("workDate", workDateBefore))
    .take(CHECK_IN_RETENTION_BATCH_SIZE);
  await Promise.all(expired.map((row) => ctx.db.delete("officeCheckIns", row._id)));
  return { deleted: expired.length, hasMore: expired.length === CHECK_IN_RETENTION_BATCH_SIZE };
}

async function purgeAuditPage(ctx: MutationCtx, auditBefore: number, cursor: string | null) {
  // Retained configuration events stay inside the expired range, so the scan
  // advances by cursor instead of re-reading the head of the range each batch.
  const page = await ctx.db
    .query("officeCheckInAudit")
    .withIndex("by_at", (q) => q.lt("at", auditBefore))
    .paginate({ cursor, numItems: AUDIT_RETENTION_PAGE_SIZE });
  const expired = page.page.filter((row) => !RETAINED_CONFIGURATION_AUDIT_KINDS.has(row.kind));
  await Promise.all(expired.map((row) => ctx.db.delete("officeCheckInAudit", row._id)));
  return {
    deleted: expired.length,
    nextCursor: page.isDone ? null : page.continueCursor,
  };
}

async function runRetentionBatch(
  ctx: MutationCtx,
  cursor: RetentionCursor
): Promise<RetentionBatchResult> {
  const [checkIns, audit] = await Promise.all([
    purgeCheckInBatch(ctx, cursor.workDateBefore),
    purgeAuditPage(ctx, cursor.auditBefore, cursor.auditCursor),
  ]);
  // A finished audit scan restarts from the beginning only while check-ins
  // remain; that rescan sees nothing but retained configuration rows.
  const scheduledContinuation = checkIns.hasMore || audit.nextCursor !== null;
  if (scheduledContinuation) {
    await ctx.scheduler.runAfter(0, continuePurgeRef, {
      auditBefore: cursor.auditBefore,
      auditCursor: audit.nextCursor,
      workDateBefore: cursor.workDateBefore,
    });
  }
  return {
    deletedAuditEvents: audit.deleted,
    deletedCheckIns: checkIns.deleted,
    scheduledContinuation,
  };
}

const retentionBatchResult = v.object({
  deletedAuditEvents: v.number(),
  deletedCheckIns: v.number(),
  scheduledContinuation: v.boolean(),
});

/** Daily entrypoint dispatched by the `jobs.purge_office_check_ins` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionBatch(ctx, retentionCursorFor(Date.now())),
  returns: retentionBatchResult,
});

/** Continues one retention run in a fresh transaction with the run's fixed cutoffs. */
export const continuePurge = internalMutation({
  args: retentionCursorArgs,
  handler: async (ctx, args) => await runRetentionBatch(ctx, args),
  returns: retentionBatchResult,
});
