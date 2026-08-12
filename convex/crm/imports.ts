import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { portalAccessArgumentValidator } from "../lib/importContractValidators";
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
import { canManagePassengerKinds, canViewPassengerKinds } from "./passengerKindPolicy";

const PASSENGER_EXPORT_ARTIFACT_TTL_MS = 15 * 60 * 1000;
const PASSENGER_EXPORT_CLEANUP_BATCH_SIZE = 50;
const PASSENGER_EXPORT_LEASE_MS = 120_000;

const passengerExportOperationDocumentValidator = v.object({
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
  leaseExpiresAt: v.optional(v.number()),
  leaseId: v.optional(v.string()),
  rowsProcessed: v.number(),
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

const passengerExportSourceRowValidator = v.object({
  cancellation: v.boolean(),
  contactNo: v.string(),
  createdAt: v.number(),
  encryptedPassportPayload: v.string(),
  foodPreference: v.string(),
  fullName: v.string(),
  gender: v.string(),
  givenName: v.string(),
  hotelAllocation: v.string(),
  lastMinuteDrop: v.boolean(),
  paymentType: v.string(),
  roomType: v.string(),
  sourceDealerCode: v.string(),
  sourceDealerName: v.string(),
  sourceDescription: v.string(),
  sourceGroup: v.string(),
  sourceRowNumber: v.union(v.number(), v.null()),
  sourceRsoName: v.string(),
  sourceSheet: v.string(),
  sourceSoName: v.string(),
  specialRequests: v.string(),
  surname: v.string(),
  tickets: v.array(
    v.object({
      airline: v.string(),
      fareType: v.string(),
      pnrCode: v.string(),
      route: v.string(),
      ticketNumber: v.string(),
      ticketType: v.string(),
    })
  ),
  travelBatchCode: v.string(),
  travelBatchId: v.string(),
  travelBatchReference: v.string(),
  travelHub: v.string(),
  travellerId: v.id("travellers"),
  visa: v.object({ appointmentDate: v.string(), notes: v.string(), status: v.string() }),
  visaRequired: v.boolean(),
  visaStatus: v.string(),
});

const passengerExportSourcePageValidator = v.object({
  clientName: v.string(),
  continueCursor: v.string(),
  isDone: v.boolean(),
  jobCode: v.string(),
  page: v.array(passengerExportSourceRowValidator),
  pageStatus: v.optional(
    v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())
  ),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

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
  jobCardId: string;
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
    jobCardId: v.string(),
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

export const commitPassengerImportBatch = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    batchId: v.string(),
    jobCardId: v.string(),
    logActivity: v.optional(v.boolean()),
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

    const existingBatch = await ctx.db
      .query("crmImportBatches")
      .withIndex("by_batchId", (q) => q.eq("batchId", args.batchId))
      .unique();
    if (existingBatch?.status === "completed") {
      return {
        accepted: existingBatch.accepted,
        batchId: existingBatch.batchId,
        created: existingBatch.created,
        errors: existingBatch.errors.map((error) => ({
          ...error,
          kind: error.kind ?? ("terminal" as const),
        })),
        failed: existingBatch.failed,
        processed: existingBatch.processed,
        remaining: existingBatch.remaining,
        roomSummary: existingBatch.roomSummary,
        status: existingBatch.status,
        updated: existingBatch.updated,
      };
    }

    const now = Date.now();
    const batchDocument = {
      accepted: args.rows.length,
      attemptCount: (existingBatch?.attemptCount ?? 0) + 1,
      batchId: args.batchId,
      completedAt: undefined,
      created: 0,
      errors: [],
      failed: 0,
      jobCardId,
      processed: 0,
      remaining: args.rows.length,
      roomSummary: {},
      status: "processing" as const,
      updated: 0,
      updatedAt: now,
    };
    const ledgerId =
      existingBatch?._id ??
      (await ctx.db.insert("crmImportBatches", {
        ...batchDocument,
        createdAt: now,
      }));
    if (existingBatch) {
      await ctx.db.patch(existingBatch._id, batchDocument);
    }

    const matchIndex = await buildTravellerMatchIndex(ctx, jobCardId);
    const result = await processImportRows(ctx, {
      access: args.access,
      job,
      jobCardId,
      logActivity: args.logActivity ?? false,
      matchIndex,
      rows: args.rows,
    });
    const status = result.remaining > 0 ? ("retryable" as const) : ("completed" as const);
    await ctx.db.patch(ledgerId, {
      accepted: result.accepted,
      completedAt: status === "completed" ? Date.now() : undefined,
      created: result.created,
      errors: result.errors,
      failed: result.failed,
      processed: result.processed,
      remaining: result.remaining,
      roomSummary: result.roomSummary,
      status,
      updated: result.updated,
      updatedAt: Date.now(),
    });
    return { ...result, batchId: args.batchId, status };
  },
});

export const beginPassengerImportOperation = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    batchTotal: v.number(),
    importKinds: v.array(v.string()),
    jobCardId: v.string(),
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
      if (existing.status !== "completed") {
        await ctx.db.patch(existing._id, { status: "running", updatedAt: Date.now() });
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
    created: v.number(),
    errorSummary: v.object({ retryable: v.number(), terminal: v.number() }),
    failed: v.number(),
    operationId: v.id("passengerImportOperations"),
    processed: v.number(),
    remaining: v.number(),
    roomSummary: v.record(v.string(), v.number()),
    updated: v.number(),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError("Import operation not found");
    }
    const existingBatch = await ctx.db
      .query("passengerImportOperationBatches")
      .withIndex("by_operationId_batchId", (q) =>
        q.eq("operationId", args.operationId).eq("batchId", args.batchId)
      )
      .unique();
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
    const wasCompleted = existingBatch?.remaining === 0 ? 1 : 0;
    const isCompleted = args.remaining === 0 ? 1 : 0;
    const batchDocument = {
      accepted: args.accepted,
      batchId: args.batchId,
      created: args.created,
      errorSummary: args.errorSummary,
      failed: args.failed,
      operationId: args.operationId,
      processed: args.processed,
      remaining: args.remaining,
      roomSummary: args.roomSummary,
      updated: args.updated,
    };
    await Promise.all([
      existingBatch
        ? ctx.db.patch(existingBatch._id, batchDocument)
        : ctx.db.insert("passengerImportOperationBatches", {
            ...batchDocument,
            createdAt: now,
          }),
      ctx.db.patch(args.operationId, {
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
    const operation = await ctx.db.get(args.operationId);
    if (!operation) {
      throw new ConvexError("Import operation not found");
    }
    const now = Date.now();
    await ctx.db.patch(args.operationId, {
      completedAt: now,
      status: operation.failed > 0 || operation.remaining > 0 ? "partial" : "completed",
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const commitPassengerImportRows = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    jobCardId: v.string(),
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
    return await processImportRows(ctx, {
      access: args.access,
      job,
      jobCardId,
      logActivity: true,
      matchIndex,
      rows: args.rows,
    });
  },
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
    jobCardId: v.string(),
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
    jobCardId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
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
    const page = await ctx.db
      .query("travellers")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      .paginate(args.paginationOpts);
    const rows = await mapInBoundedBatches(page.page, async (traveller) => {
      const [passport, visaRecord, ticketRows, travelBatch] = await Promise.all([
        ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
          .unique(),
        ctx.db
          .query("visaRecords")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
          .unique(),
        ctx.db
          .query("tickets")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
          .collect(),
        traveller.travelBatchId ? ctx.db.get(traveller.travelBatchId) : null,
      ]);
      const tickets = await mapInBoundedBatches(ticketRows, async (ticket) => {
        const pnr = ticket.pnrId ? await ctx.db.get(ticket.pnrId) : null;
        return {
          airline: pnr?.airline ?? "",
          fareType: pnr?.fareType ?? "",
          pnrCode: pnr?.pnrCode ?? "",
          route: pnr?.route ?? "",
          ticketNumber: ticket.ticketNumber ?? "",
          ticketType: ticket.ticketType ?? "",
        };
      });
      return {
        cancellation: traveller.cancellation ?? false,
        contactNo: traveller.contactNo ?? "",
        createdAt: traveller.createdAt,
        encryptedPassportPayload: passport?.encryptedPayload ?? "",
        foodPreference: traveller.foodPreference,
        fullName: traveller.fullName,
        gender: traveller.gender ?? "",
        givenName: traveller.givenName ?? "",
        hotelAllocation: traveller.hotelAllocation ?? "",
        lastMinuteDrop: traveller.lastMinuteDrop ?? false,
        paymentType: traveller.paymentType,
        roomType: traveller.roomType,
        sourceDealerCode: traveller.sourceDealerCode ?? "",
        sourceDealerName: traveller.sourceDealerName ?? "",
        sourceDescription: traveller.sourceDescription ?? "",
        sourceGroup: traveller.sourceGroup ?? "",
        sourceRowNumber: traveller.sourceRowNumber ?? null,
        sourceRsoName: traveller.sourceRsoName ?? "",
        sourceSheet: traveller.sourceSheet ?? "",
        sourceSoName: traveller.sourceSoName ?? "",
        specialRequests: traveller.specialRequests ?? "",
        surname: traveller.surname ?? "",
        tickets,
        travelBatchCode: travelBatch?.batchCode ?? "",
        travelBatchId: traveller.travelBatchId ?? "",
        travelBatchReference: travelBatch?.batchReference ?? "",
        travelHub: traveller.travelHub ?? "",
        travellerId: traveller._id,
        visa: visaRecord
          ? {
              appointmentDate: visaRecord.appointmentDate ?? "",
              notes: visaRecord.notes ?? "",
              status: visaRecord.status,
            }
          : {
              appointmentDate: traveller.biometricAppointmentDate ?? "",
              notes: "",
              status: traveller.visaStatus,
            },
        visaRequired: traveller.visaRequired,
        visaStatus: traveller.visaStatus,
      };
    });
    return {
      ...page,
      clientName: job.clientName,
      jobCode: job.jobCode,
      page: rows,
    };
  },
  returns: passengerExportSourcePageValidator,
});

export const beginPassengerExportOperation = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    commandId: v.string(),
    exportKind: exportKindValidator,
    jobCardId: v.string(),
    leaseId: v.string(),
  },
  handler: async (ctx, args) => {
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
          expiresAt: undefined,
          fileName: undefined,
          leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
          leaseId: args.leaseId,
          rowsProcessed: 0,
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
    const operationId = await ctx.db.insert("passengerExportOperations", {
      attemptCount: 1,
      commandId: args.commandId,
      exportKind: args.exportKind,
      initiatedBy,
      ...(args.access.staffId ? { initiatedByStaffId: args.access.staffId } : {}),
      jobCardId,
      leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
      leaseId: args.leaseId,
      rowsProcessed: 0,
      startedAt: now,
      status: "running",
      updatedAt: now,
    });
    return { operationId, replayed: false };
  },
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
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.leaseId !== args.leaseId || operation.status !== "running") {
      throw new ConvexError("Export operation lease was superseded");
    }
    await ctx.db.patch(args.operationId, {
      leaseExpiresAt: Date.now() + PASSENGER_EXPORT_LEASE_MS,
      rowsProcessed: args.rowsProcessed,
      updatedAt: Date.now(),
    });
    return null;
  },
  returns: v.null(),
});

export const completePassengerExportOperation = internalMutation({
  args: {
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    rowsProcessed: v.number(),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (
      !(operation?.storageId && operation.fileName) ||
      operation.leaseId !== args.leaseId ||
      operation.status !== "running"
    ) {
      throw new ConvexError("Export artifact was not staged");
    }
    const now = Date.now();
    await ctx.db.patch(args.operationId, {
      completedAt: now,
      expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      rowsProcessed: args.rowsProcessed,
      status: "completed",
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const stagePassengerExportArtifact = internalMutation({
  args: {
    fileName: v.string(),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (operation?.status !== "running" || operation.leaseId !== args.leaseId) {
      throw new ConvexError("Export operation is not running");
    }
    const now = Date.now();
    await ctx.db.patch(args.operationId, {
      expiresAt: now + PASSENGER_EXPORT_ARTIFACT_TTL_MS,
      fileName: args.fileName,
      leaseExpiresAt: now + PASSENGER_EXPORT_LEASE_MS,
      storageId: args.storageId,
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const failPassengerExportOperation = internalMutation({
  args: {
    artifactDeleted: v.boolean(),
    errorCode: v.string(),
    leaseId: v.string(),
    operationId: v.id("passengerExportOperations"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get(args.operationId);
    if (!operation || operation.leaseId !== args.leaseId) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(args.operationId, {
      errorCode: args.errorCode,
      expiresAt: args.artifactDeleted ? undefined : now,
      status: "failed",
      ...(args.artifactDeleted ? { storageId: undefined } : {}),
      leaseExpiresAt: undefined,
      leaseId: undefined,
      updatedAt: now,
    });
    return null;
  },
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
  handler: async (ctx, args) => {
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
  },
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
          status: "expired",
          storageId: undefined,
          updatedAt: now,
        });
        if (expiredStorageId) {
          await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
            storageId: expiredStorageId,
          });
        }
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
  handler: async (ctx, args) => {
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
  },
  returns: passengerExportOperationListValidator,
});

export const logPassengerExport = internalMutation({
  args: {
    access: portalAccessArgumentValidator,
    exportKind: v.optional(exportKindValidator),
    jobCardId: v.string(),
    rowCount: v.number(),
  },
  handler: async (ctx, args) => {
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      return;
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      return;
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
  },
});

export const listFlightItinerary = query({
  args: {
    jobCardId: v.optional(v.string()),
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
