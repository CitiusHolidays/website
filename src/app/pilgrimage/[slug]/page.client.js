"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import TrailSection from "@/components/pilgrimage/TrailSection";

const FALLBACK_HERO = {
  src: "/gallery/spiritual/mansarovar-lake.webp",
  alt: "Lake Mansarovar",
};

export default function PilgrimageTrailPageClient({ trail, relatedBlogPosts }) {
  const hero = trail.heroBackground ?? FALLBACK_HERO;

  return (
    <div className="bg-white min-h-screen">
      <section className="relative min-h-[min(52vh,560px)] md:min-h-[min(58vh,640px)] w-full overflow-hidden">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          className="object-cover z-0"
          sizes="100vw"
          priority
        />
        <div
          className="absolute inset-0 z-10 bg-linear-to-b from-brand-dark/75 via-brand-dark/50 to-brand-dark/88"
          aria-hidden
        />
        <div className="absolute inset-0 z-10 bg-linear-to-r from-brand-dark/60 via-transparent to-brand-dark/40" aria-hidden />

        <div className="relative z-20 pt-28 md:pt-32 pb-12 md:pb-16 px-4 max-w-6xl mx-auto min-h-[inherit] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link
              href="/pilgrimage#all-trails"
              className="inline-flex items-center gap-2 text-sm text-white/85 hover:text-white transition-colors font-medium drop-shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              All spiritual trails
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center md:text-left"
          >
            {trail.status === "comingSoon" && (
              <span className="inline-block mb-3 text-xs font-heading uppercase tracking-wider text-amber-100 bg-amber-500/25 border border-amber-200/40 px-3 py-1 rounded-full backdrop-blur-sm">
                Coming soon
              </span>
            )}
            {trail.tagline && (
              <p className="text-xs md:text-sm font-heading text-citius-orange uppercase tracking-[0.2em] mb-2 drop-shadow-sm">
                {trail.tagline}
              </p>
            )}
            <h1 className="font-heading text-3xl md:text-5xl text-white leading-tight mb-3 drop-shadow-md">
              {trail.title}
            </h1>
            <p className="font-sans text-lg md:text-xl text-white/90 max-w-3xl italic drop-shadow">
              {trail.subtitle}
            </p>
            {trail.positioning && (
              <p className="mt-4 text-sm md:text-base text-white/80 max-w-2xl">{trail.positioning}</p>
            )}
          </motion.div>
        </div>
      </section>

      <TrailSection
        trail={trail}
        relatedBlogPosts={relatedBlogPosts}
        embedded
        isAlternate={false}
        className="pt-0"
      />
    </div>
  );
}
