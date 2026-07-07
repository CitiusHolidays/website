"use client";

import { Award } from "lucide-react";
import { TRAILS } from "@/data/sacredBharat/trails";
import { cn } from "@/utils/cn";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function BadgeShelf() {
  const { progress } = useSacredBharatContext();
  const earnedIds = new Set(progress.badges.map((b) => b.badgeId));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {TRAILS.map((trail) => {
        const earned = earnedIds.has(trail.badgeId);
        return (
          <div
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3",
              earned
                ? "border-citius-orange/30 bg-citius-orange/5"
                : "border-brand-light bg-brand-light/20 opacity-60"
            )}
            key={trail.badgeId}
          >
            <span aria-hidden className="text-xl">
              {trail.emoji}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1 font-heading text-brand-dark text-sm">
                {trail.badgeName}
                {earned && <Award className="size-3.5 text-citius-orange" />}
              </p>
              <p className="truncate text-brand-muted text-xs">{trail.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
