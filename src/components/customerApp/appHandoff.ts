/**
 * The customer app's links (ADR 0020) arrive as website pages so every mail and SMS app can open
 * them. The one-time token rides in the URL fragment, which browsers never send to a server, and
 * the page passes it to the installed app through its `citius://` scheme. Universal Links and App
 * Links will later open the app directly from the same https URLs.
 */

const CUSTOMER_APP_SCHEME = "citius";

export type AppHandoffKind = "invite" | "sign-in";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const LEADING_HASH = /^#/;

/** Reads `#token=…` from a location hash; anything else is not a usable link. */
export function tokenFromHash(hash: string) {
  const params = new URLSearchParams(hash.replace(LEADING_HASH, ""));
  const token = params.get("token")?.trim() ?? "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function appHandoffUrl(kind: AppHandoffKind, token: string) {
  return `${CUSTOMER_APP_SCHEME}://${kind}?token=${encodeURIComponent(token)}`;
}
