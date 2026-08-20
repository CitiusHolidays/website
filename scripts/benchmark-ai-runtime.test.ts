import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  AI_BENCHMARK_CONTRACT_VERSION,
  AI_BENCHMARK_PROMPTS,
  AI_BENCHMARK_VERSION,
  selectBenchmarkPrompts,
} from "./benchmark-ai-runtime";

const root = resolve(import.meta.dir, "..");

describe("Production AI benchmark configuration", () => {
  test("Uses a versioned prompt contract with both production features", () => {
    expect(AI_BENCHMARK_VERSION).toBe("2026-08-05");
    expect(AI_BENCHMARK_CONTRACT_VERSION).toBe(2);
    expect(new Set(AI_BENCHMARK_PROMPTS.map((sample) => sample.feature))).toEqual(
      new Set(["concierge", "journeyPlanner"])
    );
    expect(
      AI_BENCHMARK_PROMPTS.filter((sample) => sample.feature === "concierge").every((sample) =>
        sample.tools?.some(
          (tool) =>
            // SAFETY: This test controls the asserted value at the framework boundary below.
            fromPartial<{ function?: { name?: string } }>(tool).function?.name ===
            "searchCitiusOfferings"
        )
      )
    ).toBe(true);
  });

  test("Rejects an invalid feature filter instead of running an empty benchmark", () => {
    expect(() => selectBenchmarkPrompts("unknown")).toThrow(
      "Invalid benchmark feature filter: unknown"
    );
    expect(selectBenchmarkPrompts("journeyPlanner").length).toBeGreaterThan(0);
  });

  test("Help and invalid flags never contact the provider", () => {
    const run = (args: string[]) =>
      spawnSync("bun", ["scripts/benchmark-ai-runtime.ts", ...args], {
        cwd: root,
        encoding: "utf8",
        env: { PATH: process.env.PATH },
      });

    const help = run(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("Usage: bun run ai:benchmark");
    expect(help.stderr).not.toContain("OPENROUTER_API_KEY");

    const invalid = run(["--feature", "unknown"]);
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain("Valid choices: concierge, journeyPlanner");
    expect(invalid.stderr).not.toContain("OPENROUTER_API_KEY");
  });
});
