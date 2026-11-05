import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Infer } from "convex/values";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { postTourCategoryValidator } from "../lib/postTourFeedbackValidators";
import {
  TRAVELER_FEEDBACK_CATEGORIES,
  TRAVELER_FEEDBACK_HASH_PATTERN,
  TRAVELER_MAX_PHOTOS,
  TRAVELER_MAX_RESPONSES,
  TRAVELER_PHOTO_MAX_BYTES,
  travelerCommentsValidator,
  travelerFeedbackFormValidator,
  travelerFeedbackRequestValidator,
  travelerFeedbackResponseValidator,
} from "../lib/travelerFeedbackValidators";
import { createActivity } from "./lib/activity";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { canSeeJobCardRecord } from "./lib/recordScope";
import { PERMISSIONS } from "./lib/rolePolicy";
import { type PortalAccess, requireStaff } from "./lib/staffAccess";
import { boundedPaginationOptions } from "./paginationPolicy";

type DatabaseCtx = MutationCtx | QueryCtx;
type Comments = Infer<typeof travelerCommentsValidator>;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGEMENT_PERMISSIONS = [
  PERMISSIONS.MANAGE_JOB_CARDS,
  PERMISSIONS.MANAGE_OPERATIONS,
  PERMISSIONS.MANAGE_TOUR_MANAGERS,
  PERMISSIONS.MANAGE_TRAVELLERS,
];
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function unavailable(): never {
  throw new ConvexError({
    code: "FEEDBACK_UNAVAILABLE",
    message: "This feedback link is unavailable or has expired.",
  });
}

function canManage(access: PortalAccess) {
  return MANAGEMENT_PERMISSIONS.some((permission) => access.permissions.includes(permission));
}

async function requireVisibleJob(ctx: DatabaseCtx, jobCardId: Id<"jobCards">, manage = false) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const job = await ctx.db.get("jobCards", jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery)) || (manage && !canManage(access))) {
    throw new ConvexError("FORBIDDEN");
  }
  return { access, job };
}

async function activeRequest(ctx: DatabaseCtx, tokenHash: string) {
  if (!TRAVELER_FEEDBACK_HASH_PATTERN.test(tokenHash)) {
    return unavailable();
  }
  const request = await ctx.db
    .query("travelerFeedbackRequests")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !request ||
    request.revokedAt !== undefined ||
    request.expiresAt <= Date.now() ||
    !(await ctx.db.get("jobCards", request.jobCardId))
  ) {
    return unavailable();
  }
  return request;
}

async function responseForUpload(ctx: DatabaseCtx, tokenHash: string, responseTokenHash: string) {
  const request = await activeRequest(ctx, tokenHash);
  if (!TRAVELER_FEEDBACK_HASH_PATTERN.test(responseTokenHash)) {
    return unavailable();
  }
  const response = await ctx.db
    .query("travelerFeedbackResponses")
    .withIndex("by_responseTokenHash", (q) => q.eq("responseTokenHash", responseTokenHash))
    .unique();
  if (!response || response.requestId !== request._id || response.jobCardId !== request.jobCardId) {
    return unavailable();
  }
  return { request, response };
}

async function consumeRequestWindow(
  ctx: MutationCtx,
  request: Doc<"travelerFeedbackRequests">,
  purpose: "form" | "photo" | "submission"
) {
  const now = Date.now();
  const startedAtKey = `${purpose}WindowStartedAt` as const;
  const countKey = `${purpose}WindowCount` as const;
  const startedAt = request[startedAtKey] ?? 0;
  const count = now < startedAt + MINUTE ? (request[countKey] ?? 0) : 0;
  const limit = purpose === "form" ? 240 : 120;
  if (count >= limit) {
    throw new ConvexError({
      code: "FEEDBACK_RATE_LIMITED",
      message: "Please wait a minute before trying again.",
    });
  }
  await patchWithE2eOwnership(
    ctx,
    "travelerFeedbackRequests",
    request._id,
    { [countKey]: count + 1, [startedAtKey]: count ? startedAt : now },
    { authUserId: request.createdBy }
  );
}

function checkedSubmission(args: {
  comments: Comments;
  respondentEmail?: string;
  respondentName?: string;
}) {
  const comments: Comments = {
    food: args.comments.food.trim(),
    hotel: args.comments.hotel.trim(),
    improvements: args.comments.improvements.trim(),
    itinerary: args.comments.itinerary.trim(),
    overall: args.comments.overall.trim(),
    whatWentWell: args.comments.whatWentWell.trim(),
  };
  const values = Object.values(comments);
  if (!values.some(Boolean)) {
    throw new ConvexError("Add a comment in at least one section.");
  }
  if (values.some((value) => value.length > 2000)) {
    throw new ConvexError("Keep each comment to 2,000 characters or fewer.");
  }
  const respondentName = args.respondentName?.trim() ?? "";
  const respondentEmail = args.respondentEmail?.trim().toLowerCase() ?? "";
  if (respondentName.length > 120) {
    throw new ConvexError("Keep your name to 120 characters or fewer.");
  }
  if (respondentEmail && (respondentEmail.length > 254 || !EMAIL_PATTERN.test(respondentEmail))) {
    throw new ConvexError("Enter a valid email address, or leave it blank.");
  }
  return { comments, respondentEmail, respondentName };
}

export const issueRequest = internalMutation({
  args: {
    expiresInDays: v.number(),
    jobCardId: v.id("jobCards"),
    publicTripLabel: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { access, job } = await requireVisibleJob(ctx, args.jobCardId, true);
    if (!(access.authUserId && TRAVELER_FEEDBACK_HASH_PATTERN.test(args.tokenHash))) {
      throw new ConvexError("FORBIDDEN");
    }
    const publicTripLabel = args.publicTripLabel.trim();
    if (!publicTripLabel || publicTripLabel.length > 120) {
      throw new ConvexError("Add a public trip label of 1 to 120 characters.");
    }
    if (
      !Number.isInteger(args.expiresInDays) ||
      args.expiresInDays < 1 ||
      args.expiresInDays > 30
    ) {
      throw new ConvexError("Choose an expiry between 1 and 30 days.");
    }
    const now = Date.now();
    const recent = await ctx.db
      .query("travelerFeedbackRequests")
      .withIndex("by_createdBy_and_createdAt", (q) =>
        q.eq("createdBy", access.authUserId ?? "").gte("createdAt", now - HOUR)
      )
      .take(12);
    if (recent.length >= 12) {
      throw new ConvexError("Too many feedback links created. Please try again later.");
    }
    const expiresAt = now + args.expiresInDays * 24 * HOUR;
    const id = await insertWithE2eOwnership(
      ctx,
      "travelerFeedbackRequests",
      {
        createdAt: now,
        createdBy: access.authUserId,
        createdByStaffId: access.staffId,
        expiresAt,
        jobCardId: job._id,
        publicTripLabel,
        responseCount: 0,
        tokenHash: args.tokenHash,
      },
      { authUserId: access.authUserId }
    );
    await createActivity(ctx, access, {
      action: "created",
      entityId: id,
      entityType: "travelerFeedbackRequest",
      message: `Traveller feedback link created for ${job.jobCode}`,
    });
    return { expiresAt, id };
  },
  returns: v.object({ expiresAt: v.number(), id: v.id("travelerFeedbackRequests") }),
});

export const listRequests = query({
  args: { jobCardId: v.id("jobCards"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireVisibleJob(ctx, args.jobCardId);
    const result = await ctx.db
      .query("travelerFeedbackRequests")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", args.jobCardId))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...result,
      page: result.page.map((request) => ({
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        id: request._id,
        publicTripLabel: request.publicTripLabel,
        responseCount: request.responseCount,
        revokedAt: request.revokedAt ?? null,
      })),
    };
  },
  returns: paginationResultValidator(travelerFeedbackRequestValidator),
});

export const getRequestAccess = query({
  args: { jobCardId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!(jobCardId && access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS))) {
      return { canManage: false };
    }
    const job = await ctx.db.get("jobCards", jobCardId);
    const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
    return {
      canManage: Boolean(job && canManage(access) && canSeeJobCardRecord(access, job, linkedQuery)),
    };
  },
  returns: v.object({ canManage: v.boolean() }),
});

export const revokeRequest = mutation({
  args: { requestId: v.id("travelerFeedbackRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get("travelerFeedbackRequests", args.requestId);
    if (!request) {
      throw new ConvexError("FORBIDDEN");
    }
    const { access, job } = await requireVisibleJob(ctx, request.jobCardId, true);
    if (!request.revokedAt) {
      const recent = await ctx.db
        .query("travelerFeedbackRequests")
        .withIndex("by_revokedBy_and_revokedAt", (q) =>
          q.eq("revokedBy", access.authUserId ?? "").gte("revokedAt", Date.now() - HOUR)
        )
        .take(60);
      if (recent.length >= 60) {
        throw new ConvexError("Too many changes. Please try again later.");
      }
      await patchWithE2eOwnership(
        ctx,
        "travelerFeedbackRequests",
        request._id,
        { revokedAt: Date.now(), revokedBy: access.authUserId },
        { authUserId: access.authUserId }
      );
      await createActivity(ctx, access, {
        action: "revoked",
        entityId: request._id,
        entityType: "travelerFeedbackRequest",
        message: `Traveller feedback link revoked for ${job.jobCode}`,
      });
    }
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const openForm = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const request = await activeRequest(ctx, args.tokenHash);
    if (request.responseCount >= TRAVELER_MAX_RESPONSES) {
      return unavailable();
    }
    await consumeRequestWindow(ctx, request, "form");
    return {
      categories: [...TRAVELER_FEEDBACK_CATEGORIES],
      expiresAt: request.expiresAt,
      maxPhotoBytes: TRAVELER_PHOTO_MAX_BYTES,
      maxPhotos: TRAVELER_MAX_PHOTOS,
      publicTripLabel: request.publicTripLabel,
    };
  },
  returns: travelerFeedbackFormValidator,
});

export const submitResponse = internalMutation({
  args: {
    comments: travelerCommentsValidator,
    payloadHash: v.string(),
    respondentEmail: v.optional(v.string()),
    respondentName: v.optional(v.string()),
    responseTokenHash: v.string(),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await activeRequest(ctx, args.tokenHash);
    if (
      !(
        TRAVELER_FEEDBACK_HASH_PATTERN.test(args.responseTokenHash) &&
        TRAVELER_FEEDBACK_HASH_PATTERN.test(args.payloadHash)
      )
    ) {
      return unavailable();
    }
    const existing = await ctx.db
      .query("travelerFeedbackResponses")
      .withIndex("by_responseTokenHash", (q) => q.eq("responseTokenHash", args.responseTokenHash))
      .unique();
    if (existing) {
      if (existing.requestId !== request._id || existing.payloadHash !== args.payloadHash) {
        return unavailable();
      }
      return { success: true };
    }
    if (request.responseCount >= TRAVELER_MAX_RESPONSES) {
      return unavailable();
    }
    const content = checkedSubmission(args);
    await consumeRequestWindow(ctx, request, "submission");
    await insertWithE2eOwnership(
      ctx,
      "travelerFeedbackResponses",
      {
        ...content,
        createdAt: Date.now(),
        jobCardId: request.jobCardId,
        payloadHash: args.payloadHash,
        photoCount: 0,
        requestId: request._id,
        responseTokenHash: args.responseTokenHash,
      },
      { authUserId: request.createdBy }
    );
    await patchWithE2eOwnership(
      ctx,
      "travelerFeedbackRequests",
      request._id,
      { responseCount: request.responseCount + 1 },
      { authUserId: request.createdBy }
    );
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const authorizePhoto = internalMutation({
  args: { responseTokenHash: v.string(), tokenHash: v.string() },
  handler: async (ctx, args) => {
    const { request } = await responseForUpload(ctx, args.tokenHash, args.responseTokenHash);
    await consumeRequestWindow(ctx, request, "photo");
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const savePhoto = internalMutation({
  args: {
    category: postTourCategoryValidator,
    contentDigest: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    responseTokenHash: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { request, response } = await responseForUpload(
      ctx,
      args.tokenHash,
      args.responseTokenHash
    );
    if (
      !TRAVELER_FEEDBACK_HASH_PATTERN.test(args.contentDigest) ||
      args.fileSize < 1 ||
      args.fileSize > TRAVELER_PHOTO_MAX_BYTES ||
      !["image/jpeg", "image/png", "image/webp"].includes(args.mimeType)
    ) {
      throw new ConvexError("Invalid photo.");
    }
    const existing = await ctx.db
      .query("travelerFeedbackPhotos")
      .withIndex("by_responseId_contentDigest", (q) =>
        q.eq("responseId", response._id).eq("contentDigest", args.contentDigest)
      )
      .unique();
    if (existing) {
      return { photoCount: response.photoCount, success: true };
    }
    if (response.photoCount >= TRAVELER_MAX_PHOTOS) {
      throw new ConvexError("You have already added the maximum of 8 photos.");
    }
    await insertWithE2eOwnership(
      ctx,
      "travelerFeedbackPhotos",
      {
        category: args.category,
        contentDigest: args.contentDigest,
        createdAt: Date.now(),
        fileName: args.fileName,
        fileSize: args.fileSize,
        jobCardId: request.jobCardId,
        mimeType: args.mimeType,
        requestId: request._id,
        responseId: response._id,
        storageId: args.storageId,
        thumbnailStorageId: args.thumbnailStorageId,
      },
      { authUserId: request.createdBy }
    );
    await patchWithE2eOwnership(
      ctx,
      "travelerFeedbackResponses",
      response._id,
      { photoCount: response.photoCount + 1 },
      { authUserId: request.createdBy }
    );
    return { photoCount: response.photoCount + 1, success: true };
  },
  returns: v.object({ photoCount: v.number(), success: v.boolean() }),
});

export const listResponses = query({
  args: { jobCardId: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const jobCardId = args.jobCardId ? ctx.db.normalizeId("jobCards", args.jobCardId) : null;
    if (args.jobCardId !== undefined && !jobCardId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const source = jobCardId
      ? ctx.db
          .query("travelerFeedbackResponses")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
      : ctx.db.query("travelerFeedbackResponses").withIndex("by_createdAt");
    const result = await source
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const page = await Promise.all(
      result.page.map(async (response) => {
        const job = await ctx.db.get("jobCards", response.jobCardId);
        if (!job) {
          return null;
        }
        const photos = await ctx.db
          .query("travelerFeedbackPhotos")
          .withIndex("by_responseId", (q) => q.eq("responseId", response._id))
          .take(TRAVELER_MAX_PHOTOS);
        return {
          comments: response.comments,
          createdAt: response.createdAt,
          id: response._id,
          job: {
            clientName: job.clientName,
            destination: job.destination ?? "",
            jobCardId: job._id,
            jobCode: job.jobCode,
            travelEndDate: job.travelEndDate ?? "",
            travelStartDate: job.travelStartDate ?? "",
          },
          photos: photos.map((photo) => ({
            category: photo.category,
            fileName: photo.fileName,
            fileSize: photo.fileSize,
            id: photo._id,
            mimeType: photo.mimeType,
          })),
          respondentName: response.respondentName,
        };
      })
    );
    return { ...result, page: page.filter((response) => response !== null) };
  },
  returns: paginationResultValidator(travelerFeedbackResponseValidator),
});

export const photoRecord = internalQuery({
  args: { photoId: v.id("travelerFeedbackPhotos") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const photo = await ctx.db.get("travelerFeedbackPhotos", args.photoId);
    const response = photo ? await ctx.db.get("travelerFeedbackResponses", photo.responseId) : null;
    const job = response ? await ctx.db.get("jobCards", response.jobCardId) : null;
    if (!(photo && response && job) || photo.jobCardId !== job._id) {
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
