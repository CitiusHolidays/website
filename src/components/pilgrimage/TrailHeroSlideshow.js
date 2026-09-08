"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getPilgrimageTrailContactHref } from "@/data/trails";
import { useSlideshowPlayback } from "./useSlideshowPlayback";

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
  const advance = () => setIndex((previous) => (previous + 1) % slides.length);
  const { isPlaying, sectionRef, togglePlayback } = useSlideshowPlayback({
    intervalMs: 5500,
    itemCount: slides.length,
    onAdvance: advance,
  });
  const selectSlide = (event) => {
    const nextIndex = Number(event.currentTarget.dataset.slideIndex);
    if (Number.isInteger(nextIndex)) {
      setIndex(nextIndex);
    }
  };

  const current = slides[index] ?? slides[0];
  const quickFacts = Object.entries(trail.quickFacts || {}).filter(
    ([, value]) =>
      trail.status !== "comingSoon" ||
      !["TBC", "To be announced", "Festival calendar TBC"].includes(value)
  );
  return (
    <section className="relative w-full overflow-hidden bg-public-night" ref={sectionRef}>
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

      <div className="relative z-20 mx-auto w-full max-w-6xl px-4 pt-24 pb-6 sm:px-6 md:pt-28 md:pb-10 lg:px-8">
        <Link
          className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm text-white/85 hover:text-white focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
          href="/pilgrimage#journey-details"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All spiritual trails
        </Link>
        <div>
          <h1 className="max-w-3xl font-heading text-2xl text-white leading-tight md:text-4xl">
            {trail.title}
          </h1>
          {trail.status === "comingSoon" && (
            <p className="mt-3 max-w-2xl text-sm text-white/90 leading-relaxed">
              Coming soon. Programme details and dates are under review; booking is not open.
            </p>
          )}
          <dl className="mt-5 grid max-w-3xl grid-cols-2 gap-x-5 gap-y-3 text-sm md:grid-cols-3 md:gap-y-4">
            {quickFacts.map(([key, value]) => (
              <div className={key === "route" ? "col-span-2 md:col-span-3" : "min-w-0"} key={key}>
                <dt className="text-white/70 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </dt>
                <dd className="mt-0.5 font-medium text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-public-orange px-6 py-3 font-medium text-public-ink focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-4"
            href={getPilgrimageTrailContactHref("enquiry", trail.slug)}
          >
            Enquire
            <ArrowRight aria-hidden className="size-4" />
          </Link>

          {slides.length > 1 && (
            <div className="mt-5 flex max-w-full flex-col items-start gap-2 pb-1 md:flex-row md:items-center">
              <button
                aria-pressed={isPlaying}
                className="material-floating material-public-night min-h-11 rounded-full border border-white/30 bg-brand-dark/55 px-4 font-medium text-white text-xs backdrop-blur-sm transition-colors hover:bg-brand-dark/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-orange focus-visible:outline-offset-2"
                onClick={togglePlayback}
                type="button"
              >
                {isPlaying ? "Pause slideshow" : "Play slideshow"}
              </button>
              <fieldset
                aria-label="Slideshow images"
                className="m-0 flex min-w-0 max-w-full items-center gap-2 overflow-x-auto border-0 px-1 py-2"
              >
                {slides.map((s, idx) => (
                  <button
                    aria-current={idx === index ? "true" : undefined}
                    aria-label={`Hero image ${idx + 1}`}
                    className="group grid min-h-11 min-w-11 shrink-0 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
                    data-slide-index={idx}
                    key={s.src}
                    onClick={selectSlide}
                    type="button"
                  >
                    <span
                      aria-hidden
                      className={`h-1 rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none ${
                        idx === index
                          ? "w-10 bg-public-orange"
                          : "w-3 bg-white/25 fine-hover:group-hover:bg-white/45"
                      }`}
                      data-slide-indicator-bar
                    />
                  </button>
                ))}
              </fieldset>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
