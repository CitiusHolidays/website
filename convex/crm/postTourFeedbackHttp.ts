import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, httpAction } from "../_generated/server";
import { POST_TOUR_PHOTO_MAX_BYTES } from "../lib/postTourFeedbackValidators";
import { isRuntimeString } from "../lib/runtimeValues";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

class PhotoTooLargeError extends Error {}

async function boundedPhotoBody(request: Request) {
  const declaredSize = Number(request.headers.get("content-length"));
  if (declaredSize > POST_TOUR_PHOTO_MAX_BYTES) {
    throw new PhotoTooLargeError();
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new ConvexError("Choose a photo to upload.");
  }
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      // biome-ignore lint/performance/noAwaitInLoops: stream reads must remain sequential to enforce the byte limit before accepting another chunk.
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > POST_TOUR_PHOTO_MAX_BYTES) {
        await reader.cancel();
        throw new PhotoTooLargeError();
      }
      chunks.push(new Uint8Array(chunk.value).buffer);
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) {
    throw new ConvexError("Choose a photo to upload.");
  }
  return new Blob(chunks);
}

export async function handlePhotoUpload(ctx: ActionCtx, request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  let rawStorageId: Id<"_storage"> | undefined;
  try {
    const url = new URL(request.url);
    const feedbackId = url.searchParams.get("feedbackId") ?? "";
    // Authorize before accepting bytes, then recheck within the save mutation
    // in case the assignment or Job Card changes during upload.
    const target = await ctx.runQuery(internal.crm.postTourFeedback.verifyPhotoUpload, {
      feedbackId,
    });
    const mimeType = request.headers.get("content-type")?.trim().toLowerCase() ?? "";
    if (!IMAGE_MIME_TYPES.has(mimeType)) {
      throw new ConvexError("Use a JPEG, PNG, or WebP photo.");
    }
    const blob = await boundedPhotoBody(request);
    const storageId = await ctx.storage.store(blob);
    rawStorageId = storageId;
    const result = await ctx.runAction(internal.crm.postTourFeedbackActions.validateAndSavePhoto, {
      feedbackId: target.feedbackId,
      fileName: url.searchParams.get("fileName") ?? "tour-photo",
      mimeType,
      storageId,
    });
    return Response.json(result, { headers, status: 201 });
  } catch (error) {
    if (error instanceof PhotoTooLargeError) {
      return Response.json(
        { error: "Each photo must be 4 MB or smaller." },
        { headers, status: 413 }
      );
    }
    const message =
      error instanceof ConvexError && isRuntimeString(error.data)
        ? error.data
        : "Photo upload failed. Please try again.";
    let status = 400;
    if (message.includes("FORBIDDEN")) {
      status = 403;
    } else if (message.includes("not found")) {
      status = 404;
    }
    return Response.json({ error: message }, { headers, status });
  } finally {
    if (rawStorageId) {
      await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: rawStorageId,
      });
    }
  }
}

export const uploadPhoto = httpAction(handlePhotoUpload);
