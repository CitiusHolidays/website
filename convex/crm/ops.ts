import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  assertBulkDeleteLimit,
  assertDateRangeOrder,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  notifyStaffMember,
  PERMISSIONS,
  type PortalAccess,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";

async function getVisibleJob(ctx: any, access: any, jobCardId: any) {
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}

async function getValidatedTravelBatch(
  ctx: any,
  travelBatchId: string | undefined,
  jobCardId: any,
) {
  if (!travelBatchId) {
    return null;
  }
  const id = ctx.db.normalizeId("travelBatches", travelBatchId);
  if (!id) {
    throw new ConvexError("Invalid Travel Batch id");
  }
  const batch = await ctx.db.get(id);
  if (!batch) {
    throw new ConvexError("Travel Batch not found");
  }
  if (String(batch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Travel Batch must belong to the selected Job Card");
  }
  return batch;
}

function tourManagerNotificationBody(job: any, batch: any, reportingInstructions?: string) {
  const target = batch?.batchReference ? `${job.jobCode} (${batch.batchReference})` : job.jobCode;
  const details = [
    job.clientName,
    batch?.destination ?? job.destination,
    reportingInstructions?.trim(),
  ].filter(Boolean);
  return `You were allocated as Tour Manager for ${target}${details.length ? `: ${details.join(" - ")}` : "."}`;
}

export const listHotels = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_OPERATIONS),
      ctx.db.query("hotels").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (hotel) => {
          const job = await getVisibleJob(ctx, access, hotel.jobCardId);
          if (!job) return null;
          return {
            id: hotel._id,
            jobCardId: hotel.jobCardId,
            jobCode: job?.jobCode ?? "",
            clientName: job?.clientName ?? "",
            name: hotel.name,
            city: hotel.city ?? "",
            checkInDate: hotel.checkInDate ?? "",
            checkOutDate: hotel.checkOutDate ?? "",
            earlyCheckIn: hotel.earlyCheckIn ?? false,
            lateCheckout: hotel.lateCheckout ?? false,
            specialInstructions: hotel.specialInstructions ?? "",
            createdAt: new Date(hotel.createdAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});

export const createHotel = mutation({
  args: {
    jobCardId: v.string(),
    name: v.string(),
    city: v.optional(v.string()),
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
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
      jobCardId,
      name: args.name.trim(),
      city: args.city?.trim() || "",
      checkInDate: args.checkInDate || "",
      checkOutDate: args.checkOutDate || "",
      earlyCheckIn: false,
      lateCheckout: false,
      specialInstructions: args.specialInstructions?.trim() || "",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "hotel",
      entityId: id,
      action: "created",
      message: `${args.name.trim()} hotel added`,
    });
    return { id };
  },
});

export const updateHotel = mutation({
  args: {
    hotelId: v.string(),
    name: v.optional(v.string()),
    city: v.optional(v.string()),
    checkInDate: v.optional(v.string()),
    checkOutDate: v.optional(v.string()),
    earlyCheckIn: v.optional(v.boolean()),
    lateCheckout: v.optional(v.boolean()),
    specialInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    const hotelId = ctx.db.normalizeId("hotels", args.hotelId);
    if (!hotelId) {
      throw new ConvexError("Invalid hotel id");
    }
    const hotel = await ctx.db.get(hotelId);
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
      "Check-out date",
    );

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.city !== undefined) patch.city = args.city.trim();
    if (args.checkInDate !== undefined) patch.checkInDate = args.checkInDate;
    if (args.checkOutDate !== undefined) patch.checkOutDate = args.checkOutDate;
    if (args.earlyCheckIn !== undefined) patch.earlyCheckIn = args.earlyCheckIn;
    if (args.lateCheckout !== undefined) patch.lateCheckout = args.lateCheckout;
    if (args.specialInstructions !== undefined) {
      patch.specialInstructions = args.specialInstructions.trim();
    }

    await ctx.db.patch(hotelId, patch);
    await createActivity(ctx, access, {
      entityType: "hotel",
      entityId: hotelId,
      action: "updated",
      message: `${(args.name ?? hotel.name).trim()} hotel updated`,
    });
    return { id: hotelId };
  },
});

async function deleteHotelRecord(ctx: MutationCtx, access: PortalAccess, hotelId: Id<"hotels">) {
  const hotel = await ctx.db.get(hotelId);
  if (!hotel) {
    throw new ConvexError("Hotel not found");
  }
  const job = await getVisibleJob(ctx, access, hotel.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await Promise.all([
    createActivity(ctx, access, {
      entityType: "hotel",
      entityId: hotelId,
      action: "deleted",
      message: `${hotel.name} hotel deleted`,
    }),
    deleteEntityNotifications(ctx, "hotel", hotelId),
    ctx.db.delete(hotelId),
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
});

export const removeManyHotels = mutation({
  args: {
    hotelIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_OPERATIONS);
    assertBulkDeleteLimit(args.hotelIds.length);
    const ids: Id<"hotels">[] = [];
    for (const raw of args.hotelIds) {
      const hotelId = ctx.db.normalizeId("hotels", raw);
      if (!hotelId) {
        throw new ConvexError("Invalid hotel id");
      }
      ids.push(hotelId);
    }
    await Promise.all(ids.map((hotelId) => deleteHotelRecord(ctx, access, hotelId)));
    return { deletedCount: ids.length };
  },
});

export const listTourManagers = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS),
      ctx.db.query("tourManagerAssignments").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (row) => {
          const job = row.jobCardId ? await getVisibleJob(ctx, access, row.jobCardId) : null;
          if (row.jobCardId && !job) return null;
          return {
            id: row._id,
            jobCardId: row.jobCardId ?? null,
            travelBatchId: row.travelBatchId ?? null,
            staffId: row.staffId ?? "",
            jobCode: job?.jobCode ?? "",
            currentTour: job?.clientName ?? "",
            name: row.name,
            email: row.email ?? "",
            phone: row.phone ?? "",
            status: row.status,
            languages: row.languages ?? [],
            callingStatus: row.callingStatus,
            availabilityDate: row.availabilityDate ?? "",
            reportingInstructions: row.reportingInstructions ?? "",
            notes: row.notes ?? "",
            createdAt: new Date(row.createdAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});

export async function createTourManagerForTest(
  ctx: MutationCtx,
  args: {
    jobCardId?: string;
    travelBatchId?: string;
    staffId?: string;
    name: string;
    email?: string;
    phone?: string;
    availabilityDate?: string;
    reportingInstructions?: string;
    notes?: string;
  },
  access: PortalAccess,
) {
  let name = args.name.trim();
  let email = args.email?.trim() || "";
  let phone = args.phone?.trim() || "";
  let staffId = null;
  if (args.staffId) {
    staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const staff = await ctx.db.get(staffId);
    if (!staff?.active) {
      throw new ConvexError("Staff member not found");
    }
    if (!staff.roles.includes("Tour Manager")) {
      throw new ConvexError("Selected staff member is not a tour manager");
    }
    name = staff.name.trim();
    email = staff.email || email;
    phone = staff.mobile || phone;
  }
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
  const travelBatch = await getValidatedTravelBatch(ctx, args.travelBatchId, jobCardId);
  const now = Date.now();
  const id = await ctx.db.insert("tourManagerAssignments", {
    jobCardId: jobCardId ?? undefined,
    travelBatchId: travelBatch?._id,
    staffId: staffId ?? undefined,
    name,
    email,
    phone,
    status: jobCardId ? "Assigned" : "Available",
    languages: [],
    callingStatus: "Pending",
    availabilityDate: args.availabilityDate || "",
    reportingInstructions: args.reportingInstructions?.trim() || "",
    notes: args.notes?.trim() || "",
    createdBy: access.authUserId ?? "unknown",
    createdAt: now,
    updatedAt: now,
  });
  if (jobCardId) {
    await ctx.db.patch(jobCardId, {
      tourManagerId: id,
      tourManagerName: name,
      updatedAt: now,
    });
  }
  await Promise.all([
    createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "created",
      message: `${name} added as Tour Manager`,
    }),
    staffId && jobCardId
      ? notifyStaffMember(ctx, staffId, {
          title: "Tour Manager allocated",
          body: tourManagerNotificationBody(
            await ctx.db.get(jobCardId),
            travelBatch,
            args.reportingInstructions,
          ),
          entityType: "tourManager",
          entityId: id,
        })
      : null,
  ]);
  return { id };
}

export const createTourManager = mutation({
  args: {
    jobCardId: v.optional(v.string()),
    travelBatchId: v.optional(v.string()),
    staffId: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    reportingInstructions: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    createTourManagerForTest(ctx, args, await requireHeadOrAdmin(ctx, ["Operations Head"])),
});

export async function updateTourManagerForTest(
  ctx: MutationCtx,
  args: {
    tourManagerId: string;
    jobCardId?: string;
    travelBatchId?: string;
    staffId?: string;
    name?: string;
    email?: string;
    phone?: string;
    availabilityDate?: string;
    reportingInstructions?: string;
    notes?: string;
    languages?: string[];
    callingStatus?: "Pending" | "Done" | "No response";
    status?: "Available" | "Assigned" | "Inactive";
  },
  access: PortalAccess,
) {
  const id = ctx.db.normalizeId("tourManagerAssignments", args.tourManagerId);
  if (!id) {
    throw new ConvexError("Invalid Tour Manager id");
  }
  const tourManager = await ctx.db.get(id);
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
  const patch: Record<string, unknown> = { updatedAt: now };
  if (args.name !== undefined) patch.name = args.name.trim();
  if (args.email !== undefined) patch.email = args.email.trim();
  if (args.phone !== undefined) patch.phone = args.phone.trim();
  if (args.availabilityDate !== undefined) patch.availabilityDate = args.availabilityDate;
  if (args.reportingInstructions !== undefined) {
    patch.reportingInstructions = args.reportingInstructions.trim();
  }
  if (args.notes !== undefined) patch.notes = args.notes.trim();
  if (args.languages !== undefined) patch.languages = args.languages;
  if (args.callingStatus !== undefined) patch.callingStatus = args.callingStatus;
  if (args.status !== undefined) patch.status = args.status;

  let staffId = tourManager.staffId;
  if (args.staffId !== undefined) {
    const nextStaffId = args.staffId ? ctx.db.normalizeId("staffUsers", args.staffId) : undefined;
    if (args.staffId && !nextStaffId) {
      throw new ConvexError("Invalid staff id");
    }
    if (nextStaffId) {
      const staff = await ctx.db.get(nextStaffId);
      if (!staff?.active) {
        throw new ConvexError("Staff member not found");
      }
      if (!staff.roles.includes("Tour Manager")) {
        throw new ConvexError("Selected staff member is not a tour manager");
      }
      if (args.name === undefined) patch.name = staff.name.trim();
      if (args.email === undefined) patch.email = staff.email || "";
      if (args.phone === undefined) patch.phone = staff.mobile || "";
    }
    staffId = nextStaffId ?? undefined;
    patch.staffId = nextStaffId ?? undefined;
  }

  let jobCardId = tourManager.jobCardId;
  if (args.jobCardId !== undefined) {
    const nextJobCardId = args.jobCardId
      ? ctx.db.normalizeId("jobCards", args.jobCardId)
      : undefined;
    if (args.jobCardId && !nextJobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    if (nextJobCardId && !(await getVisibleJob(ctx, access, nextJobCardId))) {
      throw new ConvexError("Job Card not found or not assigned to you");
    }
    jobCardId = nextJobCardId ?? undefined;
    patch.jobCardId = nextJobCardId ?? undefined;
    if (!patch.status) {
      patch.status = nextJobCardId ? "Assigned" : "Available";
    }
  }

  if (args.travelBatchId !== undefined && !jobCardId) {
    throw new ConvexError("Travel Batch requires a Job Card assignment");
  }
  const shouldResolveTravelBatch =
    args.travelBatchId !== undefined || (args.jobCardId === undefined && tourManager.travelBatchId);
  const existingTravelBatchId = tourManager.travelBatchId;
  const travelBatch = shouldResolveTravelBatch
    ? args.travelBatchId !== undefined
      ? await getValidatedTravelBatch(ctx, args.travelBatchId, jobCardId)
      : existingTravelBatchId
        ? await ctx.db.get(existingTravelBatchId)
        : null
    : null;
  if (args.travelBatchId !== undefined || args.jobCardId !== undefined) {
    patch.travelBatchId = travelBatch?._id;
  }

  const name = String(patch.name ?? tourManager.name).trim();
  await ctx.db.patch(id, patch);

  if (tourManager.jobCardId && tourManager.jobCardId !== jobCardId) {
    const previousJob = await ctx.db.get(tourManager.jobCardId);
    if (previousJob?.tourManagerId === id) {
      await ctx.db.patch(tourManager.jobCardId, {
        tourManagerId: undefined,
        tourManagerName: "",
        updatedAt: now,
      });
    }
  }
  if (jobCardId) {
    await ctx.db.patch(jobCardId, {
      tourManagerId: id,
      tourManagerName: name,
      updatedAt: now,
    });
  }

  const notifyOnAllocation =
    staffId &&
    jobCardId &&
    (String(staffId) !== String(tourManager.staffId ?? "") ||
      String(jobCardId) !== String(tourManager.jobCardId ?? "") ||
      String(travelBatch?._id ?? "") !== String(tourManager.travelBatchId ?? "") ||
      args.reportingInstructions !== undefined);

  const allocationStaffId = staffId;
  const allocationJobCardId = jobCardId;

  await Promise.all([
    createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "updated",
      message: `${name} tour manager updated`,
    }),
    notifyOnAllocation && allocationStaffId && allocationJobCardId
      ? notifyStaffMember(ctx, allocationStaffId, {
          title: "Tour Manager allocation updated",
          body: tourManagerNotificationBody(
            await ctx.db.get(allocationJobCardId),
            travelBatch,
            args.reportingInstructions ?? tourManager.reportingInstructions,
          ),
          entityType: "tourManager",
          entityId: id,
        })
      : null,
  ]);
  return { id };
}

export const updateTourManager = mutation({
  args: {
    tourManagerId: v.string(),
    jobCardId: v.optional(v.string()),
    travelBatchId: v.optional(v.string()),
    staffId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    reportingInstructions: v.optional(v.string()),
    notes: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    callingStatus: v.optional(
      v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response")),
    ),
    status: v.optional(
      v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
    ),
  },
  handler: async (ctx, args) =>
    updateTourManagerForTest(ctx, args, await requireHeadOrAdmin(ctx, ["Operations Head"])),
});

async function deleteTourManagerRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  id: Id<"tourManagerAssignments">,
) {
  const tourManager = await ctx.db.get(id);
  if (!tourManager) {
    throw new ConvexError("Tour Manager not found");
  }
  if (tourManager.jobCardId && !(await getVisibleJob(ctx, access, tourManager.jobCardId))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (tourManager.jobCardId) {
    const job = await ctx.db.get(tourManager.jobCardId);
    if (job?.tourManagerId === id) {
      await ctx.db.patch(tourManager.jobCardId, {
        tourManagerId: undefined,
        tourManagerName: "",
        updatedAt: Date.now(),
      });
    }
  }
  await Promise.all([
    createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "deleted",
      message: `${tourManager.name} deleted`,
    }),
    deleteEntityNotifications(ctx, "tourManager", id),
    ctx.db.delete(id),
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
});

export const removeManyTourManagers = mutation({
  args: {
    tourManagerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    assertBulkDeleteLimit(args.tourManagerIds.length);
    const ids: Id<"tourManagerAssignments">[] = [];
    for (const raw of args.tourManagerIds) {
      const id = ctx.db.normalizeId("tourManagerAssignments", raw);
      if (!id) {
        throw new ConvexError("Invalid Tour Manager id");
      }
      ids.push(id);
    }
    await Promise.all(ids.map((id) => deleteTourManagerRecord(ctx, access, id)));
    return { deletedCount: ids.length };
  },
});
