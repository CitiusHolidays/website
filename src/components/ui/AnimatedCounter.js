"use client";

import { motion, useInView } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import { cn } from "../../utils/cn";
import { useRef, useState, useEffect } from "react";

export default function AnimatedCounter({ value, label, className }) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });

  // Animate from 0 to value when in view
  useEffect(() => {
    if (isInView) {
      setDisplayValue(value);
    }
  }, [isInView, value]);

  return (
    <motion.div
      ref={ref}
      className={cn("text-center", className)}
    >
      <span className="text-3xl md:text-4xl font-bold text-citius-orange mb-2 inline-flex items-baseline">
        <AnimateNumber
          transition={{ type: "spring", stiffness: 50, damping: 20 }}
        >
          {displayValue}
        </AnimateNumber>
        <span className="ml-1 align-baseline text-2xl md:text-3xl font-bold">+</span>
      </span>
      <p className="text-brand-dark font-medium">{label}</p>
    </motion.div>
  );
}
