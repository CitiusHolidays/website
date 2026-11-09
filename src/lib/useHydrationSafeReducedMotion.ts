import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** The server cannot read the visitor's preference, so hydration starts from full motion. */
export function getReducedMotionServerSnapshot(): boolean {
  return false;
}

/**
 * Reads `prefers-reduced-motion` without a hydration mismatch: the hydration pass uses the
 * server snapshot and React re-renders with the browser preference immediately afterwards.
 */
export function useHydrationSafeReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}
