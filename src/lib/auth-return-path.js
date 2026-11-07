import { isRuntimeString } from "./runtimeValues";

const PARSE_BASE = "https://return-path.invalid";
const MAX_RETURN_PATH_LENGTH = 512;
const UNSAFE_CHARACTERS = /[\p{C}\s\\]/u;

/**
 * A post-sign-in destination taken from the URL. Only a same-origin path inside the variant's own
 * area (`/account` for guests) is accepted, so the parameter cannot redirect anywhere else.
 * Returns the path with its query and hash, or null.
 */
export function resolveAuthReturnPath(value, variant) {
  if (
    !isRuntimeString(value) ||
    value.length > MAX_RETURN_PATH_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    UNSAFE_CHARACTERS.test(value)
  ) {
    return null;
  }
  let url;
  try {
    url = new URL(value, PARSE_BASE);
  } catch {
    return null;
  }
  const area = variant.href;
  const insideArea = url.pathname === area || url.pathname.startsWith(`${area}/`);
  if (url.origin !== PARSE_BASE || area === "/" || !insideArea) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The variant's sign-in page, carrying the return path only when it is allowed. */
export function signInHrefWithReturn(returnPath, variant) {
  const allowed = resolveAuthReturnPath(returnPath, variant);
  return allowed
    ? `${variant.authPath}?${new URLSearchParams({ returnTo: allowed })}`
    : variant.authPath;
}
