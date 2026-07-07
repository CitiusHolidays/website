"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getTrailsForHub } from "@/data/trails";

export function SpiritualTrailsDropdown({ isScrolled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trails = getTrailsForHub();

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
        className={`group relative flex items-center gap-1 overflow-hidden rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ${
          isScrolled ? "text-slate-300 hover:text-white" : "text-white hover:text-white"
        }`}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="relative z-10 flex items-center gap-1">
          Spiritual Trails
          <ChevronDown
            className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            size={14}
          />
        </span>
        <m.div
          className={`pointer-events-none absolute inset-0 rounded-full bg-white/10 transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          layoutId="navHover"
        />
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full left-0 z-50 mt-2 max-h-[min(70vh,420px)] w-72 overflow-y-auto rounded-xl border border-gray-100 bg-white py-2 shadow-xl"
            exit={{ opacity: 0, y: 8 }}
            initial={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
          >
            <Link
              className="block px-4 py-2.5 font-heading font-medium text-gray-900 text-sm tracking-wide hover:bg-gray-50"
              href="/pilgrimage"
              onClick={() => setOpen(false)}
            >
              All trails overview
            </Link>
            <div className="my-1 border-gray-100 border-t" />
            {trails.map((t) => (
              <Link
                className="block px-4 py-2 text-gray-600 text-sm hover:bg-gray-50"
                href={`/pilgrimage/${t.slug}`}
                key={t.slug}
                onClick={() => setOpen(false)}
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
        )}
      </AnimatePresence>
    </div>
  );
}
