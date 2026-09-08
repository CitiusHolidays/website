"use client";

import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydratedReducedMotion() {
  const preference = useReducedMotion();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  return isHydrated && !!preference;
}

export default function ReducedMotionProvider({ children }) {
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={isHydrated ? "user" : "always"}>{children}</MotionConfig>
    </LazyMotion>
  );
}
