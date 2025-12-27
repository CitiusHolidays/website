"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";

const images = [
  {
    src: "/gallery/spiritual/yoga-silhouette.png",
    alt: "Inner Peace",
    title: "Seek Stillness",
    subtitle: "A journey of silent transformation"
  },
  {
    src: "/gallery/spiritual/varanasi-sunset.png",
    alt: "Varanasi Sunset",
    title: "Divine Connection",
    subtitle: "Where the soul meets the sacred"
  },
  {
    src: "/gallery/spiritual/scriptures.png",
    alt: "Ancient Wisdom",
    title: "Timeless Wisdom",
    subtitle: "Echoes of the eternal"
  },
  {
    src: "/gallery/spiritual/damru-hand.png",
    alt: "Shiva's Drum",
    title: "Cosmic Rhythm",
    subtitle: "The dance of creation and dissolution"
  }
];

export default function SpiritualHero() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const transitionConfig = { duration: 1.5, ease: [0.4, 0, 0.2, 1] };

  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden bg-brand-dark">
      {/* Background Slideshow */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`img-${currentIndex}`}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.6, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={transitionConfig}
          className="absolute inset-0 z-0"
        >
          <Image
            src={images[currentIndex].src}
            alt={images[currentIndex].alt}
            fill
            className="object-cover"
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* Atmospheric Gradients */}
      <div className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/60 via-transparent to-brand-dark" />
      <div className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/40 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-20 flex h-full items-center justify-center px-6">
        <div className="max-w-4xl text-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`text-${currentIndex}`}
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -30, filter: "blur(10px)" }}
              transition={transitionConfig}
            >
              <motion.span 
                initial={{ opacity: 0, letterSpacing: "0.2em" }}
                animate={{ opacity: 1, letterSpacing: "0.5em" }}
                className="mb-4 block text-xs font-medium uppercase tracking-[0.5em] text-citius-orange md:text-sm"
              >
                Citius Spiritual Trails
              </motion.span>
              
              <h1 className="font-heading mb-6 text-5xl font-bold tracking-tight text-white md:text-8xl">
                {images[currentIndex].title}
              </h1>
              
              <p className="font-sans text-xl italic text-white/80 md:text-3xl px-4">
                {images[currentIndex].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="mt-12 flex flex-col items-center gap-6"
          >
            <div className="h-24 w-px bg-linear-to-b from-citius-orange to-transparent" />
            <p className="font-sans text-sm uppercase tracking-widest text-white/50">
              Scroll to Begin
            </p>
          </motion.div>
        </div>
      </div>

      {/* Navigation Indicators */}
      <div className="absolute bottom-12 right-12 z-20 flex gap-3">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`h-1 transition-all duration-500 ${
              idx === currentIndex ? "w-12 bg-citius-orange" : "w-4 bg-white/20 hover:bg-white/40"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Side Label */}
      <div className="absolute left-12 top-1/2 z-20 hidden -translate-y-1/2 -rotate-90 origin-left md:block">
        <p className="font-heading text-xs tracking-[1em] text-white/20 uppercase whitespace-nowrap">
          The Journey Within
        </p>
      </div>
    </section>
  );
}
