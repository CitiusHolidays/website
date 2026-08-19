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

function stateContent({
  children,
  errorLabel,
  idleIcon,
  savedLabel,
  savingLabel,
  state,
}: Pick<
  MultiStateButtonProps,
  "children" | "errorLabel" | "idleIcon" | "savedLabel" | "savingLabel" | "state"
>) {
  if (state === "saving") {
    return {
      icon: <Loader2 aria-hidden className="animate-spin" size={16} />,
      label: savingLabel ?? children,
    };
  }
  if (state === "saved") {
    return { icon: <CheckCircle2 aria-hidden size={16} />, label: savedLabel };
  }
  if (state === "error") {
    return { icon: idleIcon, label: errorLabel };
  }
  return { icon: idleIcon, label: children };
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
  const content = stateContent({ children, errorLabel, idleIcon, savedLabel, savingLabel, state });

  return (
    <button className={className} disabled={disabled || isBusy} type={type} {...rest}>
      <m.span
        animate={{ opacity: 1, transform: "scale(1)" }}
        className="inline-flex items-center gap-2"
        initial={false}
        key={state}
        transition={snap}
      >
        {content.icon}
        {content.label}
      </m.span>
    </button>
  );
}
