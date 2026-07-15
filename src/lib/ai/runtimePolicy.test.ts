import { describe, expect, test } from "bun:test";
import {
  AI_ROUTE_BUDGET_MS,
  AI_RUNTIME_POLICIES,
  assertRuntimePolicy,
  type ProviderAttempt,
  runProviderFallback,
} from "./runtimePolicy";

describe("AI runtime policy", () => {
  test("uses measured free tool-capable models and leaves route headroom", () => {
    for (const policy of Object.values(AI_RUNTIME_POLICIES)) {
      expect(policy.models.length).toBeGreaterThanOrEqual(2);
      expect(policy.models.every((model) => model.endsWith(":free"))).toBe(true);
      expect(policy.maxRetries).toBe(0);
      expect(policy.totalTimeoutMs + policy.routeHeadroomMs).toBeLessThanOrEqual(
        AI_ROUTE_BUDGET_MS
      );
      expect(() => assertRuntimePolicy(policy)).not.toThrow();
    }

    expect(AI_RUNTIME_POLICIES.concierge.maxSteps).toBeGreaterThan(1);
    expect(AI_RUNTIME_POLICIES.concierge.models[0]).toBe("google/gemma-4-31b-it:free");
    expect(AI_RUNTIME_POLICIES.journeyPlanner.models).toContain(
      "nvidia/nemotron-3-super-120b-a12b:free"
    );
  });

  test("returns primary success without using fallback", async () => {
    const attempts: string[] = [];
    const result = await runProviderFallback({
      models: ["primary:free", "fallback:free"],
      now: () => 0,
      runAttempt: async ({ model }) => {
        attempts.push(model);
        return { value: "primary answer" };
      },
      totalTimeoutMs: 1000,
    });

    expect(result).toEqual({
      attempts: 1,
      fallback: false,
      model: "primary:free",
      value: "primary answer",
    });
    expect(attempts).toEqual(["primary:free"]);
  });

  test("falls back after a primary timeout", async () => {
    let now = 0;
    const runAttempt = async ({ model }: ProviderAttempt) => {
      if (model === "primary:free") {
        now = 300;
        throw new DOMException("timed out", "TimeoutError");
      }
      return { value: "fallback answer" };
    };

    const result = await runProviderFallback({
      models: ["primary:free", "fallback:free"],
      now: () => now,
      runAttempt,
      totalTimeoutMs: 1000,
    });

    expect(result.fallback).toBe(true);
    expect(result.model).toBe("fallback:free");
    expect(result.value).toBe("fallback answer");
  });

  test("reports all-provider failure and budget exhaustion", async () => {
    await expect(
      runProviderFallback({
        models: ["primary:free", "fallback:free"],
        now: () => 0,
        runAttempt: async () => {
          throw new Error("provider unavailable");
        },
        totalTimeoutMs: 1000,
      })
    ).rejects.toThrow("All AI providers failed");

    let now = 0;
    const attempts: string[] = [];
    await expect(
      runProviderFallback({
        minimumAttemptMs: 100,
        models: ["primary:free", "fallback:free"],
        now: () => now,
        runAttempt: async ({ model }) => {
          attempts.push(model);
          now = 950;
          throw new DOMException("timed out", "TimeoutError");
        },
        totalTimeoutMs: 1000,
      })
    ).rejects.toThrow("AI route budget exhausted");
    expect(attempts).toEqual(["primary:free"]);
  });
});
