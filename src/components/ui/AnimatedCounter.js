"use client";

import { m, useInView } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import { useRef } from "react";
import { cn } from "../../utils/cn";

export default function AnimatedCounter({ value, label, className }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0.4, once: true });
  const displayValue = isInView ? value : 0;

  return (
    <m.div className={cn("text-center", className)} ref={ref}>
      {/* Screen reader accessible version */}
      <span className="sr-only">
        {displayValue}+ {label}
      </span>

      {/* Visual animated version - hidden from screen readers */}
      <span
        aria-hidden="true"
        className="mb-2 inline-flex items-baseline font-bold text-3xl text-citius-orange md:text-4xl"
      >
        <AnimateNumber transition={{ damping: 20, stiffness: 50, type: "spring" }}>
          {displayValue}
        </AnimateNumber>
        <span className="ml-1 align-baseline font-bold text-2xl md:text-3xl">+</span>
      </span>
      <p aria-hidden="true" className="font-medium text-brand-dark">
        {label}
      </p>
    </m.div>
  );
}
