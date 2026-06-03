import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  assertBulkDeleteLimit,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
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
    for (const hotelId of ids) {
      await deleteHotelRecord(ctx, access, hotelId);
    }
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
            jobCode: job?.jobCode ?? "",
            currentTour: job?.clientName ?? "",
            name: row.name,
            email: row.email ?? "",
            phone: row.phone ?? "",
            status: row.status,
            languages: row.languages ?? [],
            callingStatus: row.callingStatus,
            availabilityDate: row.availabilityDate ?? "",
            notes: row.notes ?? "",
            createdAt: new Date(row.createdAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});

export const createTourManager = mutation({
  args: {
    jobCardId: v.optional(v.string()),
    staffId: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
    let name = args.name.trim();
    let email = args.email?.trim() || "";
    let phone = args.phone?.trim() || "";
    if (args.staffId) {
      const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
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
    const now = Date.now();
    const id = await ctx.db.insert("tourManagerAssignments", {
      jobCardId: jobCardId ?? undefined,
      name,
      email,
      phone,
      status: jobCardId ? "Assigned" : "Available",
      languages: [],
      callingStatus: "Pending",
      availabilityDate: args.availabilityDate || "",
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
    await createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "created",
      message: `${name} added as Tour Manager`,
    });
    return { id };
  },
});

export const updateTourManager = mutation({
  args: {
    tourManagerId: v.string(),
    jobCardId: v.optional(v.string()),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    callingStatus: v.optional(
      v.union(v.literal("Pending"), v.literal("Done"), v.literal("No response")),
    ),
    status: v.optional(
      v.union(v.literal("Available"), v.literal("Assigned"), v.literal("Inactive")),
    ),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
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
    if (args.notes !== undefined) patch.notes = args.notes.trim();
    if (args.languages !== undefined) patch.languages = args.languages;
    if (args.callingStatus !== undefined) patch.callingStatus = args.callingStatus;
    if (args.status !== undefined) patch.status = args.status;

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

    const name = (args.name ?? tourManager.name).trim();
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

    await createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "updated",
      message: `${name} tour manager updated`,
    });
    return { id };
  },
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
    for (const id of ids) {
      await deleteTourManagerRecord(ctx, access, id);
    }
    return { deletedCount: ids.length };
  },
});
