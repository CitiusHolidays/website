"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "../../utils/cn";

export default function AnimatedSection({ children, className, ...props }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0 });

  return (
    <motion.section
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.section>
  );
}
