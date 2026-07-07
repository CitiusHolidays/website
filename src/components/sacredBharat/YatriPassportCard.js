"use client";

import {
  buildPassportShareText,
  buildPublicPassportStats,
  buildRegionSummary,
  buildTrailHighlights,
  resolveTempleName,
} from "@/lib/sacredBharat/yatriPassport";
import YatriRegionMap from "./YatriRegionMap";
import YatriShareCard from "./YatriShareCard";

export default function YatriPassportCard({ passport, currentUrl = "" }) {
  if (!passport) {
    return (
      <div className="rounded-lg border border-brand-light bg-white p-6 text-center">
        <h1 className="font-heading text-2xl text-brand-dark">Passport is private</h1>
        <p className="mt-2 font-sans text-brand-muted text-sm">
          This Yatri Passport is not public or does not exist.
        </p>
      </div>
    );
  }
  const { profile, progress, leaderboardRank } = passport;
  const regions = buildRegionSummary(progress.visitedTempleIds);
  const highlights = buildTrailHighlights(progress);
  const stats = buildPublicPassportStats(progress, leaderboardRank);
  const shareText = buildPassportShareText(profile, progress);

  return (
    <article className="space-y-6">
      <section className="rounded-lg border border-brand-light bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl text-brand-dark">{profile.displayName}</h1>
            <p className="mt-1 font-sans text-brand-muted text-sm">
              {profile.homeCity || "Sacred Bharat Yatri"} · {progress.levelTitle}
            </p>
            {profile.bio && (
              <p className="mt-3 max-w-2xl font-sans text-brand-muted text-sm">{profile.bio}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {stats.map((stat) => (
              <div className="rounded-md bg-brand-light/50 px-3 py-2 text-center" key={stat.label}>
                <p className="font-heading text-brand-dark text-lg">{stat.value}</p>
                <p className="font-sans text-[11px] text-brand-muted uppercase">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-heading text-brand-dark text-xl">Region coverage</h2>
            <YatriRegionMap regions={regions} />
          </div>
          <div className="rounded-lg border border-brand-light bg-white p-4">
            <h2 className="font-heading text-brand-dark text-xl">Trail highlights</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {highlights.map((trail) => (
                <div className="rounded-md bg-brand-light/40 p-3" key={trail.slug}>
                  <p className="font-heading text-brand-dark text-sm">{trail.title}</p>
                  <p className="font-sans text-brand-muted text-xs">
                    {trail.percent}% complete {trail.complete ? "· completed" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="space-y-4">
          {profile.shareRecentVisits && (
            <div className="rounded-lg border border-brand-light bg-white p-4">
              <h2 className="font-heading text-brand-dark text-lg">Recent visits</h2>
              <div className="mt-3 space-y-2">
                {(progress.visits ?? []).map((visit) => (
                  <p
                    className="font-sans text-brand-muted text-sm"
                    key={`${visit.templeId}:${visit.visitedAt}`}
                  >
                    {resolveTempleName(visit.templeId)}
                  </p>
                ))}
              </div>
            </div>
          )}
          <YatriShareCard text={shareText} url={currentUrl} />
        </aside>
      </section>
    </article>
  );
}
