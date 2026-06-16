import { SACRED_BHARAT_CHALLENGES } from "../../data/sacredBharat/challenges";

function visitedSetFromProgress(progress) {
  return new Set(progress?.visitedTempleIds ?? []);
}

function trailBySlug(progress) {
  return new Map((progress?.trails ?? []).map((trail) => [trail.slug, trail]));
}

export function getChallengeProgress(challenge, progress) {
  const visitedSet = visitedSetFromProgress(progress);
  const trailMap = trailBySlug(progress);
  const templeIds = challenge.templeIds ?? [];
  const requiredCount = challenge.requiredCount ?? templeIds.length;
  let visited = templeIds.length
    ? templeIds.filter((id) => visitedSet.has(id)).length
    : visitedSet.size;
  let total = requiredCount;

  if (challenge.trailSlugs?.length) {
    const trailProgress = challenge.trailSlugs.flatMap((slug) => {
      const trail = trailMap.get(slug);
      return trail ? [trail] : [];
    });
    visited = trailProgress.filter((trail) => trail.complete).length;
    total = challenge.trailSlugs.length;
  }

  const complete = total > 0 && visited >= total;
  return {
    slug: challenge.slug,
    title: challenge.title,
    visited,
    total,
    percent: total ? Math.min(100, Math.round((visited / total) * 100)) : 0,
    complete,
    nextTempleIds: templeIds.filter((id) => !visitedSet.has(id)).slice(0, 3),
  };
}

export function getChallengeBadgeAwards(progress, challenges = SACRED_BHARAT_CHALLENGES) {
  return challenges.flatMap((challenge) =>
    getChallengeProgress(challenge, progress).complete
      ? [
          {
            badgeId: challenge.badgeId,
            badgeName: challenge.badgeName,
            challengeSlug: challenge.slug,
          },
        ]
      : [],
  );
}

export function sortChallengesForUser(challenges = SACRED_BHARAT_CHALLENGES, progress) {
  return challenges
    .map((challenge) => ({ ...challenge, progress: getChallengeProgress(challenge, progress) }))
    .toSorted(
      (a, b) =>
        Number(a.progress.complete) - Number(b.progress.complete) ||
        b.progress.percent - a.progress.percent,
    );
}
