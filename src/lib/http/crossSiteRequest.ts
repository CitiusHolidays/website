import { type AuthOriginEnvironment, resolveAuthOrigin } from "@convex/lib/authOriginPolicy";

const SAME_ORIGIN_FETCH_SITES = new Set(["same-origin", "none"]);

/**
 * True when a browser says this request was sent by a page on another origin.
 *
 * Cookie-authenticated routes that change state call this as defence in depth against
 * cross-site request forgery: SameSite=Lax cookies still travel with POSTs from sibling
 * subdomains, and a JSON route parses a `text/plain` form body. A request with neither
 * `Origin` nor `Sec-Fetch-Site` did not come from a browser page, so it cannot carry a
 * forged visit and is left to the route's normal authentication.
 */
export function isCrossSiteBrowserRequest(
  request: Request,
  env: AuthOriginEnvironment = process.env
): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && !SAME_ORIGIN_FETCH_SITES.has(fetchSite)) {
    return true;
  }
  const origin = request.headers.get("origin");
  if (origin === null) {
    return false;
  }
  try {
    return origin !== resolveAuthOrigin(env);
  } catch {
    // An unresolvable site origin must not widen what a browser page may send.
    return true;
  }
}
