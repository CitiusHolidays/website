import { makeFunctionReference } from "convex/server";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { scheduleCrmMetricSync } from "../financeMetricSync";
import { deleteStorageFile } from "../lib/codes";
import {
  type RetentionDecision,
  type RetentionPlan,
  reportRetentionPage,
  retentionContinuationArgs,
  retentionReportArgs,
  retentionReportResult,
  retentionRunResult,
  runRetentionPage,
} from "../lib/retentionRun";
import { RETENTION_PERIODS, retentionCutoff, tripRetentionVerdict } from "../lib/retentionSchedule";
import { tripEndLookup } from "../lib/retentionTrips";

/**
 * Passport scans (director decision, 7 Nov 2026) are deleted 90 days after the trip ends: the
 * scan file in storage and the whole `passportDetails` row, which holds the encrypted passport
 * payload, the number hash, the last four digits, the expiry date and the file name. The last
 * four digits exist so staff can recognise the right passport while it is in use; with the scan
 * gone there is nothing to recognise, so they go too. The traveller keeps the content-free
 * status word (`passportStatus`, for example "Received") so the trip history still shows that
 * the passport was collected; `hasPassportScan` and the expiry date copy are cleared.
 *
 * A traveller whose trip has no dates, whose Job Card is gone, or who no longer exists is kept
 * and counted. Run by `jobs.purge_passport_scans`, which is off until the owner switches it on.
 */
const PAGE_SIZE = 50;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/passportScans:continuePurge"
);

async function deletePassport(ctx: MutationCtx, passport: Doc<"passportDetails">) {
  await deleteStorageFile(ctx, passport.storageId, "passport scan");
  await ctx.db.delete("passportDetails", passport._id);
  await ctx.db.patch("travellers", passport.travellerId, {
    hasPassportScan: false,
    passportExpiryDate: undefined,
  });
  await scheduleCrmMetricSync(ctx, "travellers", String(passport.travellerId));
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.passportScansAfterTrip);
  const trips = tripEndLookup(ctx);
  const page = await ctx.db.query("passportDetails").paginate({ cursor, numItems: PAGE_SIZE });
  const decisions = await Promise.all(
    page.page.map(async (passport): Promise<RetentionDecision> => {
      const traveller = await ctx.db.get("travellers", passport.travellerId);
      if (!traveller) {
        return { outcome: "kept_no_traveller" };
      }
      const end = await trips.forTraveller(traveller);
      if (end === "missing") {
        return { outcome: "kept_no_job_card" };
      }
      const verdict = tripRetentionVerdict(end, cutoff);
      if (verdict !== "expired") {
        return { outcome: verdict };
      }
      return {
        apply: async (writer) => await deletePassport(writer, passport),
        outcome: "deleted",
      };
    })
  );
  return { continueCursor: page.isDone ? null : page.continueCursor, decisions };
}

/** Entrypoint dispatched by the `jobs.purge_passport_scans` scheduled job. */
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
