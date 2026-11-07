/**
 * Trip invite tokens for the customer app (ADR 0020).
 *
 * The token is the secret Citius sends to a traveller's staff-verified contact. The server only
 * ever stores its SHA-256 hash: staff screens create the token in the browser and send the hash
 * (the post-tour feedback pattern), and the app sends the token back once, when it claims it.
 */

/** 32 random bytes as unpadded base64url. */
export const TRIP_INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const TRIP_INVITE_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** An unclaimed invite stops working after this long. */
export const TRIP_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Most invites one call may create, so a 100+ traveller group goes in a few calls. */
export const TRIP_INVITE_BATCH_LIMIT = 50;

/** The guardian consent wording the app shows, by version. Bump it when the words change. */
export const PARENTAL_CONSENT_TEXT_VERSIONS = ["2026-11-07"] as const;

export const TRIP_INVITE_ERRORS = {
  alreadyOnTrip: "TRIP_INVITE_ALREADY_ON_TRIP",
  consentNotGuardian: "PARENTAL_CONSENT_NOT_GUARDIAN",
  consentVersion: "PARENTAL_CONSENT_TEXT_VERSION",
  invalid: "TRIP_INVITE_INVALID",
  minor: "TRIP_INVITE_MINOR",
  unauthorized: "UNAUTHORIZED",
} as const;

export async function hashTripInviteToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const WHITESPACE = /\s+/;

/** "Asha" from "Asha Rao": the most an invite preview says about who it is for. */
export function firstName(fullName: string) {
  return fullName.trim().split(WHITESPACE)[0] ?? "";
}
