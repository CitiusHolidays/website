import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { fieldPassportWindow, tripDates } from "./fieldPassports";

/**
 * Field passport audit retention (owner decision, 7 Nov 2026): a row is kept until the trip is
 * over, which is the close of the field passport window (24:00 IST on the day after travel ends).
 * Each row stores that close as `retainUntil`. A run re-reads the trip's current dates before
 * deleting, so a trip extended after the passport was opened keeps its rows until the new close;
 * a row whose Job Card is gone, or whose trip has no dates any more, is past its trip and goes.
 * Rows written before `retainUntil` existed sort first in the index and are handled the same way.
 */
export const FIELD_PASSPORT_AUDIT_RETENTION_BATCH_SIZE = 100;

const continuePurgeRef = makeFunctionReference<
  "mutation",
  { before: number },
  FieldPassportAuditRetentionResult
>("crm/fieldPassportAuditRetention:continuePurge");

interface FieldPassportAuditRetentionResult {
  deleted: number;
  kept: number;
  scheduledContinuation: boolean;
}

async function currentTripClose(ctx: MutationCtx, row: Doc<"fieldPassportAccessAudit">) {
  const job = await ctx.db.get("jobCards", row.jobCardId);
  if (!job) {
    return null;
  }
  const batch = row.travelBatchId ? await ctx.db.get("travelBatches", row.travelBatchId) : null;
  return fieldPassportWindow(tripDates(job, batch))?.closesAt ?? null;
}

async function purgeBatch(
  ctx: MutationCtx,
  before: number
): Promise<FieldPassportAuditRetentionResult> {
  const rows = await ctx.db
    .query("fieldPassportAccessAudit")
    .withIndex("by_retainUntil", (q) => q.lt("retainUntil", before))
    .take(FIELD_PASSPORT_AUDIT_RETENTION_BATCH_SIZE);
  const outcomes = await Promise.all(
    rows.map(async (row) => {
      const close = await currentTripClose(ctx, row);
      if (close !== null && close >= before) {
        // The trip is not over yet (dates moved later); keep the row until the new close.
        await ctx.db.patch("fieldPassportAccessAudit", row._id, { retainUntil: close });
        return "kept" as const;
      }
      await ctx.db.delete("fieldPassportAccessAudit", row._id);
      return "deleted" as const;
    })
  );
  const kept = outcomes.filter((outcome) => outcome === "kept").length;
  const deleted = outcomes.length - kept;
  const scheduledContinuation = rows.length === FIELD_PASSPORT_AUDIT_RETENTION_BATCH_SIZE;
  if (scheduledContinuation) {
    await ctx.scheduler.runAfter(0, continuePurgeRef, { before });
  }
  return { deleted, kept, scheduledContinuation };
}

const retentionResult = v.object({
  deleted: v.number(),
  kept: v.number(),
  scheduledContinuation: v.boolean(),
});

/** Daily entrypoint dispatched by the `jobs.purge_field_passport_audit` scheduled job. */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => await purgeBatch(ctx, Date.now()),
  returns: retentionResult,
});

/** Continues one run in a fresh transaction with the run's fixed cutoff. */
export const continuePurge = internalMutation({
  args: { before: v.number() },
  handler: async (ctx, args) => await purgeBatch(ctx, args.before),
  returns: retentionResult,
});
