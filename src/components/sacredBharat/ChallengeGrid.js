"use client";

import Link from "next/link";
import { SACRED_BHARAT_CHALLENGES } from "@/data/sacredBharat/challenges";
import { sortChallengesForUser } from "@/lib/sacredBharat/challenges";
import { useSacredBharatContext } from "./SacredBharatProvider";

export default function ChallengeGrid({ limit }) {
  const { progress } = useSacredBharatContext();
  const challenges = sortChallengesForUser(SACRED_BHARAT_CHALLENGES, progress).slice(
    0,
    limit ?? SACRED_BHARAT_CHALLENGES.length
  );
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {challenges.map((challenge) => (
        <article className="rounded-lg border border-brand-light bg-white p-4" key={challenge.slug}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-brand-dark text-lg">{challenge.title}</h3>
              <p className="mt-1 font-sans text-brand-muted text-sm">{challenge.description}</p>
            </div>
            {challenge.progress.complete ? (
              <span className="rounded-full bg-citius-orange/10 px-2 py-1 font-sans font-semibold text-citius-orange text-xs">
                Badge
              </span>
            ) : null}
          </div>
          <div className="mt-4 h-2 rounded-full bg-brand-light">
            <div
              className="h-full rounded-full bg-citius-blue"
              style={{ width: `${challenge.progress.percent}%` }}
            />
          </div>
          <p className="mt-2 font-sans text-brand-muted text-xs">
            {challenge.progress.visited}/{challenge.progress.total} complete · {challenge.points}{" "}
            pts
          </p>
        </article>
      ))}
      {limit ? (
        <Link
          className="rounded-lg border border-brand-light bg-brand-light/30 p-4 font-heading text-brand-dark hover:border-citius-orange"
          href="/sacred-bharat/challenges"
        >
          View all challenges
        </Link>
      ) : null}
    </div>
  );
}
