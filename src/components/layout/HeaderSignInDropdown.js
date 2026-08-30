"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getSignInAuthUrl, VISIBLE_SIGN_IN_TARGETS } from "@/lib/auth-sign-in-targets";
import { publicDisclosureMotion } from "@/lib/publicInteractionMotion";
import {
  BriefcaseBusinessIcon,
  ChevronDownIcon,
  UserIcon,
  useAnimatedIconTrigger,
} from "../ui/AnimatedLucideIcons";

const PANEL_ID = "public-sign-in-disclosure";

function SignInTargetLink({ className, iconSize, item, onClick }) {
  const iconRef = useRef(null);
  const iconTrigger = useAnimatedIconTrigger(iconRef);
  const Icon = item.icon;

  return (
    <Link className={className} href={getSignInAuthUrl(item.id)} onClick={onClick} {...iconTrigger}>
      <span className="inline-flex shrink-0 items-center justify-center">
        <Icon aria-hidden="true" ref={iconRef} size={iconSize} strokeWidth={2} />
      </span>
      {item.label}
    </Link>
  );
}

export function SignInDropdown({ isScrolled, variant = "desktop", onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const triggerUserIconRef = useRef(null);
  const triggerChevronRef = useRef(null);
  const triggerIconMotion = useAnimatedIconTrigger(triggerUserIconRef, triggerChevronRef);
  const shouldReduceMotion = !!useReducedMotion();
  const motion = publicDisclosureMotion(shouldReduceMotion, "right");
  const close = () => setOpen(false);
  const handleMobileSelect = () => onSelect?.();
  const closeAndRestoreFocus = () => {
    close();
    triggerRef.current?.focus({ preventScroll: true });
  };
  const closeFromEffect = useEffectEvent(close);
  const closeAndRestoreFocusFromEffect = useEffectEvent(closeAndRestoreFocus);
  const toggle = () => setOpen((current) => !current);

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
    icon: target.id === "employee" ? BriefcaseBusinessIcon : UserIcon,
  }));

  if (variant === "mobile") {
    return (
      <nav aria-label="Sign in" className="grid w-full grid-cols-2 gap-2">
        {items.map((item) => (
          <SignInTargetLink
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-center font-semibold text-sm text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
            iconSize={18}
            item={item}
            key={item.id}
            onClick={handleMobileSelect}
          />
        ))}
      </nav>
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
            : "material-floating border border-white/20 bg-white/10 text-white backdrop-blur-md [--material-preference-background:var(--color-public-night)] [--material-preference-boundary:var(--color-public-surface)] hover:bg-white/20"
        }`}
        onClick={toggle}
        ref={triggerRef}
        type="button"
        {...triggerIconMotion}
      >
        <UserIcon aria-hidden="true" ref={triggerUserIconRef} size={16} />
        Sign In
        <ChevronDownIcon
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          ref={triggerChevronRef}
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
            {items.map((item) => (
              <SignInTargetLink
                className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                iconSize={16}
                item={item}
                key={item.id}
                onClick={close}
              />
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
