import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  importFailureValidator,
  portalAccessArgumentValidator,
} from "../lib/importContractValidators";
import {
  commitFlightImportHandler,
  flightGroupInput,
  listFlightItineraryHandler,
} from "./flightImports";
import {
  flightImportResultValidator,
  flightItineraryListPageResultValidator,
  passengerExportOperationListValidator,
  passengerImportOperationListValidator,
} from "./importReturnContracts";
import { exportKindValidator, internalPassengerImportRow } from "./importRowValidators";
import { purgeExpiredPassengerExportsHandler } from "./passengerExportCleanup";
import {
  beginPassengerExportOperationHandler,
  completePassengerExportOperationHandler,
  failPassengerExportOperationHandler,
  getAuthorizedPassengerExportOperationHandler,
  listMyPassengerExportOperationsHandler,
  logPassengerExportHandler,
  passengerExportOperationDocumentValidator,
  stagePassengerExportArtifactHandler,
  updatePassengerExportOperationHandler,
} from "./passengerExportOperations";
import { getPassengerExportSourcePageHandler } from "./passengerExportSource";
import { passengerExportSourcePageValidator } from "./passengerExportSourceContract";
import {
  beginPassengerImportOperationHandler,
  completePassengerImportOperationHandler,
  listMyPassengerImportOperationsHandler,
  logPassengerImportActivityHandler,
  recordPassengerImportOperationBatchHandler,
} from "./passengerImportOperations";
import {
  claimPassengerImportOperationBatchHandler,
  finalizePassengerImportBatchHandler,
  getPassengerImportBatchResultHandler,
} from "./passengerImportReceipts";
import {
  commitPassengerImportRowHandler,
  importErrorResultValidator,
  importRowResultValidator,
  passengerImportBatchResultValidator,
  previewPassengerImportRowsHandler,
} from "./passengerImportRows";

export const previewPassengerImportRows = internalQuery({
  args: {
    access: portalAccessArgumentValidator,
    jobCardId: v.id("jobCards"),
    rows: v.array(internalPassengerImportRow),
  },
  handler: previewPassengerImportRowsHandler,
});

export const commitPassengerImportRow = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    expectedTravellerId: v.optional(v.id("travellers")),
    jobCardId: v.id("jobCards"),
    row: internalPassengerImportRow,
  },
  handler: commitPassengerImportRowHandler,
  returns: v.object({
    accepted: v.number(),
    created: v.number(),
    errors: v.array(importErrorResultValidator),
    failed: v.number(),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: v.record(v.string(), v.number()),
    rowResults: v.array(importRowResultValidator),
    total: v.number(),
    travellerId: v.id("travellers"),
    updated: v.number(),
  }),
});

export const claimPassengerImportOperationBatch = internalMutation({
  args: {
    batchId: v.string(),
    batchIndex: v.number(),
    operationId: v.id("passengerImportOperations"),
    rowCount: v.number(),
  },
  handler: claimPassengerImportOperationBatchHandler,
  returns: v.object({ mode: v.union(v.literal("process"), v.literal("replay")) }),
});

export const getPassengerImportBatchResult = internalQuery({
  args: { batchId: v.string(), jobCardId: v.id("jobCards") },
  handler: getPassengerImportBatchResultHandler,
  returns: v.union(v.null(), passengerImportBatchResultValidator),
});

export const finalizePassengerImportBatch = internalMutation({
  args: {
    accepted: v.number(),
    batchId: v.string(),
    created: v.number(),
    errors: v.array(importFailureValidator),
    failed: v.number(),
    jobCardId: v.id("jobCards"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: v.record(v.string(), v.number()),
    status: v.union(v.literal("completed"), v.literal("retryable")),
    updated: v.number(),
  },
  handler: finalizePassengerImportBatchHandler,
  returns: v.null(),
});

export const beginPassengerImportOperation = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    batchTotal: v.number(),
    importKinds: v.array(v.string()),
    jobCardId: v.id("jobCards"),
    sourceDigest: v.string(),
    total: v.number(),
  },
  handler: beginPassengerImportOperationHandler,
  returns: v.id("passengerImportOperations"),
});

export const recordPassengerImportOperationBatch = internalMutation({
  args: {
    accepted: v.number(),
    batchId: v.string(),
    batchIndex: v.number(),
    created: v.number(),
    errorSummary: v.object({ retryable: v.number(), terminal: v.number() }),
    failed: v.number(),
    operationId: v.id("passengerImportOperations"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: v.record(v.string(), v.number()),
    status: v.union(v.literal("completed"), v.literal("retryable")),
    updated: v.number(),
  },
  handler: recordPassengerImportOperationBatchHandler,
  returns: v.null(),
});

export const completePassengerImportOperation = internalMutation({
  args: { operationId: v.id("passengerImportOperations") },
  handler: completePassengerImportOperationHandler,
  returns: v.boolean(),
});

export const logPassengerImportActivity = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    importedCount: v.number(),
    importKind: v.string(),
    jobCardId: v.id("jobCards"),
  },
  handler: logPassengerImportActivityHandler,
  returns: v.null(),
});

export const commitFlightImport = mutation({
  args: { groups: v.array(flightGroupInput), jobCardId: v.id("jobCards") },
  handler: commitFlightImportHandler,
  returns: flightImportResultValidator,
});

export const listMyPassengerImportOperations = query({
  args: { referenceNow: v.optional(v.number()) },
  handler: listMyPassengerImportOperationsHandler,
  returns: passengerImportOperationListValidator,
});

export const getPassengerExportSourcePage = internalQuery({
  args: {
    access: portalAccessArgumentValidator,
    exportKind: exportKindValidator,
    jobCardId: v.id("jobCards"),
    paginationOpts: paginationOptsValidator,
  },
  handler: getPassengerExportSourcePageHandler,
  returns: passengerExportSourcePageValidator,
});

export const beginPassengerExportOperation = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    commandId: v.string(),
    exportKind: exportKindValidator,
    jobCardId: v.id("jobCards"),
    leaseId: v.string(),
  },
  handler: beginPassengerExportOperationHandler,
  returns: v.object({
    operationId: v.id("passengerExportOperations"),
    replayed: v.boolean(),
  }),
});

export const updatePassengerExportOperation = internalMutation({
  args: {
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    rowsProcessed: v.number(),
  },
  handler: updatePassengerExportOperationHandler,
  returns: v.null(),
});

export const completePassengerExportOperation = internalMutation({
  args: {
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    rowsProcessed: v.number(),
  },
  handler: completePassengerExportOperationHandler,
  returns: v.null(),
});

export const stagePassengerExportArtifact = internalMutation({
  args: {
    fileName: v.string(),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    storageId: v.id("_storage"),
  },
  handler: stagePassengerExportArtifactHandler,
  returns: v.null(),
});

export const failPassengerExportOperation = internalMutation({
  args: {
    artifactDeleted: v.boolean(),
    errorCode: v.string(),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
  },
  handler: failPassengerExportOperationHandler,
  returns: v.null(),
});

export const getPassengerExportOperation = internalQuery({
  args: { operationId: v.id("passengerExportOperations") },
  handler: async (ctx, args) => await ctx.db.get("passengerExportOperations", args.operationId),
  returns: v.union(passengerExportOperationDocumentValidator, v.null()),
});

export const getAuthorizedPassengerExportOperation = internalQuery({
  args: { access: portalAccessArgumentValidator, operationId: v.string() },
  handler: getAuthorizedPassengerExportOperationHandler,
  returns: passengerExportOperationDocumentValidator,
});

export const purgeExpiredPassengerExports = internalMutation({
  args: {},
  handler: purgeExpiredPassengerExportsHandler,
  returns: v.object({ expired: v.number(), scheduled: v.boolean() }),
});

export const listMyPassengerExportOperations = query({
  args: { referenceNow: v.optional(v.number()) },
  handler: listMyPassengerExportOperationsHandler,
  returns: passengerExportOperationListValidator,
});

export const logPassengerExport = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    exportKind: v.optional(exportKindValidator),
    jobCardId: v.id("jobCards"),
    rowCount: v.number(),
  },
  handler: logPassengerExportHandler,
  returns: v.null(),
});

export const listFlightItinerary = query({
  args: {
    jobCardId: v.optional(v.id("jobCards")),
    paginationOpts: paginationOptsValidator,
  },
  handler: listFlightItineraryHandler,
  returns: flightItineraryListPageResultValidator,
});
