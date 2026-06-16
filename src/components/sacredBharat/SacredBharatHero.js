"use client";

import { m } from "motion/react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import LevelBadge from "./LevelBadge";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function SacredBharatHero() {
  const { progress, isLoading } = useSacredBharatContext();

  return (
    <section className="relative min-h-[52vh] md:min-h-[58vh] flex items-end overflow-hidden bg-brand-dark">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{
          backgroundImage: "linear-gradient(135deg, #1a2744 0%, #2d4a6f 40%, #8b4513 100%)",
        }}
      />
      <div className="absolute inset-0 bg-linear-to-t from-brand-dark via-brand-dark/70 to-transparent" />
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 md:pb-20 pt-28 md:pt-36">
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="font-heading text-citius-orange text-xs md:text-sm tracking-[0.35em] uppercase mb-4 block">
            India&apos;s gamified spiritual travel platform
          </span>
          <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl text-white mb-4 leading-tight max-w-3xl">
            Sacred Bharat
            <span className="block text-2xl md:text-3xl text-white/80 italic mt-2 font-normal">
              Journey of the Soul™
            </span>
          </h1>
          <p className="font-sans text-base md:text-lg text-white/75 max-w-2xl leading-relaxed mb-8">
            Mark temples visited, complete spiritual trails, earn badges, and build your digital
            pilgrimage legacy , free to track, sign in to save and compare with fellow yatris.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {!isLoading && <LevelBadge level={progress.level} score={progress.score} size="lg" />}
            <Link
              href="#trails"
              className="inline-flex items-center gap-2 rounded-full bg-citius-orange px-6 py-3 text-sm font-medium text-white hover:bg-citius-orange/90 transition-colors"
            >
              <Sparkles size={18} />
              Explore trails
            </Link>
            <Link
              href="/pilgrimage"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              Book with Citius
            </Link>
          </div>
        </m.div>
      </div>
    </section>
  );
}
