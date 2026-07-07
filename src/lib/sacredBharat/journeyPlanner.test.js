import { describe, expect, test } from "bun:test";
import { getTempleJourneyPlan, suggestNextJourneys } from "./journeyPlanner";

describe("sacred bharat journey planner", () => {
  test("returns journey metadata for kedarnath", () => {
    const plan = getTempleJourneyPlan("kedarnath", []);
    expect(plan).not.toBeNull();
    expect(plan?.pointsAvailable).toBe(97);
    expect(plan?.nearestAirport).toContain("Dehradun");
    expect(plan?.nearbySacredPlaces.length).toBeGreaterThan(0);
    expect(plan?.visited).toBe(false);
  });

  test("marks visited temples in nearby list", () => {
    const plan = getTempleJourneyPlan("kedarnath", ["badrinath"]);
    const badrinath = plan?.nearbySacredPlaces.find((p) => p.id === "badrinath");
    expect(badrinath?.visited).toBe(true);
    expect(plan?.suggestedNextTempleId).not.toBe("badrinath");
  });

  test("suggests high-value unvisited temples for a trail", () => {
    const plans = suggestNextJourneys([], { limit: 2, trailSlug: "char-dham-trail" });
    expect(plans.length).toBe(2);
    expect(plans[0]?.pointsAvailable).toBeGreaterThanOrEqual(plans[1]?.pointsAvailable ?? 0);
  });
});
