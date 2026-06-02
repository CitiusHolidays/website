"use client";

import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from "motion/react";

export default function ReducedMotionProvider({ children }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={prefersReducedMotion ? "always" : "user"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
