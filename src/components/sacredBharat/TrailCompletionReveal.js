"use client";

import { Award } from "lucide-react";
import { m, useReducedMotion } from "motion/react";
import { useState } from "react";

export function trailCompletionMotion(shouldReduceMotion) {
  return {
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0 },
    initial: shouldReduceMotion
      ? { opacity: 0, scale: 1, y: 0 }
      : { opacity: 0, scale: 0.97, y: 6 },
    transition: shouldReduceMotion
      ? { duration: 0.21, ease: "linear" }
      : {
          default: {
            damping: 17.453_292_519_943_293,
            stiffness: 621.668_203_646_344,
            type: "spring",
          },
          opacity: { duration: 0.21, ease: "linear" },
        },
  };
}

export default function TrailCompletionReveal({ badgeName, complete, completionBonus }) {
  const shouldReduceMotion = !!useReducedMotion();
  const [lifecycle, setLifecycle] = useState(() => ({
    badgeName,
    hasRevealed: complete,
    isVisible: false,
    previousComplete: complete,
  }));
  let renderLifecycle = lifecycle;

  if (lifecycle.badgeName !== badgeName) {
    renderLifecycle = {
      badgeName,
      hasRevealed: complete,
      isVisible: false,
      previousComplete: complete,
    };
  } else if (complete !== lifecycle.previousComplete) {
    if (!complete) {
      renderLifecycle = { ...lifecycle, isVisible: false, previousComplete: false };
    } else if (lifecycle.hasRevealed) {
      renderLifecycle = { ...lifecycle, isVisible: false, previousComplete: true };
    } else {
      renderLifecycle = {
        ...lifecycle,
        hasRevealed: true,
        isVisible: true,
        previousComplete: true,
      };
    }
  }
  if (renderLifecycle !== lifecycle) {
    setLifecycle(renderLifecycle);
  }

  if (!renderLifecycle.isVisible) {
    return null;
  }
  const motion = trailCompletionMotion(shouldReduceMotion);
  return (
    <m.div
      animate={motion.animate}
      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-citius-orange/35 bg-citius-orange/10 px-4 py-3 font-sans text-brand-dark text-sm"
      initial={motion.initial}
      role="status"
      transition={motion.transition}
    >
      <Award aria-hidden="true" className="size-5 text-public-orange-ink" />
      <span>
        Trail complete: <strong>{badgeName}</strong> badge earned with a{" "}
        <strong>+{completionBonus}</strong> Soul Score bonus.
      </span>
    </m.div>
  );
}
