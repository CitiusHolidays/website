"use client";

import { m, useInView, useReducedMotion } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { publicRevealMotion } from "@/lib/publicInteractionMotion";
import { cn } from "@/lib/utils";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function AnimatedSection({ children, className, ...props }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0, once: true });
  const reducedMotionPreference = !!useReducedMotion();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydrationSnapshot
  );
  const shouldReduceMotion = isHydrated && reducedMotionPreference;
  const motion = publicRevealMotion(shouldReduceMotion);

  return (
    <m.section
      animate={isInView ? motion.animate : {}}
      className={cn("motion-reduce-spatial", className)}
      initial={false}
      ref={ref}
      transition={motion.transition}
      {...props}
    >
      {children}
    </m.section>
  );
}
