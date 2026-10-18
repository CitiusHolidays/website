import { TRAVELER_FEEDBACK_TOKEN_PATTERN } from "@convex/lib/travelerFeedbackValidators";
import { z } from "zod";
export const feedbackFormSchema = z.object({
  expiresAt: z.number(),
  maxPhotoBytes: z.number(),
  maxPhotos: z.number(),
  publicTripLabel: z.string(),
});
export type PublicFeedbackForm = z.infer<typeof feedbackFormSchema>;
const errorSchema = z.object({ error: z.string() });
const responseSchema = z.union([
  feedbackFormSchema,
  z.object({ photoCount: z.number().int().min(0).max(8).optional(), success: z.literal(true) }),
  errorSchema,
]);
export async function feedbackRequest(
  token: string,
  operation: "form" | "submit" | "photo",
  body: BodyInit,
  extraHeaders: Record<string, string> = {}
) {
  const response = await fetch(`/api/tour-feedback/${operation}`, {
    body,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    method: "POST",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) {
    const error = errorSchema.safeParse(await response.json());
    throw new Error(error.success ? error.data.error : "Feedback could not be saved. Try again.");
  }
  return responseSchema.parse(await response.json());
}
export function newResponseToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/[=]/g, "");
}

export const photoReceiptSchema = z.object({
  photoCount: z.number().int().min(0).max(8),
  success: z.literal(true),
});

export async function loadFeedbackForm(token: string) {
  if (!TRAVELER_FEEDBACK_TOKEN_PATTERN.test(token)) {
    throw new Error("Open the full feedback link sent by your tour team.");
  }
  return feedbackFormSchema.parse(await feedbackRequest(token, "form", "{}"));
}
