"use client";

import { BriefcaseBusiness, ChevronDown, User } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { getSignInAuthUrl, VISIBLE_SIGN_IN_TARGETS } from "@/lib/auth-sign-in-targets";
import { publicDisclosureMotion } from "@/lib/publicInteractionMotion";

const PANEL_ID = "public-sign-in-disclosure";

export function SignInDropdown({ isScrolled, variant = "desktop", onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const motion = publicDisclosureMotion(shouldReduceMotion, "right");
  const close = useCallback(() => setOpen(false), []);
  const handleMobileSelect = useCallback(() => onSelect?.(), [onSelect]);
  const closeAndRestoreFocus = useCallback(() => {
    close();
    triggerRef.current?.focus({ preventScroll: true });
  }, [close]);
  const closeFromEffect = useEffectEvent(close);
  const closeAndRestoreFocusFromEffect = useEffectEvent(closeAndRestoreFocus);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    const closeOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        closeFromEffect();
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocusFromEffect();
      }
    };
    const handleFocusIn = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        closeFromEffect();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [open]);

  const items = VISIBLE_SIGN_IN_TARGETS.map((target) => ({
    ...target,
    icon: target.id === "employee" ? BriefcaseBusiness : User,
  }));

  if (variant === "mobile") {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <span className="text-white/40 text-xs uppercase tracking-[0.25em]">Sign In</span>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className="flex w-full max-w-xs items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3 text-sm text-white transition-colors hover:bg-white/10"
              href={getSignInAuthUrl(item.id)}
              key={item.id}
              onClick={handleMobileSelect}
            >
              <span className="inline-flex size-[18px] shrink-0 items-center justify-center">
                <Icon size={18} strokeWidth={2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        aria-controls={PANEL_ID}
        aria-expanded={open}
        aria-label="Sign In"
        className={`hidden items-center gap-2 rounded-full px-4 py-2.5 font-medium text-sm transition-[background-color,color,box-shadow] duration-300 sm:flex ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "material-floating border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
        }`}
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <User size={16} />
        Sign In
        <ChevronDown
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={14}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            animate={motion.animate}
            className="absolute top-full right-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
            exit={motion.exit}
            id={PANEL_ID}
            initial={motion.initial}
            style={motion.style}
            transition={motion.transition}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                  href={getSignInAuthUrl(item.id)}
                  key={item.id}
                  onClick={close}
                >
                  <span className="inline-flex size-4 shrink-0 items-center justify-center">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
