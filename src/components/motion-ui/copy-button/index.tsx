"use client";

import { Check, Copy } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useMotionUITransition } from "@/components/motion-ui/ui-theme";

export interface PortalCopyButtonProps {
  "aria-label"?: string;
  className?: string;
  label?: string;
  value: string;
}

export function PortalCopyButton({
  "aria-label": ariaLabel,
  className = "",
  label,
  value,
}: PortalCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snap = useMotionUITransition("snap");

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    },
    []
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      aria-label={ariaLabel ?? (label ? `Copy ${label}` : "Copy to clipboard")}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border border-brand-border/80 bg-white px-2 py-1 font-medium text-brand-muted text-xs transition-colors hover:border-citius-blue/30 hover:text-citius-blue ${className}`}
      onClick={() => void handleCopy()}
      type="button"
    >
      {label ? <span className="tabular-nums text-brand-dark">{label}</span> : null}
      <m.span
        animate={{ opacity: 1, transform: "scale(1)" }}
        initial={false}
        key={copied ? "check" : "copy"}
        transition={snap}
      >
        {copied ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      </m.span>
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
