"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, m as motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getTrailsForHub } from "@/data/trails";

export function SpiritualTrailsDropdown({ isScrolled, pathname }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trails = getTrailsForHub();
  const isActive = pathname?.startsWith("/pilgrimage");

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1 rounded-full group overflow-hidden ${
          isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
        }`}
      >
        <span className="relative z-10 flex items-center gap-1">
          Spiritual Trails
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </span>
        <motion.div
          className={`absolute inset-0 bg-white/10 rounded-full transition-opacity duration-200 pointer-events-none ${
            isActive || open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          layoutId="navHover"
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-72 py-2 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[min(70vh,420px)] overflow-y-auto"
          >
            <Link
              href="/pilgrimage"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50 font-heading font-medium tracking-wide"
            >
              All trails overview
            </Link>
            <div className="border-t border-gray-100 my-1" />
            {trails.map((t) => (
              <Link
                key={t.slug}
                href={`/pilgrimage/${t.slug}`}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                <span className="line-clamp-2">{t.title}</span>
                {t.status === "comingSoon" && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-700">
                    Coming soon
                  </span>
                )}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
