const PUBLIC_ORIGIN = "https://www.citiusholidays.com";

function hasUnsafeCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

/**
 * Sanity links are content, not trusted navigation instructions. Keep relative links and the
 * small set of user-facing protocols we intentionally support; reject script/file/data schemes.
 */
export function safePublicHref(value) {
  if (typeof value !== "string") {
    return null;
  }
  const href = value.trim();
  if (!href || href.includes("\\") || hasUnsafeCharacters(href) || href.startsWith("//")) {
    return null;
  }
  try {
    const decodedHref = decodeURIComponent(href);
    if (decodedHref.includes("\\") || hasUnsafeCharacters(decodedHref)) {
      return null;
    }
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(href, PUBLIC_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.protocol === "mailto:" || parsed.protocol === "tel:") {
    return href;
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return href;
  }
  return null;
}

export function isSafePublicWebHref(value) {
  const href = safePublicHref(value);
  if (!href) {
    return false;
  }
  try {
    const parsed = new URL(href, PUBLIC_ORIGIN);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
