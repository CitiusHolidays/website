"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { cn } from "@/utils/cn";

export default function LeaderboardTable({ limit = 50 }) {
  const { isAuthenticated } = useConvexAuth();
  const data = useQuery(
    isAuthenticated ? api.sacredBharat.getLeaderboardWithMe : api.sacredBharat.getLeaderboard,
    isAuthenticated ? { limit } : { limit }
  );

  if (data === undefined) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div className="h-12 rounded-xl bg-brand-light" key={i} />
        ))}
      </div>
    );
  }

  const entries = isAuthenticated ? data.entries : data;
  const myRank = isAuthenticated ? data.myRank : null;

  if (!entries?.length) {
    return (
      <p className="py-8 text-center font-sans text-brand-muted">
        Be the first yatri on the leaderboard , mark a temple and sign in to save.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {myRank && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-citius-blue/25 bg-citius-blue/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="size-5 text-citius-orange" />
            <span className="font-heading text-brand-dark">Your rank</span>
          </div>
          <p className="font-sans text-brand-muted text-sm">
            #{myRank.rank} of {myRank.totalPlayers} · {myRank.score} pts · {myRank.levelTitle}
            {myRank.percentile != null && ` · Top ${myRank.percentile}%`}
          </p>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-brand-light">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-brand-light border-b bg-brand-light/40">
              <th className="px-4 py-3 font-heading text-brand-muted">Rank</th>
              <th className="px-4 py-3 font-heading text-brand-muted">Yatri</th>
              <th className="hidden px-4 py-3 font-heading text-brand-muted sm:table-cell">
                Temples
              </th>
              <th className="px-4 py-3 font-heading text-brand-muted">Score</th>
              <th className="hidden px-4 py-3 font-heading text-brand-muted md:table-cell">
                Title
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr
                className={cn(
                  "border-brand-light/80 border-b last:border-0",
                  row.isCurrentUser && "bg-citius-orange/8"
                )}
                key={row.rank}
              >
                <td className="px-4 py-3 font-medium text-citius-blue tabular-nums">{row.rank}</td>
                <td className="px-4 py-3 font-medium text-brand-dark">
                  {row.passportSlug ? (
                    <Link
                      className="text-citius-blue hover:text-citius-orange"
                      href={`/sacred-bharat/yatris/${row.passportSlug}`}
                    >
                      {row.displayName}
                    </Link>
                  ) : (
                    row.displayName
                  )}
                  {row.isCurrentUser && (
                    <span className="ml-2 text-citius-orange text-xs">(you)</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-brand-muted tabular-nums sm:table-cell">
                  {row.templeCount}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums">{row.score}</td>
                <td className="hidden px-4 py-3 text-brand-muted md:table-cell">
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
