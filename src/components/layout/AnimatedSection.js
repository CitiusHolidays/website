"use client";

import { m, useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "../../utils/cn";

export default function AnimatedSection({ children, className, ...props }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0, once: true });

  return (
    <m.section
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      className={cn(className)}
      initial={{ opacity: 0, y: 50 }}
      ref={ref}
      transition={{ duration: 0.8, ease: "easeOut" }}
      {...props}
    >
      {children}
    </m.section>
  );
}
