import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { DEFAULT_CHECKLIST } from "./jobCardConstants";
import {
  assertDateRangeOrder,
  canEditContractingRecord,
  canEditOperationsRecord,
  canSeeJobCardRecord,
  createActivity,
  editorPatch,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";
import {
  formatTravelBatchCode,
  loadTravelBatchCount,
  nextTravelBatchIdentity,
  parseTravelBatchSequence,
  travelBatchPatchFromArgs,
} from "./travelBatchPolicy";

export async function handleCreateTravelBatch(
  ctx: MutationCtx,
  args: {
    confirmedPax?: number;
    contractingOwnerId?: string;
    contractingOwnerName?: string;
    destination?: string;
    jobCardId: string;
    operationsOwnerId?: string;
    operationsOwnerName?: string;
    roomCount?: number;
    status?: string;
    ticketingOwnerId?: string;
    ticketingOwnerName?: string;
    tourManagerName?: string;
    travelEndDate?: string;
    travelStartDate?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
  ]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError(
      "Only assigned SPOCs, collaborators, and heads can create Travel Batches"
    );
  }
  const confirmedPax = args.confirmedPax ?? job.confirmedPax;
  if (confirmedPax < 1) {
    throw new ConvexError("Confirmed pax must be greater than zero");
  }
  const travelStartDate = args.travelStartDate ?? job.travelStartDate ?? "";
  const travelEndDate = args.travelEndDate ?? job.travelEndDate ?? "";
  assertDateRangeOrder(travelStartDate, travelEndDate, "Travel start date", "Travel end date");

  const currentBatchCount = await loadTravelBatchCount(ctx, job);
  const identity = nextTravelBatchIdentity(
    job.jobCode,
    currentBatchCount > 0 ? [{ batchCode: formatTravelBatchCode(currentBatchCount) }] : []
  );
  const now = Date.now();
  const batchPayload = {
    jobCardId,
    ...identity,
    confirmedPax,
    contractingOwnerId: args.contractingOwnerId ?? job.contractingOwnerId,
    contractingOwnerName: args.contractingOwnerName?.trim() ?? job.contractingOwnerName ?? "",
    destination: args.destination?.trim() ?? job.destination ?? "",
    operationsOwnerId: args.operationsOwnerId ?? job.operationsOwnerId,
    operationsOwnerName: args.operationsOwnerName?.trim() ?? job.operationsOwnerName ?? "",
    paymentTerms: job.paymentTerms ?? null,
    preDepartureChecklist: job.preDepartureChecklist ?? DEFAULT_CHECKLIST,
    queryType: job.queryType as any,
    roomCount: args.roomCount ?? job.roomCount ?? 0,
    status: (args.status ?? job.status) as
      | "Open"
      | "In Operations"
      | "Ready for Departure"
      | "On Tour"
      | "Closed",
    ticketingOwnerId: args.ticketingOwnerId ?? job.ticketingOwnerId,
    ticketingOwnerName: args.ticketingOwnerName?.trim() ?? job.ticketingOwnerName ?? "",
    tourManagerName: args.tourManagerName?.trim() ?? job.tourManagerName ?? "",
    travelEndDate,
    travelStartDate,
    ...editorPatch(access),
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    updatedAt: now,
  };
  const id = await ctx.db.insert("travelBatches", batchPayload);
  await ctx.db.patch(jobCardId, {
    travelBatchCount: parseTravelBatchSequence(identity.batchCode),
  });
  await createActivity(ctx, access, {
    action: "travel_batch_created",
    entityId: jobCardId,
    entityType: "jobCard",
    message: `${identity.batchReference} created`,
  });
  return { id, ...identity };
}

export async function handleUpdateTravelBatch(
  ctx: MutationCtx,
  args: {
    confirmedPax?: number;
    contractingOwnerId?: string;
    contractingOwnerName?: string;
    destination?: string;
    operationsOwnerId?: string;
    operationsOwnerName?: string;
    roomCount?: number;
    status?: string;
    ticketingOwnerId?: string;
    ticketingOwnerName?: string;
    tourManagerName?: string;
    travelBatchId: string;
    travelEndDate?: string;
    travelStartDate?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
  ]);
  const travelBatchId = ctx.db.normalizeId("travelBatches", args.travelBatchId);
  if (!travelBatchId) {
    throw new ConvexError("Invalid Travel Batch id");
  }
  const batch = await ctx.db.get(travelBatchId);
  if (!batch) {
    throw new ConvexError("Travel Batch not found");
  }
  const job = await ctx.db.get(batch.jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError(
      "Only assigned SPOCs, collaborators, and heads can update Travel Batches"
    );
  }
  if (args.confirmedPax !== undefined && args.confirmedPax < 1) {
    throw new ConvexError("Confirmed pax must be greater than zero");
  }
  assertDateRangeOrder(
    args.travelStartDate ?? batch.travelStartDate,
    args.travelEndDate ?? batch.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const patch = {
    ...travelBatchPatchFromArgs(args),
    ...editorPatch(access),
  };
  await ctx.db.patch(travelBatchId, patch);
  await createActivity(ctx, access, {
    action: "travel_batch_updated",
    entityId: batch.jobCardId,
    entityType: "jobCard",
    message: `${batch.batchReference} updated`,
  });
  return { id: travelBatchId };
}
