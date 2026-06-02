"use client";

import { Award, MapPin, Route, Trophy } from "lucide-react";
import Link from "next/link";
import LevelBadge from "./LevelBadge";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function ProgressSummary() {
  const { progress, isLoading } = useSacredBharatContext();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-brand-light" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Sacred sites",
      value: `${progress.templeCount}/${progress.totalTemples}`,
      icon: MapPin,
    },
    {
      label: "Trails completed",
      value: `${progress.completedTrailCount}/${progress.totalTrails}`,
      icon: Route,
    },
    {
      label: "Badges earned",
      value: String(progress.badges.length),
      icon: Award,
    },
    {
      label: "Soul score",
      value: String(progress.score),
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LevelBadge level={progress.level} score={progress.score} size="lg" />
        <Link
          href="/sacred-bharat/leaderboard"
          className="text-sm font-medium text-citius-blue hover:text-citius-orange transition-colors"
        >
          View leaderboard →
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-brand-light bg-white p-5 shadow-sm">
            <Icon className="size-5 text-citius-orange mb-3" />
            <p className="font-heading text-2xl text-brand-dark tabular-nums">{value}</p>
            <p className="font-sans text-sm text-brand-muted mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
