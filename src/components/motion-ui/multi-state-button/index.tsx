"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { m } from "motion/react";
import type { ReactNode } from "react";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";

export type MultiStateButtonState = "idle" | "saving" | "saved" | "error";

export interface MultiStateButtonProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  errorLabel?: string;
  idleIcon?: ReactNode;
  savedLabel?: string;
  savingLabel?: string;
  state: MultiStateButtonState;
  type?: "button" | "submit";
  [key: `data-${string}`]: string | undefined;
}

export function MultiStateButton({
  children,
  className = "portal-primary-btn",
  disabled = false,
  errorLabel = "Try again",
  idleIcon = <CheckCircle2 size={16} />,
  savedLabel = "Saved",
  savingLabel,
  state,
  type = "button",
  ...rest
}: MultiStateButtonProps) {
  const snap = useMotionUITransition("snap");
  const isBusy = state === "saving";
  const label =
    state === "saving"
      ? (savingLabel ?? children)
      : state === "saved"
        ? savedLabel
        : state === "error"
          ? errorLabel
          : children;

  return (
    <button className={className} disabled={disabled || isBusy} type={type} {...rest}>
      <m.span
        animate={{ opacity: 1, transform: "scale(1)" }}
        className="inline-flex items-center gap-2"
        initial={false}
        key={state}
        transition={snap}
      >
        {state === "saving" ? (
          <Loader2 aria-hidden className="animate-spin" size={16} />
        ) : state === "saved" ? (
          <CheckCircle2 aria-hidden size={16} />
        ) : (
          idleIcon
        )}
        {label}
      </m.span>
    </button>
  );
}
