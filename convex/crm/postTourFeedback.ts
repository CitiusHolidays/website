import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  POST_TOUR_MAX_PHOTOS,
  POST_TOUR_PHOTO_MAX_BYTES,
  postTourCategoryValidator,
  postTourFeedbackValidator,
  postTourJobValidator,
  postTourRatingValidator,
} from "../lib/postTourFeedbackValidators";
import { createActivity } from "./lib/activity";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { canSeeJobCardRecord } from "./lib/recordScope";
import { PERMISSIONS } from "./lib/rolePolicy";
import { isDirectorOrAdmin, type PortalAccess, requireStaff } from "./lib/staffAccess";

type DatabaseCtx = QueryCtx | MutationCtx;

function safeJob(job: Doc<"jobCards">) {
  return {
    clientName: job.clientName,
    destination: job.destination ?? "",
    jobCardId: job._id,
    jobCode: job.jobCode,
    travelEndDate: job.travelEndDate ?? "",
    travelStartDate: job.travelStartDate ?? "",
  };
}

async function canCompose(ctx: DatabaseCtx, access: PortalAccess, job: Doc<"jobCards">) {
  if (!(access.staffId && access.roles.includes("Tour Manager"))) {
    return false;
  }
  const assignments = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .take(101);
  if (assignments.length > 100) {
    return false;
  }
  const active = assignments.filter((assignment) => assignment.status === "Assigned");
  if (active.some((assignment) => assignment.staffId === access.staffId)) {
    return true;
  }
  const name = access.name.trim().toLowerCase();
  // Legacy name matching is limited to unlinked assignments. An explicit
  // staff identity always wins, including when two staff share a name.
  if (
    active.some(
      (assignment) =>
        (assignment.externalProfileId ||
          (assignment.staffId && assignment.staffId !== access.staffId)) &&
        assignment.name.trim().toLowerCase() === name
    )
  ) {
    return false;
  }
  if (
    active.some(
      (assignment) =>
        !(assignment.staffId || assignment.externalProfileId) &&
        assignment.name.trim().toLowerCase() === name
    )
  ) {
    return true;
  }
  if (assignments.length > 0 || job.tourManagerId) {
    return false;
  }
  return Boolean(name && job.tourManagerName?.trim().toLowerCase() === name);
}

async function editableFeedback(ctx: DatabaseCtx, feedbackId: Id<"postTourFeedback">) {
  const access = await requireStaff(ctx);
  const record = await ctx.db.get("postTourFeedback", feedbackId);
  const job = record ? await ctx.db.get("jobCards", record.jobCardId) : null;
  if (!(record && job)) {
    throw new ConvexError("Feedback not found");
  }
  const permitted =
    isDirectorOrAdmin(access) ||
    (record.authorStaffId === access.staffId && (await canCompose(ctx, access, job)));
  if (!permitted) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, job, record };
}

async function canReadJobContext(
  ctx: DatabaseCtx,
  access: PortalAccess,
  job: Doc<"jobCards">,
  compose: boolean
) {
  if (compose) {
    return true;
  }
  if (access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)) {
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (canSeeJobCardRecord(access, job, linkedQuery)) {
      return true;
    }
  }
  const report = await ctx.db
    .query("postTourReports")
    .withIndex("by_jobCardId_status", (q) => q.eq("jobCardId", job._id).eq("status", "submitted"))
    .first();
  if (report) {
    return true;
  }
  const feedback = await ctx.db
    .query("postTourFeedback")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .first();
  if (feedback) {
    return true;
  }
  return Boolean(
    await ctx.db
      .query("travelerFeedbackResponses")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
      .first()
  );
}

function checkedContent(args: {
  comment: string;
  vendorName?: string;
  vendorRating?: number | null;
}) {
  const comment = args.comment.trim();
  const vendorName = args.vendorName?.trim() ?? "";
  const vendorRating = args.vendorRating ?? null;
  if (!comment || comment.length > 4000) {
    throw new ConvexError("Add a comment of 1 to 4,000 characters.");
  }
  if (vendorName.length > 160) {
    throw new ConvexError("Vendor name must be 160 characters or fewer.");
  }
  if (
    vendorRating !== null &&
    (!Number.isInteger(vendorRating) || vendorRating < 1 || vendorRating > 10)
  ) {
    throw new ConvexError("Choose a rating from 1 to 10, or Not applicable.");
  }
  return { comment, vendorName, vendorRating };
}

export const list = query({
  args: { jobCardId: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const jobCardId =
      args.jobCardId === undefined ? null : ctx.db.normalizeId("jobCards", args.jobCardId);
    if (args.jobCardId !== undefined && !jobCardId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const result = jobCardId
      ? await ctx.db
          .query("postTourFeedback")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db
          .query("postTourFeedback")
          .withIndex("by_createdAt")
          .order("desc")
          .paginate(args.paginationOpts);
    const page = await Promise.all(
      result.page.map(async (record) => {
        const job = await ctx.db.get("jobCards", record.jobCardId);
        if (!job) {
          return null;
        }
        const canEdit =
          isDirectorOrAdmin(access) ||
          (record.authorStaffId === access.staffId && (await canCompose(ctx, access, job)));
        const photos = await ctx.db
          .query("postTourFeedbackPhotos")
          .withIndex("by_feedbackId", (q) => q.eq("feedbackId", record._id))
          .take(POST_TOUR_MAX_PHOTOS);
        return {
          authorName: record.authorName,
          canDelete: canEdit,
          canEdit,
          category: record.category,
          comment: record.comment,
          createdAt: record.createdAt,
          id: record._id,
          job: safeJob(job),
          photos: photos.map((photo) => ({
            fileName: photo.fileName,
            fileSize: photo.fileSize,
            id: photo._id,
            mimeType: photo.mimeType,
          })),
          updatedAt: record.updatedAt,
          vendorName: record.vendorName,
          vendorRating: record.vendorRating,
        };
      })
    );
    return { ...result, page: page.filter((row) => row !== null) };
  },
  returns: paginationResultValidator(postTourFeedbackValidator),
});

export const listJobs = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const result = await ctx.db
      .query("jobCards")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: (
        await Promise.all(
          result.page.map(async (job) => {
            const compose = await canCompose(ctx, access, job);
            return (await canReadJobContext(ctx, access, job, compose))
              ? { ...safeJob(job), canCompose: compose }
              : null;
          })
        )
      ).filter((job) => job !== null),
    };
  },
  returns: paginationResultValidator(postTourJobValidator.extend({ canCompose: v.boolean() })),
});

export const getJobContext = query({
  args: { jobCardId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
    if (!job) {
      return null;
    }
    const compose = await canCompose(ctx, access, job);
    return (await canReadJobContext(ctx, access, job, compose))
      ? { ...safeJob(job), canCompose: compose }
      : null;
  },
  returns: v.union(v.null(), postTourJobValidator.extend({ canCompose: v.boolean() })),
});

const contentArgs = {
  category: postTourCategoryValidator,
  comment: v.string(),
  vendorName: v.optional(v.string()),
  vendorRating: v.optional(postTourRatingValidator),
};

export const create = mutation({
  args: { ...contentArgs, jobCardId: v.id("jobCards") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const job = await ctx.db.get("jobCards", args.jobCardId);
    if (!(job && access.staffId && access.authUserId && (await canCompose(ctx, access, job)))) {
      throw new ConvexError("FORBIDDEN");
    }
    const now = Date.now();
    const id = await insertWithE2eOwnership(
      ctx,
      "postTourFeedback",
      {
        ...checkedContent(args),
        authorAuthUserId: access.authUserId,
        authorName: access.name,
        authorStaffId: access.staffId,
        category: args.category,
        createdAt: now,
        jobCardId: job._id,
        updatedAt: now,
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "postTourFeedback",
      message: `${job.jobCode} post-tour feedback added`,
    });
    return { id };
  },
  returns: v.object({ id: v.id("postTourFeedback") }),
});

export const update = mutation({
  args: { ...contentArgs, feedbackId: v.id("postTourFeedback") },
  handler: async (ctx, args) => {
    const { access, job, record } = await editableFeedback(ctx, args.feedbackId);
    await patchWithE2eOwnership(
      ctx,
      "postTourFeedback",
      record._id,
      {
        ...checkedContent(args),
        category: args.category,
        lastEditedBy: access.authUserId,
        lastEditedByName: access.name,
        updatedAt: Date.now(),
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "updated",
      entityId: record._id,
      entityType: "postTourFeedback",
      message: `${job.jobCode} post-tour feedback updated`,
    });
    return { id: record._id };
  },
  returns: v.object({ id: v.id("postTourFeedback") }),
});

export const remove = mutation({
  args: { feedbackId: v.id("postTourFeedback") },
  handler: async (ctx, args) => {
    const { access, job, record } = await editableFeedback(ctx, args.feedbackId);
    const photos = await ctx.db
      .query("postTourFeedbackPhotos")
      .withIndex("by_feedbackId", (q) => q.eq("feedbackId", record._id))
      .take(POST_TOUR_MAX_PHOTOS);
    await Promise.all(
      photos.map(async (photo) => {
        await Promise.all([
          ctx.storage.delete(photo.storageId),
          ctx.storage.delete(photo.thumbnailStorageId),
        ]);
        await ctx.db.delete("postTourFeedbackPhotos", photo._id);
      })
    );
    await ctx.db.delete("postTourFeedback", record._id);
    await createActivity(ctx, access, {
      action: "deleted",
      entityId: record._id,
      entityType: "postTourFeedback",
      message: `${job.jobCode} post-tour feedback removed`,
    });
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const removePhoto = mutation({
  args: { photoId: v.id("postTourFeedbackPhotos") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const photo = await ctx.db.get("postTourFeedbackPhotos", args.photoId);
    if (!photo) {
      throw new ConvexError("Photo not found");
    }
    const { access, job } = await editableFeedback(ctx, photo.feedbackId);
    await Promise.all([
      ctx.storage.delete(photo.storageId),
      ctx.storage.delete(photo.thumbnailStorageId),
    ]);
    await ctx.db.delete("postTourFeedbackPhotos", photo._id);
    await createActivity(ctx, access, {
      action: "photo_deleted",
      entityId: photo.feedbackId,
      entityType: "postTourFeedback",
      message: `${job.jobCode} post-tour photo removed`,
    });
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const verifyPhotoUpload = internalQuery({
  args: { feedbackId: v.string() },
  handler: async (ctx, args) => {
    const feedbackId = ctx.db.normalizeId("postTourFeedback", args.feedbackId);
    if (!feedbackId) {
      throw new ConvexError("Feedback not found");
    }
    const { access, record } = await editableFeedback(ctx, feedbackId);
    const photos = await ctx.db
      .query("postTourFeedbackPhotos")
      .withIndex("by_feedbackId", (q) => q.eq("feedbackId", record._id))
      .take(POST_TOUR_MAX_PHOTOS);
    if (photos.length >= POST_TOUR_MAX_PHOTOS) {
      throw new ConvexError(
        `Each feedback entry can include up to ${POST_TOUR_MAX_PHOTOS} photos.`
      );
    }
    if (!access.authUserId) {
      throw new ConvexError("FORBIDDEN");
    }
    return { authUserId: access.authUserId, feedbackId: record._id };
  },
  returns: v.object({ authUserId: v.string(), feedbackId: v.id("postTourFeedback") }),
});

// Only the authenticated HTTP handler supplies freshly stored bytes here.
// No public mutation accepts a storage ID or client-claimed size.
export const savePhoto = internalMutation({
  args: {
    actorAuthUserId: v.string(),
    feedbackId: v.id("postTourFeedback"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { access, job, record } = await editableFeedback(ctx, args.feedbackId);
    if (args.actorAuthUserId !== access.authUserId) {
      throw new ConvexError("FORBIDDEN");
    }
    const photos = await ctx.db
      .query("postTourFeedbackPhotos")
      .withIndex("by_feedbackId", (q) => q.eq("feedbackId", record._id))
      .take(POST_TOUR_MAX_PHOTOS);
    if (photos.length >= POST_TOUR_MAX_PHOTOS) {
      throw new ConvexError(
        `Each feedback entry can include up to ${POST_TOUR_MAX_PHOTOS} photos.`
      );
    }
    if (!access.authUserId || args.fileSize < 1 || args.fileSize > POST_TOUR_PHOTO_MAX_BYTES) {
      throw new ConvexError("Invalid photo size");
    }
    const id = await insertWithE2eOwnership(
      ctx,
      "postTourFeedbackPhotos",
      {
        createdAt: Date.now(),
        feedbackId: args.feedbackId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        jobCardId: record.jobCardId,
        mimeType: args.mimeType,
        storageId: args.storageId,
        thumbnailStorageId: args.thumbnailStorageId,
        uploadedBy: access.authUserId,
      },
      { authUserId: args.actorAuthUserId }
    );
    await patchWithE2eOwnership(
      ctx,
      "postTourFeedback",
      record._id,
      {
        lastEditedBy: access.authUserId,
        lastEditedByName: access.name,
        updatedAt: Date.now(),
      },
      { authUserId: args.actorAuthUserId }
    );
    await createActivity(ctx, access, {
      action: "photo_added",
      entityId: record._id,
      entityType: "postTourFeedback",
      message: `${job.jobCode} post-tour photo added`,
    });
    return { id };
  },
  returns: v.object({ id: v.id("postTourFeedbackPhotos") }),
});

export const photoRecord = internalQuery({
  args: { photoId: v.id("postTourFeedbackPhotos") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const photo = await ctx.db.get("postTourFeedbackPhotos", args.photoId);
    const record = photo ? await ctx.db.get("postTourFeedback", photo.feedbackId) : null;
    const job = record ? await ctx.db.get("jobCards", record.jobCardId) : null;
    if (!(photo && record && job) || photo.jobCardId !== record.jobCardId) {
      throw new ConvexError("Photo not found");
    }
    return {
      authUserId: access.authUserId ?? "",
      fileName: photo.fileName,
      mimeType: photo.mimeType,
      storageId: photo.storageId,
      thumbnailStorageId: photo.thumbnailStorageId,
    };
  },
  returns: v.object({
    authUserId: v.string(),
    fileName: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
  }),
});
