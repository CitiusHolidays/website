"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GuestSaveBanner from "@/components/sacredBharat/GuestSaveBanner";
import LeaderboardTable from "@/components/sacredBharat/LeaderboardTable";

export default function LeaderboardPageClient() {
  return (
    <div className="bg-[#fdfcfb] min-h-screen pt-28 md:pt-32 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href="/sacred-bharat"
          className="inline-flex items-center gap-2 text-sm text-citius-blue hover:text-citius-orange mb-8"
        >
          <ArrowLeft className="size-4" />
          Sacred Bharat
        </Link>
        <h1 className="font-heading text-3xl md:text-4xl text-brand-dark mb-2">
          Yatri leaderboard
        </h1>
        <p className="font-sans text-brand-muted mb-8 max-w-xl">
          Rankings are based on your total soul score , temple visits and trail completion bonuses.
          Sign in to appear on the board.
        </p>
        <GuestSaveBanner className="mb-8" />
        <LeaderboardTable limit={50} />
      </div>
    </div>
  );
}
