import { v } from "convex/values";
import { postTourCategoryValidator, postTourJobValidator } from "./postTourFeedbackValidators";

export const TRAVELER_FEEDBACK_CATEGORIES = [
  { label: "Overall experience", value: "overall" },
  { label: "What went well", value: "whatWentWell" },
  { label: "What could improve", value: "improvements" },
  { label: "Itinerary", value: "itinerary" },
  { label: "Hotel stay", value: "hotel" },
  { label: "Food and restaurants", value: "food" },
] as const;

export const TRAVELER_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const TRAVELER_JSON_MAX_BYTES = 64 * 1024;
export const TRAVELER_THUMBNAIL_MAX_BYTES = 256 * 1024;
export const TRAVELER_MAX_PHOTOS = 8;
export const TRAVELER_MAX_RESPONSES = 300;
export const TRAVELER_FEEDBACK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const TRAVELER_FEEDBACK_HASH_PATTERN = /^[a-f0-9]{64}$/;

export const travelerCommentsValidator = v.object({
  food: v.string(),
  hotel: v.string(),
  improvements: v.string(),
  itinerary: v.string(),
  overall: v.string(),
  whatWentWell: v.string(),
});

export const travelerFeedbackPhotoValidator = v.object({
  category: postTourCategoryValidator,
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("travelerFeedbackPhotos"),
  mimeType: v.string(),
});

export const travelerFeedbackResponseValidator = v.object({
  comments: travelerCommentsValidator,
  createdAt: v.number(),
  id: v.id("travelerFeedbackResponses"),
  job: postTourJobValidator,
  photos: v.array(travelerFeedbackPhotoValidator),
  respondentName: v.string(),
});

export const travelerFeedbackRequestValidator = v.object({
  createdAt: v.number(),
  expiresAt: v.number(),
  id: v.id("travelerFeedbackRequests"),
  publicTripLabel: v.string(),
  responseCount: v.number(),
  revokedAt: v.union(v.number(), v.null()),
});

export const travelerFeedbackFormValidator = v.object({
  categories: v.array(v.object({ label: v.string(), value: postTourCategoryValidator })),
  expiresAt: v.number(),
  maxPhotoBytes: v.number(),
  maxPhotos: v.number(),
  publicTripLabel: v.string(),
});
