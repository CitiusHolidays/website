import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  PERMISSIONS,
  requireStaff,
} from "./lib";

const visaStatusValidator = v.union(
  v.literal("Not Required"),
  v.literal("Not Started"),
  v.literal("Checklist Shared"),
  v.literal("Documents Pending"),
  v.literal("Documents Verified"),
  v.literal("Appointment Scheduled"),
  v.literal("Submitted"),
  v.literal("Awaiting"),
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Re-applied"),
);

const publicVisa = (record: any, traveller: any, job: any) => ({
  id: record._id,
  travellerId: record.travellerId,
  jobCardId: record.jobCardId,
  jobCode: job?.jobCode ?? "",
  clientName: job?.clientName ?? "",
  travellerName: traveller?.fullName ?? "",
  travelHub: traveller?.travelHub ?? "",
  status: record.status,
  appointmentDate: record.appointmentDate ?? traveller?.biometricAppointmentDate ?? "",
  checklistSharedAt: record.checklistSharedAt
    ? new Date(record.checklistSharedAt).toISOString()
    : null,
  submittedAt: record.submittedAt ? new Date(record.submittedAt).toISOString() : null,
  approvedAt: record.approvedAt ? new Date(record.approvedAt).toISOString() : null,
  rejectedAt: record.rejectedAt ? new Date(record.rejectedAt).toISOString() : null,
  notes: record.notes ?? "",
  createdAt: new Date(record.createdAt).toISOString(),
  updatedAt: new Date(record.updatedAt).toISOString(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_VISA),
      ctx.db.query("visaRecords").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (record) => {
          const [traveller, job] = await Promise.all([
            ctx.db.get(record.travellerId),
            ctx.db.get(record.jobCardId),
          ]);
          if (!job) {
            return null;
          }
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery)) {
            return null;
          }
          return publicVisa(record, traveller, job);
        }),
    );
    return result.filter(Boolean);
  },
});

export const updateStatus = mutation({
  args: {
    visaRecordId: v.string(),
    status: visaStatusValidator,
    appointmentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    const visaRecordId = ctx.db.normalizeId("visaRecords", args.visaRecordId);
    if (!visaRecordId) {
      throw new ConvexError("Invalid visa record id");
    }
    const record = await ctx.db.get(visaRecordId);
    if (!record) {
      throw new ConvexError("Visa record not found");
    }
    const job = await ctx.db.get(record.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    const now = Date.now();
    const patch: Record<string, unknown> = {
      status: args.status,
      appointmentDate: args.appointmentDate || record.appointmentDate || "",
      notes: args.notes?.trim() || record.notes || "",
      updatedBy: access.authUserId ?? "unknown",
      updatedAt: now,
    };
    if (args.status === "Checklist Shared") {
      patch.checklistSharedAt = now;
    }
    if (args.status === "Submitted") {
      patch.submittedAt = now;
    }
    if (args.status === "Approved") {
      patch.approvedAt = now;
    }
    if (args.status === "Rejected") {
      patch.rejectedAt = now;
    }

    await Promise.all([
      ctx.db.patch(visaRecordId, patch),
      ctx.db.patch(record.travellerId, {
        visaStatus: args.status,
        biometricAppointmentDate: args.appointmentDate || "",
        updatedAt: now,
      }),
      createActivity(ctx, access, {
        entityType: "visaRecord",
        entityId: visaRecordId,
        action: "status_updated",
        message: `Visa status set to ${args.status}`,
      }),
    ]);
    return { id: visaRecordId };
  },
});

export const updateRecord = mutation({
  args: {
    visaRecordId: v.string(),
    status: v.optional(visaStatusValidator),
    appointmentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    const visaRecordId = ctx.db.normalizeId("visaRecords", args.visaRecordId);
    if (!visaRecordId) {
      throw new ConvexError("Invalid visa record id");
    }
    const record = await ctx.db.get(visaRecordId);
    if (!record) {
      throw new ConvexError("Visa record not found");
    }
    const job = await ctx.db.get(record.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }

    const now = Date.now();
    const nextStatus = args.status ?? record.status;
    const patch: Record<string, unknown> = {
      updatedBy: access.authUserId ?? "unknown",
      updatedAt: now,
    };
    if (args.status !== undefined) patch.status = args.status;
    if (args.appointmentDate !== undefined) {
      patch.appointmentDate = args.appointmentDate;
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim();

    if (args.status === "Checklist Shared" && !record.checklistSharedAt) {
      patch.checklistSharedAt = now;
    }
    if (args.status === "Submitted" && !record.submittedAt) {
      patch.submittedAt = now;
    }
    if (args.status === "Approved" && !record.approvedAt) {
      patch.approvedAt = now;
    }
    if (args.status === "Rejected" && !record.rejectedAt) {
      patch.rejectedAt = now;
    }

    await Promise.all([
      ctx.db.patch(visaRecordId, patch),
      ctx.db.patch(record.travellerId, {
        visaStatus: nextStatus,
        ...(args.appointmentDate !== undefined
          ? { biometricAppointmentDate: args.appointmentDate }
          : {}),
        updatedAt: now,
      }),
      createActivity(ctx, access, {
        entityType: "visaRecord",
        entityId: visaRecordId,
        action: "updated",
        message: `Visa record updated${args.status ? ` (${args.status})` : ""}`,
      }),
    ]);
    return { id: visaRecordId };
  },
});

export const remove = mutation({
  args: {
    visaRecordId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    const visaRecordId = ctx.db.normalizeId("visaRecords", args.visaRecordId);
    if (!visaRecordId) {
      throw new ConvexError("Invalid visa record id");
    }
    const record = await ctx.db.get(visaRecordId);
    if (!record) {
      throw new ConvexError("Visa record not found");
    }
    const job = await ctx.db.get(record.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    await Promise.all([
      ctx.db.patch(record.travellerId, {
        visaStatus: "Not Started",
        updatedAt: Date.now(),
      }),
      createActivity(ctx, access, {
        entityType: "visaRecord",
        entityId: visaRecordId,
        action: "deleted",
        message: "Visa record deleted",
      }),
      deleteEntityNotifications(ctx, "visaRecord", visaRecordId),
      ctx.db.delete(visaRecordId),
    ]);
    return { id: visaRecordId };
  },
});

export const create = mutation({
  args: {
    travellerId: v.string(),
    status: v.optional(visaStatusValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }
    const traveller = await ctx.db.get(travellerId);
    if (!traveller) {
      throw new ConvexError("Traveller not found");
    }
    const job = await ctx.db.get(traveller.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }

    const existing = await ctx.db
      .query("visaRecords")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();
    if (existing) {
      throw new ConvexError("Visa record already exists for this traveller");
    }

    const now = Date.now();
    const status = args.status || "Not Started";
    const recordId = await ctx.db.insert("visaRecords", {
      travellerId,
      jobCardId: traveller.jobCardId,
      status,
      updatedBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await Promise.all([
      ctx.db.patch(travellerId, {
        visaStatus: status,
        updatedAt: now,
      }),
      createActivity(ctx, access, {
        entityType: "visaRecord",
        entityId: recordId,
        action: "created",
        message: `Visa tracking record created for ${traveller.fullName}`,
      }),
    ]);

    return { id: recordId };
  },
});

export const listTravellersWithoutVisa = query({
  args: {},
  handler: async (ctx) => {
    const [access, allTravellers, allVisaRecords] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_VISA),
      ctx.db.query("travellers").collect(),
      ctx.db.query("visaRecords").collect(),
    ]);
    const travellerIdsWithVisa = new Set(allVisaRecords.map((r) => r.travellerId.toString()));

    const result = await Promise.all(
      allTravellers.map(async (traveller) => {
        if (traveller.visaRequired && !travellerIdsWithVisa.has(traveller._id.toString())) {
          const job = await ctx.db.get(traveller.jobCardId);
          if (!job) {
            return null;
          }
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery)) {
            return null;
          }
          return {
            id: traveller._id,
            fullName: traveller.fullName,
            jobCode: job?.jobCode ?? "",
            clientName: job?.clientName ?? "",
          };
        }
        return null;
      }),
    );
    return result.filter(Boolean);
  },
});
