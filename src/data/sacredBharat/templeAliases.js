/** Legacy ids merged into canonical sacred sites (one darshan, one score). */
export const TEMPLE_ALIASES = {
  rameswaram: "ramanathaswamy",
  varanasi: "kashi-vishwanath",
};

/**
 * @param {string | null | undefined} templeId
 */
export function resolveCanonicalTempleId(templeId) {
  if (!templeId) {
    return "";
  }
  return TEMPLE_ALIASES[templeId] ?? templeId;
}

/**
 * @param {string[] | Set<string>} templeIds
 */
