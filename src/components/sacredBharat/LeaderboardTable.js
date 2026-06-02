"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Trophy } from "lucide-react";
import { cn } from "@/utils/cn";

export default function LeaderboardTable({ limit = 50 }) {
  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(
    isAuthenticated ? api.sacredBharat.getLeaderboardWithMe : api.sacredBharat.getLeaderboard,
    isAuthenticated ? { limit } : { limit },
  );

  if (data === undefined) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-brand-light" />
        ))}
      </div>
    );
  }

  const entries = isAuthenticated ? data.entries : data;
  const myRank = isAuthenticated ? data.myRank : null;

  if (!entries?.length) {
    return (
      <p className="font-sans text-brand-muted text-center py-8">
        Be the first yatri on the leaderboard , mark a temple and sign in to save.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {myRank && (
        <div className="rounded-2xl border border-citius-blue/25 bg-citius-blue/5 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-citius-orange" />
            <span className="font-heading text-brand-dark">Your rank</span>
          </div>
          <p className="font-sans text-sm text-brand-muted">
            #{myRank.rank} of {myRank.totalPlayers} · {myRank.score} pts · {myRank.levelTitle}
            {myRank.percentile != null && ` · Top ${myRank.percentile}%`}
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-brand-light">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-light bg-brand-light/40">
              <th className="px-4 py-3 font-heading text-brand-muted">Rank</th>
              <th className="px-4 py-3 font-heading text-brand-muted">Yatri</th>
              <th className="px-4 py-3 font-heading text-brand-muted hidden sm:table-cell">
                Temples
              </th>
              <th className="px-4 py-3 font-heading text-brand-muted">Score</th>
              <th className="px-4 py-3 font-heading text-brand-muted hidden md:table-cell">
                Title
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr
                key={row.rank}
                className={cn(
                  "border-b border-brand-light/80 last:border-0",
                  row.isCurrentUser && "bg-citius-orange/8",
                )}
              >
                <td className="px-4 py-3 font-medium tabular-nums text-citius-blue">{row.rank}</td>
                <td className="px-4 py-3 font-medium text-brand-dark">
                  {row.displayName}
                  {row.isCurrentUser && (
                    <span className="ml-2 text-xs text-citius-orange">(you)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-brand-muted hidden sm:table-cell tabular-nums">
                  {row.templeCount}
                </td>
                <td className="px-4 py-3 tabular-nums font-medium">{row.score}</td>
                <td className="px-4 py-3 text-brand-muted hidden md:table-cell">
                  {row.levelTitle}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
