import { makeFunctionReference } from "convex/server";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";
import { internalMutation, internalQuery } from "../../_generated/server";
import { deleteStorageFile } from "../lib/codes";
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
 * Traveller feedback (director decision, 7 Nov 2026) is deleted three years after it was
 * submitted: the response (name, email, comments) and its photos, files and thumbnails in
 * storage. The feedback link (`travelerFeedbackRequests`) holds no personal data and stays with
 * the Job Card. Tour managers' post-tour vendor feedback is not traveller feedback and is not
 * touched here. Run by `jobs.purge_old_feedback`, which is off until the owner switches it on.
 */
const PAGE_SIZE = 50;
// A response holds at most TRAVELER_MAX_PHOTOS (8) photos.
const PHOTO_LIMIT = 32;

const continuePurgeRef = makeFunctionReference<"mutation", { asOf: number; cursor: string }>(
  "crm/retention/feedback:continuePurge"
);

async function deleteResponse(ctx: MutationCtx, response: Doc<"travelerFeedbackResponses">) {
  const photos = await ctx.db
    .query("travelerFeedbackPhotos")
    .withIndex("by_responseId", (q) => q.eq("responseId", response._id))
    .take(PHOTO_LIMIT);
  await Promise.all(
    photos.map(async (photo) => {
      await deleteStorageFile(ctx, photo.storageId, "feedback photo");
      await deleteStorageFile(ctx, photo.thumbnailStorageId, "feedback photo thumbnail");
      await ctx.db.delete("travelerFeedbackPhotos", photo._id);
    })
  );
  await ctx.db.delete("travelerFeedbackResponses", response._id);
}

async function plan(ctx: QueryCtx, asOf: number, cursor: string | null): Promise<RetentionPlan> {
  const cutoff = retentionCutoff(asOf, RETENTION_PERIODS.feedback);
  const page = await ctx.db
    .query("travelerFeedbackResponses")
    .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff.startMs))
    .paginate({ cursor, numItems: PAGE_SIZE });
  return {
    continueCursor: page.isDone ? null : page.continueCursor,
    decisions: page.page.map((response) => ({
      apply: async (writer) => await deleteResponse(writer, response),
      outcome: "deleted_traveller_feedback",
    })),
  };
}

/** Entrypoint dispatched by the `jobs.purge_old_feedback` scheduled job. */
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
