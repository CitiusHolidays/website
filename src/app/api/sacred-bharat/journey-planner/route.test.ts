import { afterEach, describe, expect, test } from "bun:test";
import { fromPartial } from "@total-typescript/shoehorn";
import { handleJourneyPlannerRequest } from "./route";

// SAFETY: These route tests restore every mutated key after each test.
const mutableEnv = fromPartial<Record<string, string | undefined>>(process.env);
const ENV_KEYS = ["NODE_ENV", "OPENROUTER_API_KEY"] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    mutableEnv[key] = originalEnv[key];
  }
});

function request() {
  return new Request("http://localhost/api/sacred-bharat/journey-planner", {
    body: JSON.stringify({ focusTempleId: "kedarnath" }),
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    method: "POST",
  });
}

describe("Protected Sacred Bharat Journey Planner route", () => {
  test("stops at the admin control before consuming shared AI capacity", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
    let rateLimitCalls = 0;

    const response = await handleJourneyPlannerRequest(request(), {
      consumeRateLimit: () => {
        rateLimitCalls += 1;
        return Promise.resolve({ allowed: true, remaining: 1, retryAfterSec: 0 });
      },
      resolveControl: () =>
        Promise.resolve({
          blockedBy: [],
          enabled: false,
          key: "ai.journey_planner",
          reason: "operator_disabled",
        }),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Journey planner is currently paused." });
    expect(rateLimitCalls).toBe(0);
  });

  test("rechecks the control at the provider boundary", async () => {
    mutableEnv.NODE_ENV = "test";
    mutableEnv.OPENROUTER_API_KEY = "openrouter-test-key";
    let controlChecks = 0;

    const response = await handleJourneyPlannerRequest(request(), {
      consumeRateLimit: () => Promise.resolve({ allowed: true, remaining: 1, retryAfterSec: 0 }),
      resolveControl: () => {
        controlChecks += 1;
        return Promise.resolve({
          blockedBy: [],
          enabled: controlChecks === 1,
          key: "ai.journey_planner",
          reason: controlChecks === 1 ? "configured_default" : "explicit_disabled",
        });
      },
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Journey planner is currently paused." });
    expect(controlChecks).toBe(2);
  });
});
