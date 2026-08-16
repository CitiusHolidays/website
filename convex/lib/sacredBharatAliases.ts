/** Server mirror of src/data/sacredBharat/templeAliases.js */

import { hasOwnKey } from "./runtimeValues";

export const TEMPLE_ALIASES = {
  rameswaram: "ramanathaswamy",
  varanasi: "kashi-vishwanath",
} satisfies Record<string, string>;

export function resolveCanonicalTempleId(templeId: string): string {
  return hasOwnKey(TEMPLE_ALIASES, templeId) ? TEMPLE_ALIASES[templeId] : templeId;
}
