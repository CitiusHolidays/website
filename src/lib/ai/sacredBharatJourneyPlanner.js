import { CITIUS_CHAT_MODEL } from "@/lib/ai/citiusTravelAssistant";
import { getTrailBySlug } from "@/data/sacredBharat/trails";
import { getTempleById, TEMPLES } from "@/data/sacredBharat/temples";
import { resolveCanonicalTempleId } from "@/data/sacredBharat/templeAliases";
import { suggestNextJourneys, getTempleJourneyPlan } from "@/lib/sacredBharat/journeyPlanner";

export { CITIUS_CHAT_MODEL };

/**
 * @param {{
 *   focusTempleId?: string,
 *   trailSlug?: string,
 *   visitedTempleIds?: string[],
 *   wishlistTrailSlugs?: string[],
 * }} input
 */
export function buildSacredBharatPlannerContext(input) {
  const visited = [
    ...new Set((input.visitedTempleIds ?? []).map((id) => resolveCanonicalTempleId(id))),
  ].filter((id) => getTempleById(id));

  const visitedDetails = visited.map((id) => {
    const temple = getTempleById(id);
    return temple ? `${temple.name} (${temple.city}, ${temple.points} pts)` : id;
  });

  const focusId = input.focusTempleId
    ? resolveCanonicalTempleId(input.focusTempleId)
    : suggestNextJourneys(visited, { limit: 1, trailSlug: input.trailSlug })[0]?.temple?.id;

  const focusTemple = focusId ? getTempleById(focusId) : null;
  const focusPlan = focusId ? getTempleJourneyPlan(focusId, visited) : null;

  const trail = input.trailSlug ? getTrailBySlug(input.trailSlug) : null;
  const trailRemaining =
    trail?.templeIds?.filter((id) => !visited.includes(id)).map((id) => getTempleById(id)?.name) ??
    [];

  return {
    catalogSize: TEMPLES.length,
    focusTemple,
    focusPlan,
    trail,
    trailRemaining: trailRemaining.filter(Boolean),
    visitedCount: visited.length,
    visitedDetails,
    wishlistTrailSlugs: input.wishlistTrailSlugs ?? [],
  };
}

/**
 * @param {ReturnType<typeof buildSacredBharatPlannerContext>} context
 */
export function sacredBharatJourneyPlannerSystemPrompt(context) {
  const focusBlock = context.focusTemple
    ? `Primary planning focus: ${context.focusTemple.name} (${context.focusTemple.city}, ${context.focusTemple.state}) — ${context.focusTemple.points} Temple Points.
Best season (catalog): ${context.focusTemple.journey?.bestSeason ?? "Oct–Mar"}
Nearest airport: ${context.focusTemple.journey?.nearestAirport ?? "See regional hub"}
Mythology: ${context.focusTemple.journey?.mythology ?? ""}`
    : "Suggest the highest-impact next sacred site from their unvisited list.";

  const trailBlock = context.trail
    ? `Active trail: ${context.trail.title}. Remaining sites: ${context.trailRemaining.join(", ") || "complete"}.`
    : "";

  return `You are the Sacred Bharat AI Journey Planner for Citius Holidays — India's gamified spiritual travel companion.

Your role: help yatris plan respectful, practical pilgrimage journeys. You are warm, knowledgeable, and concise. Use DD/MM/YYYY if citing dates.

Yatri progress:
- Visited ${context.visitedCount} of ${context.catalogSize} sacred sites
- Already visited: ${context.visitedDetails.join("; ") || "none yet"}
${trailBlock}
${focusBlock}

Respond in markdown with these sections (use ## headings):
## Recommended journey
## Best season & duration
## Nearest airport & ground transfer
## Mythology & significance
## Suggested itinerary (day-by-day)
## Nearby sacred places
## Soul score opportunity
Mention Temple Points available and any trail/challenge progress they would unlock.

End with one sentence inviting them to contact Citius Holidays for a curated pilgrimage quote. Do not invent live prices or guaranteed darshan slots.`;
}

/**
 * @param {ReturnType<typeof buildSacredBharatPlannerContext>} context
 */
export function buildDefaultPlannerUserMessage(context) {
  if (context.focusTemple) {
    return `Plan my pilgrimage to ${context.focusTemple.name}. I have already visited ${context.visitedCount} sacred sites on Sacred Bharat.`;
  }
  return `Suggest my next spiritual journey on Sacred Bharat. I have visited ${context.visitedCount} sites so far.`;
}
