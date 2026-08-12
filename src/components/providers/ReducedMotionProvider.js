"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useEffect, useState } from "react";

export default function ReducedMotionProvider({ children }) {
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion={isHydrated ? "user" : "always"}>{children}</MotionConfig>
    </LazyMotion>
  );
}
