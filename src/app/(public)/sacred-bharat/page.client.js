"use client";

import Link from "next/link";
import AnimatedSection from "@/components/layout/AnimatedSection";
import BadgeShelf from "@/components/sacredBharat/BadgeShelf";
import ChallengeGrid from "@/components/sacredBharat/ChallengeGrid";
import GuestSaveBanner from "@/components/sacredBharat/GuestSaveBanner";
import JourneyPlannerPanel from "@/components/sacredBharat/JourneyPlannerPanel";
import LeaderboardTable from "@/components/sacredBharat/LeaderboardTable";
import PilgrimageLegacy from "@/components/sacredBharat/PilgrimageLegacy";
import PrivateGroupPanel from "@/components/sacredBharat/PrivateGroupPanel";
import ProgressSummary from "@/components/sacredBharat/ProgressSummary";
import SacredBharatHero from "@/components/sacredBharat/SacredBharatHero";
import TrailCardGrid from "@/components/sacredBharat/TrailCardGrid";
import YatriPassportProfilePanel from "@/components/sacredBharat/YatriPassportProfilePanel";

export default function SacredBharatPageClient() {
  return (
    <div className="bg-public-paper">
      <SacredBharatHero />

      <section className="border-brand-light border-b py-10 md:py-12">
        <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
          <GuestSaveBanner />
          <YatriPassportProfilePanel />
          <p className="mx-auto max-w-2xl text-center font-sans text-public-muted text-xs">
            Visits are self-declared on an honor system , a personal record of your spiritual
            journey, not verified darshan proof.
          </p>
        </div>
      </section>

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <ProgressSummary />
      </AnimatedSection>

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-12">
        <JourneyPlannerPanel />
      </AnimatedSection>

      <TrailCardGrid />

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-2xl text-public-ink md:text-3xl">Challenges</h2>
            <p className="mt-2 font-sans text-public-muted text-sm">
              Curated goals based on temple visits and trail progress.
            </p>
          </div>
          <Link
            className="font-medium text-citius-blue text-sm hover:text-citius-orange"
            href="/sacred-bharat/challenges"
          >
            All challenges →
          </Link>
        </div>
        <ChallengeGrid limit={5} />
      </AnimatedSection>

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-6 font-heading text-2xl text-public-ink md:text-3xl">Your badges</h2>
            <BadgeShelf />
          </div>
          <div>
            <h2 className="mb-6 font-heading text-2xl text-public-ink md:text-3xl">
              Pilgrimage legacy
            </h2>
            <PilgrimageLegacy />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="mx-auto max-w-6xl px-4 py-12">
        <PrivateGroupPanel />
      </AnimatedSection>

      <section className="border-brand-light border-t bg-public-surface py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-heading text-public-orange-ink text-xs uppercase tracking-[0.3em]">
                Leaderboard
              </span>
              <h2 className="mt-2 font-heading text-2xl text-public-ink md:text-3xl">
                Compare with fellow yatris
              </h2>
            </div>
            <Link
              className="font-medium text-citius-blue text-sm hover:text-citius-orange"
              href="/sacred-bharat/leaderboard"
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
