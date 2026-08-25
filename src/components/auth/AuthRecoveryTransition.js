"use client";

import { AnimatePresence, m, useIsPresent } from "motion/react";
import { useEffect, useRef } from "react";

function AuthRecoveryPane({ children, onEntered, paneKey }) {
  const isPresent = useIsPresent();
  const didEnter = useRef(false);

  useEffect(() => {
    if (isPresent && !didEnter.current) {
      didEnter.current = true;
      onEntered?.();
    }
  }, [isPresent, onEntered]);

  return (
    <m.div
      aria-hidden={isPresent ? undefined : true}
      data-auth-recovery-pane={paneKey}
      exit={{ opacity: 0 }}
      inert={isPresent ? undefined : true}
      initial={false}
      transition={{ duration: 0.12 }}
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
  return (
    <>
      <p aria-atomic="true" aria-live={tone} className="sr-only">
        {announcement}
      </p>
      <AnimatePresence initial={false} mode="wait">
        <AuthRecoveryPane key={paneKey} onEntered={onEntered} paneKey={paneKey}>
          {children}
        </AuthRecoveryPane>
      </AnimatePresence>
    </>
  );
}
