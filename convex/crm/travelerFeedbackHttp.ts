import type { Infer } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, httpAction } from "../_generated/server";
import { hasOwnKey, isRuntimeObject, isRuntimeString } from "../lib/runtimeValues";
import {
  TRAVELER_FEEDBACK_CATEGORIES,
  TRAVELER_JSON_MAX_BYTES,
  TRAVELER_PHOTO_MAX_BYTES,
  type travelerCommentsValidator,
} from "../lib/travelerFeedbackValidators";
import { feedbackPayloadHash, feedbackTokenHash } from "./travelerFeedbackSecurity";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]{43})$/;

class FeedbackBodyTooLarge extends Error {}

interface UnparsedTravelerComments {
  food?: unknown;
  hotel?: unknown;
  improvements?: unknown;
  itinerary?: unknown;
  overall?: unknown;
  whatWentWell?: unknown;
}

interface UnparsedTravelerSubmission {
  comments?: UnparsedTravelerComments;
  respondentEmail?: unknown;
  respondentName?: unknown;
  responseToken?: unknown;
}

async function boundedBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new FeedbackBodyTooLarge();
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new ConvexError("Add your feedback before submitting.");
  }
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      // biome-ignore lint/performance/noAwaitInLoops: Read sequentially to reject oversized bodies before buffering another chunk.
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new FeedbackBodyTooLarge();
      }
      chunks.push(new Uint8Array(chunk.value).buffer);
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks);
}

async function requestHash(request: Request) {
  // Tokens are accepted only as headers. They never enter a URL, a function
  // argument, an audit message, or a stored field before being hashed.
  const match = BEARER_PATTERN.exec(request.headers.get("authorization") ?? "");
  return await feedbackTokenHash(match?.[1] ?? "");
}

function publicError(cause: unknown) {
  if (cause instanceof FeedbackBodyTooLarge) {
    return Response.json(
      { error: "The upload is too large. Photos must be 4 MB or smaller." },
      { headers: PRIVATE_HEADERS, status: 413 }
    );
  }
  if (cause instanceof ConvexError) {
    const { data } = cause;
    if (isRuntimeObject(data) && hasOwnKey(data, "code")) {
      const limited = data.code === "FEEDBACK_RATE_LIMITED";
      return Response.json(
        {
          error: limited
            ? "Please wait a minute before trying again."
            : "This feedback link is unavailable or has expired.",
        },
        { headers: PRIVATE_HEADERS, status: limited ? 429 : 410 }
      );
    }
    if (isRuntimeString(data)) {
      return Response.json({ error: data }, { headers: PRIVATE_HEADERS, status: 400 });
    }
  }
  return Response.json(
    { error: "Feedback could not be saved. Please try again." },
    { headers: PRIVATE_HEADERS, status: 400 }
  );
}

function submissionBody(value: UnparsedTravelerSubmission) {
  if (!(isRuntimeObject(value) && isRuntimeObject(value.comments))) {
    throw new ConvexError("Add your feedback before submitting.");
  }
  const comments: Infer<typeof travelerCommentsValidator> = {
    food: "",
    hotel: "",
    improvements: "",
    itinerary: "",
    overall: "",
    whatWentWell: "",
  };
  for (const category of TRAVELER_FEEDBACK_CATEGORIES) {
    const comment = value.comments[category.value];
    if (!isRuntimeString(comment)) {
      throw new ConvexError("Use the feedback form to submit your comments.");
    }
    comments[category.value] = comment;
  }
  if (
    !isRuntimeString(value.responseToken) ||
    (value.respondentName !== undefined && !isRuntimeString(value.respondentName)) ||
    (value.respondentEmail !== undefined && !isRuntimeString(value.respondentEmail))
  ) {
    throw new ConvexError("Use the feedback form to submit your comments.");
  }
  return {
    comments,
    respondentEmail: isRuntimeString(value.respondentEmail) ? value.respondentEmail : "",
    respondentName: isRuntimeString(value.respondentName) ? value.respondentName : "",
    responseToken: value.responseToken,
  };
}

export const travelerFeedbackForm = httpAction(async (ctx, request) => {
  try {
    const result = await ctx.runMutation(internal.crm.travelerFeedback.openForm, {
      tokenHash: await requestHash(request),
    });
    return Response.json(result, { headers: PRIVATE_HEADERS });
  } catch (error) {
    return publicError(error);
  }
});

export const travelerFeedbackSubmit = httpAction(async (ctx, request) => {
  try {
    const tokenHash = await requestHash(request);
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      throw new ConvexError("Use the feedback form to submit your comments.");
    }
    const body = await boundedBody(request, TRAVELER_JSON_MAX_BYTES);
    // SAFETY: Every optional boundary field is narrowed by submissionBody before use.
    const value = JSON.parse(await body.text()) as UnparsedTravelerSubmission;
    const { responseToken, ...content } = submissionBody(value);
    const result = await ctx.runMutation(internal.crm.travelerFeedback.submitResponse, {
      ...content,
      payloadHash: await feedbackPayloadHash(JSON.stringify(content)),
      responseTokenHash: await feedbackTokenHash(responseToken),
      tokenHash,
    });
    return Response.json(result, { headers: PRIVATE_HEADERS, status: 201 });
  } catch (error) {
    return publicError(error);
  }
});

export async function handleTravelerPhoto(ctx: ActionCtx, request: Request) {
  let rawStorageId: Id<"_storage"> | undefined;
  try {
    const tokenHash = await requestHash(request);
    const responseTokenHash = await feedbackTokenHash(
      request.headers.get("x-feedback-response") ?? ""
    );
    await ctx.runMutation(internal.crm.travelerFeedback.authorizePhoto, {
      responseTokenHash,
      tokenHash,
    });
    const mimeType = request.headers.get("content-type")?.trim().toLowerCase() ?? "";
    const category = TRAVELER_FEEDBACK_CATEGORIES.find(
      (candidate) => candidate.value === (request.headers.get("x-feedback-category") ?? "overall")
    )?.value;
    if (!(IMAGE_TYPES.has(mimeType) && category)) {
      throw new ConvexError("Choose a JPEG, PNG or WebP photo and a feedback category.");
    }
    const body = await boundedBody(request, TRAVELER_PHOTO_MAX_BYTES);
    const storageId = await ctx.storage.store(body);
    rawStorageId = storageId;
    const result = await ctx.runAction(internal.crm.travelerFeedbackActions.normalizeAndSavePhoto, {
      category,
      fileName: decodeURIComponent(request.headers.get("x-file-name") ?? "tour-photo"),
      mimeType,
      responseTokenHash,
      storageId,
      tokenHash,
    });
    return Response.json(result, { headers: PRIVATE_HEADERS, status: 201 });
  } catch (error) {
    return publicError(error);
  } finally {
    if (rawStorageId) {
      await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: rawStorageId,
      });
    }
  }
}

export const travelerFeedbackPhoto = httpAction(handleTravelerPhoto);
