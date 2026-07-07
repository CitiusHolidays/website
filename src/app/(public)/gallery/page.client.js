"use client";

import { m } from "motion/react";
import GalleryGrid from "@/components/ui/GalleryGrid";

export default function GalleryPageClient({ images }) {
  return (
    <>
      <section className="relative flex h-[70vh] items-center justify-center overflow-hidden text-center">
        <video
          aria-label="Citius travel gallery background video"
          autoPlay
          className="absolute inset-0 size-full bg-brand-dark object-cover object-center brightness-75"
          loop
          muted
          playsInline
          poster="/gallery/bgfooter.webp"
        >
          <source src="/gallery/sunset.mp4" type="video/mp4" />
        </video>
        <div className="relative z-10 max-w-3xl px-4">
          <m.h1
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 font-bold text-4xl text-brand-light md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Gallery
          </m.h1>
          <m.p
            animate={{ opacity: 1, y: 0 }}
            className="text-brand-light text-lg md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            Browse memorable moments and events curated by Citius across the globe.
          </m.p>
        </div>
      </section>
      {/* <AnimatedSection className="py-16 bg-white px-4"> */}
      <m.div
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-16"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        viewport={{ amount: 0.1, once: true }}
      >
        <GalleryGrid className="mx-auto max-w-6xl" images={images} />
      </m.div>
      {/* </AnimatedSection> */}
    </>
  );
}
