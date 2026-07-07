import { getTrailBySlug } from "../../data/sacredBharat/trails.js";
import { getTempleById, TEMPLES } from "../../data/sacredBharat/temples.js";

/**
 * @param {string} templeId
 * @param {Set<string> | string[]} visitedTempleIds
 */
export function getTempleJourneyPlan(templeId, visitedTempleIds = []) {
  const temple = getTempleById(templeId);
  if (!temple) {
    return null;
  }

  const visitedSet =
    visitedTempleIds instanceof Set ? visitedTempleIds : new Set(visitedTempleIds ?? []);
  const journey = temple.journey ?? {};
  const nearbyTempleIds = journey.nearbyTempleIds ?? [];

  const nearbySacredPlaces = nearbyTempleIds.flatMap((id) => {
    const nearby = getTempleById(id);
    return nearby
      ? [
          {
            city: nearby.city,
            id: nearby.id,
            name: nearby.name,
            points: nearby.points,
            visited: visitedSet.has(nearby.id),
          },
        ]
      : [];
  });

  const unvisitedNearby = nearbySacredPlaces.filter((place) => !place.visited);

  return {
    bestSeason: journey.bestSeason ?? "Oct–Mar",
    estimatedDays: journey.estimatedDays ?? 2,
    mythology: journey.mythology ?? "",
    nearestAirport: journey.nearestAirport ?? null,
    nearbySacredPlaces,
    pointsAvailable: temple.points,
    suggestedNextTempleId: unvisitedNearby[0]?.id ?? null,
    temple: {
      city: temple.city,
      id: temple.id,
      name: temple.name,
      points: temple.points,
      state: temple.state,
    },
    visited: visitedSet.has(templeId),
  };
}

/**
 * Rank unvisited temples for a yatri planning their next darshan.
 * @param {Set<string> | string[]} visitedTempleIds
 * @param {{ trailSlug?: string, limit?: number }} [options]
 */
export function suggestNextJourneys(visitedTempleIds = [], options = {}) {
  const visitedSet =
    visitedTempleIds instanceof Set ? visitedTempleIds : new Set(visitedTempleIds ?? []);
  const limit = options.limit ?? 3;

  let pool = TEMPLES.filter((temple) => !visitedSet.has(temple.id));

  if (options.trailSlug) {
    const trail = getTrailBySlug(options.trailSlug);
    if (trail?.templeIds) {
      const trailSet = new Set(trail.templeIds);
      pool = pool.filter((temple) => trailSet.has(temple.id));
    }
  }

  return pool
    .toSorted((a, b) => b.points - a.points)
    .slice(0, limit)
    .flatMap((temple) => {
      const plan = getTempleJourneyPlan(temple.id, visitedSet);
      return plan ? [plan] : [];
    });
}
