"use client";

import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useSlideshowPlayback } from "./useSlideshowPlayback";

const images = [
  {
    alt: "Inner Peace",
    src: "/gallery/spiritual/yoga-silhouette.webp",
  },
  {
    // Provenance is unverified; this remains atmospheric decoration, not documentary evidence.
    alt: "",
    src: "/gallery/spiritual/varanasi-sunset.webp",
  },
  {
    alt: "Ancient Wisdom",
    src: "/gallery/spiritual/scriptures.webp",
  },
  {
    alt: "Shiva's Drum",
    src: "/gallery/spiritual/damru-hand.webp",
  },
];

const transitionConfig = { duration: 1.5, ease: [0.4, 0, 0.2, 1] };

export default function SpiritualHero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const advance = () => setCurrentIndex((previous) => (previous + 1) % images.length);
  const { isPlaying, sectionRef, togglePlayback } = useSlideshowPlayback({
    intervalMs: 6000,
    itemCount: images.length,
    onAdvance: advance,
  });
  const selectSlide = (event) => {
    const nextIndex = Number(event.currentTarget.dataset.slideIndex);
    if (Number.isInteger(nextIndex)) {
      setCurrentIndex(nextIndex);
    }
  };

  return (
    <section
      className="relative w-full overflow-hidden bg-public-night pt-28 pb-6 md:pt-40 md:pb-10"
      ref={sectionRef}
    >
      {/* Background Slideshow */}
      <AnimatePresence initial={false}>
        <m.div
          animate={{ opacity: 0.6, scale: 1 }}
          className="absolute inset-0 z-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0, scale: 1.1 }}
          key={`img-${currentIndex}`}
          transition={transitionConfig}
        >
          <Image
            alt={images[currentIndex].alt}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={images[currentIndex].src}
          />
        </m.div>
      </AnimatePresence>

      {/* Atmospheric Gradients */}
      <div className="absolute inset-0 z-10 bg-linear-to-b from-public-night/60 via-transparent to-public-night" />
      <div className="absolute inset-0 z-10 bg-linear-to-r from-public-night/40 via-transparent to-transparent" />

      <div className="relative z-20 mx-auto max-w-5xl px-4 pb-10 text-white sm:px-6 md:pb-16 lg:px-8">
        <h1 className="max-w-3xl font-heading text-3xl leading-tight md:text-5xl">
          Kailash Mansarovar with Citius Spiritual Trails
        </h1>
        <p className="mt-4 max-w-2xl text-base text-white/85 leading-relaxed md:text-lg">
          Explore the published 14-day yatra and 2-night aerial darshan programmes.
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-public-orange px-6 py-3 font-medium text-public-ink focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-4"
          href="#journey-details"
        >
          Compare programmes
        </Link>
      </div>

      {/* Navigation Indicators */}
      <div className="relative z-20 mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 sm:px-6 lg:px-8">
        <button
          aria-pressed={isPlaying}
          className="material-floating material-public-night min-h-11 rounded-full border border-white/30 bg-public-night/55 px-4 font-medium text-white text-xs backdrop-blur-sm transition-colors hover:bg-public-night/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
          onClick={togglePlayback}
          type="button"
        >
          {isPlaying ? "Pause slideshow" : "Play slideshow"}
        </button>
        {images.map((image, idx) => (
          <button
            aria-current={idx === currentIndex ? "true" : undefined}
            aria-label={`Go to slide ${idx + 1}`}
            className="group grid min-h-11 min-w-11 place-items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-public-orange focus-visible:outline-offset-2"
            data-slide-index={idx}
            key={image.src}
            onClick={selectSlide}
            type="button"
          >
            <span
              aria-hidden
              className={`h-1 rounded-full transition-[width,background-color] duration-500 motion-reduce:transition-none ${
                idx === currentIndex
                  ? "w-12 bg-public-orange"
                  : "w-4 bg-white/20 fine-hover:group-hover:bg-white/40"
              }`}
              data-slide-indicator-bar
            />
          </button>
        ))}
      </div>
    </section>
  );
}
