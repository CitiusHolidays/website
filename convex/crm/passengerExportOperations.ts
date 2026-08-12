import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { getVisibleJob } from "./importProcessor";
import type { PortalAccess } from "./lib";
import { createActivity, requireStaff } from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { purgePassengerExportSourceChunksRef } from "./passengerExportFunctionReferences";
import {
  PASSENGER_EXPORT_ARTIFACT_TTL_MS,
  PASSENGER_EXPORT_CLEANUP_BATCH_SIZE,
  PASSENGER_EXPORT_LEASE_MS,
} from "./passengerExportPolicy";
import { canViewPassengerKinds } from "./passengerKindPolicy";

export interface BeginPassengerExportOperationArgs {
  access: PortalAccess;
  commandId: string;
  exportKind: string;
  jobCardId: Doc<"jobCards">["_id"];
  leaseId: string;
}

export const passengerExportOperationDocumentValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("passengerExportOperations"),
  attemptCount: v.number(),
  commandId: v.string(),
  completedAt: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  exportKind: v.string(),
  fileName: v.optional(v.string()),
  initiatedBy: v.string(),
  initiatedByStaffId: v.optional(v.id("staffUsers")),
  jobCardId: v.id("jobCards"),
  jobCode: v.optional(v.string()),
  leaseExpiresAt: v.optional(v.number()),
  leaseId: v.optional(v.string()),
  rowsProcessed: v.number(),
  sourceChunkCount: v.optional(v.number()),
  sourceCursor: v.optional(v.string()),
  sourceDone: v.optional(v.boolean()),
  startedAt: v.number(),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("expired")
  ),
  storageId: v.optional(v.id("_storage")),
  updatedAt: v.number(),
});

const sourceChunkValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("passengerExportSourceChunks"),
  continueCursor: v.string(),
  createdAt: v.number(),
  cursorStart: v.string(),
  isDone: v.boolean(),
  operationId: v.id("passengerExportOperations"),
  pageIndex: v.number(),
  rowCount: v.number(),
  storageId: v.id("_storage"),
});

export async function beginPassengerExportOperationHandler(
  ctx: MutationCtx,
  args: BeginPassengerExportOperationArgs
) {
  if (!canViewPassengerKinds(args.access, [args.exportKind])) {
    throw new ConvexError("FORBIDDEN");
  }
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, args.access, jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const now = Date.now();
  const initiatedBy = args.access.authUserId ?? args.access.email;
  const existing = await ctx.db
    .query("passengerExportOperations")
    .withIndex("by_initiatedBy_exportKind_jobCardId_commandId", (indexQuery) =>
      indexQuery
        .eq("initiatedBy", initiatedBy)
        .eq("exportKind", args.exportKind)
        .eq("jobCardId", jobCardId)
        .eq("commandId", args.commandId)
    )
    .unique();
  if (existing) {
    const canTakeOver =
      existing.status === "failed" ||
      (existing.status === "running" && (existing.leaseExpiresAt ?? 0) <= now);
    if (canTakeOver) {
      const rejectedStorageId = existing.storageId;
      await ctx.db.patch(existing._id, {
        attemptCount: (existing.attemptCount ?? 0) + 1,
        completedAt: undefined,
        errorCode: undefined,
        expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
        fileName: undefined,
        leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
        leaseId: args.leaseId,
        startedAt: now,
        status: "running",
        storageId: undefined,
        updatedAt: now,
      });
      if (rejectedStorageId) {
        await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
          storageId: rejectedStorageId,
        });
      }
      return { operationId: existing._id, replayed: false };
    }
    return { operationId: existing._id, replayed: true };
  }
  const operationId = await insertWithE2eOwnership(ctx, "passengerExportOperations", {
    attemptCount: 1,
    commandId: args.commandId,
    expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
    exportKind: args.exportKind,
    initiatedBy,
    ...(args.access.staffId ? { initiatedByStaffId: args.access.staffId } : {}),
    jobCardId,
    leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
    leaseId: args.leaseId,
    rowsProcessed: 0,
    sourceChunkCount: 0,
    sourceCursor: "",
    sourceDone: false,
    startedAt: now,
    status: "running",
    updatedAt: now,
  });
  return { operationId, replayed: false };
}

export async function completePassengerExportOperationHandler(
  ctx: MutationCtx,
  args: {
    leaseId: string;
    operationId: Doc<"passengerExportOperations">["_id"];
    rowsProcessed: number;
  }
) {
  const operation = await ctx.db.get(args.operationId);
  if (
    !(operation?.storageId && operation.fileName) ||
    operation.leaseId !== args.leaseId ||
    operation.status !== "running"
  ) {
    throw new ConvexError("Export artifact was not staged");
  }
  const now = Date.now();
  await patchWithE2eOwnership(ctx, "passengerExportOperations", args.operationId, {
    completedAt: now,
    expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
    leaseExpiresAt: undefined,
    leaseId: undefined,
    rowsProcessed: args.rowsProcessed,
    status: "completed",
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, purgePassengerExportSourceChunksRef, {
    expireOperation: false,
    operationId: args.operationId,
  });
  return null;
}

export async function getAuthorizedPassengerExportOperationHandler(
  ctx: QueryCtx,
  args: { access: PortalAccess; operationId: string }
) {
  const operationId = ctx.db.normalizeId("passengerExportOperations", args.operationId);
  const operation = operationId ? await ctx.db.get(operationId) : null;
  if (
    !operation ||
    operation.initiatedBy !== (args.access.authUserId ?? args.access.email) ||
    !canViewPassengerKinds(args.access, [operation.exportKind])
  ) {
    throw new ConvexError("FORBIDDEN");
  }
  const job = await getVisibleJob(ctx, args.access, operation.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  return operation;
}

export async function listMyPassengerExportOperationsHandler(
  ctx: QueryCtx,
  args: { referenceNow?: number }
) {
  const access = await requireStaff(ctx);
  const initiatedBy = access.authUserId ?? access.email;
  const referenceNow = args.referenceNow ?? Date.now();
  const operations = await ctx.db
    .query("passengerExportOperations")
    .withIndex("by_initiatedBy_updatedAt", (q) => q.eq("initiatedBy", initiatedBy))
    .order("desc")
    .take(12);
  const visibleOperations = await Promise.all(
    operations.map(async (operation) => {
      if (!canViewPassengerKinds(access, [operation.exportKind])) {
        return null;
      }
      const job = await getVisibleJob(ctx, access, operation.jobCardId);
      if (!job) {
        return null;
      }
      return {
        commandId: operation.commandId,
        completedAt: operation.completedAt,
        errorCode: operation.errorCode,
        exportKind: operation.exportKind,
        fileName: operation.fileName,
        id: operation._id,
        jobCardId: operation.jobCardId,
        rowsProcessed: operation.rowsProcessed,
        stalled: operation.status === "running" && referenceNow - operation.updatedAt > 120_000,
        startedAt: operation.startedAt,
        status:
          operation.status === "completed" &&
          operation.expiresAt !== undefined &&
          operation.expiresAt <= referenceNow
            ? ("expired" as const)
            : operation.status,
        updatedAt: operation.updatedAt,
      };
    })
  );
  return visibleOperations.filter((operation) => operation !== null);
}

export async function logPassengerExportHandler(
  ctx: MutationCtx,
  args: {
    access: PortalAccess;
    exportKind?: string;
    jobCardId: Doc<"jobCards">["_id"];
    rowCount: number;
  }
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    return null;
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  const exportedKind = args.exportKind ?? "passenger";
  let exportedLabel = `${exportedKind} rows`;
  if (exportedKind === "passenger") {
    exportedLabel = "passengers";
  } else if (exportedKind === "traveller") {
    exportedLabel = "travellers";
  }
  await createActivity(ctx, args.access, {
    action: "exported",
    entityId: jobCardId,
    entityType: "traveller",
    message: `${args.rowCount} ${exportedLabel} exported for ${job.jobCode}`,
  });
  return null;
}

export async function updatePassengerExportOperationHandler(
  ctx: MutationCtx,
  args: {
    leaseId: string;
    operationId: Doc<"passengerExportOperations">["_id"];
    rowsProcessed: number;
  }
) {
  const operation = await ctx.db.get(args.operationId);
  if (!operation || operation.leaseId !== args.leaseId || operation.status !== "running") {
    throw new ConvexError("Export operation lease was superseded");
  }
  const now = Date.now();
  await ctx.db.patch(args.operationId, {
    expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
    leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
    rowsProcessed: args.rowsProcessed,
    updatedAt: now,
  });
  return null;
}

export async function stagePassengerExportArtifactHandler(
  ctx: MutationCtx,
  args: {
    fileName: string;
    leaseId: string;
    operationId: Doc<"passengerExportOperations">["_id"];
    storageId: Doc<"passengerExportSourceChunks">["storageId"];
  }
) {
  const operation = await ctx.db.get(args.operationId);
  if (operation?.status !== "running" || operation.leaseId !== args.leaseId) {
    throw new ConvexError("Export operation is not running");
  }
  const now = Date.now();
  await patchWithE2eOwnership(ctx, "passengerExportOperations", args.operationId, {
    expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
    fileName: args.fileName,
    leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
    storageId: args.storageId,
    updatedAt: now,
  });
  return null;
}

export async function failPassengerExportOperationHandler(
  ctx: MutationCtx,
  args: {
    artifactDeleted: boolean;
    errorCode: string;
    leaseId: string;
    operationId: Doc<"passengerExportOperations">["_id"];
  }
) {
  const operation = await ctx.db.get(args.operationId);
  if (!operation || operation.leaseId !== args.leaseId) {
    return null;
  }
  await ctx.db.patch(args.operationId, {
    errorCode: args.errorCode,
    expiresAt: Date.now() + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
    status: "failed",
    ...(args.artifactDeleted ? { fileName: undefined, storageId: undefined } : {}),
    leaseExpiresAt: undefined,
    leaseId: undefined,
    updatedAt: Date.now(),
  });
  return null;
}

export const stagePassengerExportSourceChunk = internalMutation({
  args: {
    continueCursor: v.string(),
    cursorStart: v.string(),
    isDone: v.boolean(),
    jobCode: v.string(),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    pageIndex: v.number(),
    rowCount: v.number(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.status !== "running" || operation.leaseId !== args.leaseId) {
      throw new ConvexError("Export operation lease was superseded");
    }
    const expectedPageIndex = operation.sourceChunkCount ?? 0;
    const expectedCursor = operation.sourceCursor ?? "";
    if (args.pageIndex !== expectedPageIndex || args.cursorStart !== expectedCursor) {
      throw new ConvexError("Export source chunk position does not match server progress");
    }
    if (operation.jobCode && operation.jobCode !== args.jobCode) {
      throw new ConvexError("Export source Job Card identity changed during resume");
    }
    const existing = await ctx.db
      .query("passengerExportSourceChunks")
      .withIndex("by_operationId_pageIndex", (q) =>
        q.eq("operationId", args.operationId).eq("pageIndex", args.pageIndex)
      )
      .unique();
    if (existing) {
      throw new ConvexError("Export source chunk position already exists");
    }
    const now = Date.now();
    await insertWithE2eOwnership(ctx, "passengerExportSourceChunks", {
      continueCursor: args.continueCursor,
      createdAt: now,
      cursorStart: args.cursorStart,
      isDone: args.isDone,
      operationId: args.operationId,
      pageIndex: args.pageIndex,
      rowCount: args.rowCount,
      storageId: args.storageId,
    });
    await ctx.db.patch(args.operationId, {
      expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
      jobCode: operation.jobCode ?? args.jobCode,
      leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
      rowsProcessed: operation.rowsProcessed + args.rowCount,
      sourceChunkCount: expectedPageIndex + 1,
      sourceCursor: args.continueCursor,
      sourceDone: args.isDone,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const listPassengerExportSourceChunks = internalQuery({
  args: {
    afterPageIndex: v.number(),
    operationId: v.id("passengerExportOperations"),
  },
  handler: async (ctx, args) =>
    await ctx.db
      .query("passengerExportSourceChunks")
      .withIndex("by_operationId_pageIndex", (q) =>
        q.eq("operationId", args.operationId).gt("pageIndex", args.afterPageIndex)
      )
      .order("asc")
      .take(PASSENGER_EXPORT_CLEANUP_BATCH_SIZE),
  returns: v.array(sourceChunkValidator),
});

export const purgePassengerExportSourceChunks = internalMutation({
  args: {
    expireOperation: v.boolean(),
    operationId: v.id("passengerExportOperations"),
  },
  handler: async (ctx, args) => {
    const chunks = (await ctx.db
      .query("passengerExportSourceChunks")
      .withIndex("by_operationId_pageIndex", (q) => q.eq("operationId", args.operationId))
      .order("asc")
      .take(PASSENGER_EXPORT_CLEANUP_BATCH_SIZE)) as Doc<"passengerExportSourceChunks">[];
    await Promise.all(
      chunks.map(async (chunk) => {
        await ctx.db.delete(chunk._id);
        await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
          storageId: chunk.storageId,
        });
      })
    );
    const scheduled = chunks.length === PASSENGER_EXPORT_CLEANUP_BATCH_SIZE;
    if (scheduled) {
      await ctx.scheduler.runAfter(0, purgePassengerExportSourceChunksRef, args);
    } else if (args.expireOperation) {
      const operation = await ctx.db.get(args.operationId);
      if (operation && operation.status !== "completed") {
        await ctx.db.patch(args.operationId, {
          expiresAt: undefined,
          fileName: undefined,
          leaseExpiresAt: undefined,
          leaseId: undefined,
          sourceChunkCount: 0,
          sourceCursor: undefined,
          sourceDone: undefined,
          status: "expired",
          storageId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    return { deleted: chunks.length, scheduled };
  },
  returns: v.object({ deleted: v.number(), scheduled: v.boolean() }),
});
