"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { useSlideshowPlayback } from "./useSlideshowPlayback";

const images = [
  {
    alt: "Inner Peace",
    src: "/gallery/spiritual/yoga-silhouette.webp",
    subtitle: "Stillness before the mountain",
    title: "Seek Stillness",
  },
  {
    // Provenance is unverified; this remains atmospheric decoration, not documentary evidence.
    alt: "",
    src: "/gallery/spiritual/varanasi-sunset.webp",
    subtitle: "Evening aarti on the Ganges",
    title: "Varanasi at dusk",
  },
  {
    alt: "Ancient Wisdom",
    src: "/gallery/spiritual/scriptures.webp",
    subtitle: "Echoes of the eternal",
    title: "Timeless Wisdom",
  },
  {
    alt: "Shiva's Drum",
    src: "/gallery/spiritual/damru-hand.webp",
    subtitle: "The dance of creation and dissolution",
    title: "Cosmic Rhythm",
  },
];

const transitionConfig = { duration: 1.5, ease: [0.4, 0, 0.2, 1] };

export default function SpiritualHero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const shouldReduceMotion = !!useReducedMotion();
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
      className="relative min-h-[100dvh] w-full overflow-hidden bg-public-night py-24 md:min-h-[700px]"
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

      {/* Content */}
      <div className="relative z-20 flex min-h-[calc(100dvh-12rem)] items-center justify-center px-6 md:min-h-[calc(700px-12rem)]">
        <div className="max-w-4xl text-center">
          <AnimatePresence initial={false} mode="popLayout">
            <m.div
              animate={{ opacity: 1, transform: "translate3d(0, 0, 0)" }}
              exit={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translate3d(0, -30px, 0)",
              }}
              initial={{
                opacity: 0,
                transform: shouldReduceMotion ? "none" : "translate3d(0, 30px, 0)",
              }}
              key={`text-${currentIndex}`}
              transition={transitionConfig}
            >
              <h1 className="mb-6 font-bold font-heading text-5xl text-white tracking-tight md:text-8xl">
                {images[currentIndex].title}
                <span className="mt-3 block font-medium text-base text-public-orange tracking-normal md:text-xl">
                  Citius Spiritual Trails
                </span>
              </h1>

              <p className="px-4 font-sans text-white/80 text-xl md:text-3xl">
                {images[currentIndex].subtitle}
              </p>
            </m.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Indicators */}
      <div className="absolute right-[max(1rem,var(--safe-area-inset-right))] bottom-[max(1rem,var(--safe-area-inset-bottom))] z-20 flex items-center gap-3 md:right-12 md:bottom-12">
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
