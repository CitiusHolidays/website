"use client";

import { ArrowLeft, ExternalLink, Heart } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import GuestSaveBanner from "@/components/sacredBharat/GuestSaveBanner";
import LevelBadge from "@/components/sacredBharat/LevelBadge";
import { useSacredBharatContext } from "@/components/sacredBharat/SacredBharatProvider";
import TempleChecklist from "@/components/sacredBharat/TempleChecklist";
import { REGION_LABELS, REGIONS } from "@/data/sacredBharat/regions";
import { TEMPLES } from "@/data/sacredBharat/temples";
import { cn } from "@/utils/cn";

export default function TrailDetailClient({ trail }) {
  const { progress, toggleWishlist, isWishlisted } = useSacredBharatContext();
  const trailProgress = progress.trails.find((t) => t.slug === trail.slug);
  const isRegionTrail = trail.type === "region";
  const wishlisted = isWishlisted("trail", trail.slug);

  const contactHref = `/contact?interest=sacred-bharat&trail=${encodeURIComponent(trail.slug)}`;

  return (
    <div className="bg-[#fdfcfb] min-h-screen">
      <section className="bg-brand-dark text-white pt-28 pb-12 md:pt-32 md:pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/sacred-bharat"
            className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Sacred Bharat
          </Link>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-3xl mb-4 block" aria-hidden>
              {trail.emoji}
            </span>
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl mb-4">{trail.title}</h1>
            <p className="font-sans text-white/75 max-w-2xl mb-6">
              Complete this trail to earn the{" "}
              <strong className="text-citius-orange">{trail.badgeName}</strong> badge and a{" "}
              <strong>+{trail.completionBonus}</strong> point bonus (plus +25 per temple visited).
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <LevelBadge level={progress.level} score={progress.score} />
              {trailProgress && (
                <span className="text-sm text-white/80 tabular-nums">
                  {trailProgress.visited}/{trailProgress.total} · {trailProgress.percent}%
                  {trailProgress.complete ? " · Complete!" : ""}
                </span>
              )}
            </div>
            <div className="mt-6 h-2 max-w-md rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-citius-orange transition-all duration-500"
                style={{ width: `${trailProgress?.percent ?? 0}%` }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <GuestSaveBanner />

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => toggleWishlist("trail", trail.slug)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              wishlisted
                ? "border-citius-orange bg-citius-orange/10 text-citius-orange"
                : "border-brand-light text-brand-muted hover:border-citius-blue",
            )}
          >
            <Heart className={cn("h-4 w-4", wishlisted && "fill-current")} />
            {wishlisted ? "On wishlist" : "Plan future journey"}
          </button>
          <Link
            href={contactHref}
            className="inline-flex items-center gap-2 rounded-full bg-citius-blue px-4 py-2 text-sm font-medium text-white hover:bg-citius-blue/90"
          >
            Plan with Citius
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>

        {isRegionTrail ? (
          <div className="space-y-8">
            <p className="font-sans text-brand-muted">
              Visit at least one sacred site in each region of Bharat — North, South, East, and West
              — to complete this trail.
            </p>
            {REGIONS.map((region) => (
              <div key={region}>
                <h2 className="font-heading text-xl text-citius-blue mb-4">
                  {REGION_LABELS[region]}
                </h2>
                <TempleChecklist
                  templeIds={TEMPLES.filter((t) => t.region === region).map((t) => t.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <TempleChecklist templeIds={trail.templeIds} />
        )}
      </div>
    </div>
  );
}
