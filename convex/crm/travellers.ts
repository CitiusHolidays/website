import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { resolveRoomCategory } from "../lib/roomTypes";
import { roomTypeValidator } from "../lib/roomTypeValidators";
import type { RuntimeObject } from "../lib/runtimeValues";
import { isRuntimeString, propertiesWhen } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { completeJobCardDeletionWorker, failJobCardDeletionOperation } from "./jobCardDeletion";
import {
  assertBulkDeleteMutationBatch,
  canSeeAllCementRecords,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  deleteStorageFile,
  flushDeferredNotificationCleanup,
  hasRole,
  isDirectorOrAdmin,
  PERMISSIONS,
  type PortalAccess,
  portalDateRangeValidator,
  requireAnyPermission,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import {
  assertListSearchReady,
  buildTravellerListSearchText,
  markListSearchDirty,
} from "./listSearch";
import { loadMetricTotals } from "./metricAggregates";
import type { MetricValues } from "./metricTypes";
import {
  deletedCountResultValidator,
  roomCountSummaryResultValidator,
  travellerIdResultValidator,
  travellerListPageResultValidator,
  travellerListRowResultValidator,
} from "./operationsReturnContracts";
import {
  applyCrmCreatedAtIndexRange,
  applyCrmCursorFilters,
  boundedPaginationOptions,
  loadRowsByIdInBatches,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { classifyPassportExpiryUrgency, normalizePassportExpiryDate } from "./passportExpiry";

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan")
);

const paymentTypeValidator = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid")
);

const guestTypeValidator = v.union(v.literal("Employee"), v.literal("Client"), v.literal("VIP"));

export function buildTravellerListSource(
  ctx: QueryCtx,
  args: { createdAtFrom?: number; createdAtTo?: number },
  search: string | undefined,
  normalizedJobCardId: Id<"jobCards"> | null
) {
  if (search) {
    return ctx.db
      .query("travellers")
      .withSearchIndex("search_list", (q) => q.search("listSearchText", search));
  }
  if (normalizedJobCardId) {
    return ctx.db
      .query("travellers")
      .withIndex("by_jobCardId_createdAt", (q) =>
        applyCrmCreatedAtIndexRange(q.eq("jobCardId", normalizedJobCardId), args)
      )
      .order("desc");
  }
  return ctx.db
    .query("travellers")
    .withIndex("by_createdAt", (q) => applyCrmCreatedAtIndexRange(q, args))
    .order("desc");
}

async function normalizeTravelBatchForJob(
  ctx: QueryCtx | MutationCtx,
  jobCardId: Id<"jobCards">,
  rawId?: string
) {
  const value = String(rawId ?? "").trim();
  if (!value) {
    return { travelBatch: null, travelBatchId: undefined };
  }
  const travelBatchId = ctx.db.normalizeId("travelBatches", value);
  if (!travelBatchId) {
    throw new ConvexError("Invalid Travel Batch id");
  }
  const batch = await ctx.db.get("travelBatches", travelBatchId);
  if (!batch || String(batch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Travel Batch must belong to the selected Job Card");
  }
  return { travelBatch: batch, travelBatchId };
}

function travellerText<Value extends string>(value: Value | null | undefined): Value | "" {
  return value ?? "";
}

function travellerFlag(value: boolean | undefined) {
  return value ?? false;
}

interface TravelBatchLabel {
  batchCode?: string;
  batchReference?: string;
}

const publicTraveller = (
  traveller: Doc<"travellers">,
  job: Doc<"jobCards">,
  travelBatch: TravelBatchLabel | null = null,
  hasPassportScan = traveller.hasPassportScan ?? false,
  passportExpiryDate = traveller.passportExpiryDate ?? ""
) => ({
  arrivingEarly: travellerFlag(traveller.arrivingEarly),
  biometricAppointmentDate: travellerText(traveller.biometricAppointmentDate),
  callingStatus: traveller.callingStatus,
  cancellation: travellerFlag(traveller.cancellation),
  clientName: travellerText(job?.clientName),
  createdAt: new Date(traveller.createdAt).toISOString(),
  domesticTravelRequired: travellerFlag(traveller.domesticTravelRequired),
  extensionOfTour: travellerFlag(traveller.extensionOfTour),
  foodPreference: traveller.foodPreference,
  fullName: traveller.fullName,
  gender: travellerText(traveller.gender),
  givenName: travellerText(traveller.givenName),
  guestCompanions: travellerText(traveller.guestCompanions),
  guestType: traveller.guestType,
  hasPassportScan,
  hotelAllocation: travellerText(traveller.hotelAllocation),
  id: traveller._id,
  jobCardId: traveller.jobCardId,
  jobCode: travellerText(job?.jobCode),
  lastMinuteDrop: travellerFlag(traveller.lastMinuteDrop),
  passportExpiryDate,
  passportStatus: travellerText(traveller.passportStatus),
  paymentType: traveller.paymentType,
  // Storage is widened during the room-type migration. Keep the public
  // contract canonical even if a legacy row is read before its page runs.
  roomType: resolveRoomCategory(traveller.roomType) ?? "Twin",
  specialRequests: travellerText(traveller.specialRequests),
  surname: travellerText(traveller.surname),
  ticketStatus: traveller.ticketStatus,
  travelBatchCode: travellerText(travelBatch?.batchCode),
  travelBatchId: travellerText(traveller.travelBatchId),
  travelBatchReference: travellerText(travelBatch?.batchReference),
  travelDate: travellerText(traveller.travelDate),
  travelHub: travellerText(traveller.travelHub),
  travelStartDate: travellerText(job?.travelStartDate),
  updatedAt: new Date(traveller.updatedAt).toISOString(),
  visaRequired: traveller.visaRequired,
  visaStatus: traveller.visaStatus,
});

interface TravellerCreateArgs {
  arrivingEarly?: boolean;
  biometricAppointmentDate?: string;
  domesticTravelRequired?: boolean;
  extensionOfTour?: boolean;
  foodPreference: Doc<"travellers">["foodPreference"];
  fullName: string;
  gender?: string;
  givenName?: string;
  guestCompanions?: string;
  guestType: Doc<"travellers">["guestType"];
  hotelAllocation?: string;
  jobCardId: string;
  passportStatus?: string;
  paymentType: Doc<"travellers">["paymentType"];
  roomType: Doc<"travellers">["roomType"];
  specialRequests?: string;
  surname?: string;
  travelBatchId?: string;
  travelDate?: string;
  travelHub?: string;
  visaRequired: boolean;
}

type TravellerUpdateArgs = Partial<Omit<TravellerCreateArgs, "jobCardId">> & {
  travellerId: string;
};

function buildTravellerCreateRow(
  args: TravellerCreateArgs,
  access: PortalAccess,
  job: Doc<"jobCards">,
  jobCardId: Id<"jobCards">,
  travelBatch: Doc<"travelBatches"> | null,
  travelBatchId: Id<"travelBatches"> | undefined,
  now: number
) {
  const visaStatus: "Not Required" | "Not Started" = args.visaRequired
    ? "Not Started"
    : "Not Required";
  return {
    jobCardId,
    ...propertiesWhen(travelBatchId, () => ({ travelBatchId })),
    arrivingEarly: travellerFlag(args.arrivingEarly),
    biometricAppointmentDate: travellerText(args.biometricAppointmentDate),
    callingStatus: "Pending" as const,
    cancellation: false,
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    domesticTravelRequired: travellerFlag(args.domesticTravelRequired),
    extensionOfTour: travellerFlag(args.extensionOfTour),
    foodPreference: args.foodPreference,
    fullName: args.fullName.trim(),
    gender: travellerText(args.gender).trim(),
    givenName: travellerText(args.givenName).trim(),
    guestCompanions: travellerText(args.guestCompanions).trim(),
    guestType: args.guestType,
    hasPassportScan: false,
    hotelAllocation: travellerText(args.hotelAllocation).trim(),
    lastMinuteDrop: false,
    listSearchText: buildTravellerListSearchText(args, {
      jobCode: job.jobCode,
      travelBatchReference: travelBatch?.batchReference,
    }),
    passportStatus: travellerText(args.passportStatus) || "Pending",
    paymentType: args.paymentType,
    roomType: args.roomType,
    specialRequests: travellerText(args.specialRequests).trim(),
    surname: travellerText(args.surname).trim(),
    ticketStatus: "Pending Issue" as const,
    travelBatchCode: travellerText(travelBatch?.batchCode),
    travelBatchReference: travellerText(travelBatch?.batchReference),
    travelDate: travellerText(args.travelDate),
    travelHub: travellerText(args.travelHub).trim(),
    updatedAt: now,
    visaRequired: args.visaRequired,
    visaStatus,
  };
}

function addOptionalTravellerFields(patch: RuntimeObject, args: TravellerUpdateArgs) {
  const trimmedFields = [
    "fullName",
    "surname",
    "givenName",
    "travelHub",
    "guestCompanions",
    "specialRequests",
    "passportStatus",
    "hotelAllocation",
    "gender",
  ] as const;
  for (const field of trimmedFields) {
    const value = args[field];
    if (isRuntimeString(value)) {
      patch[field] = value.trim();
    }
  }
  const directFields = [
    "foodPreference",
    "guestType",
    "paymentType",
    "roomType",
    "domesticTravelRequired",
    "biometricAppointmentDate",
    "travelDate",
    "extensionOfTour",
    "arrivingEarly",
  ] as const;
  for (const field of directFields) {
    const value = args[field];
    if (value !== undefined) {
      patch[field] = value;
    }
  }
}

function addVisaRequirementPatch(
  patch: RuntimeObject,
  args: TravellerUpdateArgs,
  traveller: Doc<"travellers">
) {
  if (args.visaRequired === undefined) {
    return;
  }
  patch.visaRequired = args.visaRequired;
  if (!args.visaRequired) {
    patch.visaStatus = "Not Required";
    return;
  }
  patch.visaStatus = traveller.visaStatus === "Not Required" ? "Not Started" : traveller.visaStatus;
}

async function syncTravellerVisaRecord(
  ctx: MutationCtx,
  args: TravellerUpdateArgs,
  access: PortalAccess,
  travellerId: Id<"travellers">,
  patch: RuntimeObject,
  now: number
) {
  if (args.visaRequired === undefined && args.biometricAppointmentDate === undefined) {
    return;
  }
  const visaRecord = await ctx.db
    .query("visaRecords")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
    .unique();
  if (!visaRecord) {
    return;
  }
  const visaPatch: RuntimeObject = {
    updatedAt: now,
    updatedBy: access.authUserId ?? "unknown",
  };
  if (args.visaRequired !== undefined) {
    visaPatch.status = patch.visaStatus;
  }
  if (args.biometricAppointmentDate !== undefined) {
    visaPatch.appointmentDate = args.biometricAppointmentDate;
  }
  await patchWithE2eOwnership(ctx, "visaRecords", visaRecord._id, visaPatch);
  await scheduleCrmMetricSync(ctx, "visaRecords", String(visaRecord._id));
}

export const listPage = query({
  args: {
    callingStatus: v.optional(v.string()),
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    passportExpiryUrgency: v.optional(
      v.union(
        v.literal("critical"),
        v.literal("expired"),
        v.literal("ok"),
        v.literal("unknown"),
        v.literal("warning")
      )
    ),
    passportReferenceDate: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    roomType: v.optional(roomTypeValidator),
    search: v.optional(v.string()),
    ticketStatus: v.optional(v.string()),
    visaStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const normalizedJobCardId = args.jobCardId
      ? ctx.db.normalizeId("jobCards", args.jobCardId)
      : null;
    if (args.jobCardId && !normalizedJobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const search = args.search?.trim();
    await assertListSearchReady(ctx, "travellers", search);
    const sourceQuery = buildTravellerListSource(ctx, args, search, normalizedJobCardId);
    const filteredSource = applyCrmCursorFilters(sourceQuery, {
      createdAtFrom: search ? args.createdAtFrom : undefined,
      createdAtTo: search ? args.createdAtTo : undefined,
      equals: {
        callingStatus: args.callingStatus,
        ...propertiesWhen(search && normalizedJobCardId, () => ({
          jobCardId: String(normalizedJobCardId),
        })),
        passportStatus: args.passportStatus,
        roomType: args.roomType,
        ticketStatus: args.ticketStatus,
        visaStatus: args.visaStatus,
      },
    });
    const sourcePage = await filteredSource.paginate(boundedPaginationOptions(args.paginationOpts));
    const jobs = await loadRowsByIdInBatches(
      ctx,
      "jobCards",
      sourcePage.page.map((traveller) => traveller.jobCardId),
      sourcePage.page.length
    );
    const jobById = new Map(jobs.map((job) => [String(job._id), job]));
    const linkedQueries = await loadRowsByIdInBatches(
      ctx,
      "queries",
      jobs.flatMap((job) => (job.queryId ? [job.queryId] : [])),
      jobs.length
    );
    const queryById = new Map(linkedQueries.map((row) => [String(row._id), row]));
    const visibleRows = sourcePage.page.filter((traveller) => {
      const job = jobById.get(String(traveller.jobCardId));
      if (!job) {
        return false;
      }
      const linkedQuery = job.queryId ? queryById.get(String(job.queryId)) : null;
      return canSeeJobCardRecord(access, job, linkedQuery);
    });
    let page = visibleRows.map((traveller) => {
      const job = jobById.get(String(traveller.jobCardId));
      if (!job) {
        throw new Error("Visible traveller is missing its visible Job Card");
      }
      return publicTraveller(
        traveller,
        job,
        traveller.travelBatchId
          ? {
              batchCode: traveller.travelBatchCode,
              batchReference: traveller.travelBatchReference,
            }
          : null
      );
    });
    if (args.passportExpiryUrgency) {
      const referenceDate = normalizePassportExpiryDate(args.passportReferenceDate);
      if (!referenceDate) {
        throw new ConvexError("A valid passport reference date is required");
      }
      const urgency = args.passportExpiryUrgency;
      page = page.filter(
        (traveller) =>
          classifyPassportExpiryUrgency({
            expiryDate: traveller.passportExpiryDate,
            referenceDate,
            travelDate: traveller.travelStartDate || traveller.travelDate,
          }) === urgency
      );
    }
    return { ...sourcePage, page };
  },
  returns: travellerListPageResultValidator,
});

function canUseGlobalRoomingAggregate(access: PortalAccess) {
  if (shouldApplyCementScope(access)) {
    return canSeeAllCementRecords(access);
  }
  return (
    isDirectorOrAdmin(access) ||
    [
      "Accounts",
      "Accounts Head",
      "Contracting Head",
      "Finance",
      "Head of Ticketing",
      "Operations Head",
    ].some((role) => hasRole(access, role))
  );
}

function mergeRoomMetricValues(target: MetricValues, source: MetricValues) {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
  return target;
}

function roomTypeCounts(values: MetricValues) {
  const prefix = "travellers.roomType.";
  const suffix = ".assignments";
  return Object.entries(values)
    .flatMap(([key, assignments]) =>
      key.startsWith(prefix) && key.endsWith(suffix) && assignments > 0
        ? [{ assignments, roomType: key.slice(prefix.length, -suffix.length) }]
        : []
    )
    .sort((left, right) => left.roomType.localeCompare(right.roomType));
}

export const getRoomCountSummary = query({
  args: {
    dateRange: portalDateRangeValidator,
    jobCardId: v.optional(v.string()),
    jobCardPageComplete: v.boolean(),
    visibleJobCardIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.visibleJobCardIds.length > 100) {
      throw new ConvexError("Room Count can summarize at most 100 visible Job Cards per page");
    }
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const requestedIds = Array.from(
      new Set([...(args.jobCardId ? [args.jobCardId] : []), ...args.visibleJobCardIds])
    );
    const normalizedIds = requestedIds.map((rawId) => {
      const id = ctx.db.normalizeId("jobCards", rawId);
      if (!id) {
        throw new ConvexError("Invalid Job Card id");
      }
      return id;
    });
    const jobs = await loadRowsByIdInBatches(
      ctx,
      "jobCards",
      normalizedIds,
      Math.max(1, normalizedIds.length)
    );
    const linkedQueries = await loadRowsByIdInBatches(
      ctx,
      "queries",
      jobs.flatMap((job) => (job.queryId ? [job.queryId] : [])),
      Math.max(1, jobs.length)
    );
    const queryById = new Map(linkedQueries.map((row) => [String(row._id), row]));
    const visibleJobs = jobs.filter((job) =>
      canSeeJobCardRecord(access, job, job.queryId ? queryById.get(String(job.queryId)) : null)
    );
    if (args.jobCardId && !visibleJobs.some((job) => String(job._id) === args.jobCardId)) {
      throw new ConvexError("FORBIDDEN");
    }
    const dateRange = args.dateRange ?? undefined;
    const jobAggregates = await mapInBoundedBatches(
      visibleJobs,
      async (job) => ({
        aggregate: await loadMetricTotals(ctx, `job:${String(job._id)}`, dateRange),
        job,
      }),
      8
    );
    const selectedJob = args.jobCardId
      ? visibleJobs.find((job) => String(job._id) === args.jobCardId)
      : null;
    const useGlobal = !selectedJob && canUseGlobalRoomingAggregate(access);
    const globalAggregate = useGlobal
      ? await loadMetricTotals(ctx, shouldApplyCementScope(access) ? "cement" : "all", dateRange)
      : null;
    const totals = globalAggregate
      ? globalAggregate.values
      : jobAggregates.reduce<MetricValues>(
          (values, entry) => mergeRoomMetricValues(values, entry.aggregate.values),
          {}
        );
    let scope: "all-visible" | "selected-job" | "visible-job-page" = "visible-job-page";
    if (selectedJob) {
      scope = "selected-job";
    } else if (useGlobal) {
      scope = "all-visible";
    }
    return {
      breakdownComplete: Boolean(selectedJob || args.jobCardPageComplete),
      complete:
        (globalAggregate?.complete ?? true) &&
        jobAggregates.every((entry) => entry.aggregate.complete),
      jobBreakdown: jobAggregates.map(({ aggregate, job }) => ({
        assignments: aggregate.values["travellers.roomingAssignments"] ?? 0,
        clientName: job.clientName,
        id: job._id,
        jobCode: job.jobCode,
        roomTypes: roomTypeCounts(aggregate.values),
      })),
      roomTypes: roomTypeCounts(totals),
      scope,
      totalAssignments: totals["travellers.roomingAssignments"] ?? 0,
      updatedAt: Math.max(
        globalAggregate?.updatedAt ?? 0,
        ...jobAggregates.map((entry) => entry.aggregate.updatedAt)
      ),
    };
  },
  returns: roomCountSummaryResultValidator,
});

export const getListRow = query({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      return null;
    }
    const traveller = await ctx.db.get("travellers", travellerId);
    if (!traveller) {
      return null;
    }
    const job = await ctx.db.get("jobCards", traveller.jobCardId);
    if (!job) {
      return null;
    }
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      return null;
    }
    const travelBatch = traveller.travelBatchId
      ? {
          batchCode: traveller.travelBatchCode,
          batchReference: traveller.travelBatchReference,
        }
      : null;
    return publicTraveller(traveller, job, travelBatch);
  },
  returns: travellerListRowResultValidator,
});

export const create = mutation({
  args: {
    arrivingEarly: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    domesticTravelRequired: v.optional(v.boolean()),
    extensionOfTour: v.optional(v.boolean()),
    foodPreference: foodPreferenceValidator,
    fullName: v.string(),
    gender: v.optional(v.string()),
    givenName: v.optional(v.string()),
    guestCompanions: v.optional(v.string()),
    guestType: guestTypeValidator,
    hotelAllocation: v.optional(v.string()),
    jobCardId: v.string(),
    passportStatus: v.optional(v.string()),
    paymentType: paymentTypeValidator,
    roomType: roomTypeValidator,
    specialRequests: v.optional(v.string()),
    surname: v.optional(v.string()),
    travelBatchId: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    travelHub: v.optional(v.string()),
    visaRequired: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get("jobCards", jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }
    const { travelBatch, travelBatchId } = await normalizeTravelBatchForJob(
      ctx,
      jobCardId,
      args.travelBatchId
    );

    const now = Date.now();
    const travellerRow = buildTravellerCreateRow(
      args,
      access,
      job,
      jobCardId,
      travelBatch,
      travelBatchId,
      now
    );
    const id = await insertWithE2eOwnership(ctx, "travellers", travellerRow);
    await markListSearchDirty(ctx, "travellers", String(id));
    await scheduleCrmMetricSync(ctx, "travellers", String(id));

    const [visaRecordId] = await Promise.all([
      insertWithE2eOwnership(ctx, "visaRecords", {
        createdAt: now,
        jobCardId,
        status: travellerRow.visaStatus,
        travellerId: id,
        updatedAt: now,
        updatedBy: access.authUserId ?? "unknown",
      }),
      createActivity(ctx, access, {
        action: "created",
        entityId: id,
        entityType: "traveller",
        message: `${args.fullName.trim()} added to ${job.jobCode}`,
      }),
    ]);
    await scheduleCrmMetricSync(ctx, "visaRecords", String(visaRecordId));
    return { id };
  },
  returns: travellerIdResultValidator,
});

export const update = mutation({
  args: {
    arrivingEarly: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    domesticTravelRequired: v.optional(v.boolean()),
    extensionOfTour: v.optional(v.boolean()),
    foodPreference: v.optional(foodPreferenceValidator),
    fullName: v.optional(v.string()),
    gender: v.optional(v.string()),
    givenName: v.optional(v.string()),
    guestCompanions: v.optional(v.string()),
    guestType: v.optional(guestTypeValidator),
    hotelAllocation: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    paymentType: v.optional(paymentTypeValidator),
    roomType: v.optional(roomTypeValidator),
    specialRequests: v.optional(v.string()),
    surname: v.optional(v.string()),
    travelBatchId: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    travelHub: v.optional(v.string()),
    travellerId: v.string(),
    visaRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const traveller = await ctx.db.get("travellers", travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    const job = await ctx.db.get("jobCards", traveller.jobCardId);
    const linkedQuery = await (job?.queryId
      ? ctx.db.get("queries", job.queryId)
      : Promise.resolve(null));
    if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.fullName !== undefined && !args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }

    const now = Date.now();
    const patch: RuntimeObject = { updatedAt: now };
    if (args.travelBatchId !== undefined) {
      const normalized = await normalizeTravelBatchForJob(
        ctx,
        traveller.jobCardId,
        args.travelBatchId
      );
      patch.travelBatchId = normalized.travelBatchId;
    }
    addOptionalTravellerFields(patch, args);
    addVisaRequirementPatch(patch, args, traveller);
    // SAFETY: both operands are travelBatches IDs produced by Convex validators or the stored traveller row.
    const nextTravelBatchId = (patch.travelBatchId ?? traveller.travelBatchId) as
      | Id<"travelBatches">
      | undefined;
    const nextTravelBatch = nextTravelBatchId
      ? await ctx.db.get("travelBatches", nextTravelBatchId)
      : null;
    patch.travelBatchCode = nextTravelBatch?.batchCode ?? "";
    patch.travelBatchReference = nextTravelBatch?.batchReference ?? "";
    patch.listSearchText = buildTravellerListSearchText(
      { ...traveller, ...patch },
      {
        jobCode: job.jobCode,
        travelBatchReference: nextTravelBatch?.batchReference,
      }
    );

    await patchWithE2eOwnership(ctx, "travellers", travellerId, patch);
    await markListSearchDirty(ctx, "travellers", String(travellerId));
    await scheduleCrmMetricSync(ctx, "travellers", String(travellerId));

    await syncTravellerVisaRecord(ctx, args, access, travellerId, patch, now);

    await createActivity(ctx, access, {
      action: "updated",
      entityId: travellerId,
      entityType: "traveller",
      message: `${(args.fullName ?? traveller.fullName).trim()} updated`,
    });
    return { id: travellerId };
  },
  returns: travellerIdResultValidator,
});

export const updateCallingStatus = mutation({
  args: {
    callingStatus: v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response")),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_TRAVELLERS,
      PERMISSIONS.MANAGE_TOUR_MANAGERS,
    ]);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const traveller = await ctx.db.get("travellers", travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    const job = await ctx.db.get("jobCards", traveller.jobCardId);
    const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
      throw new ConvexError("FORBIDDEN");
    }
    await patchWithE2eOwnership(ctx, "travellers", travellerId, {
      callingStatus: args.callingStatus,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      action: "calling_status_updated",
      entityId: travellerId,
      entityType: "traveller",
      message: `Traveller calling status set to ${args.callingStatus}`,
    });
    return { id: travellerId };
  },
  returns: travellerIdResultValidator,
});

export async function deleteTravellerRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  travellerId: Id<"travellers">
) {
  const traveller = await ctx.db.get("travellers", travellerId);
  if (!traveller) {
    throw new ConvexError("Traveller not found");
  }
  const job = await ctx.db.get("jobCards", traveller.jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    throw new ConvexError("FORBIDDEN");
  }

  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: travellerId,
      entityType: "traveller",
      message: `${traveller.fullName} deleted`,
    }),
    deleteEntityNotifications(ctx, "traveller", travellerId),
    ctx.db.delete("travellers", travellerId),
    ctx.scheduler.runAfter(0, internal.crm.travellers.continueTravellerCleanup, {
      mode: "all",
      stage: "passportDetails",
      travellerId: String(travellerId),
    }),
  ]);
  await markListSearchDirty(ctx, "travellers", String(travellerId));
  await scheduleCrmMetricSync(ctx, "travellers", String(travellerId));
}

const travellerCleanupStageValidator = v.union(
  v.literal("mealPreferences"),
  v.literal("passportDetails"),
  v.literal("roomingListEntries"),
  v.literal("seatAllocations"),
  v.literal("tickets"),
  v.literal("visaRecords")
);
type TravellerCleanupStage =
  | "mealPreferences"
  | "passportDetails"
  | "roomingListEntries"
  | "seatAllocations"
  | "tickets"
  | "visaRecords";
const ALL_TRAVELLER_CLEANUP_STAGES: TravellerCleanupStage[] = [
  "passportDetails",
  "visaRecords",
  "tickets",
  "seatAllocations",
  "mealPreferences",
  "roomingListEntries",
];
const PRIVATE_TRAVELLER_CLEANUP_STAGES: TravellerCleanupStage[] = [
  "passportDetails",
  "mealPreferences",
];
const CASCADE_DELETE_PAGE_SIZE = 32;
const travellerCleanupResultValidator = v.object({
  complete: v.boolean(),
  deleted: v.number(),
});

export const continueTravellerCleanup = internalMutation({
  args: {
    mode: v.union(v.literal("all"), v.literal("private")),
    operationId: v.optional(v.id("jobCardDeletionOperations")),
    stage: travellerCleanupStageValidator,
    travellerId: v.string(),
    workerId: v.optional(v.id("jobCardDeletionWorkers")),
  },
  handler: async (ctx, args) => {
    try {
      const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
      if (!travellerId) {
        throw new Error("Invalid traveller cleanup identity");
      }
      const rows = await ctx.db
        .query(args.stage)
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .take(CASCADE_DELETE_PAGE_SIZE);
      const notifications: Array<{ entityId: string; entityType: string }> = [];
      await Promise.all(
        rows.map(async (row) => {
          if (args.stage === "passportDetails" && "storageId" in row) {
            await deleteStorageFile(ctx, row.storageId, "passport scan");
          }
          if (args.stage === "tickets") {
            notifications.push({ entityId: String(row._id), entityType: "ticket" });
          }
          await ctx.db.delete(args.stage, row._id);
          if (args.stage === "tickets" || args.stage === "visaRecords") {
            await scheduleCrmMetricSync(ctx, args.stage, String(row._id));
          }
        })
      );
      if (notifications.length > 0) {
        await flushDeferredNotificationCleanup(ctx, notifications);
      }
      const stages =
        args.mode === "private" ? PRIVATE_TRAVELLER_CLEANUP_STAGES : ALL_TRAVELLER_CLEANUP_STAGES;
      const stageIndex = stages.indexOf(args.stage);
      const nextStage =
        rows.length === CASCADE_DELETE_PAGE_SIZE ? args.stage : stages[stageIndex + 1];
      if (nextStage) {
        await ctx.scheduler.runAfter(0, internal.crm.travellers.continueTravellerCleanup, {
          ...args,
          stage: nextStage,
        });
      } else if (args.operationId && args.workerId) {
        await completeJobCardDeletionWorker(ctx, args.operationId, args.workerId);
      }
      return { complete: !nextStage, deleted: rows.length };
    } catch (error) {
      if (args.operationId) {
        await failJobCardDeletionOperation(ctx, args.operationId, error);
        return { complete: false, deleted: 0 };
      }
      throw error;
    }
  },
  returns: travellerCleanupResultValidator,
});

export const remove = mutation({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    await deleteTravellerRecord(ctx, access, travellerId);
    return { id: travellerId };
  },
  returns: travellerIdResultValidator,
});

export const removeMany = mutation({
  args: {
    travellerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    assertBulkDeleteMutationBatch(args.travellerIds.length);
    const ids: Id<"travellers">[] = [];
    for (const raw of args.travellerIds) {
      const travellerId = ctx.db.normalizeId("travellers", raw);
      if (!travellerId) {
        throw new ConvexError("Invalid traveller id");
      }
      ids.push(travellerId);
    }
    await mapInBoundedBatches(
      ids,
      async (travellerId) => await deleteTravellerRecord(ctx, access, travellerId),
      4
    );
    return { deletedCount: ids.length };
  },
  returns: deletedCountResultValidator,
});
