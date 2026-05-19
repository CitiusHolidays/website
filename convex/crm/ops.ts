import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  requireAnyPermission,
  requireStaff,
} from "./lib";

export const listHotels = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_OPERATIONS);
    const rows = await ctx.db.query("hotels").collect();
    const result = [];
    for (const hotel of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = await ctx.db.get(hotel.jobCardId);
      result.push({
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
      });
    }
    return result;
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
    const hotel = await ctx.db.get(hotelId);
    if (!hotel) {
      throw new ConvexError("Hotel not found");
    }
    await createActivity(ctx, access, {
      entityType: "hotel",
      entityId: hotelId,
      action: "deleted",
      message: `${hotel.name} hotel deleted`,
    });
    await deleteEntityNotifications(ctx, "hotel", hotelId);
    await ctx.db.delete(hotelId);
    return { id: hotelId };
  },
});

export const listTourManagers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TOUR_MANAGERS);
    const rows = await ctx.db.query("tourManagerAssignments").collect();
    const result = [];
    for (const row of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = row.jobCardId ? await ctx.db.get(row.jobCardId) : null;
      result.push({
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
      });
    }
    return result;
  },
});

export const createTourManager = mutation({
  args: {
    jobCardId: v.optional(v.string()),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    availabilityDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_TOUR_MANAGERS,
      PERMISSIONS.MANAGE_OPERATIONS,
    ]);
    const jobCardId = args.jobCardId ? ctx.db.normalizeId("jobCards", args.jobCardId) : null;
    const now = Date.now();
    const id = await ctx.db.insert("tourManagerAssignments", {
      jobCardId: jobCardId ?? undefined,
      name: args.name.trim(),
      email: args.email?.trim() || "",
      phone: args.phone?.trim() || "",
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
        tourManagerName: args.name.trim(),
        updatedAt: now,
      });
    }
    await createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "created",
      message: `${args.name.trim()} added as Tour Manager`,
    });
    return { id };
  },
});

export const removeTourManager = mutation({
  args: {
    tourManagerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_TOUR_MANAGERS,
      PERMISSIONS.MANAGE_OPERATIONS,
    ]);
    const id = ctx.db.normalizeId("tourManagerAssignments", args.tourManagerId);
    if (!id) {
      throw new ConvexError("Invalid Tour Manager id");
    }
    const tourManager = await ctx.db.get(id);
    if (!tourManager) {
      throw new ConvexError("Tour Manager not found");
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
    await createActivity(ctx, access, {
      entityType: "tourManager",
      entityId: id,
      action: "deleted",
      message: `${tourManager.name} deleted`,
    });
    await deleteEntityNotifications(ctx, "tourManager", id);
    await ctx.db.delete(id);
    return { id };
  },
});
