import { ConvexError } from "convex/values";
import { TRAVELER_FEEDBACK_TOKEN_PATTERN } from "../lib/travelerFeedbackValidators";

export function validFeedbackToken(value: string) {
  return TRAVELER_FEEDBACK_TOKEN_PATTERN.test(value);
}

export async function feedbackTokenHash(token: string) {
  if (!validFeedbackToken(token)) {
    throw new ConvexError("Feedback link is unavailable.");
  }
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function feedbackPayloadHash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
