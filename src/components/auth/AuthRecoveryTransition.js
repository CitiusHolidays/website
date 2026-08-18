"use client";

import { AnimatePresence, m, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

export const AUTH_RECOVERY_UI_SPRING = {
  damping: 33.161_255_787_892_26,
  stiffness: 304.617_419_786_708_64,
  type: "spring",
};

export function authRecoveryMotion(shouldReduceMotion) {
  if (shouldReduceMotion) {
    return {
      animate: { opacity: 1, transform: "none" },
      exit: { opacity: 0, transform: "none" },
      initial: { opacity: 0, transform: "none" },
      transition: { duration: 0.2, ease: "linear" },
    };
  }
  return {
    animate: { opacity: 1, transform: "translateY(0) scale(1)" },
    exit: { opacity: 0, transform: "translateY(-4px) scale(0.99)" },
    initial: { opacity: 0, transform: "translateY(6px) scale(0.98)" },
    transition: {
      opacity: { duration: 0.3, ease: "linear" },
      transform: AUTH_RECOVERY_UI_SPRING,
    },
  };
}

function AuthRecoveryPane({ children, motion, onEntered, paneKey }) {
  const isPresent = useIsPresent();
  const didEnter = useRef(false);
  const handleAnimationComplete = () => {
    if (isPresent && !didEnter.current) {
      didEnter.current = true;
      onEntered?.();
    }
  };

  return (
    <m.div
      animate={motion?.animate}
      aria-hidden={isPresent ? undefined : true}
      data-auth-recovery-pane={paneKey}
      exit={motion?.exit}
      inert={isPresent ? undefined : true}
      initial={motion?.initial}
      onAnimationComplete={handleAnimationComplete}
      transition={motion?.transition}
    >
      {children}
    </m.div>
  );
}

export function AuthRecoveryTransition({
  announcement = "",
  children,
  onEntered,
  paneKey,
  tone = "polite",
}) {
  const prefersReducedMotion = useReducedMotion();
  const [motionPreference, setMotionPreference] = useState(null);
  useEffect(() => {
    setMotionPreference(Boolean(prefersReducedMotion));
  }, [prefersReducedMotion]);
  const motion = motionPreference === null ? null : authRecoveryMotion(Boolean(motionPreference));

  return (
    <>
      <p aria-atomic="true" aria-live={tone} className="sr-only">
        {announcement}
      </p>
      <AnimatePresence initial={false} mode="wait">
        <AuthRecoveryPane key={paneKey} motion={motion} onEntered={onEntered} paneKey={paneKey}>
          {children}
        </AuthRecoveryPane>
      </AnimatePresence>
    </>
  );
}
