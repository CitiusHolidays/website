import type { MotionUITheme, ReducedMotionStrategy } from "./types";

/** Runtime motion posture resolved for the current visitor. */
export type MotionMode = "full" | ReducedMotionStrategy;

/** The resolved motion posture a section should render with. */
export interface ResolvedReducedMotion {
  /** Whether to animate at all (`false` only under `"off"`). */
  animate: boolean;
  /** Whether only opacity (duration-based fades) should animate. */
  opacityOnly: boolean;
  /** Which posture is in effect. */
  strategy: MotionMode;
  /** Whether positional/scale travel is permitted (`false` under `"calm"`/`"off"`). */
  travel: boolean;
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
    return { animate: true, opacityOnly: false, strategy: "full", travel: true };
  }
  if (theme.reducedMotion === "off") {
    return { animate: false, opacityOnly: false, strategy: "off", travel: false };
  }
  return { animate: true, opacityOnly: true, strategy: "calm", travel: false };
}
