"use client";

import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

const FALLBACK_HERO = {
  alt: "Lake Mansarovar",
  src: "/gallery/spiritual/mansarovar-lake.webp",
};

const transitionConfig = { duration: 1.2, ease: [0.4, 0, 0.2, 1] };

function buildSlides(trail) {
  const seen = new Set();
  const slides = [];

  const push = (src, alt) => {
    if (!src || seen.has(src)) {
      return;
    }
    seen.add(src);
    slides.push({ alt: alt || "Trail image", src });
  };

  if (trail.heroBackground?.src) {
    push(trail.heroBackground.src, trail.heroBackground.alt);
  }

  if (Array.isArray(trail.gallery)) {
    for (const g of trail.gallery) {
      if (g?.src) {
        push(g.src, g.alt);
      }
    }
  }

  if (slides.length === 0) {
    push(FALLBACK_HERO.src, FALLBACK_HERO.alt);
  }

  return slides;
}

export default function TrailHeroSlideshow({ trail }) {
  const slides = buildSlides(trail);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }
    const t = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[index] ?? slides[0];
  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden bg-brand-dark">
      <AnimatePresence initial={false} mode="sync">
        <m.div
          animate={{ opacity: 0.6, scale: 1 }}
          className="absolute inset-0 z-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0, scale: 1.06 }}
          key={current.src}
          transition={transitionConfig}
        >
          <Image
            alt={current.alt}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={current.src}
          />
        </m.div>
      </AnimatePresence>

      <div
        aria-hidden
        className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/60 via-transparent to-brand-dark"
      />
      <div
        aria-hidden
        className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/40 via-transparent to-transparent"
      />

      {/* Full-height overlay: back link top, title + slide dots bottom — matches base SpiritualHero viewport */}
      <div className="relative z-20 mx-auto flex h-full min-h-[700px] w-full max-w-6xl flex-col px-4 pt-28 pb-12 md:pt-32 md:pb-16">
        {/* <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="shrink-0">
          <Link
            href="/pilgrimage#all-trails"
            className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors font-medium drop-shadow-sm"
          >
            <ArrowLeft className="size-4" />
            All spiritual trails
          </Link>
        </m.div> */}

        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="pb-2 text-center md:text-left"
            initial={{ opacity: 0, y: 12 }}
            transition={{ delay: 0.05 }}
          >
            {trail.status === "comingSoon" && (
              <span className="mb-3 inline-block rounded-full border border-amber-200/40 bg-amber-500/25 px-3 py-1 font-heading text-amber-100 text-xs uppercase tracking-wider backdrop-blur-sm">
                Coming soon
              </span>
            )}
            {trail.tagline && (
              <p className="mb-2 line-clamp-2 font-heading text-citius-orange text-xs uppercase tracking-[0.2em] drop-shadow-sm md:text-sm">
                {trail.tagline}
              </p>
            )}
            <h1 className="mb-3 font-heading text-3xl text-white leading-tight drop-shadow-md md:text-5xl">
              {trail.title}
            </h1>
            <p className="line-clamp-3 max-w-3xl font-sans text-lg text-white/90 italic drop-shadow md:line-clamp-none md:text-xl">
              {trail.subtitle}
            </p>
            {trail.positioning && (
              <p className="mt-4 line-clamp-3 max-w-2xl text-sm text-white/80 md:text-base">
                {trail.positioning}
              </p>
            )}
          </m.div>

          {slides.length > 1 && (
            <div className="mt-6 flex justify-center gap-2 pb-1 md:justify-start">
              {slides.map((s, idx) => (
                <button
                  aria-label={`Hero image ${idx + 1}`}
                  className={`h-1 rounded-full transition-[width,background-color] duration-500 ${
                    idx === index ? "w-10 bg-citius-orange" : "w-3 bg-white/25 hover:bg-white/45"
                  }`}
                  key={s.src}
                  onClick={() => setIndex(idx)}
                  type="button"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
