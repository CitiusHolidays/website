import { paginationResultValidator } from "convex/server";
import { v } from "convex/values";

export const passengerImportPreviewResultValidator = v.object({
  roomSummary: v.record(v.string(), v.number()),
  rows: v.array(
    v.object({
      action: v.union(v.literal("create"), v.literal("update")),
      id: v.string(),
      travellerId: v.union(v.id("travellers"), v.null()),
      travellerName: v.string(),
    })
  ),
});

const importErrorValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("retryable"), v.literal("terminal")),
  message: v.string(),
});
const importRowResultValidator = v.object({
  disposition: v.union(v.literal("created"), v.literal("updated"), v.literal("failed")),
  fullName: v.string(),
  id: v.string(),
  message: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

export const passengerImportCommitResultValidator = v.object({
  accepted: v.number(),
  batches: v.array(
    v.object({
      batchId: v.string(),
      errors: v.array(importErrorValidator),
      status: v.string(),
    })
  ),
  completed: v.boolean(),
  created: v.number(),
  failed: v.number(),
  operationId: v.id("passengerImportOperations"),
  processed: v.number(),
  remaining: v.number(),
  roomSummary: v.record(v.string(), v.number()),
  rowResults: v.array(importRowResultValidator),
  total: v.number(),
  updated: v.number(),
});

export const passengerImportOperationValidator = v.object({
  batchTotal: v.number(),
  completedAt: v.optional(v.number()),
  completedBatches: v.number(),
  created: v.number(),
  errorSummary: v.object({ retryable: v.number(), terminal: v.number() }),
  failed: v.number(),
  id: v.id("passengerImportOperations"),
  importKinds: v.array(v.string()),
  jobCardId: v.id("jobCards"),
  processed: v.number(),
  remaining: v.number(),
  roomSummary: v.record(v.string(), v.number()),
  stalled: v.boolean(),
  startedAt: v.number(),
  status: v.union(v.literal("running"), v.literal("completed"), v.literal("partial")),
  total: v.number(),
  updated: v.number(),
  updatedAt: v.number(),
});

export const passengerImportOperationListValidator = v.array(passengerImportOperationValidator);

export const passengerExportOperationResultValidator = v.object({
  operationId: v.id("passengerExportOperations"),
});

export const passengerExportOperationValidator = v.object({
  commandId: v.string(),
  completedAt: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  exportKind: v.string(),
  fileName: v.optional(v.string()),
  id: v.id("passengerExportOperations"),
  jobCardId: v.id("jobCards"),
  rowsProcessed: v.number(),
  stalled: v.boolean(),
  startedAt: v.number(),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("expired")
  ),
  updatedAt: v.number(),
});

export const passengerExportOperationListValidator = v.array(passengerExportOperationValidator);

export const passengerExportDownloadValidator = v.object({
  fileName: v.string(),
  url: v.string(),
});

export const flightImportResultValidator = v.object({
  createdGroups: v.number(),
  createdSegments: v.number(),
  totalGroups: v.number(),
  totalSegments: v.number(),
  updatedGroups: v.number(),
  updatedSegments: v.number(),
});

const flightSegmentOutputValidator = v.object({
  airline: v.string(),
  arriveTime: v.string(),
  dateLabel: v.string(),
  departTime: v.string(),
  destination: v.string(),
  duration: v.string(),
  flightNumber: v.string(),
  id: v.id("flightSegments"),
  importKey: v.string(),
  origin: v.string(),
  transit: v.string(),
});
const flightItineraryOutputValidator = v.object({
  airline: v.string(),
  arrivalDate: v.string(),
  clientName: v.string(),
  departureDate: v.string(),
  id: v.id("flightGroups"),
  importKey: v.string(),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  name: v.string(),
  route: v.string(),
  segments: v.array(flightSegmentOutputValidator),
  sourceGroupIndex: v.number(),
  sourceSheet: v.string(),
  travelBatchCode: v.string(),
  travelBatchId: v.string(),
  travelBatchReference: v.string(),
  updatedAt: v.string(),
});
export const flightItineraryListResultValidator = v.array(flightItineraryOutputValidator);
export const flightItineraryListPageResultValidator = paginationResultValidator(
  flightItineraryOutputValidator
);
