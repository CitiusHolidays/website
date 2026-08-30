import { createHash } from "node:crypto";
import { isRuntimeString } from "@/lib/runtimeValues";

const JOURNEY_KEY_PREFIX = "j_";

/**
 * Produce a stable, non-secret selector for an Account journey URL. The
 * selector is deliberately not an authorization credential; every detail
 * request still resolves it against the caller's current server-owned access.
 */
export function createAccountJourneyUrlKey(bookingId) {
  if (!isRuntimeString(bookingId) || bookingId.length === 0) {
    throw new TypeError("A booking id is required to derive a journey URL key");
  }
  const digest = createHash("sha256")
    .update(`citius-account-journey-v1\0${bookingId}`)
    .digest("base64url")
    .slice(0, 22);
  return `${JOURNEY_KEY_PREFIX}${digest}`;
}

export function addAccountJourneyUrlKeys(journeys) {
  if (!(journeys && Array.isArray(journeys.summaries))) {
    return { referenceNow: 0, summaries: [] };
  }
  return {
    ...journeys,
    summaries: journeys.summaries.map((summary) => ({
      ...summary,
      journeyKey: createAccountJourneyUrlKey(summary.booking.id),
    })),
  };
}
