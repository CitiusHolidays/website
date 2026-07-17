/** Shared portal motion presets — GPU transform + opacity only. */

export const PORTAL_EASE_OUT = [0.23, 1, 0.32, 1];

export function portalMotionTransition(shouldReduceMotion, duration = 0.2) {
  return shouldReduceMotion ? { duration: 0 } : { duration, ease: PORTAL_EASE_OUT };
}

export function portalModalHiddenTransform(shouldReduceMotion, scale = 0.96) {
  return shouldReduceMotion ? "scale(1)" : `scale(${scale})`;
}

export function portalModalExitTransform(shouldReduceMotion, scale = 0.96) {
  return shouldReduceMotion ? "scale(1)" : `scale(${scale})`;
}

export const PORTAL_MODAL_VISIBLE_TRANSFORM = "scale(1)";
