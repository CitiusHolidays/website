import { describe, expect, test } from "bun:test";
import {
  AI_BENCHMARK_CONTRACT_VERSION,
  AI_BENCHMARK_PROMPTS,
  AI_BENCHMARK_VERSION,
  selectBenchmarkPrompts,
} from "./benchmark-ai-runtime";

describe("production AI benchmark configuration", () => {
  test("uses a versioned prompt contract with both production features", () => {
    expect(AI_BENCHMARK_VERSION).toBe("2026-08-05");
    expect(AI_BENCHMARK_CONTRACT_VERSION).toBe(2);
    expect(new Set(AI_BENCHMARK_PROMPTS.map((sample) => sample.feature))).toEqual(
      new Set(["concierge", "journeyPlanner"])
    );
    expect(
      AI_BENCHMARK_PROMPTS.filter((sample) => sample.feature === "concierge").every((sample) =>
        sample.tools?.some(
          (tool) =>
            (tool as { function?: { name?: string } }).function?.name === "searchCitiusOfferings"
        )
      )
    ).toBe(true);
  });

  test("rejects an invalid feature filter instead of running an empty benchmark", () => {
    expect(() => selectBenchmarkPrompts("unknown")).toThrow(
      "Invalid benchmark feature filter: unknown"
    );
    expect(selectBenchmarkPrompts("journeyPlanner").length).toBeGreaterThan(0);
  });
});
