"use client";

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
          <h1 className="public-enter mb-4 font-bold font-heading text-4xl text-public-surface md:text-5xl">
            Gallery
          </h1>
          <p className="public-enter text-lg text-public-surface [--public-enter-delay:60ms] md:text-xl">
            Photos from Citius MICE programmes, corporate events, and travel routes.
          </p>
        </div>
      </section>
      <div className="bg-[url('/gallery/bgfooter.webp')] bg-center px-4 py-16">
        <GalleryGrid className="mx-auto max-w-6xl" images={images} />
      </div>
    </>
  );
}
