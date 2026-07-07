"use client";

import { AnimatePresence, m } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

const images = [
  {
    alt: "Inner Peace",
    src: "/gallery/spiritual/yoga-silhouette.webp",
    subtitle: "A journey of silent transformation",
    title: "Seek Stillness",
  },
  {
    alt: "Varanasi Sunset",
    src: "/gallery/spiritual/varanasi-sunset.webp",
    subtitle: "Where the soul meets the sacred",
    title: "Divine Connection",
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden bg-brand-dark">
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
      <div className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/60 via-transparent to-brand-dark" />
      <div className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div className="max-w-4xl text-center">
          <AnimatePresence initial={false} mode="popLayout">
            <m.div
              animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
              exit={{ filter: "blur(10px)", opacity: 0, y: -30 }}
              initial={{ filter: "blur(10px)", opacity: 0, y: 30 }}
              key={`text-${currentIndex}`}
              transition={transitionConfig}
            >
              <m.span
                animate={{ letterSpacing: "0.5em", opacity: 1 }}
                className="mb-4 block font-medium text-citius-orange text-xs uppercase tracking-[0.5em] md:text-sm"
                initial={{ letterSpacing: "0.2em", opacity: 0 }}
              >
                Citius Spiritual Trails
              </m.span>

              <h1 className="mb-6 font-bold font-heading text-5xl text-white tracking-tight md:text-8xl">
                {images[currentIndex].title}
              </h1>

              <p className="px-4 font-sans text-white/80 text-xl italic md:text-3xl">
                {images[currentIndex].subtitle}
              </p>
            </m.div>
          </AnimatePresence>

          <m.div
            animate={{ opacity: 1 }}
            className="mt-12 flex flex-col items-center gap-6"
            initial={{ opacity: 0 }}
            transition={{ delay: 1, duration: 1 }}
          >
            <div className="h-24 w-px bg-linear-to-b from-citius-orange to-transparent" />
            <p className="font-sans text-sm text-white/50 uppercase tracking-widest">
              Scroll to Begin
            </p>
          </m.div>
        </div>
      </div>

      {/* Navigation Indicators */}
      <div className="absolute right-12 bottom-12 z-20 flex gap-3">
        {images.map((image, idx) => (
          <button
            aria-label={`Go to slide ${idx + 1}`}
            className={`h-1 transition-all duration-500 ${
              idx === currentIndex ? "w-12 bg-citius-orange" : "w-4 bg-white/20 hover:bg-white/40"
            }`}
            key={image.src}
            onClick={() => setCurrentIndex(idx)}
            type="button"
          />
        ))}
      </div>

      {/* Side Label */}
      <div className="absolute top-1/2 left-12 z-20 hidden origin-left -translate-y-1/2 -rotate-90 md:block">
        <p className="whitespace-nowrap font-heading text-white/20 text-xs uppercase tracking-[1em]">
          The Journey Within
        </p>
      </div>
    </section>
  );
}
