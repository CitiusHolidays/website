import { additionalTrails } from "./additionalTrails.js";
import { kailashAerialTrail } from "./kailashAerial.js";
import { kailashMansarovarTrail } from "./kailashMansarovar.js";

/**
 * @typedef {object} PublicTrail
 * @property {string} id Stable content identifier.
 * @property {string} slug Stable public URL segment.
 * @property {string} title Display title.
 * @property {"published" | "comingSoon"} status Publication state.
 * @property {string} group Hub ordering group.
 */

/** @type {PublicTrail[]} */
export const TRAILS = [kailashMansarovarTrail, kailashAerialTrail, ...additionalTrails];

export const TRAIL_BY_SLUG = Object.fromEntries(TRAILS.map((trail) => [trail.slug, trail]));

/** Hub section order (trails grouped under these ids via `trail.group`). */
export const TRAIL_GROUPS = [
  { id: "kailash-mansarovar", label: "Kailash Mansarovar 2026" },
  { id: "kora-routes", label: "Kora routes" },
  { id: "special-programs", label: "Special programs" },
];
