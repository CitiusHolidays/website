"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getTrailsForHub } from "@/data/trails";
import { publicDisclosureMotion } from "@/lib/publicInteractionMotion";

const PANEL_ID = "public-spiritual-trails-disclosure";

export function SpiritualTrailsDropdown({ isScrolled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const shouldReduceMotion = !!useReducedMotion();
  const trails = getTrailsForHub();
  const motion = publicDisclosureMotion(shouldReduceMotion);

  const close = () => setOpen(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        aria-controls={PANEL_ID}
        aria-expanded={open}
        aria-label="Spiritual Trails"
        className={`group relative flex items-center gap-1 overflow-hidden rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ${
          isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
        }`}
        onClick={toggle}
        ref={triggerRef}
        type="button"
      >
        <span className="relative z-10 flex items-center gap-1">
          Spiritual Trails
          <ChevronDown
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            size={14}
          />
        </span>
        <div
          className={`pointer-events-none absolute inset-0 rounded-full bg-white/10 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            animate={motion.animate}
            className="absolute top-full left-0 z-50 mt-2 max-h-[min(70vh,420px)] w-72 overflow-y-auto rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
            exit={motion.exit}
            id={PANEL_ID}
            initial={motion.initial}
            style={motion.style}
            transition={motion.transition}
          >
            <Link
              className="block px-4 py-2.5 font-heading font-medium text-gray-900 text-sm tracking-wide hover:bg-gray-50"
              href="/pilgrimage"
              onClick={close}
            >
              All trails overview
            </Link>
            <div className="my-1 border-gray-100 border-t" />
            {trails.map((t) => (
              <Link
                className="block px-4 py-2 text-gray-600 text-sm hover:bg-gray-50"
                href={`/pilgrimage/${t.slug}`}
                key={t.slug}
                onClick={close}
              >
                <span className="line-clamp-2">{t.title}</span>
                {t.status === "comingSoon" && (
                  <span className="text-[10px] text-amber-700 uppercase tracking-wider">
                    Coming soon
                  </span>
                )}
              </Link>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
