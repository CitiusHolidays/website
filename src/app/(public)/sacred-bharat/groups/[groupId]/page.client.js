"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";

export default function SacredBharatGroupPageClient({ groupId }) {
  const data = useQuery(api.sacredBharat.getGroupLeaderboard, { groupId });
  return (
    <main className="min-h-screen bg-[#fdfcfb] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {data === undefined ? (
          <div className="h-48 animate-pulse rounded-lg bg-brand-light" />
        ) : (
          <div className="space-y-5">
            <section className="rounded-lg border border-brand-light bg-white p-5">
              <h1 className="font-heading text-2xl text-brand-dark">{data.group.name}</h1>
              <p className="mt-1 font-sans text-brand-muted text-sm">
                Invite code: <span className="font-semibold">{data.group.inviteCode}</span>
              </p>
            </section>
            <section className="overflow-hidden rounded-lg border border-brand-light bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-light/50">
                  <tr>
                    <th className="px-4 py-3 font-heading text-brand-muted">Rank</th>
                    <th className="px-4 py-3 font-heading text-brand-muted">Yatri</th>
                    <th className="px-4 py-3 font-heading text-brand-muted">Temples</th>
                    <th className="px-4 py-3 font-heading text-brand-muted">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr className="border-brand-light border-t" key={entry.authUserId}>
                      <td className="px-4 py-3 tabular-nums">{entry.rank}</td>
                      <td className="px-4 py-3 font-medium text-brand-dark">
                        {entry.displayName}
                        {entry.isCurrentUser ? " (you)" : ""}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{entry.templeCount}</td>
                      <td className="px-4 py-3 tabular-nums">{entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
