/** Server mirror of src/data/sacredBharat/templeAliases.js */

export const TEMPLE_ALIASES: Record<string, string> = {
  rameswaram: "ramanathaswamy",
  varanasi: "kashi-vishwanath",
};

export function resolveCanonicalTempleId(templeId: string): string {
  return TEMPLE_ALIASES[templeId] ?? templeId;
}
