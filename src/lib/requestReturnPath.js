/**
 * Server layouts cannot read the request URL, so `src/proxy.js` copies the requested path into
 * this header for the pages that send signed-out visitors to sign in. The value is only a hint:
 * `resolveAuthReturnPath` decides whether it may be used as `returnTo`.
 */
export const RETURN_PATH_HEADER = "x-citius-return-path";

// Next's own request markers; they must never end up in a post-sign-in URL.
const INTERNAL_SEARCH_PARAMS = ["_rsc"];

export function requestReturnPath(requestUrl) {
  const url = new URL(requestUrl);
  for (const name of INTERNAL_SEARCH_PARAMS) {
    url.searchParams.delete(name);
  }
  return `${url.pathname}${url.search}`;
}

/** The request headers with the return-path header set, replacing any value the client sent. */
export function withReturnPathHeader(requestHeaders, requestUrl) {
  const nextHeaders = new Headers(requestHeaders);
  nextHeaders.set(RETURN_PATH_HEADER, requestReturnPath(requestUrl));
  return nextHeaders;
}
