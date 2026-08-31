import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import { PERMISSIONS } from "./lib/rolePolicy";
import { requireStaff } from "./lib/staffAccess";
import {
  loadPassportCleanupRetryTarget,
  queueEncryptedCleanupRetry,
  queuePlaintextCleanupRetry,
} from "./passportCleanupRetry";

const passportCleanupTargetValidator = v.union(
  v.object({
    kind: v.literal("passport_upload_cleanup"),
    ticketId: v.id("passportUploadTickets"),
  }),
  v.object({
    cleanupRecordId: v.id("passportUploadCleanupRecords"),
    kind: v.literal("passport_encrypted_cleanup"),
  })
);

export const retryPassportCleanup = mutation({
  args: {
    cleanup: passportCleanupTargetValidator,
    commandId: v.string(),
    expectedUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    const target = await loadPassportCleanupRetryTarget(ctx, access, args.cleanup);
    if (!target) {
      throw new ConvexError("PASSPORT_CLEANUP_RETRY_UNAVAILABLE");
    }
    const command = await resolveCommandReceipt(ctx, {
      access,
      commandId: args.commandId,
      operation: "passport_cleanup_retry",
      payload: {
        cleanup: args.cleanup,
        expectedUpdatedAt: args.expectedUpdatedAt,
      },
      targetId: target.targetId,
    });
    if (command.replayedResultId) {
      return { queued: true, replayed: true };
    }
    const expectedStatus =
      args.cleanup.kind === "passport_upload_cleanup" ? "cleanup_degraded" : "degraded";
    if (
      !Number.isSafeInteger(args.expectedUpdatedAt) ||
      args.expectedUpdatedAt < 0 ||
      target.updatedAt !== args.expectedUpdatedAt ||
      target.status !== expectedStatus ||
      target.failureCode !== "cleanup_failed" ||
      !target.residualPresent
    ) {
      throw new ConvexError("PASSPORT_CLEANUP_RETRY_STALE");
    }
    const queued =
      args.cleanup.kind === "passport_upload_cleanup"
        ? await queuePlaintextCleanupRetry(ctx, args.cleanup.ticketId)
        : await queueEncryptedCleanupRetry(ctx, args.cleanup.cleanupRecordId);
    if (!queued.queued) {
      throw new ConvexError("PASSPORT_CLEANUP_RETRY_STALE");
    }
    await storeCommandReceipt(ctx, {
      actorKey: command.actorKey,
      commandId: args.commandId,
      operation: "passport_cleanup_retry",
      payloadDigest: command.payloadDigest,
      resultId: target.targetId,
      targetId: target.targetId,
    });
    return { queued: true, replayed: false };
  },
  returns: v.object({ queued: v.boolean(), replayed: v.boolean() }),
});
