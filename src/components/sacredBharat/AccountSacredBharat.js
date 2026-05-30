"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Award, MapPin, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { clearGuestDraft, readGuestDraft } from "@/lib/sacredBharat/guestStorage";
import { computeProgress } from "@/lib/sacredBharat/scoring";

export default function AccountSacredBharat() {
  const serverProgress = useQuery(api.sacredBharat.getMyProgress, {});
  const rank = useQuery(api.sacredBharat.getMyLeaderboardRank, {});
  const mergeGuest = useMutation(api.sacredBharat.mergeGuestProgress);
  const mergeAttempted = useRef(false);

  useEffect(() => {
    if (mergeAttempted.current) return;
    const draft = readGuestDraft();
    if (draft.templeIds.length === 0) return;
    mergeAttempted.current = true;
    mergeGuest({ templeIds: draft.templeIds })
      .then(() => clearGuestDraft())
      .catch(() => {
        mergeAttempted.current = false;
      });
  }, [mergeGuest]);

  if (serverProgress === undefined) {
    return <div className="animate-pulse h-48 rounded-3xl bg-gray-100" />;
  }

  const templeIds = serverProgress?.visitedTempleIds ?? [];
  const progress = computeProgress(templeIds);

  return (
    <div className="bg-white rounded-3xl shadow-xl shadow-[#0B1026]/5 overflow-hidden">
      <div className="p-8 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#d4af37] mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-medium uppercase tracking-[0.2em]">Sacred Bharat</span>
          </div>
          <h2 className="font-heading text-2xl text-[#0B1026]">Journey of the Soul™</h2>
          <p className="text-gray-500 font-light mt-1">
            {progress.level.title} · {progress.score} points
          </p>
        </div>
        <Link
          href="/sacred-bharat"
          className="inline-flex items-center gap-2 rounded-full bg-[#0B1026] text-white px-5 py-2.5 text-sm hover:bg-[#1a2c4e] transition-colors"
        >
          Continue journey
        </Link>
      </div>
      <div className="p-8 grid gap-6 sm:grid-cols-3">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#0B1026]/40" />
          <div>
            <p className="text-2xl font-heading text-[#0B1026] tabular-nums">
              {progress.templeCount}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Temples</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-[#0B1026]/40" />
          <div>
            <p className="text-2xl font-heading text-[#0B1026] tabular-nums">
              {progress.badges.length}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Badges</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#0B1026]/40" />
          <div>
            <p className="text-2xl font-heading text-[#0B1026] tabular-nums">
              {rank?.rank ? `#${rank.rank}` : "—"}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Leaderboard</p>
          </div>
        </div>
      </div>
      {progress.completedTrailCount > 0 && (
        <div className="px-8 pb-8">
          <p className="text-sm text-gray-500">
            {progress.completedTrailCount} of {progress.totalTrails} trails completed
          </p>
        </div>
      )}
    </div>
  );
}
