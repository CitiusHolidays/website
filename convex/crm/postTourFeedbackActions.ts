"use node";

import { ConvexError, v } from "convex/values";
import sharp from "sharp";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import {
  POST_TOUR_PHOTO_MAX_BYTES,
  POST_TOUR_THUMBNAIL_MAX_BYTES,
} from "../lib/postTourFeedbackValidators";
import { downloadFileResultValidator } from "./fileReturnContracts";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";

const PHOTO_FORMATS = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;
const FILE_EXTENSION_PATTERN = /\.[^.]*$/;
const UNSAFE_FILE_NAME_PATTERN = /[^\w .()-]/g;

export const validateAndSavePhoto = internalAction({
  args: {
    feedbackId: v.id("postTourFeedback"),
    fileName: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<{ id: Id<"postTourFeedbackPhotos"> }> => {
    let normalizedStorageId: Id<"_storage"> | undefined;
    let thumbnailStorageId: Id<"_storage"> | undefined;
    try {
      const uploadAccess = await ctx.runQuery(internal.crm.postTourFeedback.verifyPhotoUpload, {
        feedbackId: args.feedbackId,
      });
      const blob = await ctx.storage.get(args.storageId);
      if (!blob || blob.size < 1 || blob.size > POST_TOUR_PHOTO_MAX_BYTES) {
        throw new ConvexError("Each photo must be between 1 byte and 4 MB.");
      }
      const bytes = Buffer.from(await blob.arrayBuffer());
      const decoder = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 });
      const metadata = await decoder.metadata();
      const { format } = metadata;
      if (
        (format !== "jpeg" && format !== "png" && format !== "webp") ||
        (metadata.pages ?? 1) > 1
      ) {
        throw new ConvexError("Use a still JPEG, PNG, or WebP photo.");
      }
      const actualMimeType = PHOTO_FORMATS[format];
      if (args.mimeType !== actualMimeType) {
        throw new ConvexError("Photo content does not match its declared type.");
      }
      // Full decode/re-encode rejects corrupt image payloads, applies camera
      // orientation, and omits EXIF/GPS metadata before durable attachment.
      const normalized = await decoder.rotate().toBuffer();
      if (normalized.byteLength > POST_TOUR_PHOTO_MAX_BYTES) {
        throw new ConvexError("This photo is too large after processing. Choose a smaller image.");
      }
      normalizedStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(normalized)], { type: actualMimeType })
      );
      const thumbnail = await sharp(normalized, { limitInputPixels: 40_000_000 })
        .resize({ fit: "inside", height: 640, width: 640, withoutEnlargement: true })
        .jpeg({ mozjpeg: true, quality: 72 })
        .toBuffer();
      if (thumbnail.byteLength > POST_TOUR_THUMBNAIL_MAX_BYTES) {
        throw new ConvexError("Photo preview is too large. Choose a smaller image.");
      }
      thumbnailStorageId = await ctx.storage.store(
        new Blob([new Uint8Array(thumbnail)], { type: "image/jpeg" })
      );
      const stem =
        args.fileName
          .replace(FILE_EXTENSION_PATTERN, "")
          .replace(UNSAFE_FILE_NAME_PATTERN, "_")
          .trim()
          .slice(0, 120) || "tour-photo";
      const result: { id: Id<"postTourFeedbackPhotos"> } = await ctx.runMutation(
        internal.crm.postTourFeedback.savePhoto,
        {
          actorAuthUserId: uploadAccess.authUserId,
          feedbackId: args.feedbackId,
          fileName: `${stem}.${format === "jpeg" ? "jpg" : format}`,
          fileSize: normalized.byteLength,
          mimeType: actualMimeType,
          storageId: normalizedStorageId,
          thumbnailStorageId,
        }
      );
      normalizedStorageId = undefined;
      thumbnailStorageId = undefined;
      return result;
    } catch (error) {
      if (normalizedStorageId) {
        await ctx.storage.delete(normalizedStorageId);
      }
      if (thumbnailStorageId) {
        await ctx.storage.delete(thumbnailStorageId);
      }
      if (error instanceof ConvexError) {
        throw error;
      }
      // biome-ignore lint/style/useErrorCause: ConvexError accepts only serializable user-facing data; native decoder errors stay private.
      throw new ConvexError("Photo could not be decoded. Choose a valid JPEG, PNG, or WebP image.");
    } finally {
      await ctx.storage.delete(args.storageId);
    }
  },
  returns: v.object({ id: v.id("postTourFeedbackPhotos") }),
});

export const getPhotoFile = action({
  args: { photoId: v.id("postTourFeedbackPhotos") },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const record = await ctx.runQuery(internal.crm.postTourFeedback.photoRecord, args);
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
  args: { photoId: v.id("postTourFeedbackPhotos") },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const record = await ctx.runQuery(internal.crm.postTourFeedback.photoRecord, args);
    const rateLimit = await ctx.runMutation(
      internal.crm.rateLimitMaintenance.consumePostTourMediaRead,
      {
        authUserId: record.authUserId,
      }
    );
    if (!rateLimit.allowed) {
      throw new ConvexError({
        code: "PORTAL_FILE_RATE_LIMITED",
        retryAfterSeconds: rateLimit.retryAfterSeconds ?? 1,
      });
    }
    const blob = await ctx.storage.get(record.thumbnailStorageId);
    if (!blob || blob.size > POST_TOUR_THUMBNAIL_MAX_BYTES) {
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
