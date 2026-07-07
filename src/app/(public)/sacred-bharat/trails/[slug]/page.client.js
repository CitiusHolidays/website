"use client";

import { ArrowLeft, ExternalLink, Heart } from "lucide-react";
import { m } from "motion/react";
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
    <div className="min-h-screen bg-[#fdfcfb]">
      <section className="bg-brand-dark pt-28 pb-12 text-white md:pt-32 md:pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Link
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
            href="/sacred-bharat"
          >
            <ArrowLeft className="size-4" />
            Sacred Bharat
          </Link>
          <m.div animate={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }}>
            <span aria-hidden className="mb-4 block text-3xl">
              {trail.emoji}
            </span>
            <h1 className="mb-4 font-heading text-3xl md:text-4xl lg:text-5xl">{trail.title}</h1>
            <p className="mb-6 max-w-2xl font-sans text-white/75">
              Complete this trail to earn the{" "}
              <strong className="text-citius-orange">{trail.badgeName}</strong> badge and a{" "}
              <strong>+{trail.completionBonus}</strong> trail bonus (plus each site's Temple Points).
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
            <div className="mt-6 h-2 max-w-md overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-citius-orange transition-all duration-500"
                style={{ width: `${trailProgress?.percent ?? 0}%` }}
              />
            </div>
          </m.div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <GuestSaveBanner />

        <div className="flex flex-wrap gap-3">
          <button
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium text-sm transition-colors",
              wishlisted
                ? "border-citius-orange bg-citius-orange/10 text-citius-orange"
                : "border-brand-light text-brand-muted hover:border-citius-blue"
            )}
            onClick={() => toggleWishlist("trail", trail.slug)}
            type="button"
          >
            <Heart className={cn("size-4", wishlisted && "fill-current")} />
            {wishlisted ? "On wishlist" : "Plan future journey"}
          </button>
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-citius-blue px-4 py-2 font-medium text-sm text-white hover:bg-citius-blue/90"
            href={contactHref}
          >
            Plan with Citius
            <ExternalLink className="size-4" />
          </Link>
        </div>

        {isRegionTrail ? (
          <div className="space-y-8">
            <p className="font-sans text-brand-muted">
              Visit at least one sacred site in each region of Bharat , North, South, East, and West
              to complete this trail.
            </p>
            {REGIONS.map((region) => (
              <div key={region}>
                <h2 className="mb-4 font-heading text-citius-blue text-xl">
                  {REGION_LABELS[region]}
                </h2>
                <TempleChecklist
                  templeIds={TEMPLES.flatMap((temple) =>
                    temple.region === region ? [temple.id] : []
                  )}
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
