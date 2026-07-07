"use client";

import { Award, MapPin, Route, Trophy } from "lucide-react";
import Link from "next/link";
import LevelBadge from "./LevelBadge";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function ProgressSummary() {
  const { progress, isLoading } = useSacredBharatContext();

  if (isLoading) {
    return (
      <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div className="h-24 rounded-2xl bg-brand-light" key={i} />
        ))}
      </div>
    );
  }

  const stats = [
    {
      icon: MapPin,
      label: "Sacred sites",
      value: `${progress.templeCount}/${progress.totalTemples}`,
    },
    {
      icon: Route,
      label: "Trails completed",
      value: `${progress.completedTrailCount}/${progress.totalTrails}`,
    },
    {
      icon: Award,
      label: "Badges earned",
      value: String(progress.badges.length),
    },
    {
      icon: Trophy,
      label: "Soul score",
      value: String(progress.score),
      hint:
        progress.challengeBonusTotal > 0
          ? `Temple ${progress.templePointsTotal} + trails ${progress.trailBonusTotal} + challenges ${progress.challengeBonusTotal}`
          : undefined,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LevelBadge level={progress.level} score={progress.score} size="lg" />
        <Link
          className="font-medium text-citius-blue text-sm transition-colors hover:text-citius-orange"
          href="/sacred-bharat/leaderboard"
        >
          View leaderboard →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <div className="rounded-2xl border border-brand-light bg-white p-5 shadow-sm" key={label}>
            <Icon className="mb-3 size-5 text-citius-orange" />
            <p className="font-heading text-2xl text-brand-dark tabular-nums">{value}</p>
            <p className="mt-1 font-sans text-brand-muted text-sm">{label}</p>
            {hint ? <p className="mt-2 font-sans text-[11px] text-brand-muted leading-snug">{hint}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
