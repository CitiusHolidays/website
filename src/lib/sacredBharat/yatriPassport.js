import { REGIONS } from "../../data/sacredBharat/regions";
import { TEMPLE_BY_ID, TEMPLES } from "../../data/sacredBharat/temples";
import { getChallengeBadgeAwards } from "./challenges";

export function buildRegionSummary(visitedTempleIds = []) {
  const visited = new Set(visitedTempleIds);
  return REGIONS.map((region) => {
    const temples = TEMPLES.filter((temple) => temple.region === region);
    const count = temples.filter((temple) => visited.has(temple.id)).length;
    return {
      region,
      visited: count,
      total: temples.length,
      percent: temples.length ? Math.round((count / temples.length) * 100) : 0,
      states: [
        ...new Set(temples.flatMap((temple) => (visited.has(temple.id) ? [temple.state] : []))),
      ],
    };
  });
}

export function buildTrailHighlights(progress = {}) {
  return (progress.trails ?? [])
    .filter((trail) => trail.complete || trail.percent >= 50)
    .toSorted((a, b) => Number(b.complete) - Number(a.complete) || b.percent - a.percent)
    .slice(0, 6);
}

export function buildPassportShareText(profile = {}, progress = {}) {
  const name = profile.displayName || "A Sacred Bharat yatri";
  return `${name} has marked ${progress.templeCount ?? 0} Sacred Bharat visits and completed ${progress.completedTrailCount ?? 0} trails.`;
}

export function buildPublicPassportStats(progress = {}, leaderboardRank = null) {
  return [
    { label: "Temples", value: progress.templeCount ?? 0 },
    { label: "Score", value: progress.score ?? 0 },
    { label: "Trails", value: progress.completedTrailCount ?? 0 },
    { label: "Rank", value: leaderboardRank?.rank ? `#${leaderboardRank.rank}` : "Private" },
    { label: "Challenges", value: getChallengeBadgeAwards(progress).length },
  ];
}

export function resolveTempleName(templeId) {
  return TEMPLE_BY_ID[templeId]?.name ?? templeId;
}
