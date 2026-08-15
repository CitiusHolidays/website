import { ConvexError, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { importFailureValidator } from "../lib/importContractValidators";
import { passengerImportBatchRowCount } from "./importBatchPolicy";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { isOperationStalled } from "./operationTimePolicy";

type ImportFailure = Infer<typeof importFailureValidator>;

const SERVER_BATCH_DIGEST_PATTERN = /^[0-9a-f]{16}$/i;

export function receiptBatchStatus(
  batch?: {
    remaining: number;
    status?: "processing" | "completed" | "retryable";
  } | null
) {
  return batch?.status ?? (batch?.remaining === 0 ? "completed" : "retryable");
}

export function batchIndexFromServerId(batchId: string) {
  const parts = batchId.split(":");
  // biome-ignore lint/style/useAtIndex: the Convex TypeScript target does not include Array.at.
  const candidate = Number(parts[parts.length - 2]);
  return Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null;
}

function assertServerBatchIdentity(
  operation: Doc<"passengerImportOperations">,
  batchIndex: number,
  batchId: string
) {
  const prefix = `passenger:${String(operation.jobCardId)}:${batchIndex}:`;
  const digest = batchId.slice(prefix.length);
  if (!(batchId.startsWith(prefix) && SERVER_BATCH_DIGEST_PATTERN.test(digest))) {
    throw new ConvexError("Invalid server passenger import batch identity");
  }
}

export async function claimPassengerImportOperationBatchHandler(
  ctx: MutationCtx,
  args: {
    batchId: string;
    batchIndex: number;
    operationId: Id<"passengerImportOperations">;
    rowCount: number;
  }
) {
  const operation = await ctx.db.get("passengerImportOperations", args.operationId);
  if (!operation) {
    throw new ConvexError("Import operation not found");
  }
  if (
    !Number.isSafeInteger(args.batchIndex) ||
    args.batchIndex < 0 ||
    args.batchIndex >= operation.batchTotal ||
    args.rowCount !== passengerImportBatchRowCount(operation.total, args.batchIndex)
  ) {
    throw new ConvexError("Invalid passenger import batch position");
  }
  assertServerBatchIdentity(operation, args.batchIndex, args.batchId);
  const indexedBatch = await ctx.db
    .query("passengerImportOperationBatches")
    .withIndex("by_operationId_batchIndex", (q) =>
      q.eq("operationId", args.operationId).eq("batchIndex", args.batchIndex)
    )
    .unique();
  let existingBatch = indexedBatch;
  if (!existingBatch) {
    const legacyBatches = await ctx.db
      .query("passengerImportOperationBatches")
      .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
      .collect();
    existingBatch =
      legacyBatches.find(
        (batch) => (batch.batchIndex ?? batchIndexFromServerId(batch.batchId)) === args.batchIndex
      ) ?? null;
  }
  if (existingBatch) {
    if (
      existingBatch.batchId !== args.batchId ||
      (existingBatch.rowCount !== undefined && existingBatch.rowCount !== args.rowCount) ||
      existingBatch.accepted !== args.rowCount
    ) {
      throw new ConvexError("Passenger import batch position already has different content");
    }
    const status = receiptBatchStatus(existingBatch);
    if (existingBatch.batchIndex === undefined || existingBatch.rowCount === undefined) {
      await patchWithE2eOwnership(
        ctx,
        "passengerImportOperationBatches",
        existingBatch._id,
        {
          batchIndex: args.batchIndex,
          rowCount: args.rowCount,
          status,
        },
        { authUserId: operation.initiatedBy }
      );
    }
    if (status === "completed") {
      return { mode: "replay" as const };
    }
    if (
      status === "processing" &&
      !isOperationStalled(operation.status, operation.updatedAt, Date.now())
    ) {
      return { mode: "wait" as const };
    }
    return { mode: "process" as const };
  }
  const now = Date.now();
  await insertWithE2eOwnership(
    ctx,
    "passengerImportOperationBatches",
    {
      accepted: args.rowCount,
      batchId: args.batchId,
      batchIndex: args.batchIndex,
      created: 0,
      createdAt: now,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      operationId: args.operationId,
      processed: 0,
      remaining: args.rowCount,
      roomSummary: {},
      rowCount: args.rowCount,
      status: "processing",
      updated: 0,
    },
    { authUserId: operation.initiatedBy }
  );
  return { mode: "process" as const };
}

export async function getPassengerImportBatchResultHandler(
  ctx: QueryCtx,
  args: { batchId: string; jobCardId: Id<"jobCards"> }
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const batch = await ctx.db
    .query("crmImportBatches")
    .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
    .unique();
  if (!batch) {
    return null;
  }
  if (String(batch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Passenger import batch belongs to a different Job Card");
  }
  return {
    accepted: batch.accepted,
    batchId: batch.batchId,
    created: batch.created,
    errors: batch.errors.map((error) => ({
      ...error,
      kind: error.kind ?? ("terminal" as const),
    })),
    failed: batch.failed,
    processed: batch.processed,
    remaining: batch.remaining,
    roomSummary: batch.roomSummary,
    rowResults: [],
    status: batch.status,
    updated: batch.updated,
  };
}

export async function finalizePassengerImportBatchHandler(
  ctx: MutationCtx,
  args: {
    accepted: number;
    batchId: string;
    created: number;
    errors: ImportFailure[];
    failed: number;
    jobCardId: Id<"jobCards">;
    operationId: Id<"passengerImportOperations">;
    processed: number;
    remaining: number;
    roomSummary: Record<string, number>;
    status: "completed" | "retryable";
    updated: number;
  }
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const operation = await ctx.db.get("passengerImportOperations", args.operationId);
  if (!(operation && String(operation.jobCardId) === String(jobCardId))) {
    throw new ConvexError("Passenger import operation does not match the selected Job Card");
  }
  const existingBatch = await ctx.db
    .query("crmImportBatches")
    .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
    .unique();
  if (existingBatch && String(existingBatch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Passenger import batch belongs to a different Job Card");
  }
  const now = Date.now();
  const document = {
    accepted: args.accepted,
    attemptCount: (existingBatch?.attemptCount ?? 0) + 1,
    batchId: args.batchId,
    completedAt: args.status === "completed" ? now : undefined,
    created: args.created,
    errors: args.errors,
    failed: args.failed,
    jobCardId,
    processed: args.processed,
    remaining: args.remaining,
    roomSummary: args.roomSummary,
    status: args.status,
    updated: args.updated,
    updatedAt: now,
  };
  if (existingBatch) {
    await patchWithE2eOwnership(ctx, "crmImportBatches", existingBatch._id, document, {
      authUserId: operation.initiatedBy,
    });
  } else {
    await insertWithE2eOwnership(
      ctx,
      "crmImportBatches",
      { ...document, createdAt: now },
      { authUserId: operation.initiatedBy }
    );
  }
  return null;
}
