import { makeFunctionReference } from "convex/server";
import type { QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import {
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "../lib/retentionRun";
import { RETENTION_PERIODS, retentionCutoff } from "../lib/retentionSchedule";

/**
 * Office access logs (`activityLogs`) are kept for one year (director decision, 7 Nov 2026),
 * counted by office date (IST) from `createdAt`. Run by `jobs.purge_activity_logs`, which is
 * off until the owner switches it on.
 */
const PAGE_SIZE = 200;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/activityLogs:continuePurge"
);

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.activityLogs);
  const page = await ctx.db
    .query("activityLogs")
    .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff.startMs))
    .paginate({ cursor, numItems: PAGE_SIZE });
  return {
    continueCursor: page.isDone ? null : page.continueCursor,
    decisions: page.page.map((row) => ({
      apply: async (writer) => {
        await writer.db.delete("activityLogs", row._id);
      },
      outcome: "deleted",
    })),
  };
}

const JOB = {
  continueRef: continuePurgeRef,
  controlKey: "jobs.purge_activity_logs",
  planner: plan,
} as const;

/** Entrypoint dispatched by the `jobs.purge_activity_logs` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await runRetentionPage(ctx, JOB, Date.now(), null),
  returns: retentionRunResult,
});

/** Continues one run in a fresh transaction with the run's fixed `asOf`. */
export const continuePurge = internalMutation({
  args: retentionContinuationArgs,
  handler: async (ctx, args) => await runRetentionPage(ctx, JOB, args.asOf, args.cursor),
  returns: retentionRunResult,
});

/** Dry run: what one page of the job would do at `asOf`, as content-free counts. */
export const dryRun = internalQuery({
  args: retentionReportArgs,
  handler: async (ctx, args) =>
    await reportRetentionPage(args.secret, () => plan(ctx, args.asOf, args.cursor)),
  returns: retentionReportResult,
});
