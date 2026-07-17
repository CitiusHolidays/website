import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  assertBulkDeleteMutationBatch,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  flushDeferredNotificationCleanup,
  type NotificationEntityIdentity,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import {
  deletedCountResultValidator,
  travellerWithoutVisaListResultValidator,
  visaIdResultValidator,
  visaListPageResultValidator,
} from "./operationsReturnContracts";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

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
  v.literal("Re-applied")
);

const publicVisa = (record: any, traveller: any, job: any, travelBatch: any = null) => ({
  appointmentDate: record.appointmentDate ?? traveller?.biometricAppointmentDate ?? "",
  approvedAt: record.approvedAt ? new Date(record.approvedAt).toISOString() : null,
  checklistSharedAt: record.checklistSharedAt
    ? new Date(record.checklistSharedAt).toISOString()
    : null,
  clientName: job?.clientName ?? "",
  createdAt: new Date(record.createdAt).toISOString(),
  id: record._id,
  jobCardId: record.jobCardId,
  jobCode: job?.jobCode ?? "",
  notes: record.notes ?? "",
  rejectedAt: record.rejectedAt ? new Date(record.rejectedAt).toISOString() : null,
  status: record.status,
  submittedAt: record.submittedAt ? new Date(record.submittedAt).toISOString() : null,
  travelBatchCode: travelBatch?.batchCode ?? "",
  travelBatchId: traveller?.travelBatchId ?? "",
  travelBatchReference: travelBatch?.batchReference ?? "",
  travelHub: traveller?.travelHub ?? "",
  travellerId: record.travellerId,
  travellerName: traveller?.fullName ?? "",
  updatedAt: new Date(record.updatedAt).toISOString(),
});

export const list = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(visaStatusValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_VISA);
    const page = await applyCrmCursorFilters(
      ctx.db.query("visaRecords").withIndex("by_createdAt").order("desc"),
      { equals: { jobCardId: args.jobCardId, status: args.status } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    const rows = await mapInBoundedBatches(page.page, async (record) => {
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
      const travelBatch = traveller?.travelBatchId
        ? await ctx.db.get(traveller.travelBatchId)
        : null;
      return publicVisa(record, traveller, job, travelBatch);
    });
    return { ...page, page: compactPageItems(rows) };
  },
  returns: visaListPageResultValidator,
});

export const updateStatus = mutation({
  args: {
    appointmentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: visaStatusValidator,
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
    const now = Date.now();
    const patch: Record<string, unknown> = {
      appointmentDate: args.appointmentDate || record.appointmentDate || "",
      notes: args.notes?.trim() || record.notes || "",
      status: args.status,
      updatedAt: now,
      updatedBy: access.authUserId ?? "unknown",
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
        biometricAppointmentDate: args.appointmentDate || "",
        updatedAt: now,
        visaStatus: args.status,
      }),
      createActivity(ctx, access, {
        action: "status_updated",
        entityId: visaRecordId,
        entityType: "visaRecord",
        message: `Visa status set to ${args.status}`,
      }),
    ]);
    return { id: visaRecordId };
  },
  returns: visaIdResultValidator,
});

export const updateRecord = mutation({
  args: {
    appointmentDate: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(visaStatusValidator),
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

    const now = Date.now();
    const nextStatus = args.status ?? record.status;
    const patch: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: access.authUserId ?? "unknown",
    };
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    if (args.appointmentDate !== undefined) {
      patch.appointmentDate = args.appointmentDate;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim();
    }

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
        ...(args.appointmentDate === undefined
          ? {}
          : { biometricAppointmentDate: args.appointmentDate }),
        updatedAt: now,
      }),
      createActivity(ctx, access, {
        action: "updated",
        entityId: visaRecordId,
        entityType: "visaRecord",
        message: `Visa record updated${args.status ? ` (${args.status})` : ""}`,
      }),
    ]);
    return { id: visaRecordId };
  },
  returns: visaIdResultValidator,
});

async function deleteVisaRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  visaRecordId: Id<"visaRecords">,
  deferredNotifications?: NotificationEntityIdentity[]
) {
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
      updatedAt: Date.now(),
      visaStatus: "Not Started",
    }),
    createActivity(ctx, access, {
      action: "deleted",
      entityId: visaRecordId,
      entityType: "visaRecord",
      message: "Visa record deleted",
    }),
    deleteEntityNotifications(ctx, "visaRecord", visaRecordId, deferredNotifications),
    ctx.db.delete(visaRecordId),
  ]);
}

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
    await deleteVisaRecord(ctx, access, visaRecordId);
    return { id: visaRecordId };
  },
  returns: visaIdResultValidator,
});

export const removeMany = mutation({
  args: {
    visaRecordIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_VISA);
    assertBulkDeleteMutationBatch(args.visaRecordIds.length);
    const ids: Id<"visaRecords">[] = [];
    for (const raw of args.visaRecordIds) {
      const visaRecordId = ctx.db.normalizeId("visaRecords", raw);
      if (!visaRecordId) {
        throw new ConvexError("Invalid visa record id");
      }
      ids.push(visaRecordId);
    }
    const notifications: NotificationEntityIdentity[] = [];
    await mapInBoundedBatches(
      ids,
      async (visaRecordId) => await deleteVisaRecord(ctx, access, visaRecordId, notifications),
      4
    );
    await flushDeferredNotificationCleanup(ctx, notifications);
    return { deletedCount: ids.length };
  },
  returns: deletedCountResultValidator,
});

export const create = mutation({
  args: {
    status: v.optional(visaStatusValidator),
    travellerId: v.string(),
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
      createdAt: now,
      jobCardId: traveller.jobCardId,
      status,
      travellerId,
      updatedAt: now,
      updatedBy: access.authUserId ?? "unknown",
    });

    await Promise.all([
      ctx.db.patch(travellerId, {
        updatedAt: now,
        visaStatus: status,
      }),
      createActivity(ctx, access, {
        action: "created",
        entityId: recordId,
        entityType: "visaRecord",
        message: `Visa tracking record created for ${traveller.fullName}`,
      }),
    ]);

    return { id: recordId };
  },
  returns: visaIdResultValidator,
});

export const listTravellersWithoutVisa = query({
  args: {},
  handler: async (ctx) => {
    const [access, visaRecords] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_VISA),
      ctx.db.query("visaRecords").withIndex("by_createdAt").order("desc").take(5000),
    ]);
    const travellerIdsWithVisa = new Set(visaRecords.map((r) => r.travellerId.toString()));

    const travellers = await ctx.db
      .query("travellers")
      .withIndex("by_createdAt")
      .order("desc")
      .take(5000);

    const result = await Promise.all(
      travellers.map(async (traveller) => {
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
            clientName: job?.clientName ?? "",
            fullName: traveller.fullName,
            id: traveller._id,
            jobCode: job?.jobCode ?? "",
          };
        }
        return null;
      })
    );
    return result.filter((row): row is NonNullable<typeof row> => row !== null);
  },
  returns: travellerWithoutVisaListResultValidator,
});
