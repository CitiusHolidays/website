import { LEVELS, POINTS_PER_TEMPLE } from "../../data/sacredBharat/levels.js";
import { REGIONS } from "../../data/sacredBharat/regions.js";
import { TEMPLE_BY_ID, TEMPLES } from "../../data/sacredBharat/temples.js";
import { TRAILS } from "../../data/sacredBharat/trails.js";

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
    TEMPLES.some((t) => t.region === region && visitedSet.has(t.id))
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
function getTrailProgress(trail, visitedSet) {
  if (trail.type === "region") {
    const completedRegions = REGIONS.filter((region) =>
      TEMPLES.some((t) => t.region === region && visitedSet.has(t.id))
    );
    return {
      completedRegions,
      percent: Math.round((completedRegions.length / REGIONS.length) * 100),
      total: REGIONS.length,
      visited: completedRegions.length,
    };
  }
  const visited = trail.templeIds.filter((id) => visitedSet.has(id)).length;
  const total = trail.templeIds.length;
  return {
    completedRegions: [],
    percent: total === 0 ? 0 : Math.round((visited / total) * 100),
    total,
    visited,
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
      (level) => score >= level.minScore && (level.maxScore === null || score <= level.maxScore)
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
      emoji: trail.emoji,
      slug: trail.slug,
      title: trail.title,
      ...progress,
      badgeId: trail.badgeId,
      badgeName: trail.badgeName,
      complete,
      completionBonus: trail.completionBonus,
    };
  });

  const badges = trails.reduce((items, t) => {
    if (t.complete) {
      items.push({
        badgeId: t.badgeId,
        badgeName: t.badgeName,
        trailSlug: t.slug,
      });
    }
    return items;
  }, []);

  const completedTrailCount = trails.filter((t) => t.complete).length;

  return {
    badges,
    completedTrailCount,
    level,
    score,
    templeCount: visitedSet.size,
    totalTemples: TEMPLES.length,
    totalTrails: TRAILS.length,
    trails,
    visitedTempleIds: [...visitedSet],
  };
}
