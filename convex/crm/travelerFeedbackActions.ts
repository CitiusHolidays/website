"use node";

import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import sharp from "sharp";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import { postTourCategoryValidator } from "../lib/postTourFeedbackValidators";
import {
  TRAVELER_PHOTO_MAX_BYTES,
  TRAVELER_THUMBNAIL_MAX_BYTES,
} from "../lib/travelerFeedbackValidators";
import { downloadFileResultValidator } from "./fileReturnContracts";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";

const FILE_EXTENSION_PATTERN = /\.[^.]*$/;
const UNSAFE_FILE_NAME_PATTERN = /[^\w .()-]/g;
const PHOTO_FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export const createRequest = action({
  args: {
    expiresInDays: v.optional(v.number()),
    jobCardId: v.id("jobCards"),
    publicTripLabel: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ expiresAt: number; id: Id<"travelerFeedbackRequests">; token: string }> => {
    const token = randomBytes(32).toString("base64url");
    const result = await ctx.runMutation(internal.crm.travelerFeedback.issueRequest, {
      expiresInDays: args.expiresInDays ?? 14,
      jobCardId: args.jobCardId,
      publicTripLabel: args.publicTripLabel,
      tokenHash: createHash("sha256").update(token).digest("hex"),
    });
    // The raw capability is returned once, never stored or written to activity.
    return { ...result, token };
  },
  returns: v.object({
    expiresAt: v.number(),
    id: v.id("travelerFeedbackRequests"),
    token: v.string(),
  }),
});

export const normalizeAndSavePhoto = internalAction({
  args: {
    category: postTourCategoryValidator,
    fileName: v.string(),
    mimeType: v.string(),
    responseTokenHash: v.string(),
    storageId: v.id("_storage"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args): Promise<{ photoCount: number; success: boolean }> => {
    let storageId: Id<"_storage"> | undefined;
    let thumbnailStorageId: Id<"_storage"> | undefined;
    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob || blob.size < 1 || blob.size > TRAVELER_PHOTO_MAX_BYTES) {
        throw new ConvexError("Choose a photo no larger than 4 MB.");
      }
      const rawBytes = Buffer.from(await blob.arrayBuffer());
      const contentDigest = createHash("sha256").update(rawBytes).digest("hex");
      const decoder = sharp(rawBytes, {
        failOn: "warning",
        limitInputPixels: 40_000_000,
      });
      const metadata = await decoder.metadata();
      const { format } = metadata;
      if (
        (format !== "jpeg" && format !== "png" && format !== "webp") ||
        (metadata.pages ?? 1) > 1 ||
        PHOTO_FORMATS[format] !== args.mimeType
      ) {
        throw new ConvexError("Choose a still JPEG, PNG or WebP photo.");
      }
      const normalized = await decoder.rotate().toBuffer();
      if (normalized.byteLength > TRAVELER_PHOTO_MAX_BYTES) {
        throw new ConvexError("This photo is too large after processing.");
      }
      const thumbnail = await sharp(normalized)
        .resize({ fit: "inside", height: 640, width: 640, withoutEnlargement: true })
        .jpeg({ mozjpeg: true, quality: 72 })
        .toBuffer();
      if (thumbnail.byteLength > TRAVELER_THUMBNAIL_MAX_BYTES) {
        throw new ConvexError("Choose a smaller photo.");
      }
      storageId = await ctx.storage.store(
        new Blob([new Uint8Array(normalized)], { type: args.mimeType })
      );
      thumbnailStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(thumbnail)], { type: "image/jpeg" })
      );
      const stem =
        args.fileName
          .replace(FILE_EXTENSION_PATTERN, "")
          .replace(UNSAFE_FILE_NAME_PATTERN, "_")
          .trim()
          .slice(0, 100) || "tour-photo";
      // Finalization rechecks expiry, revocation, JC existence and response scope
      // inside the same transaction that increments the bounded photo count.
      const result = await ctx.runMutation(internal.crm.travelerFeedback.savePhoto, {
        category: args.category,
        contentDigest,
        fileName: `${stem}.${format === "jpeg" ? "jpg" : format}`,
        fileSize: normalized.byteLength,
        mimeType: args.mimeType,
        responseTokenHash: args.responseTokenHash,
        storageId,
        thumbnailStorageId,
        tokenHash: args.tokenHash,
      });
      return result;
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      // biome-ignore lint/style/useErrorCause: Decoder internals are not public response data.
      throw new ConvexError(
        "Photo could not be processed. Choose a valid JPEG, PNG or WebP image."
      );
    } finally {
      // The reference check also preserves committed files if dispatch returns
      // an uncertain error after a successful attachment transaction.
      await Promise.all(
        [args.storageId, storageId, thumbnailStorageId].flatMap((candidate) =>
          candidate
            ? [
                ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
                  storageId: candidate,
                }),
              ]
            : []
        )
      );
    }
  },
  returns: v.object({ photoCount: v.number(), success: v.boolean() }),
});

export const getPhotoFile = action({
  args: { photoId: v.id("travelerFeedbackPhotos") },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const record = await ctx.runQuery(internal.crm.travelerFeedback.photoRecord, args);
    await enforcePortalFileDownloadLimit(ctx, record);
    const blob = await ctx.storage.get(record.storageId);
    if (!blob) {
      throw new ConvexError("Photo not found");
    }
    return {
      bytes: await blob.arrayBuffer(),
      fileName: record.fileName,
      mimeType: record.mimeType,
    };
  },
  returns: downloadFileResultValidator,
});

export const getPhotoThumbnail = action({
  args: { photoId: v.id("travelerFeedbackPhotos") },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const record = await ctx.runQuery(internal.crm.travelerFeedback.photoRecord, args);
    const limit = await ctx.runMutation(
      internal.crm.rateLimitMaintenance.consumePostTourMediaRead,
      {
        authUserId: record.authUserId,
      }
    );
    if (!limit.allowed) {
      throw new ConvexError({
        code: "PORTAL_FILE_RATE_LIMITED",
        retryAfterSeconds: limit.retryAfterSeconds ?? 1,
      });
    }
    const blob = await ctx.storage.get(record.thumbnailStorageId);
    if (!blob || blob.size > TRAVELER_THUMBNAIL_MAX_BYTES) {
      throw new ConvexError("Photo preview not found");
    }
    return {
      bytes: await blob.arrayBuffer(),
      fileName: `${record.fileName}.preview.jpg`,
      mimeType: "image/jpeg",
    };
  },
  returns: downloadFileResultValidator,
});
