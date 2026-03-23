"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft } from "lucide-react";

const FALLBACK_HERO = {
  src: "/gallery/spiritual/mansarovar-lake.webp",
  alt: "Lake Mansarovar"
};

function buildSlides(trail) {
  const seen = new Set();
  const slides = [];

  const push = (src, alt) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    slides.push({ src, alt: alt || "Trail image" });
  };

  if (trail.heroBackground?.src) {
    push(trail.heroBackground.src, trail.heroBackground.alt);
  }

  if (Array.isArray(trail.gallery)) {
    for (const g of trail.gallery) {
      if (g?.src) push(g.src, g.alt);
    }
  }

  if (slides.length === 0) {
    push(FALLBACK_HERO.src, FALLBACK_HERO.alt);
  }

  return slides;
}

export default function TrailHeroSlideshow({ trail }) {
  const slides = useMemo(() => buildSlides(trail), [trail]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const t = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[index] ?? slides[0];
  const transitionConfig = { duration: 1.2, ease: [0.4, 0, 0.2, 1] };

  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden bg-brand-dark">
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={current.src}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 0.6, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="absolute inset-0 z-0"
        >
          <Image
            src={current.src}
            alt={current.alt}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </motion.div>
      </AnimatePresence>

      <div
        className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/60 via-transparent to-brand-dark"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/40 via-transparent to-transparent"
        aria-hidden
      />

      {/* Full-height overlay: back link top, title + slide dots bottom — matches base SpiritualHero viewport */}
      <div className="relative z-20 flex h-full min-h-[700px] flex-col px-4 max-w-6xl mx-auto w-full pt-28 md:pt-32 pb-12 md:pb-16">
        {/* <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="shrink-0">
          <Link
            href="/pilgrimage#all-trails"
            className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors font-medium drop-shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            All spiritual trails
          </Link>
        </motion.div> */}

        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center md:text-left pb-2"
          >
            {trail.status === "comingSoon" && (
              <span className="inline-block mb-3 text-xs font-heading uppercase tracking-wider text-amber-100 bg-amber-500/25 border border-amber-200/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Coming soon
              </span>
            )}
            {trail.tagline && (
              <p className="text-xs md:text-sm font-heading text-citius-orange uppercase tracking-[0.2em] mb-2 drop-shadow-sm line-clamp-2">
                {trail.tagline}
              </p>
            )}
            <h1 className="font-heading text-3xl md:text-5xl text-white leading-tight mb-3 drop-shadow-md">
              {trail.title}
            </h1>
            <p className="font-sans text-lg md:text-xl text-white/90 max-w-3xl italic drop-shadow line-clamp-3 md:line-clamp-none">
              {trail.subtitle}
            </p>
            {trail.positioning && (
              <p className="mt-4 text-sm md:text-base text-white/80 max-w-2xl line-clamp-3">{trail.positioning}</p>
            )}
          </motion.div>

          {slides.length > 1 && (
            <div className="flex justify-center md:justify-start gap-2 mt-6 pb-1">
              {slides.map((s, idx) => (
                <button
                  key={s.src}
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    idx === index ? "w-10 bg-citius-orange" : "w-3 bg-white/25 hover:bg-white/45"
                  }`}
                  aria-label={`Hero image ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
