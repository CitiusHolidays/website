import { SACRED_BHARAT_CHALLENGES } from "../../data/sacredBharat/challenges.js";
import { LEVELS } from "../../data/sacredBharat/levels.js";
import { REGIONS } from "../../data/sacredBharat/regions.js";
import { resolveCanonicalTempleId } from "../../data/sacredBharat/templeAliases.js";
import { getTemplePoints, TEMPLE_BY_ID, TEMPLES } from "../../data/sacredBharat/temples.js";
import { TRAILS } from "../../data/sacredBharat/trails.js";
import { getChallengeBadgeAwards, getChallengeProgress } from "./challenges.js";

export { getTemplePoints };

/**
 * @param {string[] | Set<string>} templeIds
 */
export function normalizeVisitedSet(templeIds) {
  const raw = templeIds instanceof Set ? [...templeIds] : (templeIds ?? []);
  const canonical = raw.map((id) => resolveCanonicalTempleId(id));
  return new Set(canonical.filter((id) => TEMPLE_BY_ID[id]));
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

function buildTrailSummaries(visitedSet) {
  return TRAILS.map((trail) => {
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
}

/**
 * @param {string[] | Set<string>} templeIds
 */
export function computeTemplePointsTotal(visitedSet) {
  let total = 0;
  for (const templeId of visitedSet) {
    total += getTemplePoints(templeId);
  }
  return total;
}

/**
 * @param {Set<string>} visitedSet
 * @param {ReturnType<typeof buildTrailSummaries>} trails
 */
export function computeChallengeBonus(visitedSet, trails) {
  const progress = { trails, visitedTempleIds: [...visitedSet] };
  return SACRED_BHARAT_CHALLENGES.reduce((sum, challenge) => {
    if (getChallengeProgress(challenge, progress).complete) {
      return sum + (challenge.points ?? 0);
    }
    return sum;
  }, 0);
}

export function computeScore(templeIds) {
  const visitedSet = normalizeVisitedSet(templeIds);
  const trails = buildTrailSummaries(visitedSet);
  const templePointsTotal = computeTemplePointsTotal(visitedSet);
  const trailBonusTotal = trails
    .filter((trail) => trail.complete)
    .reduce((sum, trail) => sum + trail.completionBonus, 0);
  const challengeBonusTotal = computeChallengeBonus(visitedSet, trails);
  return templePointsTotal + trailBonusTotal + challengeBonusTotal;
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
  const trails = buildTrailSummaries(visitedSet);
  const templePointsTotal = computeTemplePointsTotal(visitedSet);
  const trailBonusTotal = trails
    .filter((trail) => trail.complete)
    .reduce((sum, trail) => sum + trail.completionBonus, 0);
  const challengeBonusTotal = computeChallengeBonus(visitedSet, trails);
  const score = templePointsTotal + trailBonusTotal + challengeBonusTotal;
  const level = getLevelForScore(score);

  const trailBadges = trails.reduce((items, t) => {
    if (t.complete) {
      items.push({
        badgeId: t.badgeId,
        badgeName: t.badgeName,
        trailSlug: t.slug,
      });
    }
    return items;
  }, []);

  const challengeBadges = getChallengeBadgeAwards({ trails, visitedTempleIds: [...visitedSet] });
  const badges = [...trailBadges, ...challengeBadges];

  const completedTrailCount = trails.filter((t) => t.complete).length;
  const completedChallengeCount = challengeBadges.length;

  return {
    badges,
    challengeBonusTotal,
    completedChallengeCount,
    completedTrailCount,
    level,
    score,
    templeCount: visitedSet.size,
    templePointsTotal,
    totalTemples: TEMPLES.length,
    totalTrails: TRAILS.length,
    trailBonusTotal,
    trails,
    visitedTempleIds: [...visitedSet],
  };
}
