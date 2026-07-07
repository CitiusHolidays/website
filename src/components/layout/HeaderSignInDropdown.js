"use client";

import { BriefcaseBusiness, ChevronDown, User } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSignInAuthUrl, VISIBLE_SIGN_IN_TARGETS } from "@/lib/auth-sign-in-targets";

export function SignInDropdown({ isScrolled, variant = "desktop", onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
              onClick={() => onSelect?.()}
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
        className={`hidden items-center gap-2 rounded-full px-4 py-2.5 font-medium text-sm transition-all duration-300 sm:flex ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "border border-white/20 bg-white/10 text-white backdrop-blur-md hover:bg-white/20"
        }`}
        onClick={() => setOpen((current) => !current)}
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
        {open && (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full right-0 z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex items-center gap-3 px-4 py-2.5 text-gray-700 text-sm transition-colors hover:bg-gray-50"
                  href={getSignInAuthUrl(item.id)}
                  key={item.id}
                  onClick={() => setOpen(false)}
                >
                  <span className="inline-flex size-4 shrink-0 items-center justify-center">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
