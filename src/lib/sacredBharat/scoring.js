import { LEVELS, POINTS_PER_TEMPLE } from "@/data/sacredBharat/levels";
import { REGIONS } from "@/data/sacredBharat/regions";
import { TEMPLE_BY_ID, TEMPLES } from "@/data/sacredBharat/temples";
import { TRAILS } from "@/data/sacredBharat/trails";

/**
 * @param {string[] | Set<string>} templeIds
 */
export function normalizeVisitedSet(templeIds) {
  if (templeIds instanceof Set) {
    return new Set([...templeIds].filter((id) => TEMPLE_BY_ID[id]));
  }
  return new Set((templeIds || []).filter((id) => TEMPLE_BY_ID[id]));
}

/**
 * Bharat Explorer: at least one visited temple per region.
 */
export function isBharatExplorerComplete(visitedSet) {
  return REGIONS.every((region) =>
    TEMPLES.some((t) => t.region === region && visitedSet.has(t.id)),
  );
}

/**
 * @param {import('@/data/sacredBharat/trails').TRAILS[number]} trail
 * @param {Set<string>} visitedSet
 */
export function isTrailComplete(trail, visitedSet) {
  if (trail.type === "region") {
    return isBharatExplorerComplete(visitedSet);
  }
  return trail.templeIds.every((id) => visitedSet.has(id));
}

/**
 * @param {import('@/data/sacredBharat/trails').TRAILS[number]} trail
 * @param {Set<string>} visitedSet
 */
export function getTrailProgress(trail, visitedSet) {
  if (trail.type === "region") {
    const completedRegions = REGIONS.filter((region) =>
      TEMPLES.some((t) => t.region === region && visitedSet.has(t.id)),
    );
    return {
      visited: completedRegions.length,
      total: REGIONS.length,
      percent: Math.round((completedRegions.length / REGIONS.length) * 100),
      completedRegions,
    };
  }
  const visited = trail.templeIds.filter((id) => visitedSet.has(id)).length;
  const total = trail.templeIds.length;
  return {
    visited,
    total,
    percent: total === 0 ? 0 : Math.round((visited / total) * 100),
    completedRegions: [],
  };
}

/**
 * @param {string[] | Set<string>} templeIds
 */
export function computeScore(templeIds) {
  const visitedSet = normalizeVisitedSet(templeIds);
  let score = visitedSet.size * POINTS_PER_TEMPLE;

  for (const trail of TRAILS) {
    if (isTrailComplete(trail, visitedSet)) {
      score += trail.completionBonus;
    }
  }

  return score;
}

/**
 * @param {number} score
 */
export function getLevelForScore(score) {
  const match =
    LEVELS.find(
      (level) => score >= level.minScore && (level.maxScore === null || score <= level.maxScore),
    ) ?? LEVELS[0];
  return match;
}

/**
 * @param {string[] | Set<string>} templeIds
 */
export function computeProgress(templeIds) {
  const visitedSet = normalizeVisitedSet(templeIds);
  const score = computeScore(visitedSet);
  const level = getLevelForScore(score);

  const trails = TRAILS.map((trail) => {
    const progress = getTrailProgress(trail, visitedSet);
    const complete = isTrailComplete(trail, visitedSet);
    return {
      slug: trail.slug,
      title: trail.title,
      emoji: trail.emoji,
      ...progress,
      complete,
      completionBonus: trail.completionBonus,
      badgeId: trail.badgeId,
      badgeName: trail.badgeName,
    };
  });

  const badges = trails
    .filter((t) => t.complete)
    .map((t) => ({
      badgeId: t.badgeId,
      badgeName: t.badgeName,
      trailSlug: t.slug,
    }));

  const completedTrailCount = trails.filter((t) => t.complete).length;

  return {
    visitedTempleIds: [...visitedSet],
    templeCount: visitedSet.size,
    totalTemples: TEMPLES.length,
    score,
    level,
    trails,
    badges,
    completedTrailCount,
    totalTrails: TRAILS.length,
  };
}

/**
 * @param {{ templeId: string, visitedAt: number }[]} visits
 */
export function visitsToTempleIds(visits) {
  return visits.map((v) => v.templeId);
}

/**
 * @param {{ templeId: string, visitedAt: number }[]} visits
 */
export function sortVisitsChronologically(visits) {
  return [...visits].sort((a, b) => b.visitedAt - a.visitedAt);
}
