"use client";

import { m, useInView, useReducedMotion } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import { useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;

export default function NumberTicker({ value, label, className = "" }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.4, once: true });
  const shouldReduceMotion = useReducedMotion();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  const displayValue = isHydrated && (shouldReduceMotion || isInView) ? value : 0;
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { damping: 20, stiffness: 50, type: "spring" };

  return (
    <m.div className={cn("text-center", className)} ref={ref}>
      <span className="sr-only">
        {value}+ {label}
      </span>
      <span
        aria-hidden="true"
        className="mb-2 inline-flex items-baseline font-bold text-3xl text-public-orange-ink tabular-nums md:text-4xl"
      >
        <AnimateNumber transition={transition}>{displayValue}</AnimateNumber>
        <span className="ml-1 align-baseline font-bold text-2xl md:text-3xl">+</span>
      </span>
      <p aria-hidden="true" className="font-medium text-brand-dark">
        {label}
      </p>
    </m.div>
  );
}
