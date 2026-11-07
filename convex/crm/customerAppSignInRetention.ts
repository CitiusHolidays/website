import { makeFunctionReference } from "convex/server";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { SIGN_IN_LINK_ROW_TTL_MS } from "../lib/customerAppSignIn";
import { deleteSignInVerifications } from "../lib/customerAppSignInVerification";
import {
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "./lib/retentionRun";

/**
 * Customer app sign-in link requests (ADR 0020) live one day: long enough to count the hourly
 * limits and outlive the 10-minute link. Each row holds digests only (address, device, token);
 * this daily job deletes rows older than a day, a bounded page at a time, with the Better Auth
 * verification row of each link, which holds the address in plain text.
 */
export const CUSTOMER_APP_SIGN_IN_RETENTION_BATCH_SIZE = 200;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/customerAppSignInRetention:continuePurge"
);

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const page = await ctx.db
    .query("customerAppSignInLinks")
    .withIndex("by_requestedAt", (q) => q.lt("requestedAt", asOf - SIGN_IN_LINK_ROW_TTL_MS))
    .paginate({ cursor, numItems: CUSTOMER_APP_SIGN_IN_RETENTION_BATCH_SIZE });
  return {
    continueCursor: page.isDone ? null : page.continueCursor,
    decisions: page.page.map((row) => ({
      apply: async (writer) => {
        // The link's verification row holds the address even once expired; it goes too.
        await deleteSignInVerifications(writer, [row.tokenDigest]);
        await writer.db.delete("customerAppSignInLinks", row._id);
      },
      outcome: "deleted",
    })),
  };
}

const JOB = {
  continueRef: continuePurgeRef,
  controlKey: "jobs.purge_customer_app_sign_in_links",
  planner: plan,
} as const;

/** Daily entrypoint dispatched by the `jobs.purge_customer_app_sign_in_links` scheduled job. */
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
