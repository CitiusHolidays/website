"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

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
