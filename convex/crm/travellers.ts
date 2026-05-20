import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const roomTypeValidator = v.union(
  v.literal("SGL"),
  v.literal("Twin"),
  v.literal("DBL"),
  v.literal("Child with Bed"),
  v.literal("Family Room"),
);

const paymentTypeValidator = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid"),
);

const guestTypeValidator = v.union(
  v.literal("Employee"),
  v.literal("Client"),
  v.literal("VIP"),
);

const publicTraveller = (traveller: any, job: any) => ({
  id: traveller._id,
  jobCardId: traveller.jobCardId,
  jobCode: job?.jobCode ?? "",
  clientName: job?.clientName ?? "",
  fullName: traveller.fullName,
  travelHub: traveller.travelHub ?? "",
  foodPreference: traveller.foodPreference,
  guestType: traveller.guestType,
  paymentType: traveller.paymentType,
  roomType: traveller.roomType,
  visaRequired: traveller.visaRequired,
  domesticTravelRequired: traveller.domesticTravelRequired ?? false,
  biometricAppointmentDate: traveller.biometricAppointmentDate ?? "",
  travelDate: traveller.travelDate ?? "",
  extensionOfTour: traveller.extensionOfTour ?? false,
  arrivingEarly: traveller.arrivingEarly ?? false,
  guestCompanions: traveller.guestCompanions ?? "",
  specialRequests: traveller.specialRequests ?? "",
  passportStatus: traveller.passportStatus ?? "",
  ticketStatus: traveller.ticketStatus,
  visaStatus: traveller.visaStatus,
  callingStatus: traveller.callingStatus,
  cancellation: traveller.cancellation ?? false,
  lastMinuteDrop: traveller.lastMinuteDrop ?? false,
  hotelAllocation: traveller.hotelAllocation ?? "",
  createdAt: new Date(traveller.createdAt).toISOString(),
  updatedAt: new Date(traveller.updatedAt).toISOString(),
});

export const list = query({
  args: {
    jobCardId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const normalizedJobCardId = args.jobCardId
      ? ctx.db.normalizeId("jobCards", args.jobCardId)
      : null;
    const rows = normalizedJobCardId
      ? await ctx.db
          .query("travellers")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", normalizedJobCardId))
          .collect()
      : await ctx.db.query("travellers").collect();
    const result = [];
    for (const traveller of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = await ctx.db.get(traveller.jobCardId);
      result.push(publicTraveller(traveller, job));
    }
    return result;
  },
});

export const create = mutation({
  args: {
    jobCardId: v.string(),
    fullName: v.string(),
    travelHub: v.optional(v.string()),
    foodPreference: foodPreferenceValidator,
    guestType: guestTypeValidator,
    paymentType: paymentTypeValidator,
    roomType: roomTypeValidator,
    visaRequired: v.boolean(),
    domesticTravelRequired: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    extensionOfTour: v.optional(v.boolean()),
    arrivingEarly: v.optional(v.boolean()),
    guestCompanions: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    hotelAllocation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    if (!args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }

    const now = Date.now();
    const visaStatus = args.visaRequired ? "Not Started" : "Not Required";
    const id = await ctx.db.insert("travellers", {
      jobCardId,
      fullName: args.fullName.trim(),
      travelHub: args.travelHub?.trim() || "",
      foodPreference: args.foodPreference,
      guestType: args.guestType,
      paymentType: args.paymentType,
      roomType: args.roomType,
      visaRequired: args.visaRequired,
      domesticTravelRequired: args.domesticTravelRequired ?? false,
      biometricAppointmentDate: args.biometricAppointmentDate || "",
      travelDate: args.travelDate || "",
      extensionOfTour: args.extensionOfTour ?? false,
      arrivingEarly: args.arrivingEarly ?? false,
      guestCompanions: args.guestCompanions?.trim() || "",
      specialRequests: args.specialRequests?.trim() || "",
      passportStatus: args.passportStatus?.trim() || "Pending",
      hotelAllocation: args.hotelAllocation?.trim() || "",
      ticketStatus: "Pending Issue",
      visaStatus,
      callingStatus: "Pending",
      cancellation: false,
      lastMinuteDrop: false,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("visaRecords", {
      travellerId: id,
      jobCardId,
      status: visaStatus,
      updatedBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "traveller",
      entityId: id,
      action: "created",
      message: `${args.fullName.trim()} added to ${job.jobCode}`,
    });
    return { id };
  },
});

export const update = mutation({
  args: {
    travellerId: v.string(),
    fullName: v.optional(v.string()),
    travelHub: v.optional(v.string()),
    foodPreference: v.optional(foodPreferenceValidator),
    guestType: v.optional(guestTypeValidator),
    paymentType: v.optional(paymentTypeValidator),
    roomType: v.optional(roomTypeValidator),
    visaRequired: v.optional(v.boolean()),
    domesticTravelRequired: v.optional(v.boolean()),
    biometricAppointmentDate: v.optional(v.string()),
    travelDate: v.optional(v.string()),
    extensionOfTour: v.optional(v.boolean()),
    arrivingEarly: v.optional(v.boolean()),
    guestCompanions: v.optional(v.string()),
    specialRequests: v.optional(v.string()),
    passportStatus: v.optional(v.string()),
    hotelAllocation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const traveller = await ctx.db.get(travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    if (args.fullName !== undefined && !args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
    if (args.travelHub !== undefined) patch.travelHub = args.travelHub.trim();
    if (args.foodPreference !== undefined) patch.foodPreference = args.foodPreference;
    if (args.guestType !== undefined) patch.guestType = args.guestType;
    if (args.paymentType !== undefined) patch.paymentType = args.paymentType;
    if (args.roomType !== undefined) patch.roomType = args.roomType;
    if (args.visaRequired !== undefined) {
      patch.visaRequired = args.visaRequired;
      patch.visaStatus = args.visaRequired
        ? traveller.visaStatus === "Not Required"
          ? "Not Started"
          : traveller.visaStatus
        : "Not Required";
    }
    if (args.domesticTravelRequired !== undefined) {
      patch.domesticTravelRequired = args.domesticTravelRequired;
    }
    if (args.biometricAppointmentDate !== undefined) {
      patch.biometricAppointmentDate = args.biometricAppointmentDate;
    }
    if (args.travelDate !== undefined) patch.travelDate = args.travelDate;
    if (args.extensionOfTour !== undefined) patch.extensionOfTour = args.extensionOfTour;
    if (args.arrivingEarly !== undefined) patch.arrivingEarly = args.arrivingEarly;
    if (args.guestCompanions !== undefined) {
      patch.guestCompanions = args.guestCompanions.trim();
    }
    if (args.specialRequests !== undefined) {
      patch.specialRequests = args.specialRequests.trim();
    }
    if (args.passportStatus !== undefined) {
      patch.passportStatus = args.passportStatus.trim();
    }
    if (args.hotelAllocation !== undefined) {
      patch.hotelAllocation = args.hotelAllocation.trim();
    }

    await ctx.db.patch(travellerId, patch);

    if (args.visaRequired !== undefined || args.biometricAppointmentDate !== undefined) {
      const visaRecord = await ctx.db
        .query("visaRecords")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .unique();
      if (visaRecord) {
        const visaPatch: Record<string, unknown> = {
          updatedBy: access.authUserId ?? "unknown",
          updatedAt: now,
        };
        if (args.visaRequired !== undefined) {
          visaPatch.status = patch.visaStatus as string;
        }
        if (args.biometricAppointmentDate !== undefined) {
          visaPatch.appointmentDate = args.biometricAppointmentDate;
        }
        await ctx.db.patch(visaRecord._id, visaPatch);
      }
    }

    await createActivity(ctx, access, {
      entityType: "traveller",
      entityId: travellerId,
      action: "updated",
      message: `${(args.fullName ?? traveller.fullName).trim()} updated`,
    });
    return { id: travellerId };
  },
});

export const updateCallingStatus = mutation({
  args: {
    travellerId: v.string(),
    callingStatus: v.union(
      v.literal("Pending"),
      v.literal("Done"),
      v.literal("No response"),
    ),
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
    await ctx.db.patch(travellerId, {
      callingStatus: args.callingStatus,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      entityType: "traveller",
      entityId: travellerId,
      action: "calling_status_updated",
      message: `Traveller calling status set to ${args.callingStatus}`,
    });
    return { id: travellerId };
  },
});

export const remove = mutation({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const traveller = await ctx.db.get(travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }

    const passportDetails = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of passportDetails) await ctx.db.delete(row._id);

    const visaRecords = await ctx.db
      .query("visaRecords")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of visaRecords) await ctx.db.delete(row._id);

    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of tickets) {
      await deleteEntityNotifications(ctx, "ticket", row._id);
      await ctx.db.delete(row._id);
    }

    const seats = await ctx.db
      .query("seatAllocations")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of seats) await ctx.db.delete(row._id);

    const meals = await ctx.db
      .query("mealPreferences")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of meals) await ctx.db.delete(row._id);

    const rooms = await ctx.db
      .query("roomingListEntries")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .collect();
    for (const row of rooms) await ctx.db.delete(row._id);

    await createActivity(ctx, access, {
      entityType: "traveller",
      entityId: travellerId,
      action: "deleted",
      message: `${traveller.fullName} deleted`,
    });
    await deleteEntityNotifications(ctx, "traveller", travellerId);
    await ctx.db.delete(travellerId);
    return { id: travellerId };
  },
});
