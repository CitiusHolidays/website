import { v } from "convex/values";

export const POST_TOUR_FEEDBACK_CATEGORIES = [
  { label: "Overall experience", value: "overall" },
  { label: "What went well", value: "whatWentWell" },
  { label: "What could improve", value: "improvements" },
  { label: "Itinerary", value: "itinerary" },
  { label: "Hotel stay", value: "hotel" },
  { label: "Food and restaurants", value: "food" },
] as const;

export const postTourCategoryValidator = v.union(
  ...POST_TOUR_FEEDBACK_CATEGORIES.map(({ value }) => v.literal(value))
);
export const postTourRatingValidator = v.union(v.number(), v.null());
export const POST_TOUR_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const POST_TOUR_MAX_PHOTOS = 8;
export const POST_TOUR_THUMBNAIL_MAX_BYTES = 256 * 1024;

export const postTourJobValidator = v.object({
  clientName: v.string(),
  destination: v.string(),
  jobCardId: v.id("jobCards"),
  jobCode: v.string(),
  travelEndDate: v.string(),
  travelStartDate: v.string(),
});
export const postTourPhotoValidator = v.object({
  fileName: v.string(),
  fileSize: v.number(),
  id: v.id("postTourFeedbackPhotos"),
  mimeType: v.string(),
});
export const postTourFeedbackValidator = v.object({
  authorName: v.string(),
  canDelete: v.boolean(),
  canEdit: v.boolean(),
  category: postTourCategoryValidator,
  comment: v.string(),
  createdAt: v.number(),
  id: v.id("postTourFeedback"),
  job: postTourJobValidator,
  photos: v.array(postTourPhotoValidator),
  updatedAt: v.number(),
  vendorName: v.string(),
  vendorRating: postTourRatingValidator,
});
