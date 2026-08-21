"use client";

import { m } from "motion/react";
import HeroVideo from "@/components/pages/HeroVideo";
import GalleryGrid from "@/components/ui/GalleryGrid";

const GALLERY_VIDEO_SOURCES = [{ src: "/gallery/sunset.mp4", type: "video/mp4" }];

export default function GalleryPageClient({ images }) {
  return (
    <>
      <section className="relative flex h-[70vh] items-center justify-center overflow-hidden text-center">
        <HeroVideo
          className="absolute inset-0 size-full bg-public-night object-cover object-center brightness-75"
          label="gallery background video"
          poster="/gallery/bgfooter.webp"
          sources={GALLERY_VIDEO_SOURCES}
        />
        <div className="relative z-10 max-w-3xl px-4">
          <m.h1
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 font-bold font-heading text-4xl text-public-surface md:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Gallery
          </m.h1>
          <m.p
            animate={{ opacity: 1, y: 0 }}
            className="text-lg text-public-surface md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          >
            Photos from Citius MICE programmes, corporate events, and travel routes.
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
