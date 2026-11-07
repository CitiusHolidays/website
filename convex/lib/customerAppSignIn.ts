/**
 * Guards on the customer app's email sign-in link (ADR 0020).
 *
 * - Device binding: the app keeps a random secret on the phone and sends only its SHA-256 digest
 *   when it asks for a link; verifying the link needs the secret itself, in a header. A link
 *   forwarded to someone else's phone (or opened in a browser) signs nobody in.
 * - Limits, counted on rows of digests whatever IP the requests come from (a Convex HTTP action
 *   has no client IP it can trust):
 *   - per inbox: a few links an hour, after folding aliases that reach one inbox (case, `+tags`,
 *     Gmail dots and googlemail.com, Yahoo `-` disposable addresses);
 *   - per domain, for domains that are not a large shared provider: a bound on what one
 *     organisation's domain receives, which also covers catch-all domains and subdomain
 *     addressing (anything@user.fastmail.com) that no folding can see;
 *   - per phone: best effort only. The device digest is whatever the caller sends, so it stops a
 *     looping app, not an attacker;
 *   - overall: a soft hourly ceiling. Past it, addresses that already have a login are still
 *     served and new ones are not, and the app logs an alarm. It never locks every customer out.
 * Every refusal answers like a sent link, except the phone limit ("try again later"), which says
 * nothing about the address.
 */
export const SIGN_IN_DEVICE_HEADER = "x-citius-sign-in-device";
export const SIGN_IN_LINKS_PER_HOUR = 5;
export const SIGN_IN_LINKS_PER_DEVICE_PER_HOUR = 10;
export const SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR = 30;
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
const YAHOO_DOMAINS = new Set([
  "rocketmail.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "yahoo.com",
  "yahoo.in",
  "ymail.com",
]);
/** Large shared providers: their inboxes are told apart by folding, never by domain. */
const SHARED_PROVIDER_DOMAINS = new Set([
  ...GMAIL_DOMAINS,
  ...YAHOO_DOMAINS,
  "aol.com",
  "fastmail.com",
  "gmx.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "mac.com",
  "mail.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "proton.me",
  "protonmail.com",
  "rediffmail.com",
  "yandex.com",
  "zoho.com",
]);

function splitAddress(email: string) {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return at <= 0 ? null : { domain: address.slice(at + 1), local: address.slice(0, at) };
}

/**
 * The inbox an address reaches, for counting only (the email still goes to the address typed):
 * lower case, without a `+tag`, and for Gmail without dots and with googlemail.com as gmail.com.
 */
export function signInInbox(email: string) {
  const parts = splitAddress(email);
  if (!parts) {
    return email.trim().toLowerCase();
  }
  const { domain } = parts;
  let { local } = parts;
  const plus = local.indexOf("+");
  if (plus > 0) {
    local = local.slice(0, plus);
  }
  if (GMAIL_DOMAINS.has(domain)) {
    return `${local.replaceAll(".", "")}@gmail.com`;
  }
  const dash = local.indexOf("-");
  if (YAHOO_DOMAINS.has(domain) && dash > 0) {
    // Yahoo disposable addresses are base-keyword@: they reach the base's inbox.
    return `${local.slice(0, dash)}@${domain}`;
  }
  return `${local}@${domain}`;
}

/** The domain counted as one organisation's mail, or null for a large shared provider. */
export function signInDomain(email: string) {
  const parts = splitAddress(email);
  if (!parts || SHARED_PROVIDER_DOMAINS.has(parts.domain)) {
    return null;
  }
  return parts.domain;
}

export function signInRecipientDigest(email: string) {
  return sha256Hex(`app-sign-in:${signInInbox(email)}`);
}

export async function signInDomainDigest(email: string) {
  const domain = signInDomain(email);
  return domain === null ? undefined : await sha256Hex(`app-sign-in-domain:${domain}`);
}

/** The device digest the app sent with its request, or null when it is missing or malformed. */
export function deviceDigestFrom(metadata: SignInLinkMetadata | undefined) {
  const value = metadata?.deviceDigest;
  return isRuntimeString(value) && DIGEST_PATTERN.test(value) ? value : null;
}
