/** Legacy ids merged into canonical sacred sites (one darshan, one score). */
export const TEMPLE_ALIASES = {
  rameswaram: "ramanathaswamy",
  varanasi: "kashi-vishwanath",
};

export const MERGED_TEMPLE_IDS = Object.keys(TEMPLE_ALIASES);

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
export function resolveCanonicalTempleIds(templeIds) {
  const list = templeIds instanceof Set ? [...templeIds] : templeIds ?? [];
  return list.map(resolveCanonicalTempleId).filter(Boolean);
}
