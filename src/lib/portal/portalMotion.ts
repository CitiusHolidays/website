/** Shared portal motion presets — GPU transform + opacity only. */

import {
  resolveReducedMotion,
  type TransitionName,
  type UITransition,
} from "@/components/motion-ui/ui-theme";
import citiusTheme from "@/motion.theme";

export type PortalMotionTransition =
  | UITransition
  | { duration: number; ease: "linear" }
  | { duration: 0 };

/** Build a Motion-compatible transition from the Citius portal theme. */
export function resolveMotionUITransition(
  name: TransitionName,
  durationOverride?: number
): UITransition {
  const token = citiusTheme.transitions[name];
  const duration = durationOverride ?? token.duration;
  return {
    damping: token.damping,
    duration,
    ease: token.ease,
    opacity: { duration, ease: "linear", inherit: true, type: "tween" },
    stiffness: token.stiffness,
    type: "spring",
  };
}

/**
 * Portal overlay transition respecting the theme's reduced-motion strategy.
 * Calm mode keeps opacity fades; off mode disables animation.
 */
export function portalMotionTransition(
  prefersReducedMotion: boolean,
  durationOverride?: number,
  name: TransitionName = "ui"
): PortalMotionTransition {
  const { strategy, animate, opacityOnly } = resolveReducedMotion(
    citiusTheme,
    prefersReducedMotion
  );

  if (!animate || strategy === "off") {
    return { duration: 0 };
  }

  const token = citiusTheme.transitions[name];
  const duration = durationOverride ?? token.duration;

  if (opacityOnly || strategy === "calm") {
    return { duration, ease: "linear" };
  }

  return resolveMotionUITransition(name, duration);
}

export function portalModalHiddenTransform(prefersReducedMotion: boolean, scale = 0.96) {
  const { travel } = resolveReducedMotion(citiusTheme, prefersReducedMotion);
  return travel ? `scale(${scale})` : "scale(1)";
}

export function portalModalExitTransform(prefersReducedMotion: boolean, scale = 0.96) {
  const { travel } = resolveReducedMotion(citiusTheme, prefersReducedMotion);
  return travel ? `scale(${scale})` : "scale(1)";
}

export const PORTAL_MODAL_VISIBLE_TRANSFORM = "scale(1)";
