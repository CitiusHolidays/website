import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  assertBulkDeleteMutationBatch,
  assertDateRangeOrder,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  flushDeferredNotificationCleanup,
  type NotificationEntityIdentity,
  PERMISSIONS,
  type PortalAccess,
  publishWorkflowNotification,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import {
  deletedCountResultValidator,
  hotelIdResultValidator,
  hotelListPageResultValidator,
  tourManagerIdResultValidator,
  tourManagerListPageResultValidator,
} from "./operationsReturnContracts";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

async function getVisibleJob(
  ctx: MutationCtx | QueryCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">
) {
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}

async function getValidatedTravelBatch(
  ctx: MutationCtx | QueryCtx,
  travelBatchId: string | undefined,
  jobCardId: Id<"jobCards"> | null | undefined
) {
  if (!travelBatchId) {
    return null;
  }
  const id = ctx.db.normalizeId("travelBatches", travelBatchId);
  if (!id) {
    throw new ConvexError("Invalid Travel Batch id");
  }
  const batch = await ctx.db.get("travelBatches", id);
  if (!batch) {
    throw new ConvexError("Travel Batch not found");
  }
  if (String(batch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Travel Batch must belong to the selected Job Card");
  }
  return batch;
}

function tourManagerNotificationBody(
  job: Doc<"jobCards">,
  batch: Doc<"travelBatches"> | null,
  reportingInstructions?: string
) {
  const target = batch?.batchReference ? `${job.jobCode} (${batch.batchReference})` : job.jobCode;
  const details = [
    job.clientName,
    batch?.destination ?? job.destination,
    reportingInstructions?.trim(),
  ].filter(Boolean);
  return `You were allocated as Tour Manager for ${target}${details.length ? `: ${details.join(" - ")}` : "."}`;
}

export const listHotels = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_OPERATIONS);
    const page = await applyCrmCursorFilters(
      ctx.db.query("hotels").withIndex("by_createdAt").order("desc"),
      { equals: { jobCardId: args.jobCardId } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = await mapInBoundedBatches(page.page, async (hotel) => {
      const job = await getVisibleJob(ctx, access, hotel.jobCardId);
      if (!job) {
        return null;
      }
      return {
        checkInDate: hotel.checkInDate ?? "",
        checkOutDate: hotel.checkOutDate ?? "",
        city: hotel.city ?? "",
        clientName: job?.clientName ?? "",
        createdAt: new Date(hotel.createdAt).toISOString(),
        earlyCheckIn: hotel.earlyCheckIn ?? false,
        id: hotel._id,
        jobCardId: hotel.jobCardId,
        jobCode: job?.jobCode ?? "",
        lateCheckout: hotel.lateCheckout ?? false,
        name: hotel.name,
        specialInstructions: hotel.specialInstructions ?? "",
      };
    });
    return { ...page, page: compactPageItems(rows) };
  },
  returns: hotelListPageResultValidator,
});

export const createHotel = mutation({
  args: {
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
    city: v.optional(v.string()),
    jobCardId: v.string(),
    name: v.string(),
    specialInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, access, jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found or not assigned to you");
    }
    assertDateRangeOrder(args.checkInDate, args.checkOutDate, "Check-in date", "Check-out date");
    const now = Date.now();
    const id = await ctx.db.insert("hotels", {
      checkInDate: args.checkInDate || "",
      checkOutDate: args.checkOutDate || "",
      city: args.city?.trim() || "",
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      earlyCheckIn: false,
      jobCardId,
      lateCheckout: false,
      name: args.name.trim(),
      specialInstructions: args.specialInstructions?.trim() || "",
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "hotel",
      message: `${args.name.trim()} hotel added`,
    });
    return { id };
  },
  returns: hotelIdResultValidator,
});

export const updateHotel = mutation({
  args: {
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
    city: v.optional(v.string()),
    earlyCheckIn: v.optional(v.boolean()),
    hotelId: v.string(),
    lateCheckout: v.optional(v.boolean()),
    name: v.optional(v.string()),
    specialInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    const hotelId = ctx.db.normalizeId("hotels", args.hotelId);
    if (!hotelId) {
      throw new ConvexError("Invalid hotel id");
    }
    const hotel = await ctx.db.get("hotels", hotelId);
    if (!hotel) {
      throw new ConvexError("Hotel not found");
    }
    const job = await getVisibleJob(ctx, access, hotel.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.name !== undefined && !args.name.trim()) {
      throw new ConvexError("Hotel name is required");
    }
    assertDateRangeOrder(
      args.checkInDate ?? hotel.checkInDate,
      args.checkOutDate ?? hotel.checkOutDate,
      "Check-in date",
      "Check-out date"
    );

    const patch: RuntimeObject = { updatedAt: Date.now() };
    if (args.name !== undefined) {
      patch.name = args.name.trim();
    }
    if (args.city !== undefined) {
      patch.city = args.city.trim();
    }
    if (args.checkInDate !== undefined) {
      patch.checkInDate = args.checkInDate;
    }
    if (args.checkOutDate !== undefined) {
      patch.checkOutDate = args.checkOutDate;
    }
    if (args.earlyCheckIn !== undefined) {
      patch.earlyCheckIn = args.earlyCheckIn;
    }
    if (args.lateCheckout !== undefined) {
      patch.lateCheckout = args.lateCheckout;
    }
    if (args.specialInstructions !== undefined) {
      patch.specialInstructions = args.specialInstructions.trim();
    }

    await ctx.db.patch("hotels", hotelId, patch);
    await createActivity(ctx, access, {
      action: "updated",
      entityId: hotelId,
      entityType: "hotel",
      message: `${(args.name ?? hotel.name).trim()} hotel updated`,
    });
    return { id: hotelId };
  },
  returns: hotelIdResultValidator,
});

async function deleteHotelRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  hotelId: Id<"hotels">,
  deferredNotifications?: NotificationEntityIdentity[]
) {
  const hotel = await ctx.db.get("hotels", hotelId);
  if (!hotel) {
    throw new ConvexError("Hotel not found");
  }
  const job = await getVisibleJob(ctx, access, hotel.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: hotelId,
      entityType: "hotel",
      message: `${hotel.name} hotel deleted`,
    }),
    deleteEntityNotifications(ctx, "hotel", hotelId, deferredNotifications),
    ctx.db.delete("hotels", hotelId),
  ]);
}

export const removeHotel = mutation({
  args: {
    hotelId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    const hotelId = ctx.db.normalizeId("hotels", args.hotelId);
    if (!hotelId) {
      throw new ConvexError("Invalid hotel id");
    }
    await deleteHotelRecord(ctx, access, hotelId);
    return { id: hotelId };
  },
  returns: hotelIdResultValidator,
});

export const removeManyHotels = mutation({
  args: {
    hotelIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    assertBulkDeleteMutationBatch(args.hotelIds.length);
    const ids: Id<"hotels">[] = [];
    for (const raw of args.hotelIds) {
      const hotelId = ctx.db.normalizeId("hotels", raw);
      if (!hotelId) {
        throw new ConvexError("Invalid hotel id");
      }
      ids.push(hotelId);
    }
    const notifications: NotificationEntityIdentity[] = [];
    await mapInBoundedBatches(
      ids,
      async (hotelId) => await deleteHotelRecord(ctx, access, hotelId, notifications),
      4
    );
    await flushDeferredNotificationCleanup(ctx, notifications);
    return { deletedCount: ids.length };
  },
  returns: deletedCountResultValidator,
});

export const listTourManagers = query({
  args: {
    callingStatus: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS);
    const page = await applyCrmCursorFilters(
      ctx.db.query("tourManagerAssignments").withIndex("by_createdAt").order("desc"),
      {
        equals: {
          callingStatus: args.callingStatus,
          jobCardId: args.jobCardId,
          status: args.status,
        },
      }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = await mapInBoundedBatches(page.page, async (row) => {
      const job = row.jobCardId ? await getVisibleJob(ctx, access, row.jobCardId) : null;
      if (row.jobCardId && !job) {
        return null;
      }
      return {
        availabilityDate: row.availabilityDate ?? "",
        callingStatus: row.callingStatus,
        createdAt: new Date(row.createdAt).toISOString(),
        currentTour: job?.clientName ?? "",
        email: row.email ?? "",
        id: row._id,
        jobCardId: row.jobCardId ?? null,
        jobCode: job?.jobCode ?? "",
        languages: row.languages ?? [],
        name: row.name,
        notes: row.notes ?? "",
        phone: row.phone ?? "",
        reportingInstructions: row.reportingInstructions ?? "",
        staffId: row.staffId ?? ("" as const),
        status: row.status,
        travelBatchId: row.travelBatchId ?? null,
      };
    });
    return { ...page, page: compactPageItems(rows) };
  },
  returns: tourManagerListPageResultValidator,
});

interface ResolvedTourManagerIdentity {
  email: string;
  name: string;
  phone: string;
  staffId: Id<"staffUsers"> | null;
}

interface CreateTourManagerArgs {
  availabilityDate?: string;
  email?: string;
  jobCardId?: string;
  name: string;
  notes?: string;
  phone?: string;
  reportingInstructions?: string;
  staffId?: string;
  travelBatchId?: string;
}

interface UpdateTourManagerArgs {
  availabilityDate?: string;
  callingStatus?: "Done" | "No response" | "Pending";
  email?: string;
  jobCardId?: string;
  languages?: string[];
  name?: string;
  notes?: string;
  phone?: string;
  reportingInstructions?: string;
  staffId?: string;
  status?: "Assigned" | "Available" | "Inactive";
  tourManagerId: string;
  travelBatchId?: string;
}

async function resolveTourManagerIdentity(ctx: MutationCtx, args: CreateTourManagerArgs) {
  const fallback: ResolvedTourManagerIdentity = {
    email: args.email?.trim() || "",
    name: args.name.trim(),
    phone: args.phone?.trim() || "",
    staffId: null,
  };
  if (!args.staffId) {
    return fallback;
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get("staffUsers", staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  if (!staff.roles.includes("Tour Manager")) {
    throw new ConvexError("Selected staff member is not a tour manager");
  }
  return {
    email: staff.email || fallback.email,
    name: staff.name.trim(),
    phone: staff.mobile || fallback.phone,
    staffId,
  };
}

async function resolveTourManagerAssignment(
  ctx: MutationCtx,
  access: PortalAccess,
  args: CreateTourManagerArgs
) {
  const jobCardId = args.jobCardId ? ctx.db.normalizeId("jobCards", args.jobCardId) : null;
  if (args.jobCardId && !jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  if (jobCardId && !(await getVisibleJob(ctx, access, jobCardId))) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  if (args.travelBatchId && !jobCardId) {
    throw new ConvexError("Travel Batch requires a Job Card assignment");
  }
  return {
    jobCardId,
    travelBatch: await getValidatedTravelBatch(ctx, args.travelBatchId, jobCardId),
  };
}

async function notifyTourManagerCreated(
  ctx: MutationCtx,
  {
    access,
    args,
    id,
    jobCardId,
    name,
    staffId,
    travelBatch,
  }: {
    access: PortalAccess;
    args: CreateTourManagerArgs;
    id: Id<"tourManagerAssignments">;
    jobCardId: Id<"jobCards"> | null;
    name: string;
    staffId: Id<"staffUsers"> | null;
    travelBatch: Doc<"travelBatches"> | null;
  }
) {
  const activity = createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "tourManager",
    message: `${name} added as Tour Manager`,
  });
  if (!(staffId && jobCardId)) {
    await activity;
    return;
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    await activity;
    return;
  }
  await Promise.all([
    activity,
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "staff", staffIds: [staffId] },
      content: {
        body: tourManagerNotificationBody(job, travelBatch, args.reportingInstructions),
        entityId: id,
        entityType: "tourManager",
        title: "Tour Manager allocated",
      },
      emailTargets: { kind: "staff", staffIds: [staffId] },
    }),
  ]);
}

export async function createTourManagerForTest(
  ctx: MutationCtx,
  args: CreateTourManagerArgs,
  access: PortalAccess
) {
  const { email, name, phone, staffId } = await resolveTourManagerIdentity(ctx, args);
  const { jobCardId, travelBatch } = await resolveTourManagerAssignment(ctx, access, args);
  const now = Date.now();
  const id = await ctx.db.insert("tourManagerAssignments", {
    availabilityDate: args.availabilityDate || "",
    callingStatus: "Pending",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    email,
    jobCardId: jobCardId ?? undefined,
    languages: [],
    name,
    notes: args.notes?.trim() || "",
    phone,
    reportingInstructions: args.reportingInstructions?.trim() || "",
    staffId: staffId ?? undefined,
    status: jobCardId ? "Assigned" : "Available",
    travelBatchId: travelBatch?._id,
    updatedAt: now,
  });
  if (jobCardId) {
    await ctx.db.patch("jobCards", jobCardId, {
      tourManagerId: id,
      tourManagerName: name,
      updatedAt: now,
    });
    await scheduleCrmMetricSync(ctx, "jobCards", String(jobCardId));
  }
  await notifyTourManagerCreated(ctx, {
    access,
    args,
    id,
    jobCardId,
    name,
    staffId,
    travelBatch,
  });
  return { id };
}

export const createTourManager = mutation({
  args: {
    availabilityDate: v.optional(v.string()),
    email: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    name: v.string(),
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    reportingInstructions: v.optional(v.string()),
    staffId: v.optional(v.string()),
    travelBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    createTourManagerForTest(ctx, args, await requireHeadOrAdmin(ctx, ["Operations Head"])),
  returns: tourManagerIdResultValidator,
});

function addTourManagerUpdateFields(patch: RuntimeObject, args: UpdateTourManagerArgs) {
  const trimmedFields = ["name", "email", "phone", "reportingInstructions", "notes"] as const;
  for (const field of trimmedFields) {
    if (args[field] !== undefined) {
      patch[field] = args[field].trim();
    }
  }
  const directFields = ["availabilityDate", "languages", "callingStatus", "status"] as const;
  for (const field of directFields) {
    if (args[field] !== undefined) {
      patch[field] = args[field];
    }
  }
}

async function resolveUpdatedTourManagerStaff(
  ctx: MutationCtx,
  args: UpdateTourManagerArgs,
  tourManager: Doc<"tourManagerAssignments">,
  patch: RuntimeObject
) {
  if (args.staffId === undefined) {
    return tourManager.staffId;
  }
  const staffId = args.staffId ? ctx.db.normalizeId("staffUsers", args.staffId) : undefined;
  if (args.staffId && !staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = staffId ? await ctx.db.get("staffUsers", staffId) : null;
  if (staffId && !staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  if (staff && !staff.roles.includes("Tour Manager")) {
    throw new ConvexError("Selected staff member is not a tour manager");
  }
  if (staff && args.name === undefined) {
    patch.name = staff.name.trim();
  }
  if (staff && args.email === undefined) {
    patch.email = staff.email || "";
  }
  if (staff && args.phone === undefined) {
    patch.phone = staff.mobile || "";
  }
  patch.staffId = staffId;
  return staffId ?? undefined;
}

async function resolveUpdatedTourManagerJob(
  ctx: MutationCtx,
  access: PortalAccess,
  args: UpdateTourManagerArgs,
  tourManager: Doc<"tourManagerAssignments">,
  patch: RuntimeObject
) {
  if (args.jobCardId === undefined) {
    return tourManager.jobCardId ?? undefined;
  }
  const jobCardId = args.jobCardId ? ctx.db.normalizeId("jobCards", args.jobCardId) : undefined;
  if (args.jobCardId && !jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  if (jobCardId && !(await getVisibleJob(ctx, access, jobCardId))) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  patch.jobCardId = jobCardId;
  if (!patch.status) {
    patch.status = jobCardId ? "Assigned" : "Available";
  }
  return jobCardId ?? undefined;
}

function resolveUpdatedTourManagerBatch(
  ctx: MutationCtx,
  args: UpdateTourManagerArgs,
  jobCardId: Id<"jobCards"> | undefined,
  existingTravelBatchId: Id<"travelBatches"> | undefined
) {
  if (args.travelBatchId !== undefined && !jobCardId) {
    throw new ConvexError("Travel Batch requires a Job Card assignment");
  }
  if (args.travelBatchId !== undefined) {
    return getValidatedTravelBatch(ctx, args.travelBatchId, jobCardId);
  }
  if (args.jobCardId === undefined && existingTravelBatchId) {
    return ctx.db.get("travelBatches", existingTravelBatchId);
  }
  return null;
}

async function syncTourManagerJobLinks(
  ctx: MutationCtx,
  id: Id<"tourManagerAssignments">,
  tourManager: Doc<"tourManagerAssignments">,
  jobCardId: Id<"jobCards"> | undefined,
  name: string,
  now: number
) {
  if (tourManager.jobCardId && tourManager.jobCardId !== jobCardId) {
    const previousJob = await ctx.db.get("jobCards", tourManager.jobCardId);
    if (previousJob?.tourManagerId === id) {
      await ctx.db.patch("jobCards", tourManager.jobCardId, {
        tourManagerId: undefined,
        tourManagerName: "",
        updatedAt: now,
      });
      await scheduleCrmMetricSync(ctx, "jobCards", String(tourManager.jobCardId));
    }
  }
  if (jobCardId) {
    await ctx.db.patch("jobCards", jobCardId, {
      tourManagerId: id,
      tourManagerName: name,
      updatedAt: now,
    });
    await scheduleCrmMetricSync(ctx, "jobCards", String(jobCardId));
  }
}

function tourManagerAllocationChanged(
  args: UpdateTourManagerArgs,
  tourManager: Doc<"tourManagerAssignments">,
  staffId: Id<"staffUsers"> | undefined,
  jobCardId: Id<"jobCards"> | undefined,
  travelBatch: Doc<"travelBatches"> | null
) {
  if (!(staffId && jobCardId)) {
    return false;
  }
  return (
    [
      [staffId, tourManager.staffId],
      [jobCardId, tourManager.jobCardId],
      [travelBatch?._id, tourManager.travelBatchId],
    ].some(([next, current]) => String(next ?? "") !== String(current ?? "")) ||
    args.reportingInstructions !== undefined
  );
}

async function notifyTourManagerUpdated(
  ctx: MutationCtx,
  {
    access,
    args,
    id,
    jobCardId,
    name,
    staffId,
    tourManager,
    travelBatch,
  }: {
    access: PortalAccess;
    args: UpdateTourManagerArgs;
    id: Id<"tourManagerAssignments">;
    jobCardId: Id<"jobCards"> | undefined;
    name: string;
    staffId: Id<"staffUsers"> | undefined;
    tourManager: Doc<"tourManagerAssignments">;
    travelBatch: Doc<"travelBatches"> | null;
  }
) {
  const activity = createActivity(ctx, access, {
    action: "updated",
    entityId: id,
    entityType: "tourManager",
    message: `${name} tour manager updated`,
  });
  if (!tourManagerAllocationChanged(args, tourManager, staffId, jobCardId, travelBatch)) {
    await activity;
    return;
  }
  if (!(staffId && jobCardId)) {
    await activity;
    return;
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    await activity;
    return;
  }
  await Promise.all([
    activity,
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "staff", staffIds: [staffId] },
      content: {
        body: tourManagerNotificationBody(
          job,
          travelBatch,
          args.reportingInstructions ?? tourManager.reportingInstructions
        ),
        entityId: id,
        entityType: "tourManager",
        title: "Tour Manager allocation updated",
      },
      emailTargets: { kind: "staff", staffIds: [staffId] },
    }),
  ]);
}

export async function updateTourManagerForTest(
  ctx: MutationCtx,
  args: UpdateTourManagerArgs,
  access: PortalAccess
) {
  const id = ctx.db.normalizeId("tourManagerAssignments", args.tourManagerId);
  if (!id) {
    throw new ConvexError("Invalid Tour Manager id");
  }
  const tourManager = await ctx.db.get("tourManagerAssignments", id);
  if (!tourManager) {
    throw new ConvexError("Tour Manager not found");
  }
  if (tourManager.jobCardId && !(await getVisibleJob(ctx, access, tourManager.jobCardId))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (args.name !== undefined && !args.name.trim()) {
    throw new ConvexError("Tour manager name is required");
  }

  const now = Date.now();
  const patch: RuntimeObject = { updatedAt: now };
  addTourManagerUpdateFields(patch, args);
  const staffId = await resolveUpdatedTourManagerStaff(ctx, args, tourManager, patch);
  const jobCardId = await resolveUpdatedTourManagerJob(ctx, access, args, tourManager, patch);
  const travelBatch = await resolveUpdatedTourManagerBatch(
    ctx,
    args,
    jobCardId,
    tourManager.travelBatchId
  );
  if (args.travelBatchId !== undefined || args.jobCardId !== undefined) {
    patch.travelBatchId = travelBatch?._id;
  }

  const name = String(patch.name ?? tourManager.name).trim();
  await ctx.db.patch("tourManagerAssignments", id, patch);

  await syncTourManagerJobLinks(ctx, id, tourManager, jobCardId, name, now);
  await notifyTourManagerUpdated(ctx, {
    access,
    args,
    id,
    jobCardId,
    name,
    staffId,
    tourManager,
    travelBatch,
  });
  return { id };
}

export const updateTourManager = mutation({
  args: {
    availabilityDate: v.optional(v.string()),
    callingStatus: v.optional(
      v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response"))
    ),
    email: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    name: v.optional(v.string()),
    notes: v.optional(v.string()),
    phone: v.optional(v.string()),
    reportingInstructions: v.optional(v.string()),
    staffId: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive"))
    ),
    tourManagerId: v.string(),
    travelBatchId: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    updateTourManagerForTest(ctx, args, await requireHeadOrAdmin(ctx, ["Operations Head"])),
  returns: tourManagerIdResultValidator,
});

async function deleteTourManagerRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  id: Id<"tourManagerAssignments">,
  deferredNotifications?: NotificationEntityIdentity[]
) {
  const tourManager = await ctx.db.get("tourManagerAssignments", id);
  if (!tourManager) {
    throw new ConvexError("Tour Manager not found");
  }
  if (tourManager.jobCardId && !(await getVisibleJob(ctx, access, tourManager.jobCardId))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (tourManager.jobCardId) {
    const job = await ctx.db.get("jobCards", tourManager.jobCardId);
    if (job?.tourManagerId === id) {
      await ctx.db.patch("jobCards", tourManager.jobCardId, {
        tourManagerId: undefined,
        tourManagerName: "",
        updatedAt: Date.now(),
      });
      await scheduleCrmMetricSync(ctx, "jobCards", String(tourManager.jobCardId));
    }
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: id,
      entityType: "tourManager",
      message: `${tourManager.name} deleted`,
    }),
    deleteEntityNotifications(ctx, "tourManager", id, deferredNotifications),
    ctx.db.delete("tourManagerAssignments", id),
  ]);
}

export const removeTourManager = mutation({
  args: {
    tourManagerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    const id = ctx.db.normalizeId("tourManagerAssignments", args.tourManagerId);
    if (!id) {
      throw new ConvexError("Invalid Tour Manager id");
    }
    await deleteTourManagerRecord(ctx, access, id);
    return { id };
  },
  returns: tourManagerIdResultValidator,
});

export const removeManyTourManagers = mutation({
  args: {
    tourManagerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    assertBulkDeleteMutationBatch(args.tourManagerIds.length);
    const ids: Id<"tourManagerAssignments">[] = [];
    for (const raw of args.tourManagerIds) {
      const id = ctx.db.normalizeId("tourManagerAssignments", raw);
      if (!id) {
        throw new ConvexError("Invalid Tour Manager id");
      }
      ids.push(id);
    }
    const notifications: NotificationEntityIdentity[] = [];
    await mapInBoundedBatches(
      ids,
      async (id) => await deleteTourManagerRecord(ctx, access, id, notifications),
      4
    );
    await flushDeferredNotificationCleanup(ctx, notifications);
    return { deletedCount: ids.length };
  },
  returns: deletedCountResultValidator,
});
