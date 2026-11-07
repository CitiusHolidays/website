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
 *   - per domain, for addresses with no login and no pending invite only: a bound on links to
 *     unknown addresses at one organisation's domain, which covers catch-all domains and
 *     subdomain addressing (anything@user.fastmail.com) that no folding can see. A traveller
 *     Operations invited, or anyone who already has a login, never meets it, so a corporate
 *     group can all sign in at once after a bulk invite and junk requests cannot lock them out;
 *   - per phone: best effort only. The device digest is whatever the caller sends, so it stops a
 *     looping app, not an attacker;
 *   - overall: a soft hourly ceiling. Past it, addresses with a login or a pending invite are
 *     still served, other new addresses are not, and the app logs an alarm. It never locks out a
 *     customer or an invited traveller.
 * An invite vouches only for the invited traveller's email on file or, when that is missing or
 * different, for at most `SIGN_IN_ADDRESSES_PER_INVITE` addresses a day, and for at most
 * `SIGN_IN_TRUSTED_SENDS_PER_INVITE_PER_HOUR` sends an hour: a leaked invite link cannot waive the
 * limits for anyone else. The request answers at once and the checks and the send run in the
 * background, so neither the answer nor its timing tells what happened.
 * Every refusal answers like a sent link, except the phone limit ("try again later"), which says
 * nothing about the address.
 */
export const SIGN_IN_DEVICE_HEADER = "x-citius-sign-in-device";
export const SIGN_IN_LINKS_PER_HOUR = 5;
export const SIGN_IN_LINKS_PER_DEVICE_PER_HOUR = 10;
export const SIGN_IN_LINKS_PER_DOMAIN_PER_HOUR = 30;
/** Trusted sends one pending invite may make in an hour. */
export const SIGN_IN_TRUSTED_SENDS_PER_INVITE_PER_HOUR = 3;
/** Addresses one pending invite may vouch for in a day, besides the traveller's own on file. */
export const SIGN_IN_ADDRESSES_PER_INVITE = 2;
/** Every sign-in link the app may send in an hour, across all addresses and phones. */
export const SIGN_IN_LINKS_OVERALL_PER_HOUR = 300;
export const SIGN_IN_LINK_WINDOW_MS = 60 * 60 * 1000;
/** Rows are kept a day, long enough to count the window and outlive the 10-minute link. */
export const SIGN_IN_LINK_ROW_TTL_MS = 24 * 60 * 60 * 1000;

import { isRuntimeString } from "./runtimeValues";

/** What the app sends with a sign-in link request (Better Auth's `metadata`). */
export interface SignInLinkMetadata {
  deviceDigest?: unknown;
  /** The SHA-256 of the trip invite the app holds, when it was opened from an invite link. */
  inviteTokenHash?: unknown;
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
  "163.com",
  "fastmail.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "hotmail.co.uk",
  "hotmail.com",
  "hotmail.fr",
  "icloud.com",
  "live.co.uk",
  "live.com",
  "live.in",
  "mac.com",
  "mail.com",
  "mail.ru",
  "me.com",
  "msn.com",
  "naver.com",
  "outlook.co.uk",
  "outlook.com",
  "outlook.in",
  "proton.me",
  "protonmail.com",
  "qq.com",
  "rediffmail.com",
  "web.de",
  "yahoo.co.jp",
  "yandex.com",
  "yandex.ru",
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

/** The invite hash the app sent with its request, or undefined when it is missing or malformed. */
export function inviteTokenHashFrom(metadata: SignInLinkMetadata | undefined) {
  const value = metadata?.inviteTokenHash;
  return isRuntimeString(value) && DIGEST_PATTERN.test(value) ? value : undefined;
}

/** The device digest the app sent with its request, or null when it is missing or malformed. */
export function deviceDigestFrom(metadata: SignInLinkMetadata | undefined) {
  const value = metadata?.deviceDigest;
  return isRuntimeString(value) && DIGEST_PATTERN.test(value) ? value : null;
}
