import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { assertE2eSecret, assertE2eTargetIdentity } from "./lib/e2eAuth";
import { E2E_CLEANUP_TABLE_ORDER, type E2eCleanupTableName } from "./lib/e2eOwnership";
import {
  deleteNotificationReadWithProjection,
  deleteNotificationWithProjection,
} from "./notificationUnreadProjection";

const RUN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const CLEANUP_PAGE_MAX = 50;

const cleanupResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
  residualCount: v.number(),
  runId: v.string(),
});

export const begin = internalMutation({
  args: {
    authUserIds: v.array(v.string()),
    runId: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    assertE2eSecret();
    const identity = assertE2eTargetIdentity(args.targetId);
    if (!RUN_ID_PATTERN.test(args.runId) || args.authUserIds.length === 0) {
      throw new ConvexError("Invalid E2E run identity");
    }
    const { target } = identity;
    const existingRun = await ctx.db
      .query("e2eRuns")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (existingRun) {
      throw new ConvexError("E2E run identity is already registered");
    }
    const activeActors = await Promise.all(
      args.authUserIds.map((authUserId) =>
        ctx.db
          .query("e2eRunActors")
          .withIndex("by_authUserId_status", (q) =>
            q.eq("authUserId", authUserId).eq("status", "active")
          )
          .first()
      )
    );
    for (const active of activeActors) {
      if (active) {
        throw new ConvexError(`E2E actor already belongs to unfinished run ${active.runId}`);
      }
    }
    const now = Date.now();
    await ctx.db.insert("e2eRuns", {
      createdAt: now,
      mutatedCount: 0,
      ownedCount: 0,
      runId: args.runId,
      status: "active",
      target,
      targetId: identity.targetId,
      updatedAt: now,
    });
    await Promise.all(
      args.authUserIds.map((authUserId) =>
        ctx.db.insert("e2eRunActors", {
          authUserId,
          createdAt: now,
          runId: args.runId,
          status: "active",
        })
      )
    );
    return { runId: args.runId, target, targetId: identity.targetId };
  },
  returns: v.object({
    runId: v.string(),
    target: v.union(v.literal("development"), v.literal("preview")),
    targetId: v.string(),
  }),
});

export const cleanupPage = internalMutation({
  args: { pageSize: v.number(), runId: v.string(), targetId: v.string() },
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cleanup is one bounded persisted state transition
  handler: async (ctx, args) => {
    assertE2eSecret();
    assertE2eTargetIdentity(args.targetId);
    const pageSize = Math.min(CLEANUP_PAGE_MAX, Math.max(1, Math.trunc(args.pageSize)));
    const run = await ctx.db
      .query("e2eRuns")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (!run) {
      throw new ConvexError("E2E run not found");
    }
    if (run.targetId !== args.targetId) {
      throw new ConvexError("E2E run target identity does not match");
    }
    if (run.status === "complete") {
      return { complete: true, deleted: 0, residualCount: 0, runId: args.runId };
    }
    const records = await ctx.db
      .query("e2eOwnedRecords")
      .withIndex("by_runId_cleanupOrder_createdAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(pageSize);
    for (const record of records) {
      if (!(record.tableName in E2E_CLEANUP_TABLE_ORDER)) {
        throw new ConvexError(`No reviewed cleanup strategy for owned table ${record.tableName}`);
      }
      const tableName = record.tableName as E2eCleanupTableName;
      const documentId = ctx.db.normalizeId(tableName, record.documentId);
      // The workflow may intentionally delete an owned record before teardown.
      // Treat that as already-clean instead of stranding the resumable ledger.
      // biome-ignore lint/performance/noAwaitInLoops: reviewed table order preserves dependencies
      const existingDocument = documentId ? await ctx.db.get(tableName, documentId) : null;
      if (documentId && existingDocument) {
        if (tableName === "notificationReads") {
          await deleteNotificationReadWithProjection(
            ctx,
            existingDocument as Doc<"notificationReads">
          );
        } else if (tableName === "notifications") {
          await deleteNotificationWithProjection(ctx, existingDocument as Doc<"notifications">);
        } else {
          await ctx.db.delete(tableName as never, documentId as never);
        }
      }
      await Promise.all(
        record.storageIds.map(async (storageId) => {
          try {
            await ctx.storage.delete(storageId);
          } catch {
            // Idempotent cleanup accepts an already-removed storage object.
          }
        })
      );
      await ctx.db.delete("e2eOwnedRecords", record._id);
    }
    const remainingOwned = Math.max(0, run.ownedCount - records.length);
    let restored = 0;
    if (remainingOwned === 0) {
      const snapshots = await ctx.db
        .query("e2eMutatedRecords")
        .withIndex("by_runId_createdAt", (q) => q.eq("runId", args.runId))
        .order("desc")
        .take(pageSize);
      for (const snapshot of snapshots) {
        if (!(snapshot.tableName in E2E_CLEANUP_TABLE_ORDER)) {
          throw new ConvexError(
            `No reviewed restore strategy for mutated table ${snapshot.tableName}`
          );
        }
        const tableName = snapshot.tableName as E2eCleanupTableName;
        const documentId = ctx.db.normalizeId(tableName, snapshot.documentId);
        // biome-ignore lint/performance/noAwaitInLoops: snapshots must validate and restore in reverse order
        if (!(documentId && (await ctx.db.get(tableName, documentId)))) {
          throw new ConvexError(`Cannot restore missing E2E-mutated ${tableName} record`);
        }
        await ctx.db.replace(tableName, documentId, snapshot.originalValue);
        await ctx.db.delete("e2eMutatedRecords", snapshot._id);
        restored += 1;
      }
    }
    const remainingMutated = Math.max(0, run.mutatedCount - restored);
    const residualCount = remainingOwned + remainingMutated;
    const complete = residualCount === 0;
    const now = Date.now();
    await ctx.db.patch("e2eRuns", run._id, {
      ...(complete ? { completedAt: now } : {}),
      mutatedCount: remainingMutated,
      ownedCount: remainingOwned,
      status: complete ? "complete" : "cleaning",
      updatedAt: now,
    });
    if (complete) {
      const actors = await ctx.db
        .query("e2eRunActors")
        .withIndex("by_runId", (q) => q.eq("runId", args.runId))
        .collect();
      await Promise.all(
        actors.map((actor) => ctx.db.patch("e2eRunActors", actor._id, { status: "complete" }))
      );
    }
    return { complete, deleted: records.length, residualCount, runId: args.runId };
  },
  returns: cleanupResultValidator,
});

export interface E2eCleanupResult {
  complete: boolean;
  deleted: number;
  residualCount: number;
  runId: string;
}
