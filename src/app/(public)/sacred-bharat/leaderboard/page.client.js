"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GuestSaveBanner from "@/components/sacredBharat/GuestSaveBanner";
import LeaderboardTable from "@/components/sacredBharat/LeaderboardTable";

export default function LeaderboardPageClient() {
  return (
    <div className="min-h-screen bg-[#fdfcfb] pt-28 pb-16 md:pt-32">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          className="mb-8 inline-flex items-center gap-2 text-citius-blue text-sm hover:text-citius-orange"
          href="/sacred-bharat"
        >
          <ArrowLeft className="size-4" />
          Sacred Bharat
        </Link>
        <h1 className="mb-2 font-heading text-3xl text-brand-dark md:text-4xl">
          Yatri leaderboard
        </h1>
        <p className="mb-8 max-w-xl font-sans text-brand-muted">
          Rankings are based on your total soul score , temple visits and trail completion bonuses.
          Sign in to appear on the board.
        </p>
        <GuestSaveBanner className="mb-8" />
        <LeaderboardTable limit={50} />
      </div>
    </div>
  );
}
