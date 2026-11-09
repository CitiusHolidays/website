"use client";

import { m, useInView } from "motion/react";
import { useRef } from "react";
import { PUBLIC_EASE_OUT } from "@/lib/publicInteractionMotion";
import { useHydrationSafeReducedMotion } from "@/lib/useHydrationSafeReducedMotion";
import { cn } from "@/lib/utils";

// A transform string runs as a hardware-accelerated animation; the `y` shorthand would be
// interpolated on the main thread while the page is still hydrating. The 2D end value leaves no
// permanent compositor layer behind.
const SECTION_HIDDEN = { opacity: 0, transform: "translateY(24px)" };
const SECTION_SHOWN = { opacity: 1, transform: "translateY(0px)" };
const SECTION_TRANSITION = { duration: 0.45, ease: PUBLIC_EASE_OUT };

export default function AnimatedSection({ children, className, ...props }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { amount: 0, once: true });
  const shouldReduceMotion = useHydrationSafeReducedMotion();
  const isShown = shouldReduceMotion || isInView;

  return (
    <m.section
      animate={isShown ? SECTION_SHOWN : SECTION_HIDDEN}
      className={cn(className)}
      initial={SECTION_HIDDEN}
      ref={ref}
      transition={shouldReduceMotion ? { duration: 0 } : SECTION_TRANSITION}
      {...props}
    >
      {children}
    </m.section>
  );
}
