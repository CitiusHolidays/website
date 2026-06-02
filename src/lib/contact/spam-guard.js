/** Minimum seconds between form load and submit (bots submit instantly). */
export const MIN_FORM_SECONDS = 3;

/** Reject stale timing tokens (replay / scraped payloads). */
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

const SPAM_KEYWORDS = [
  "seo services",
  "search engine optimization",
  "guest post",
  "backlink",
  "cryptocurrency",
  "bitcoin",
  "forex",
  "casino",
  "viagra",
  "cialis",
  "weight loss pill",
  "web design agency",
  "digital marketing agency",
  "increase your traffic",
  "rank on google",
  "link building",
];

const URL_PATTERN = /https?:\/\/|www\./gi;
const SPAM_KEYWORD_PATTERN = new RegExp(
  SPAM_KEYWORDS.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);

/**
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * @param {Request} request
 * @returns {boolean}
 */
export function isAllowedSiteOrigin(request) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const siteUrl =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;

  if (!siteUrl) {
    return true;
  }

  let allowedOrigin;
  try {
    allowedOrigin = new URL(siteUrl).origin;
  } catch {
    return true;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  if (origin?.startsWith(allowedOrigin)) {
    return true;
  }
  if (referer?.startsWith(allowedOrigin)) {
    return true;
  }

  return false;
}

/**
 * @param {number | string | undefined} formLoadedAt
 * @returns {{ ok: true } | { ok: false; reason: string }}
 */
export function validateFormTiming(formLoadedAt) {
  const loadedAt = Number(formLoadedAt);
  if (!Number.isFinite(loadedAt) || loadedAt <= 0) {
    return { ok: false, reason: "invalid_timing" };
  }

  const ageMs = Date.now() - loadedAt;
  if (ageMs < MIN_FORM_SECONDS * 1000) {
    return { ok: false, reason: "too_fast" };
  }
  if (ageMs > MAX_FORM_AGE_MS) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

/**
 * @param {string | undefined} honeypot
 * @returns {boolean} true if submission looks like a bot
 */
export function isHoneypotTripped(honeypot) {
  return Boolean(honeypot && String(honeypot).trim().length > 0);
}

/**
 * Heuristic spam scoring for messages that bypass CAPTCHA farms.
 *
 * @param {{ name: string; email: string; subject: string; message: string }} fields
 * @returns {{ spam: boolean; reason?: string }}
 */
export function detectSpamContent({ name, email, subject, message }) {
  const combined = `${name} ${email} ${subject} ${message}`.toLowerCase();

  if (SPAM_KEYWORD_PATTERN.test(combined)) {
    return { spam: true, reason: "keyword" };
  }

  const urlMatches = message.match(URL_PATTERN) || [];
  if (urlMatches.length >= 2) {
    return { spam: true, reason: "urls" };
  }

  if (message.length > 80 && message === message.toUpperCase()) {
    return { spam: true, reason: "shouting" };
  }

  const localPart = email.split("@")[0] || "";
  if (/^\d{8,}$/.test(localPart)) {
    return { spam: true, reason: "numeric_email" };
  }

  return { spam: false };
}
