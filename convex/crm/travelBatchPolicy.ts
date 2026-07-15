import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

const LEGACY_TRAVEL_BATCH_COUNTER_LIMIT = 100;

export function formatTravelBatchCode(sequence: number) {
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new ConvexError("Travel Batch sequence must be greater than zero");
  }
  return `B${String(Math.floor(sequence)).padStart(2, "0")}`;
}

export function buildTravelBatchReference(jobCode: string, batchCode: string) {
  return `${jobCode} / ${batchCode}`;
}

const TRAVEL_BATCH_CODE_PATTERN = /^B(\d+)$/;

export function parseTravelBatchSequence(batchCode: string | undefined | null) {
  const match = String(batchCode ?? "").match(TRAVEL_BATCH_CODE_PATTERN);
  return match ? Number(match[1]) : 0;
}

export async function loadTravelBatchCount(ctx: MutationCtx, job: any) {
  if (Number.isInteger(job.travelBatchCount) && job.travelBatchCount >= 0) {
    return Number(job.travelBatchCount);
  }
  const summaryRows = Array.isArray(job.travelBatchSummaries) ? job.travelBatchSummaries : [];
  if (summaryRows.length > 0) {
    return summaryRows.reduce(
      (max: number, batch: { batchCode?: string }) =>
        Math.max(max, parseTravelBatchSequence(batch.batchCode)),
      0
    );
  }
  const legacyRows = await ctx.db
    .query("travelBatches")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .take(LEGACY_TRAVEL_BATCH_COUNTER_LIMIT + 1);
  if (legacyRows.length > LEGACY_TRAVEL_BATCH_COUNTER_LIMIT) {
    throw new ConvexError("Travel Batch counter requires bounded reconciliation before creation");
  }
  return legacyRows.reduce(
    (max, batch) => Math.max(max, parseTravelBatchSequence(batch.batchCode)),
    0
  );
}

export function nextTravelBatchIdentity(
  jobCode: string,
  existingBatches: Array<{ batchCode?: string | null }>
) {
  const nextSequence =
    existingBatches.reduce(
      (max, batch) => Math.max(max, parseTravelBatchSequence(batch.batchCode)),
      0
    ) + 1;
  const batchCode = formatTravelBatchCode(nextSequence);
  return {
    batchCode,
    batchReference: buildTravelBatchReference(jobCode, batchCode),
  };
}

export function travelBatchPatchFromArgs(args: {
  destination?: string;
  confirmedPax?: number;
  roomCount?: number;
  travelStartDate?: string;
  travelEndDate?: string;
  contractingOwnerId?: string;
  contractingOwnerName?: string;
  operationsOwnerId?: string;
  operationsOwnerName?: string;
  ticketingOwnerId?: string;
  ticketingOwnerName?: string;
  tourManagerName?: string;
  status?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (args.destination !== undefined) {
    patch.destination = args.destination.trim();
  }
  if (args.confirmedPax !== undefined) {
    patch.confirmedPax = args.confirmedPax;
  }
  if (args.roomCount !== undefined) {
    patch.roomCount = args.roomCount;
  }
  if (args.travelStartDate !== undefined) {
    patch.travelStartDate = args.travelStartDate;
  }
  if (args.travelEndDate !== undefined) {
    patch.travelEndDate = args.travelEndDate;
  }
  if (args.contractingOwnerId !== undefined) {
    patch.contractingOwnerId = args.contractingOwnerId;
  }
  if (args.contractingOwnerName !== undefined) {
    patch.contractingOwnerName = args.contractingOwnerName.trim();
  }
  if (args.operationsOwnerId !== undefined) {
    patch.operationsOwnerId = args.operationsOwnerId;
  }
  if (args.operationsOwnerName !== undefined) {
    patch.operationsOwnerName = args.operationsOwnerName.trim();
  }
  if (args.ticketingOwnerId !== undefined) {
    patch.ticketingOwnerId = args.ticketingOwnerId;
  }
  if (args.ticketingOwnerName !== undefined) {
    patch.ticketingOwnerName = args.ticketingOwnerName.trim();
  }
  if (args.tourManagerName !== undefined) {
    patch.tourManagerName = args.tourManagerName.trim();
  }
  if (args.status !== undefined) {
    patch.status = args.status;
  }
  return patch;
}
