"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";

/**
 * @param {{ templeIds?: string[], showAllTemples?: boolean }} props
 */
export function sacredVisitFeedbackMotion(shouldReduceMotion) {
  return {
    animate: { opacity: 1, transform: "translateY(0)" },
    exit: {
      opacity: 0,
      transform: shouldReduceMotion ? "translateY(0)" : "translateY(-4px)",
    },
    initial: {
      opacity: 0,
      transform: shouldReduceMotion ? "translateY(0)" : "translateY(6px)",
    },
  };
}

export function TempleVisitFeedback({ feedback, onUndo }) {
  const shouldReduceMotion = !!useReducedMotion();
  const motion = sacredVisitFeedbackMotion(shouldReduceMotion);

  return (
    <AnimatePresence initial={false} mode="wait">
      {feedback ? (
        <m.div
          animate={motion.animate}
          className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-citius-orange/30 bg-citius-orange/8 px-4 py-3 text-brand-dark"
          exit={motion.exit}
          initial={motion.initial}
          key={feedback.templeId}
          role="status"
          transition={{ duration: shouldReduceMotion ? 0.01 : 0.18, ease: "easeOut" }}
        >
          <p className="text-sm">
            <strong>{feedback.templeName}</strong> added to your journey. +{feedback.points} Soul
            Score points.
          </p>
          <button
            className="min-h-11 shrink-0 rounded-full px-3 font-semibold text-citius-blue text-xs underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
            onClick={onUndo}
            type="button"
          >
            Undo
          </button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
