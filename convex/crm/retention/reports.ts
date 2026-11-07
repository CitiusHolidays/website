import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction } from "../../_generated/server";
import { assertMigrationSecret } from "../../migrationAuth";
import type { RetentionCounts } from "../lib/retentionRun";
import { retentionCountsValidator } from "../lib/retentionRun";

/**
 * One call that sums a retention rule's dry-run pages, so the owner can review the numbers
 * before switching a job on. Counts only; nothing is written. Each page is a separate bounded
 * query; `maxPages` bounds the call, and a partial result returns the cursor to continue from.
 * See docs/DATA_RETENTION.md.
 */
const DEFAULT_MAX_PAGES = 50;
const MAX_PAGES_LIMIT = 200;

const DRY_RUN_MODULE_BY_JOB = {
  anonymise_past_travellers: "crm/retention/travellers",
  purge_activity_logs: "crm/retention/activityLogs",
  purge_customer_app_sign_in_links: "crm/customerAppSignInRetention",
  purge_field_passport_audit: "crm/fieldPassportAuditRetention",
  purge_inactive_customer_accounts: "crm/retention/customerAccounts",
  purge_old_feedback: "crm/retention/feedback",
  purge_passport_scans: "crm/retention/passportScans",
  purge_unconverted_enquiries: "crm/retention/enquiries",
  retire_financial_records: "crm/retention/financialRecords",
} as const;

const retentionJobValidator = v.union(
  v.literal("anonymise_past_travellers"),
  v.literal("purge_activity_logs"),
  v.literal("purge_customer_app_sign_in_links"),
  v.literal("purge_field_passport_audit"),
  v.literal("purge_inactive_customer_accounts"),
  v.literal("purge_old_feedback"),
  v.literal("purge_passport_scans"),
  v.literal("purge_unconverted_enquiries"),
  v.literal("retire_financial_records")
);

interface DryRunPage {
  continueCursor: string | null;
  counts: RetentionCounts;
  isDone: boolean;
}

export const summarize = internalAction({
  args: {
    asOf: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
    job: retentionJobValidator,
    maxPages: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const asOf = args.asOf ?? Date.now();
    const maxPages = Math.min(
      Math.max(Math.trunc(args.maxPages ?? DEFAULT_MAX_PAGES), 1),
      MAX_PAGES_LIMIT
    );
    const dryRun = makeFunctionReference<
      "query",
      { asOf: number; cursor: string | null; secret: string },
      DryRunPage
    >(`${DRY_RUN_MODULE_BY_JOB[args.job]}:dryRun`);
    const counts: RetentionCounts = {};
    let cursor = args.cursor ?? null;
    let pagesRead = 0;
    let isDone = false;
    while (!isDone && pagesRead < maxPages) {
      // biome-ignore lint/performance/noAwaitInLoops: each page continues from the previous page's cursor.
      const page = await ctx.runQuery(dryRun, { asOf, cursor, secret: args.secret });
      for (const [outcome, count] of Object.entries(page.counts)) {
        counts[outcome] = (counts[outcome] ?? 0) + count;
      }
      ({ isDone } = page);
      cursor = page.continueCursor;
      pagesRead += 1;
    }
    return { asOf, continueCursor: cursor, counts, isDone, pagesRead };
  },
  returns: v.object({
    asOf: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    counts: retentionCountsValidator,
    isDone: v.boolean(),
    pagesRead: v.number(),
  }),
});
