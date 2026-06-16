"use client";

import { m, useInView } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import { useRef } from "react";
import { cn } from "../../utils/cn";

export default function AnimatedCounter({ value, label, className }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const displayValue = isInView ? value : 0;

  return (
    <m.div ref={ref} className={cn("text-center", className)}>
      {/* Screen reader accessible version */}
      <span className="sr-only">
        {displayValue}+ {label}
      </span>

      {/* Visual animated version - hidden from screen readers */}
      <span
        className="text-3xl md:text-4xl font-bold text-citius-orange mb-2 inline-flex items-baseline"
        aria-hidden="true"
      >
        <AnimateNumber transition={{ type: "spring", stiffness: 50, damping: 20 }}>
          {displayValue}
        </AnimateNumber>
        <span className="ml-1 align-baseline text-2xl md:text-3xl font-bold">+</span>
      </span>
      <p className="text-brand-dark font-medium" aria-hidden="true">
        {label}
      </p>
    </m.div>
  );
}
