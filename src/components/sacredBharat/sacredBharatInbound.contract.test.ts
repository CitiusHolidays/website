import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const trailSource = readFileSync(
  "src/app/(public)/sacred-bharat/trails/[slug]/page.client.js",
  "utf8"
);
const plannerSource = readFileSync("src/components/sacredBharat/JourneyPlannerPanel.js", "utf8");

describe("Sacred Bharat explicit Sales-intake entry points", () => {
  test("replaces the generic Trail contact link with one contextual planning action", () => {
    expect(trailSource).toContain("<SacredBharatContactHandoff");
    expect(trailSource).toContain('entryPoint: "trail"');
    expect(trailSource).toContain('triggerLabel="Plan this trail with Citius"');
    expect(trailSource).not.toContain("/contact?interest=sacred-bharat");
  });

  test("offers contextual contact only after the Journey Planner completes", () => {
    expect(plannerSource).toContain('message.terminalState === "complete"');
    expect(plannerSource).toContain('planMessage?.terminalState === "complete"');
    expect(plannerSource).toContain('entryPoint: "journey_planner"');
    expect(plannerSource).toContain('triggerLabel="Plan this journey with Citius"');
  });
});
