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
        <span className="text-xs uppercase tracking-[0.25em] text-white/40">Sign In</span>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={getSignInAuthUrl(item.id)}
              onClick={() => onSelect?.()}
              className="flex w-full max-w-xs items-center justify-center gap-3 rounded-full border border-white/15 px-6 py-3 text-sm text-white transition-colors hover:bg-white/10"
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
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
          isScrolled
            ? "bg-white/10 text-white hover:bg-white/20"
            : "bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20"
        }`}
      >
        <User size={16} />
        Sign In
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={getSignInAuthUrl(item.id)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
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
