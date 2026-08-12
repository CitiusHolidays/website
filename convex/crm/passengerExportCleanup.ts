import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { purgePassengerExportSourceChunksRef } from "./passengerExportFunctionReferences";
import { PASSENGER_EXPORT_CLEANUP_BATCH_SIZE } from "./passengerExportPolicy";

export async function purgeExpiredPassengerExportsHandler(ctx: MutationCtx) {
  const now = Date.now();
  const cleanupStatuses = ["completed", "failed", "running"] as const;
  const expired = (
    await Promise.all(
      cleanupStatuses.map((status) =>
        ctx.db
          .query("passengerExportOperations")
          .withIndex("by_status_expiresAt", (indexQuery) =>
            indexQuery.eq("status", status).gte("expiresAt", 0).lt("expiresAt", now)
          )
          .take(PASSENGER_EXPORT_CLEANUP_BATCH_SIZE)
      )
    )
  )
    .flat()
    .slice(0, PASSENGER_EXPORT_CLEANUP_BATCH_SIZE) as Doc<"passengerExportOperations">[];
  await Promise.all(
    expired.map(async (operation) => {
      const expiredStorageId = operation.storageId;
      await ctx.db.patch(operation._id, {
        expiresAt: undefined,
        fileName: undefined,
        leaseExpiresAt: undefined,
        leaseId: undefined,
        sourceChunkCount: 0,
        sourceCursor: undefined,
        sourceDone: undefined,
        status: "expired",
        storageId: undefined,
        updatedAt: now,
      });
      if (expiredStorageId) {
        await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
          storageId: expiredStorageId,
        });
      }
      await ctx.scheduler.runAfter(0, purgePassengerExportSourceChunksRef, {
        expireOperation: false,
        operationId: operation._id,
      });
    })
  );
  const scheduled = expired.length === PASSENGER_EXPORT_CLEANUP_BATCH_SIZE;
  if (scheduled) {
    await ctx.scheduler.runAfter(0, internal.crm.imports.purgeExpiredPassengerExports, {});
  }
  return { expired: expired.length, scheduled };
}
