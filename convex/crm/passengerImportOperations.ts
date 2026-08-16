import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import { passengerImportBatchRowCount } from "./importBatchPolicy";
import { getVisibleJob } from "./importProcessor";
import { createActivity, type PortalAccess, requireStaff } from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { isOperationStalled } from "./operationTimePolicy";
import { batchIndexFromServerId, receiptBatchStatus } from "./passengerImportReceipts";
import { canManagePassengerKinds } from "./passengerKindPolicy";
import { assertReferenceNow } from "./referenceTimePolicy";

export async function beginPassengerImportOperationHandler(
  ctx: MutationCtx,
  args: {
    access: PortalAccess;
    batchTotal: number;
    importKinds: string[];
    jobCardId: Id<"jobCards">;
    sourceDigest: string;
    total: number;
  }
) {
  if (!canManagePassengerKinds(args.access, args.importKinds)) {
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
  const initiatedBy = args.access.authUserId ?? args.access.email;
  const importKinds = Array.from(new Set(args.importKinds)).sort();
  const existing = await ctx.db
    .query("passengerImportOperations")
    .withIndex("by_initiatedBy_jobCardId_sourceDigest", (q) =>
      q
        .eq("initiatedBy", initiatedBy)
        .eq("jobCardId", jobCardId)
        .eq("sourceDigest", args.sourceDigest)
    )
    .unique();
  if (existing) {
    if (
      existing.batchTotal !== args.batchTotal ||
      existing.total !== args.total ||
      JSON.stringify(Array.from(new Set(existing.importKinds)).sort()) !==
        JSON.stringify(importKinds)
    ) {
      throw new ConvexError("Passenger import source manifest conflicts with its receipt");
    }
    return existing._id;
  }
  const now = Date.now();
  return await insertWithE2eOwnership(
    ctx,
    "passengerImportOperations",
    {
      batchTotal: args.batchTotal,
      completedBatches: 0,
      created: 0,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      importKinds,
      initiatedBy,
      ...propertiesWhen(args.access.staffId, () => ({ initiatedByStaffId: args.access.staffId })),
      jobCardId,
      processed: 0,
      remaining: args.total,
      roomSummary: {},
      sourceDigest: args.sourceDigest,
      startedAt: now,
      status: "running",
      terminalBatches: 0,
      total: args.total,
      updated: 0,
      updatedAt: now,
    },
    { authUserId: initiatedBy }
  );
}

export interface RecordPassengerImportBatchArgs extends Record<string, unknown> {
  accepted: number;
  batchId: string;
  batchIndex: number;
  created: number;
  errorSummary: { retryable: number; terminal: number };
  failed: number;
  operationId: Id<"passengerImportOperations">;
  processed: number;
  remaining: number;
  roomSummary: Record<string, number>;
  status: "completed" | "retryable";
  updated: number;
}

function assertBatchResult(args: RecordPassengerImportBatchArgs, expectedRows: number) {
  const counts = [
    args.accepted,
    args.created,
    args.failed,
    args.processed,
    args.remaining,
    args.updated,
  ];
  if (
    !counts.every((count) => Number.isSafeInteger(count) && count >= 0) ||
    args.accepted !== expectedRows ||
    args.processed + args.remaining !== args.accepted ||
    args.created + args.updated > args.processed ||
    args.failed > args.accepted ||
    (args.status === "completed") !== (args.remaining === 0)
  ) {
    throw new ConvexError("Invalid passenger import batch result");
  }
}

export async function recordPassengerImportOperationBatchHandler(
  ctx: MutationCtx,
  args: RecordPassengerImportBatchArgs
) {
  const operation = await ctx.db.get("passengerImportOperations", args.operationId);
  if (!operation) {
    throw new ConvexError("Import operation not found");
  }
  const existingBatch = await ctx.db
    .query("passengerImportOperationBatches")
    .withIndex("by_operationId_batchIndex", (q) =>
      q.eq("operationId", args.operationId).eq("batchIndex", args.batchIndex)
    )
    .unique();
  if (!(existingBatch && existingBatch.batchId === args.batchId)) {
    throw new ConvexError("Passenger import batch position was not claimed");
  }
  assertBatchResult(args, passengerImportBatchRowCount(operation.total, args.batchIndex));
  const roomSummary = { ...operation.roomSummary };
  for (const [roomType, count] of Object.entries(existingBatch.roomSummary ?? {})) {
    roomSummary[roomType] = Math.max(0, (roomSummary[roomType] ?? 0) - count);
  }
  for (const [roomType, count] of Object.entries(args.roomSummary)) {
    roomSummary[roomType] = (roomSummary[roomType] ?? 0) + count;
  }
  const previousResolved = existingBatch.accepted - existingBatch.remaining;
  const nextResolved = args.accepted - args.remaining;
  const previousStatus = receiptBatchStatus(existingBatch);
  const wasCompleted = previousStatus === "completed" ? 1 : 0;
  const isCompleted = args.status === "completed" ? 1 : 0;
  const wasTerminal = previousStatus === "completed" || previousStatus === "retryable" ? 1 : 0;
  let { terminalBatches } = operation;
  if (terminalBatches === undefined) {
    const operationBatches = await ctx.db
      .query("passengerImportOperationBatches")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .collect();
    terminalBatches = operationBatches.filter((batch) => {
      const status = receiptBatchStatus(batch);
      return status === "completed" || status === "retryable";
    }).length;
  }
  const now = Date.now();
  await Promise.all([
    patchWithE2eOwnership(
      ctx,
      "passengerImportOperationBatches",
      existingBatch._id,
      {
        accepted: args.accepted,
        batchId: args.batchId,
        batchIndex: args.batchIndex,
        created: args.created,
        errorSummary: args.errorSummary,
        failed: args.failed,
        operationId: args.operationId,
        processed: args.processed,
        remaining: args.remaining,
        roomSummary: args.roomSummary,
        rowCount: args.accepted,
        status: args.status,
        updated: args.updated,
      },
      { authUserId: operation.initiatedBy }
    ),
    patchWithE2eOwnership(
      ctx,
      "passengerImportOperations",
      args.operationId,
      {
        completedAt: undefined,
        completedBatches: operation.completedBatches + isCompleted - wasCompleted,
        created: operation.created + args.created - existingBatch.created,
        errorSummary: {
          retryable:
            operation.errorSummary.retryable +
            args.errorSummary.retryable -
            existingBatch.errorSummary.retryable,
          terminal:
            operation.errorSummary.terminal +
            args.errorSummary.terminal -
            existingBatch.errorSummary.terminal,
        },
        failed: operation.failed + args.failed - existingBatch.failed,
        processed: operation.processed + args.processed - existingBatch.processed,
        remaining: Math.max(0, operation.remaining - (nextResolved - previousResolved)),
        roomSummary,
        status: "running",
        terminalBatches: terminalBatches + 1 - wasTerminal,
        updated: operation.updated + args.updated - existingBatch.updated,
        updatedAt: now,
      },
      { authUserId: operation.initiatedBy }
    ),
  ]);
  return null;
}

export async function completePassengerImportOperationHandler(
  ctx: MutationCtx,
  args: { operationId: Id<"passengerImportOperations"> }
) {
  const operation = await ctx.db.get("passengerImportOperations", args.operationId);
  if (!operation) {
    throw new ConvexError("Import operation not found");
  }
  let { terminalBatches } = operation;
  if (terminalBatches === undefined) {
    const operationBatches = await ctx.db
      .query("passengerImportOperationBatches")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .collect();
    terminalBatches = new Set(
      operationBatches.flatMap((batch) => {
        const index = batch.batchIndex ?? batchIndexFromServerId(batch.batchId);
        const status = receiptBatchStatus(batch);
        return index !== null && (status === "completed" || status === "retryable") ? [index] : [];
      })
    ).size;
  }
  if (terminalBatches !== operation.batchTotal) {
    return false;
  }
  await patchWithE2eOwnership(
    ctx,
    "passengerImportOperations",
    args.operationId,
    {
      completedAt: Date.now(),
      status: operation.failed > 0 || operation.remaining > 0 ? "partial" : "completed",
      terminalBatches,
      updatedAt: Date.now(),
    },
    { authUserId: operation.initiatedBy }
  );
  return true;
}

export async function logPassengerImportActivityHandler(
  ctx: MutationCtx,
  args: {
    access: PortalAccess;
    importedCount: number;
    importKind: string;
    jobCardId: Id<"jobCards">;
  }
) {
  if (!canManagePassengerKinds(args.access, [args.importKind])) {
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
  let importedLabel = `${args.importKind} rows`;
  if (args.importKind === "passenger") {
    importedLabel = "passengers";
  } else if (args.importKind === "traveller") {
    importedLabel = "travellers";
  }
  await createActivity(ctx, args.access, {
    action: "imported",
    entityId: jobCardId,
    entityType: "traveller",
    message: `${args.importedCount} ${importedLabel} imported for ${job.jobCode}`,
  });
  return null;
}

export async function listMyPassengerImportOperationsHandler(
  ctx: QueryCtx,
  args: { referenceNow: number }
) {
  const access = await requireStaff(ctx);
  const initiatedBy = access.authUserId ?? access.email;
  const referenceNow = assertReferenceNow(args.referenceNow);
  const operations = await ctx.db
    .query("passengerImportOperations")
    .withIndex("by_initiatedBy_updatedAt", (q) => q.eq("initiatedBy", initiatedBy))
    .order("desc")
    .take(12);
  const visible = await Promise.all(
    operations.map(async (operation) => {
      if (!canManagePassengerKinds(access, operation.importKinds)) {
        return null;
      }
      if (!(await getVisibleJob(ctx, access, operation.jobCardId))) {
        return null;
      }
      return {
        batchTotal: operation.batchTotal,
        completedAt: operation.completedAt,
        completedBatches: operation.completedBatches,
        created: operation.created,
        errorSummary: operation.errorSummary,
        failed: operation.failed,
        id: operation._id,
        importKinds: operation.importKinds,
        jobCardId: operation.jobCardId,
        processed: operation.processed,
        remaining: operation.remaining,
        roomSummary: operation.roomSummary,
        stalled: isOperationStalled(operation.status, operation.updatedAt, referenceNow),
        startedAt: operation.startedAt,
        status: operation.status,
        total: operation.total,
        updated: operation.updated,
        updatedAt: operation.updatedAt,
      };
    })
  );
  return visible.filter((operation) => operation !== null);
}
