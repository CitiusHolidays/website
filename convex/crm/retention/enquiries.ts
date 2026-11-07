import { makeFunctionReference } from "convex/server";
import type { QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { deleteEntityNotifications } from "../lib/notifications";
import {
  decodePhaseCursor,
  nextPhaseCursor,
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
 * Website enquiries that never became a Query (director decision, 7 Nov 2026) are deleted two
 * years after they were created: inbound intents still `pending` or `dismissed`. A converted
 * intent is part of its Query's history and is never touched here. The intent's bell rows go
 * with it; its `crmHandoffEvents` row holds no personal data and stays for the handoff counts.
 * Run by `jobs.purge_unconverted_enquiries`, which is off until the owner switches it on.
 */
const PAGE_SIZE = 100;
const PHASES = ["pending", "dismissed"] as const;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/enquiries:continuePurge"
);

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.unconvertedEnquiries);
  const position = decodePhaseCursor(cursor, PHASES);
  const page = await ctx.db
    .query("inboundQueryIntents")
    .withIndex("by_status_createdAt", (q) =>
      q.eq("status", position.phase).lt("createdAt", cutoff.startMs)
    )
    .paginate({ cursor: position.cursor, numItems: PAGE_SIZE });
  return {
    continueCursor: nextPhaseCursor(PHASES, position.phase, page),
    decisions: page.page.map((intent) => {
      if (intent.convertedQueryId || intent.convertedAt !== undefined) {
        return { outcome: "kept_converted" };
      }
      return {
        apply: async (writer) => {
          await deleteEntityNotifications(writer, "inboundQueryIntent", String(intent._id));
          await writer.db.delete("inboundQueryIntents", intent._id);
        },
        outcome: "deleted",
      };
    }),
  };
}

/** Entrypoint dispatched by the `jobs.purge_unconverted_enquiries` scheduled job. */
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
