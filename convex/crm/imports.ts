import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  importFailureValidator,
  portalAccessArgumentValidator,
} from "../lib/importContractValidators";
import { passengerImportBatchRowCount } from "./importBatchPolicy";
import {
  buildTravellerMatchIndex,
  findTravellerMatchInIndex,
  getVisibleJob,
  processImportRows,
  resolveImportTravelBatchId,
  summarizeRoomTypesFromRows,
} from "./importProcessor";
import {
  flightImportResultValidator,
  flightItineraryListPageResultValidator,
  passengerExportOperationListValidator,
  passengerImportOperationListValidator,
} from "./importReturnContracts";
import { exportKindValidator, internalPassengerImportRow } from "./importRowValidators";
import { createActivity, PERMISSIONS, type PortalAccess, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { purgePassengerExportSourceChunksRef } from "./passengerExportFunctionReferences";
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
import { PASSENGER_EXPORT_CLEANUP_BATCH_SIZE } from "./passengerExportPolicy";
import { getPassengerExportSourcePageHandler } from "./passengerExportSource";
import { passengerExportSourcePageValidator } from "./passengerExportSourceContract";
import { canManagePassengerKinds } from "./passengerKindPolicy";

const SERVER_BATCH_DIGEST_PATTERN = /^[0-9a-f]{16}$/i;

const flightSegmentInput = v.object({
  airline: v.string(),
  arriveTime: v.optional(v.string()),
  dateLabel: v.string(),
  departTime: v.optional(v.string()),
  destination: v.string(),
  duration: v.optional(v.string()),
  flightNumber: v.string(),
  id: v.string(),
  importKey: v.string(),
  origin: v.string(),
  segmentIndex: v.number(),
  sourceGroupIndex: v.number(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.string(),
  transit: v.optional(v.string()),
});

const flightGroupInput = v.object({
  groupIndex: v.number(),
  id: v.string(),
  name: v.string(),
  segments: v.array(flightSegmentInput),
  sourceSheet: v.string(),
  travelBatchId: v.optional(v.string()),
  travelBatchReference: v.optional(v.string()),
});

type CommitFlightImportArgs = {
  jobCardId: Id<"jobCards">;
  groups: Array<{
    id?: string;
    sourceSheet: string;
    groupIndex: number;
    name: string;
    travelBatchId?: string;
    travelBatchReference?: string;
    segments: Array<{
      id?: string;
      sourceSheet?: string;
      sourceRowNumber?: number;
      sourceGroupIndex?: number;
      segmentIndex?: number;
      importKey?: string;
      dateLabel: string;
      airline: string;
      flightNumber: string;
      departTime?: string;
      origin: string;
      arriveTime?: string;
      destination: string;
      duration?: string;
      transit?: string;
    }>;
  }>;
};

function groupImportKey(sheet: string, groupIndex: number) {
  return `${sheet.trim().toLowerCase()}|${groupIndex}`;
}

function flightSegmentImportKey(
  group: { sourceSheet: string; groupIndex: number },
  segment: CommitFlightImportArgs["groups"][number]["segments"][number]
) {
  if (segment.importKey) {
    return segment.importKey;
  }
  const segmentIndex = segment.segmentIndex ?? 0;
  return `${groupImportKey(group.sourceSheet, group.groupIndex)}|${segmentIndex}`;
}

function summarizeGroup(group: {
  sourceSheet: string;
  groupIndex: number;
  segments: Array<{
    airline: string;
    flightNumber: string;
    dateLabel: string;
    origin: string;
    destination: string;
  }>;
}) {
  const first = group.segments[0];
  const last = group.segments[group.segments.length - 1] ?? first;
  const airlines = Array.from(
    group.segments.reduce((set, segment) => {
      if (segment.airline) {
        set.add(segment.airline);
      }
      return set;
    }, new Set<string>())
  );
  const flightNumbers = group.segments.reduce((items, segment) => {
    if (segment.flightNumber) {
      items.push(segment.flightNumber);
    }
    return items;
  }, [] as string[]);
  return {
    airline: airlines.length === 1 ? airlines[0] : airlines.join(" / "),
    arrivalDate: last?.dateLabel ?? "",
    departureDate: first?.dateLabel ?? "",
    flightNumber: flightNumbers.join(" / "),
    name: `${group.sourceSheet} itinerary ${group.groupIndex + 1}`,
    route: [first?.origin, last?.destination].filter(Boolean).join(" - "),
  };
}

export const previewPassengerImportRows = internalQuery({
  args: {
    access: portalAccessArgumentValidator,
    jobCardId: v.id("jobCards"),
    rows: v.array(internalPassengerImportRow),
  },
  handler: async (ctx, args) => {
    if (
      !canManagePassengerKinds(
        args.access,
        args.rows.map((row) => row.importKind ?? "passenger")
      )
    ) {
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

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    const results = args.rows.map((row) => {
      const match = findTravellerMatchInIndex(matchIndex, row);
      return {
        action: match ? "update" : "create",
        id: row.id,
        travellerId: match?._id ?? null,
        travellerName: match?.fullName ?? "",
      };
    });
    return { roomSummary: summarizeRoomTypesFromRows(args.rows), rows: results };
  },
});

const importErrorResultValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("retryable"), v.literal("terminal")),
  message: v.string(),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

const importRowResultValidator = v.object({
  disposition: v.union(v.literal("created"), v.literal("updated"), v.literal("failed")),
  fullName: v.string(),
  id: v.string(),
  message: v.optional(v.string()),
  sourceRowNumber: v.optional(v.number()),
  sourceSheet: v.optional(v.string()),
});

const importBatchStatusValidator = v.union(
  v.literal("processing"),
  v.literal("completed"),
  v.literal("retryable")
);

const passengerImportBatchResultValidator = v.object({
  accepted: v.number(),
  batchId: v.string(),
  created: v.number(),
  errors: v.array(importErrorResultValidator),
  failed: v.number(),
  processed: v.number(),
  remaining: v.number(),
  roomSummary: v.record(v.string(), v.number()),
  rowResults: v.array(importRowResultValidator),
  status: importBatchStatusValidator,
  updated: v.number(),
});

function receiptBatchStatus(batch: {
  remaining: number;
  status?: "processing" | "completed" | "retryable";
}) {
  return batch.status ?? (batch.remaining === 0 ? "completed" : "retryable");
}

function batchIndexFromServerId(batchId: string) {
  const parts = batchId.split(":");
  // biome-ignore lint/style/useAtIndex: this Convex tsconfig targets an Array library without at().
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

async function resolveBoundedTravellerMatch(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  row: any,
  expectedTravellerId?: Id<"travellers">
) {
  if (expectedTravellerId) {
    const expected = await ctx.db.get("travellers", expectedTravellerId);
    if (!(expected && String(expected.jobCardId) === String(jobCardId))) {
      throw new ConvexError("Passenger import match no longer belongs to the selected Job Card");
    }
    return expected;
  }
  if (row.passportNumberHash) {
    const passport = await ctx.db
      .query("passportDetails")
      .withIndex("by_passportNumberHash", (q) => q.eq("passportNumberHash", row.passportNumberHash))
      .first();
    const traveller = passport ? await ctx.db.get("travellers", passport.travellerId) : null;
    if (traveller && String(traveller.jobCardId) === String(jobCardId)) {
      return traveller;
    }
  }
  return await ctx.db
    .query("travellers")
    .withIndex("by_jobCardId_importKey", (q) =>
      q.eq("jobCardId", jobCardId).eq("importKey", row.importKey)
    )
    .unique();
}

export const commitPassengerImportRow = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    expectedTravellerId: v.optional(v.id("travellers")),
    jobCardId: v.id("jobCards"),
    row: internalPassengerImportRow,
  },
  handler: async (ctx, args) => {
    const importKind = args.row.importKind ?? "passenger";
    if (!canManagePassengerKinds(args.access, [importKind])) {
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
    const match = await resolveBoundedTravellerMatch(
      ctx,
      jobCardId,
      args.row,
      args.expectedTravellerId
    );
    const matchIndex = {
      byImportKey: new Map<string, any>(),
      byNormalizedName: new Map<string, any>(),
      byPassportHash: new Map<string, any>(),
    };
    if (match) {
      if (match.importKey) {
        matchIndex.byImportKey.set(match.importKey, match);
      }
      matchIndex.byNormalizedName.set(match.fullName.trim().toLowerCase(), match);
      if (args.row.passportNumberHash) {
        matchIndex.byPassportHash.set(args.row.passportNumberHash, match);
      }
    }
    const result = await processImportRows(ctx, {
      access: args.access,
      failFast: true,
      job,
      jobCardId,
      matchIndex,
      rows: [args.row],
    });
    const [travellerId] = result.committedTravellerIds;
    if (!travellerId) {
      throw new ConvexError("Passenger import row did not commit");
    }
    const { committedTravellerIds: _committedTravellerIds, ...publicResult } = result;
    return { ...publicResult, travellerId };
  },
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
  handler: async (ctx, args) => {
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
        await ctx.db.patch("passengerImportOperationBatches", existingBatch._id, {
          batchIndex: args.batchIndex,
          rowCount: args.rowCount,
          status,
        });
      }
      return { mode: status === "completed" ? ("replay" as const) : ("process" as const) };
    }

    const now = Date.now();
    await ctx.db.insert("passengerImportOperationBatches", {
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
    });
    return { mode: "process" as const };
  },
  returns: v.object({ mode: v.union(v.literal("process"), v.literal("replay")) }),
});

export const getPassengerImportBatchResult = internalQuery({
  args: { batchId: v.string(), jobCardId: v.id("jobCards") },
  handler: async (ctx, args) => {
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
  },
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
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
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
      await ctx.db.patch("crmImportBatches", existingBatch._id, document);
    } else {
      await ctx.db.insert("crmImportBatches", { ...document, createdAt: now });
    }
    return null;
  },
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
  handler: async (ctx, args) => {
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
      const existingKinds = Array.from(new Set(existing.importKinds)).sort();
      const requestedKinds = Array.from(new Set(args.importKinds)).sort();
      if (
        existing.batchTotal !== args.batchTotal ||
        existing.total !== args.total ||
        JSON.stringify(existingKinds) !== JSON.stringify(requestedKinds)
      ) {
        throw new ConvexError("Passenger import source manifest conflicts with its receipt");
      }
      return existing._id;
    }
    const now = Date.now();
    return await ctx.db.insert("passengerImportOperations", {
      batchTotal: args.batchTotal,
      completedBatches: 0,
      created: 0,
      errorSummary: { retryable: 0, terminal: 0 },
      failed: 0,
      importKinds: Array.from(new Set(args.importKinds)).sort(),
      initiatedBy,
      ...(args.access.staffId ? { initiatedByStaffId: args.access.staffId } : {}),
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
    });
  },
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
  handler: async (ctx, args) => {
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
    const expectedRows = passengerImportBatchRowCount(operation.total, args.batchIndex);
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
    const roomSummary = { ...operation.roomSummary } as Record<string, number>;
    for (const [roomType, count] of Object.entries(existingBatch?.roomSummary ?? {})) {
      roomSummary[roomType] = Math.max(0, (roomSummary[roomType] ?? 0) - count);
    }
    for (const [roomType, count] of Object.entries(args.roomSummary)) {
      roomSummary[roomType] = (roomSummary[roomType] ?? 0) + count;
    }
    const now = Date.now();
    const previousResolved = existingBatch ? existingBatch.accepted - existingBatch.remaining : 0;
    const nextResolved = args.accepted - args.remaining;
    const previousStatus = receiptBatchStatus(existingBatch);
    const wasCompleted = previousStatus === "completed" ? 1 : 0;
    const isCompleted = args.status === "completed" ? 1 : 0;
    const wasTerminal = previousStatus === "completed" || previousStatus === "retryable" ? 1 : 0;
    const isTerminal = 1;
    let terminalBatches = operation.terminalBatches;
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
    const batchDocument = {
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
    };
    await Promise.all([
      ctx.db.patch("passengerImportOperationBatches", existingBatch._id, batchDocument),
      ctx.db.patch("passengerImportOperations", args.operationId, {
        completedAt: undefined,
        completedBatches: operation.completedBatches + isCompleted - wasCompleted,
        created: operation.created + args.created - (existingBatch?.created ?? 0),
        errorSummary: {
          retryable:
            operation.errorSummary.retryable +
            args.errorSummary.retryable -
            (existingBatch?.errorSummary.retryable ?? 0),
          terminal:
            operation.errorSummary.terminal +
            args.errorSummary.terminal -
            (existingBatch?.errorSummary.terminal ?? 0),
        },
        failed: operation.failed + args.failed - (existingBatch?.failed ?? 0),
        processed: operation.processed + args.processed - (existingBatch?.processed ?? 0),
        remaining: Math.max(0, operation.remaining - (nextResolved - previousResolved)),
        roomSummary,
        status: "running",
        terminalBatches: terminalBatches + isTerminal - wasTerminal,
        updated: operation.updated + args.updated - (existingBatch?.updated ?? 0),
        updatedAt: now,
      }),
    ]);
    return null;
  },
  returns: v.null(),
});

export const completePassengerImportOperation = internalMutation({
  args: { operationId: v.id("passengerImportOperations") },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get("passengerImportOperations", args.operationId);
    if (!operation) {
      throw new ConvexError("Import operation not found");
    }
    let terminalBatches = operation.terminalBatches;
    if (terminalBatches === undefined) {
      const operationBatches = await ctx.db
        .query("passengerImportOperationBatches")
        .withIndex("by_operationId", (q) => q.eq("operationId", args.operationId))
        .collect();
      const terminalIndexes = new Set(
        operationBatches.flatMap((batch) => {
          const index = batch.batchIndex ?? batchIndexFromServerId(batch.batchId);
          const status = receiptBatchStatus(batch);
          return index !== null && (status === "completed" || status === "retryable")
            ? [index]
            : [];
        })
      );
      terminalBatches = terminalIndexes.size;
    }
    if (terminalBatches !== operation.batchTotal) {
      return false;
    }
    const now = Date.now();
    await ctx.db.patch("passengerImportOperations", args.operationId, {
      completedAt: now,
      status: operation.failed > 0 || operation.remaining > 0 ? "partial" : "completed",
      terminalBatches,
      updatedAt: now,
    });
    return true;
  },
  returns: v.boolean(),
});

export const logPassengerImportActivity = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    importedCount: v.number(),
    importKind: v.string(),
    jobCardId: v.id("jobCards"),
  },
  handler: async (ctx, args) => {
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

    const importedLabel =
      args.importKind === "passenger"
        ? "passengers"
        : args.importKind === "traveller"
          ? "travellers"
          : `${args.importKind} rows`;
    await createActivity(ctx, args.access, {
      action: "imported",
      entityId: jobCardId,
      entityType: "traveller",
      message: `${args.importedCount} ${importedLabel} imported for ${job.jobCode}`,
    });
    return null;
  },
  returns: v.null(),
});

export async function commitFlightImportForTest(
  ctx: MutationCtx,
  args: CommitFlightImportArgs,
  access: PortalAccess
) {
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }

  const now = Date.now();
  let createdGroups = 0;
  let updatedGroups = 0;
  let createdSegments = 0;
  let updatedSegments = 0;

  for (const group of args.groups) {
    const importKey = groupImportKey(group.sourceSheet, group.groupIndex);
    const summary = summarizeGroup(group);
    const travelBatchId = await resolveImportTravelBatchId(ctx, jobCardId, group);
    const existingGroup = await ctx.db
      .query("flightGroups")
      .withIndex("by_jobCardId_importKey", (q) =>
        q.eq("jobCardId", jobCardId).eq("importKey", importKey)
      )
      .first();

    let flightGroupId: Id<"flightGroups">;
    const groupFields = {
      airline: summary.airline,
      arrivalDate: summary.arrivalDate,
      departureDate: summary.departureDate,
      flightNumber: summary.flightNumber,
      importKey,
      name: group.name.trim() || summary.name,
      route: summary.route,
      sourceGroupIndex: group.groupIndex,
      sourceSheet: group.sourceSheet,
      ticketingType: "Imported Itinerary",
      totalSeats: 0,
      travelBatchId,
      updatedAt: now,
    };

    if (existingGroup) {
      await ctx.db.patch(existingGroup._id, groupFields);
      flightGroupId = existingGroup._id;
      updatedGroups += 1;
    } else {
      flightGroupId = await ctx.db.insert("flightGroups", {
        jobCardId,
        ...groupFields,
        createdAt: now,
        createdBy: access.authUserId ?? "unknown",
      });
      createdGroups += 1;
    }

    const incomingKeys = new Set(
      group.segments.map((segment) => flightSegmentImportKey(group, segment))
    );
    const existingSegments = await ctx.db
      .query("flightSegments")
      .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", flightGroupId))
      .collect();
    const existingSegmentByImportKey = new Map<string, Doc<"flightSegments">>(
      existingSegments.map((segment) => [segment.importKey, segment])
    );
    await Promise.all(
      existingSegments.flatMap((existingSegment) =>
        incomingKeys.has(existingSegment.importKey) ? [] : [ctx.db.delete(existingSegment._id)]
      )
    );

    const segmentResults = await Promise.all(
      group.segments.map(async (segment) => {
        const segmentImportKey = flightSegmentImportKey(group, segment);
        const existingSegment = existingSegmentByImportKey.get(segmentImportKey);
        const segmentPatch = {
          airline: segment.airline,
          arriveTime: segment.arriveTime ?? "",
          dateLabel: segment.dateLabel,
          departTime: segment.departTime ?? "",
          destination: segment.destination,
          duration: segment.duration ?? "",
          flightGroupId,
          flightNumber: segment.flightNumber,
          importKey: segmentImportKey,
          jobCardId,
          origin: segment.origin,
          segmentIndex: segment.segmentIndex ?? 0,
          sourceGroupIndex: segment.sourceGroupIndex ?? group.groupIndex,
          sourceRowNumber: segment.sourceRowNumber,
          sourceSheet: segment.sourceSheet ?? group.sourceSheet,
          transit: segment.transit ?? "",
          updatedAt: now,
        };
        if (existingSegment) {
          await ctx.db.patch(existingSegment._id, segmentPatch);
          return "updated";
        }
        await ctx.db.insert("flightSegments", {
          ...segmentPatch,
          createdAt: now,
          createdBy: access.authUserId ?? "unknown",
        });
        return "created";
      })
    );
    for (const result of segmentResults) {
      if (result === "created") {
        createdSegments += 1;
      }
      if (result === "updated") {
        updatedSegments += 1;
      }
    }
  }

  await createActivity(ctx, access, {
    action: "imported",
    entityId: jobCardId,
    entityType: "flightGroup",
    message: `${createdSegments + updatedSegments} flight segments imported for ${job.jobCode}`,
  });

  return {
    createdGroups,
    createdSegments,
    totalGroups: args.groups.length,
    totalSegments: args.groups.reduce((sum, group) => sum + group.segments.length, 0),
    updatedGroups,
    updatedSegments,
  };
}

export const commitFlightImport = mutation({
  args: {
    groups: v.array(flightGroupInput),
    jobCardId: v.id("jobCards"),
  },
  handler: async (ctx, args) =>
    commitFlightImportForTest(ctx, args, await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING)),
  returns: flightImportResultValidator,
});

export const listMyPassengerImportOperations = query({
  args: { referenceNow: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const initiatedBy = access.authUserId ?? access.email;
    const referenceNow = args.referenceNow ?? Date.now();
    const operations = await ctx.db
      .query("passengerImportOperations")
      .withIndex("by_initiatedBy_updatedAt", (q) => q.eq("initiatedBy", initiatedBy))
      .order("desc")
      .take(12);
    const visibleOperations = await Promise.all(
      operations.map(async (operation) => {
        if (!canManagePassengerKinds(access, operation.importKinds)) {
          return null;
        }
        const job = await getVisibleJob(ctx, access, operation.jobCardId);
        if (!job) {
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
          stalled: operation.status === "running" && referenceNow - operation.updatedAt > 120_000,
          startedAt: operation.startedAt,
          status: operation.status,
          total: operation.total,
          updated: operation.updated,
          updatedAt: operation.updatedAt,
        };
      })
    );
    return visibleOperations.filter((operation) => operation !== null);
  },
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
  handler: async (ctx, args) => await ctx.db.get(args.operationId),
  returns: v.union(passengerExportOperationDocumentValidator, v.null()),
});

export const getAuthorizedPassengerExportOperation = internalQuery({
  args: {
    access: portalAccessArgumentValidator,
    operationId: v.string(),
  },
  handler: getAuthorizedPassengerExportOperationHandler,
  returns: passengerExportOperationDocumentValidator,
});

export const purgeExpiredPassengerExports = internalMutation({
  args: {},
  handler: async (ctx) => {
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
  },
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
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const page = await applyCrmCursorFilters(
      ctx.db.query("flightGroups").withIndex("by_createdAt").order("desc"),
      { equals: { jobCardId: args.jobCardId } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = await mapInBoundedBatches(page.page, async (group) => {
      const job = await getVisibleJob(ctx, access, group.jobCardId);
      if (!job) {
        return null;
      }
      const segments = await ctx.db
        .query("flightSegments")
        .withIndex("by_flightGroupId", (q) => q.eq("flightGroupId", group._id))
        .take(64);
      const travelBatch = group.travelBatchId ? await ctx.db.get(group.travelBatchId) : null;
      return {
        airline: group.airline,
        arrivalDate: group.arrivalDate ?? "",
        clientName: job.clientName,
        departureDate: group.departureDate,
        id: group._id,
        importKey: group.importKey ?? "",
        jobCardId: group.jobCardId,
        jobCode: job.jobCode,
        name: group.name,
        route: group.route,
        segments: segments
          .sort((a, b) => a.segmentIndex - b.segmentIndex)
          .map((segment) => ({
            airline: segment.airline,
            arriveTime: segment.arriveTime ?? "",
            dateLabel: segment.dateLabel,
            departTime: segment.departTime ?? "",
            destination: segment.destination,
            duration: segment.duration ?? "",
            flightNumber: segment.flightNumber,
            id: segment._id,
            importKey: segment.importKey,
            origin: segment.origin,
            transit: segment.transit ?? "",
          })),
        sourceGroupIndex: group.sourceGroupIndex ?? 0,
        sourceSheet: group.sourceSheet ?? "",
        travelBatchCode: travelBatch?.batchCode ?? "",
        travelBatchId: group.travelBatchId ?? "",
        travelBatchReference: travelBatch?.batchReference ?? "",
        updatedAt: new Date(group.updatedAt).toISOString(),
      };
    });
    return { ...page, page: compactPageItems(rows) };
  },
  returns: flightItineraryListPageResultValidator,
});
