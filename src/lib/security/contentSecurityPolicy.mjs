/**
 * Content Security Policy for every document the site serves.
 *
 * It ships as Content-Security-Policy-Report-Only: browsers report what the policy would block
 * to /api/csp-report and block nothing. Each source below was found in the code, not guessed:
 *
 * - challenges.cloudflare.com: the Turnstile script and its challenge iframe (TurnstileWidget).
 * - va.vercel-scripts.com: the Vercel Analytics and Speed Insights scripts outside production;
 *   production loads them from same-origin /_vercel paths.
 * - Convex cloud hosts (https and wss): the Convex client's queries and live subscriptions;
 *   Convex site hosts serve HTTP actions. The configured Convex URLs are added too, which
 *   covers a local Convex backend in development.
 * - cdn.sanity.io, Convex storage, lh3.googleusercontent.com, transparenttextures.com:
 *   images loaded straight from those hosts (next/image remote patterns, Sanity URLs used
 *   directly, the pilgrimage paper texture).
 * - www.google.com and www.youtube.com: Google Maps and YouTube embeds.
 * - blob: and data: images, media, and workers: photo booth previews, document previews, and
 *   downloads. 'wasm-unsafe-eval': the photo booth's MediaPipe WebAssembly segmenter.
 * - 'unsafe-inline' scripts and styles: Next.js inlines its bootstrap and RSC payload scripts.
 *   A nonce would remove it, but a nonce needs a per-request render, which Cache Components and
 *   the prerendered public pages are built to avoid. 'unsafe-eval' is added only in development,
 *   where React and Turbopack need it.
 *
 * Deliberately left out: Razorpay (checkout happens server-side; no browser script loads) and
 * MediaPipe's usage logging to odml.pa.googleapis.com, which the photo booth does not need.
 *
 * To enforce the policy: watch /api/csp-report logs ("csp.violation") on production traffic
 * until real pages produce none, then in next.config.mjs change the header key from
 * CONTENT_SECURITY_POLICY_REPORT_ONLY_HEADER to "Content-Security-Policy" and call
 * buildContentSecurityPolicy with { enforce: true }. That also adds frame-ancestors 'none' and
 * upgrade-insecure-requests, which browsers ignore in a report-only policy. Keep the reporting
 * directives so violations stay visible after the switch.
 */

export const CONTENT_SECURITY_POLICY_REPORT_ONLY_HEADER = "Content-Security-Policy-Report-Only";
export const CSP_REPORT_PATH = "/api/csp-report";
export const CSP_REPORT_GROUP = "csp-endpoint";
export const CSP_REPORTING_ENDPOINTS = `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`;

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const VERCEL_SCRIPTS_ORIGIN = "https://va.vercel-scripts.com";

function configuredOrigins(urls) {
  const origins = [];
  for (const url of urls) {
    if (!url?.trim()) {
      continue;
    }
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        continue;
      }
      origins.push(parsed.origin);
      origins.push(`${parsed.protocol === "https:" ? "wss:" : "ws:"}//${parsed.host}`);
    } catch {
      // A malformed URL fails elsewhere; it must not widen or break the policy.
    }
  }
  return origins;
}

/**
 * @param {{
 *   convexSiteUrl?: string;
 *   convexUrl?: string;
 *   development?: boolean;
 *   enforce?: boolean;
 * }} [options]
 */
export function buildContentSecurityPolicy({
  convexSiteUrl,
  convexUrl,
  development = false,
  enforce = false,
} = {}) {
  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["form-action", "'self'"],
    [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(development ? ["'unsafe-eval'"] : []),
      TURNSTILE_ORIGIN,
      VERCEL_SCRIPTS_ORIGIN,
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      "https://cdn.sanity.io",
      "https://*.convex.cloud",
      "https://lh3.googleusercontent.com",
      "https://www.transparenttextures.com",
    ],
    ["font-src", "'self'", "data:"],
    [
      "connect-src",
      "'self'",
      "https://*.convex.cloud",
      "wss://*.convex.cloud",
      "https://*.convex.site",
      ...new Set(configuredOrigins([convexUrl, convexSiteUrl])),
    ],
    ["media-src", "'self'", "blob:"],
    ["frame-src", TURNSTILE_ORIGIN, "https://www.google.com", "https://www.youtube.com"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ...(enforce ? [["frame-ancestors", "'none'"], ["upgrade-insecure-requests"]] : []),
    ["report-uri", CSP_REPORT_PATH],
    ["report-to", CSP_REPORT_GROUP],
  ];
  return directives.map((parts) => parts.join(" ")).join("; ");
}
