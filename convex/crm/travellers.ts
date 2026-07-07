import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalQuery, mutation, query } from "../_generated/server";
import { roomTypeValidator } from "../lib/roomTypeValidators";
import {
  assertBulkDeleteLimit,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  deleteStorageFile,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import { normalizePassportExpiryDate } from "./passportExpiry";

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

async function normalizeTravelBatchForJob(ctx: any, jobCardId: Id<"jobCards">, rawId?: string) {
  const value = String(rawId ?? "").trim();
  if (!value) {
    return { travelBatch: null, travelBatchId: undefined };
  }
  const travelBatchId = ctx.db.normalizeId("travelBatches", value);
  if (!travelBatchId) {
    throw new ConvexError("Invalid Travel Batch id");
  }
  const batch = await ctx.db.get(travelBatchId);
  if (!batch || String(batch.jobCardId) !== String(jobCardId)) {
    throw new ConvexError("Travel Batch must belong to the selected Job Card");
  }
  return { travelBatch: batch, travelBatchId };
}

const publicTraveller = (
  traveller: any,
  job: any,
  travelBatch: any = null,
  hasPassportScan = false,
  passportExpiryDate = ""
) => ({
  arrivingEarly: traveller.arrivingEarly ?? false,
  biometricAppointmentDate: traveller.biometricAppointmentDate ?? "",
  callingStatus: traveller.callingStatus,
  cancellation: traveller.cancellation ?? false,
  clientName: job?.clientName ?? "",
  createdAt: new Date(traveller.createdAt).toISOString(),
  domesticTravelRequired: traveller.domesticTravelRequired ?? false,
  extensionOfTour: traveller.extensionOfTour ?? false,
  foodPreference: traveller.foodPreference,
  fullName: traveller.fullName,
  gender: traveller.gender ?? "",
  givenName: traveller.givenName ?? "",
  guestCompanions: traveller.guestCompanions ?? "",
  guestType: traveller.guestType,
  hasPassportScan,
  hotelAllocation: traveller.hotelAllocation ?? "",
  id: traveller._id,
  jobCardId: traveller.jobCardId,
  jobCode: job?.jobCode ?? "",
  lastMinuteDrop: traveller.lastMinuteDrop ?? false,
  passportExpiryDate,
  passportStatus: traveller.passportStatus ?? "",
  paymentType: traveller.paymentType,
  roomType: traveller.roomType,
  specialRequests: traveller.specialRequests ?? "",
  surname: traveller.surname ?? "",
  ticketStatus: traveller.ticketStatus,
  travelBatchCode: travelBatch?.batchCode ?? "",
  travelBatchId: traveller.travelBatchId ?? "",
  travelBatchReference: travelBatch?.batchReference ?? "",
  travelDate: traveller.travelDate ?? "",
  travelHub: traveller.travelHub ?? "",
  travelStartDate: job?.travelStartDate ?? "",
  updatedAt: new Date(traveller.updatedAt).toISOString(),
  visaRequired: traveller.visaRequired,
  visaStatus: traveller.visaStatus,
});

export const list = query({
  args: {
    jobCardId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TRAVELLERS);
    const normalizedJobCardId = args.jobCardId
      ? ctx.db.normalizeId("jobCards", args.jobCardId)
      : null;
    const rows = normalizedJobCardId
      ? await ctx.db
          .query("travellers")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", normalizedJobCardId))
          .collect()
      : await ctx.db.query("travellers").collect();
    const passportRows = await ctx.db.query("passportDetails").collect();
    const passportScanByTraveller = new Map<string, boolean>();
    const passportExpiryByTraveller = new Map<string, string>();
    for (const row of passportRows) {
      const travellerKey = String(row.travellerId);
      if (row.storageId) {
        passportScanByTraveller.set(travellerKey, true);
      }
      const expiryDate = normalizePassportExpiryDate(row.expiryDate);
      if (expiryDate) {
        passportExpiryByTraveller.set(travellerKey, expiryDate);
      }
    }
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (traveller) => {
          const job = await ctx.db.get(traveller.jobCardId);
          if (!job) {
            return null;
          }
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery)) {
            return null;
          }
          return publicTraveller(
            traveller,
            job,
            traveller.travelBatchId ? await ctx.db.get(traveller.travelBatchId) : null,
            passportScanByTraveller.has(String(traveller._id)),
            passportExpiryByTraveller.get(String(traveller._id)) ?? ""
          );
        })
    );
    return result.filter(Boolean);
  },
});

export const passportExpirySources = internalQuery({
  args: {
    access: v.any(),
    jobCardId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = args.access as PortalAccess;
    if (!access?.allowed) {
      return [];
    }

    const normalizedJobCardId = args.jobCardId
      ? ctx.db.normalizeId("jobCards", args.jobCardId)
      : null;
    const travellers = normalizedJobCardId
      ? await ctx.db
          .query("travellers")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", normalizedJobCardId))
          .collect()
      : await ctx.db.query("travellers").collect();

    const sources = (
      await Promise.all(
        travellers.map(async (traveller) => {
          const job = await ctx.db.get(traveller.jobCardId);
          if (!job) {
            return null;
          }
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery)) {
            return null;
          }

          const passport = await ctx.db
            .query("passportDetails")
            .withIndex("by_travellerId", (q) => q.eq("travellerId", traveller._id))
            .unique();
          if (!passport?.encryptedPayload) {
            return null;
          }

          return {
            encryptedPayload: passport.encryptedPayload,
            expiryDate: passport.expiryDate ?? "",
            passportId: passport._id,
            travellerId: traveller._id,
          };
        })
      )
    ).filter((source): source is NonNullable<typeof source> => source != null);

    return sources;
  },
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
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }
    const { travelBatchId } = await normalizeTravelBatchForJob(ctx, jobCardId, args.travelBatchId);

    const now = Date.now();
    const visaStatus = args.visaRequired ? "Not Started" : "Not Required";
    const id = await ctx.db.insert("travellers", {
      jobCardId,
      ...(travelBatchId ? { travelBatchId } : {}),
      arrivingEarly: args.arrivingEarly ?? false,
      biometricAppointmentDate: args.biometricAppointmentDate || "",
      callingStatus: "Pending",
      cancellation: false,
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
      domesticTravelRequired: args.domesticTravelRequired ?? false,
      extensionOfTour: args.extensionOfTour ?? false,
      foodPreference: args.foodPreference,
      fullName: args.fullName.trim(),
      gender: args.gender?.trim() || "",
      givenName: args.givenName?.trim() || "",
      guestCompanions: args.guestCompanions?.trim() || "",
      guestType: args.guestType,
      hotelAllocation: args.hotelAllocation?.trim() || "",
      lastMinuteDrop: false,
      passportStatus: args.passportStatus?.trim() || "Pending",
      paymentType: args.paymentType,
      roomType: args.roomType,
      specialRequests: args.specialRequests?.trim() || "",
      surname: args.surname?.trim() || "",
      ticketStatus: "Pending Issue",
      travelDate: args.travelDate || "",
      travelHub: args.travelHub?.trim() || "",
      updatedAt: now,
      visaRequired: args.visaRequired,
      visaStatus,
    });

    await Promise.all([
      ctx.db.insert("visaRecords", {
        createdAt: now,
        jobCardId,
        status: visaStatus,
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
    return { id };
  },
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
    const traveller = await ctx.db.get(travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    const job = await ctx.db.get(traveller.jobCardId);
    const linkedQuery = await (job?.queryId ? ctx.db.get(job.queryId) : Promise.resolve(null));
    if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.fullName !== undefined && !args.fullName.trim()) {
      throw new ConvexError("Traveller name is required");
    }

    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.travelBatchId !== undefined) {
      const normalized = await normalizeTravelBatchForJob(
        ctx,
        traveller.jobCardId,
        args.travelBatchId
      );
      patch.travelBatchId = normalized.travelBatchId;
    }
    if (args.fullName !== undefined) {
      patch.fullName = args.fullName.trim();
    }
    if (args.surname !== undefined) {
      patch.surname = args.surname.trim();
    }
    if (args.givenName !== undefined) {
      patch.givenName = args.givenName.trim();
    }
    if (args.travelHub !== undefined) {
      patch.travelHub = args.travelHub.trim();
    }
    if (args.foodPreference !== undefined) {
      patch.foodPreference = args.foodPreference;
    }
    if (args.guestType !== undefined) {
      patch.guestType = args.guestType;
    }
    if (args.paymentType !== undefined) {
      patch.paymentType = args.paymentType;
    }
    if (args.roomType !== undefined) {
      patch.roomType = args.roomType;
    }
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
    if (args.travelDate !== undefined) {
      patch.travelDate = args.travelDate;
    }
    if (args.extensionOfTour !== undefined) {
      patch.extensionOfTour = args.extensionOfTour;
    }
    if (args.arrivingEarly !== undefined) {
      patch.arrivingEarly = args.arrivingEarly;
    }
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
    if (args.gender !== undefined) {
      patch.gender = args.gender.trim();
    }

    await ctx.db.patch(travellerId, patch);

    if (args.visaRequired !== undefined || args.biometricAppointmentDate !== undefined) {
      const visaRecord = await ctx.db
        .query("visaRecords")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .unique();
      if (visaRecord) {
        const visaPatch: Record<string, unknown> = {
          updatedAt: now,
          updatedBy: access.authUserId ?? "unknown",
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
      action: "updated",
      entityId: travellerId,
      entityType: "traveller",
      message: `${(args.fullName ?? traveller.fullName).trim()} updated`,
    });
    return { id: travellerId };
  },
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
    const traveller = await ctx.db.get(travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    const job = await ctx.db.get(traveller.jobCardId);
    const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
    if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(travellerId, {
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
});

export async function deleteTravellerRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  travellerId: Id<"travellers">
) {
  const traveller = await ctx.db.get(travellerId);
  if (!traveller) {
    throw new ConvexError("Traveller not found");
  }
  const job = await ctx.db.get(traveller.jobCardId);
  const [linkedQuery, passportDetails, visaRecords, tickets, seats, meals, rooms] =
    await Promise.all([
      job?.queryId ? ctx.db.get(job.queryId) : Promise.resolve(null),
      ctx.db
        .query("passportDetails")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
      ctx.db
        .query("visaRecords")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
      ctx.db
        .query("tickets")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
      ctx.db
        .query("seatAllocations")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
      ctx.db
        .query("mealPreferences")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
      ctx.db
        .query("roomingListEntries")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect(),
    ]);
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    throw new ConvexError("FORBIDDEN");
  }

  await Promise.all([
    ...passportDetails.map((row) =>
      Promise.all([deleteStorageFile(ctx, row.storageId, "passport scan"), ctx.db.delete(row._id)])
    ),
    ...visaRecords.map((row) => ctx.db.delete(row._id)),
    ...tickets.flatMap((row) => [
      deleteEntityNotifications(ctx, "ticket", row._id),
      ctx.db.delete(row._id),
    ]),
    ...seats.map((row) => ctx.db.delete(row._id)),
    ...meals.map((row) => ctx.db.delete(row._id)),
    ...rooms.map((row) => ctx.db.delete(row._id)),
  ]);

  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: travellerId,
      entityType: "traveller",
      message: `${traveller.fullName} deleted`,
    }),
    deleteEntityNotifications(ctx, "traveller", travellerId),
    ctx.db.delete(travellerId),
  ]);
}

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
});

export const removeMany = mutation({
  args: {
    travellerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TRAVELLERS);
    assertBulkDeleteLimit(args.travellerIds.length);
    const ids: Id<"travellers">[] = [];
    for (const raw of args.travellerIds) {
      const travellerId = ctx.db.normalizeId("travellers", raw);
      if (!travellerId) {
        throw new ConvexError("Invalid traveller id");
      }
      ids.push(travellerId);
    }
    await Promise.all(ids.map((travellerId) => deleteTravellerRecord(ctx, access, travellerId)));
    return { deletedCount: ids.length };
  },
});
