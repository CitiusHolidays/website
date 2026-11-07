import { makeFunctionReference } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { fieldPassportWindow } from "./fieldPassports";
import {
  type RetentionDecision,
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "./lib/retentionRun";
import {
  FIELD_PASSPORT_AUDIT_RETENTION_DAYS,
  RETENTION_DAY_MS,
  tripDates,
} from "./lib/retentionSchedule";

/**
 * Field passport audit retention (director decision, 7 Nov 2026): a row is kept for one year
 * after the trip is over. The trip is over when its field passport window closes (24:00 IST on
 * the day after travel ends), so a row is kept until that close plus 365 days. Each row stores
 * the close as `tripClosesAt` and the deletion time as `retainUntil`.
 *
 * A run re-reads the trip's current dates before deleting, so a trip extended after the passport
 * was opened keeps its rows until a year after the new close. A trip that has lost its dates is
 * never purged; its rows are looked at again after `UNDATED_RECHECK_DAYS`. A row whose Job Card
 * is gone keeps the close it recorded: rows written before `tripClosesAt` existed stored the
 * close in `retainUntil`, and rows older than both fall back to the read time.
 */
export const FIELD_PASSPORT_AUDIT_RETENTION_BATCH_SIZE = 100;
const UNDATED_RECHECK_DAYS = 30;
const RETENTION_MS = FIELD_PASSPORT_AUDIT_RETENTION_DAYS * RETENTION_DAY_MS;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/fieldPassportAuditRetention:continuePurge"
);

/** The time a row may be deleted: one year after its trip's passport window closes. */
export function fieldPassportAuditRetainUntil(tripClosesAt: number) {
  return tripClosesAt + RETENTION_MS;
}

async function decide(
  ctx: QueryCtx,
  row: Doc<"fieldPassportAccessAudit">,
  asOf: number
): Promise<RetentionDecision> {
  const job = await ctx.db.get("jobCards", row.jobCardId);
  let tripClosesAt: number;
  if (job) {
    const batch = row.travelBatchId ? await ctx.db.get("travelBatches", row.travelBatchId) : null;
    const close = fieldPassportWindow(tripDates(job, batch))?.closesAt ?? null;
    if (close === null) {
      return {
        apply: async (writer) => {
          await writer.db.patch("fieldPassportAccessAudit", row._id, {
            retainUntil: asOf + UNDATED_RECHECK_DAYS * RETENTION_DAY_MS,
          });
        },
        outcome: "kept_undated",
      };
    }
    tripClosesAt = close;
  } else {
    tripClosesAt = row.tripClosesAt ?? row.retainUntil ?? row.accessedAt;
  }
  const retainUntil = fieldPassportAuditRetainUntil(tripClosesAt);
  if (retainUntil >= asOf) {
    return {
      apply: async (writer) => {
        await writer.db.patch("fieldPassportAccessAudit", row._id, { retainUntil, tripClosesAt });
      },
      outcome: "kept_trip_recent",
    };
  }
  return {
    apply: async (writer) => {
      await writer.db.delete("fieldPassportAccessAudit", row._id);
    },
    outcome: "deleted",
  };
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  // Rows without `retainUntil` sort first in the index and are looked at by every run.
  const page = await ctx.db
    .query("fieldPassportAccessAudit")
    .withIndex("by_retainUntil", (q) => q.lt("retainUntil", asOf))
    .paginate({ cursor, numItems: FIELD_PASSPORT_AUDIT_RETENTION_BATCH_SIZE });
  return {
    continueCursor: page.isDone ? null : page.continueCursor,
    decisions: await Promise.all(page.page.map((row) => decide(ctx, row, asOf))),
  };
}

/** Daily entrypoint dispatched by the `jobs.purge_field_passport_audit` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionPage(ctx, plan, continuePurgeRef, Date.now(), null),
  returns: retentionRunResult,
});

/** Continues one run in a fresh transaction with the run's fixed `asOf`. */
export const continuePurge = internalMutation({
  args: retentionContinuationArgs,
  handler: async (ctx, args) =>
    await runRetentionPage(ctx, plan, continuePurgeRef, args.asOf, args.cursor),
  returns: retentionRunResult,
});

/** Dry run: what one page of the job would do at `asOf`, as content-free counts. */
export const dryRun = internalQuery({
  args: retentionReportArgs,
  handler: async (ctx, args) =>
    await reportRetentionPage(args.secret, () => plan(ctx, args.asOf, args.cursor)),
  returns: retentionReportResult,
});
