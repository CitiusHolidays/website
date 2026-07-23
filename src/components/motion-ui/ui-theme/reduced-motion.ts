import type { MotionUITheme, ReducedMotionStrategy } from "./types";

/** Runtime motion posture resolved for the current visitor. */
export type MotionMode = "full" | ReducedMotionStrategy;

/** The resolved motion posture a section should render with. */
export interface ResolvedReducedMotion {
  /** Which posture is in effect. */
  strategy: MotionMode;
  /** Whether to animate at all (`false` only under `"off"`). */
  animate: boolean;
  /** Whether positional/scale travel is permitted (`false` under `"calm"`/`"off"`). */
  travel: boolean;
  /** Whether only opacity (duration-based fades) should animate. */
  opacityOnly: boolean;
}

/**
 * Resolve how a section should behave given the theme's reduced-motion strategy
 * and whether the user currently prefers reduced motion.
 *
 * - Not reduced: `strategy: "full"` (animate, travel, no restriction).
 * - Reduced + theme `"calm"`: `strategy: "calm"` (animate opacity only, no travel).
 * - Reduced + theme `"off"`: `strategy: "off"` (do not animate).
 *
 * React components normally consume the equivalent `motionMode` from
 * `useMotionUITheme()`. This pure resolver remains useful outside React.
 */
export function resolveReducedMotion(
  theme: MotionUITheme,
  prefersReducedMotion: boolean
): ResolvedReducedMotion {
  if (!prefersReducedMotion) {
    return { strategy: "full", animate: true, travel: true, opacityOnly: false };
  }
  if (theme.reducedMotion === "off") {
    return { strategy: "off", animate: false, travel: false, opacityOnly: false };
  }
  return { strategy: "calm", animate: true, travel: false, opacityOnly: true };
}
