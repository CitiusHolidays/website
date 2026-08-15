"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import LevelBadge from "./LevelBadge";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function SacredBharatHero() {
  const { progress, isLoading } = useSacredBharatContext();

  return (
    <section className="relative flex min-h-[52vh] items-end overflow-hidden bg-public-night md:min-h-[58vh]">
      <div className="absolute inset-0 bg-linear-to-br from-public-night via-public-night/90 to-public-orange/35" />
      <div className="absolute inset-0 bg-linear-to-t from-public-night via-public-night/70 to-transparent" />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-28 pb-14 sm:px-6 md:pt-36 md:pb-20 lg:px-8">
        <div>
          <span className="mb-4 block font-heading text-public-orange text-xs uppercase tracking-[0.35em] md:text-sm">
            India&apos;s gamified spiritual travel platform
          </span>
          <h1 className="mb-4 max-w-3xl font-heading text-4xl text-white leading-tight md:text-5xl lg:text-6xl">
            Sacred Bharat
            <span className="mt-2 block font-normal text-2xl text-white/80 italic md:text-3xl">
              Journey of the Soul
            </span>
          </h1>
          <p className="mb-5 font-sans text-white/60 text-xs uppercase tracking-[0.2em]">
            by Citius Holidays
          </p>
          <p className="mb-8 max-w-2xl font-sans text-base text-white/75 leading-relaxed md:text-lg">
            Mark temples visited, complete spiritual trails, earn badges, and build your digital
            pilgrimage legacy — free to track; sign in to save and compare with fellow yatris.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {!isLoading && <LevelBadge level={progress.level} score={progress.score} size="lg" />}
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-public-orange px-6 py-3 font-medium text-public-night text-sm transition-colors hover:bg-public-orange/90"
              href="#trails"
            >
              <Sparkles size={18} />
              Explore trails
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 font-medium text-sm text-white transition-colors hover:bg-white/10"
              href="/pilgrimage"
            >
              Book with Citius
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
