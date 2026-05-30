"use client";

import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import BadgeShelf from "@/components/sacredBharat/BadgeShelf";
import FamilyComingSoon from "@/components/sacredBharat/FamilyComingSoon";
import GuestSaveBanner from "@/components/sacredBharat/GuestSaveBanner";
import LeaderboardTable from "@/components/sacredBharat/LeaderboardTable";
import PilgrimageLegacy from "@/components/sacredBharat/PilgrimageLegacy";
import ProgressSummary from "@/components/sacredBharat/ProgressSummary";
import SacredBharatHero from "@/components/sacredBharat/SacredBharatHero";
import TrailCardGrid from "@/components/sacredBharat/TrailCardGrid";

export default function SacredBharatPageClient() {
  return (
    <div className="bg-[#fdfcfb]">
      <SacredBharatHero />

      <section className="py-10 md:py-12 border-b border-brand-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <GuestSaveBanner />
          <p className="font-sans text-xs text-brand-muted text-center max-w-2xl mx-auto">
            Visits are self-declared on an honor system — a personal record of your spiritual
            journey, not verified darshan proof.
          </p>
        </div>
      </section>

      <AnimatedSection className="py-16 md:py-20 px-4 max-w-6xl mx-auto">
        <ProgressSummary />
      </AnimatedSection>

      <TrailCardGrid />

      <AnimatedSection className="py-16 md:py-20 px-4 max-w-6xl mx-auto">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl md:text-3xl text-brand-dark mb-6">Your badges</h2>
            <BadgeShelf />
          </div>
          <div>
            <h2 className="font-heading text-2xl md:text-3xl text-brand-dark mb-6">
              Pilgrimage legacy
            </h2>
            <PilgrimageLegacy />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="py-12 px-4 max-w-6xl mx-auto">
        <FamilyComingSoon />
      </AnimatedSection>

      <section className="py-16 md:py-24 bg-white border-t border-brand-light">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <span className="font-heading text-citius-orange text-xs tracking-[0.3em] uppercase">
                Leaderboard
              </span>
              <h2 className="font-heading text-2xl md:text-3xl text-brand-dark mt-2">
                Compare with fellow yatris
              </h2>
            </div>
            <Link
              href="/sacred-bharat/leaderboard"
              className="text-sm font-medium text-citius-blue hover:text-citius-orange"
            >
              Full leaderboard →
            </Link>
          </div>
          <LeaderboardTable limit={10} />
        </div>
      </section>
    </div>
  );
}
