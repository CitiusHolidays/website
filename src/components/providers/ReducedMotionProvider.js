"use client";

import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";

export default function ReducedMotionProvider({ children }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
