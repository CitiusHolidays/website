/**
 * Guards on the customer app's email sign-in link (ADR 0020).
 *
 * - Device binding: the app keeps a random secret on the phone and sends only its SHA-256 digest
 *   when it asks for a link; verifying the link needs the secret itself, in a header. A link
 *   forwarded to someone else's phone (or opened in a browser) signs nobody in.
 * - Limits, counted on rows of digests whatever IP the requests come from:
 *   - per inbox: a few links an hour per address, after folding aliases that reach one inbox
 *     (case, `+tags`, Gmail dots and googlemail.com), so the form cannot flood an inbox;
 *   - per phone: a few more an hour per device digest;
 *   - overall: a bounded hourly ceiling that fails closed ("try again later") when reached.
 */
export const SIGN_IN_DEVICE_HEADER = "x-citius-sign-in-device";
export const SIGN_IN_LINKS_PER_HOUR = 5;
export const SIGN_IN_LINKS_PER_DEVICE_PER_HOUR = 10;
/** Every sign-in link the app may send in an hour, across all addresses and phones. */
export const SIGN_IN_LINKS_OVERALL_PER_HOUR = 300;
export const SIGN_IN_LINK_WINDOW_MS = 60 * 60 * 1000;
/** Rows are kept a day, long enough to count the window and outlive the 10-minute link. */
export const SIGN_IN_LINK_ROW_TTL_MS = 24 * 60 * 60 * 1000;

import { isRuntimeString } from "./runtimeValues";

/** What the app sends with a sign-in link request (Better Auth's `metadata`). */
export interface SignInLinkMetadata {
  deviceDigest?: unknown;
}

const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
/** The app's device secret: 43 base64url characters (32 random bytes). */
export const SIGN_IN_DEVICE_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export async function sha256Hex(value: string) {
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * The inbox an address reaches, for counting only (the email still goes to the address typed):
 * lower case, without a `+tag`, and for Gmail without dots and with googlemail.com as gmail.com.
 */
export function signInInbox(email: string) {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at <= 0) {
    return address;
  }
  const domain = address.slice(at + 1);
  let local = address.slice(0, at);
  const plus = local.indexOf("+");
  if (plus > 0) {
    local = local.slice(0, plus);
  }
  if (GMAIL_DOMAINS.has(domain)) {
    return `${local.replaceAll(".", "")}@gmail.com`;
  }
  return `${local}@${domain}`;
}

export function signInRecipientDigest(email: string) {
  return sha256Hex(`app-sign-in:${signInInbox(email)}`);
}

/** The device digest the app sent with its request, or null when it is missing or malformed. */
export function deviceDigestFrom(metadata: SignInLinkMetadata | undefined) {
  const value = metadata?.deviceDigest;
  return isRuntimeString(value) && DIGEST_PATTERN.test(value) ? value : null;
}
