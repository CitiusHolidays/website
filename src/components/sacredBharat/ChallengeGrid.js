"use client";

import Link from "next/link";
import { SACRED_BHARAT_CHALLENGES } from "@/data/sacredBharat/challenges";
import { sortChallengesForUser } from "@/lib/sacredBharat/challenges";
import { useSacredBharat } from "@/lib/sacredBharat/useSacredBharat";

export default function ChallengeGrid({ limit }) {
  const { progress } = useSacredBharat();
  const challenges = sortChallengesForUser(SACRED_BHARAT_CHALLENGES, progress).slice(
    0,
    limit ?? SACRED_BHARAT_CHALLENGES.length,
  );
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => (
        <article key={challenge.slug} className="rounded-lg border border-brand-light bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg text-brand-dark">{challenge.title}</h3>
              <p className="mt-1 font-sans text-sm text-brand-muted">{challenge.description}</p>
            </div>
            {challenge.progress.complete && (
              <span className="rounded-full bg-citius-orange/10 px-2 py-1 font-sans text-xs font-semibold text-citius-orange">
                Badge
              </span>
            )}
          </div>
          <div className="mt-4 h-2 rounded-full bg-brand-light">
            <div
              className="h-full rounded-full bg-citius-blue"
              style={{ width: `${challenge.progress.percent}%` }}
            />
          </div>
          <p className="mt-2 font-sans text-xs text-brand-muted">
            {challenge.progress.visited}/{challenge.progress.total} complete · {challenge.points}{" "}
            pts
          </p>
        </article>
      ))}
      {limit && (
        <Link
          href="/sacred-bharat/challenges"
          className="rounded-lg border border-brand-light bg-brand-light/30 p-4 font-heading text-brand-dark hover:border-citius-orange"
        >
          View all challenges
        </Link>
      )}
    </div>
  );
}
