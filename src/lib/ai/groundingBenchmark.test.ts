import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { CHILD_TEST_TIMEOUT_MS, runChild } from "../../../test-helpers/runChild";
import {
  GROUNDING_BENCHMARK_CASES,
  GROUNDING_BENCHMARK_VERSION,
  runCanonicalGroundingBenchmark,
} from "./groundingBenchmark";

const root = resolve(import.meta.dir, "../../..");

describe("Offline canonical grounding benchmark", () => {
  test("Scores every versioned fact and refusal case deterministically", () => {
    const first = runCanonicalGroundingBenchmark();
    const second = runCanonicalGroundingBenchmark();

    expect(first).toEqual(second);
    expect(first.version).toBe(GROUNDING_BENCHMARK_VERSION);
    expect(first.score).toBe(1);
    expect(first.passed).toBe(GROUNDING_BENCHMARK_CASES.length);
    expect(first.failed).toBe(0);
    expect(new Set(GROUNDING_BENCHMARK_CASES.map((sample) => sample.kind))).toEqual(
      new Set(["fact", "refusal"])
    );
    for (const sample of GROUNDING_BENCHMARK_CASES) {
      expect(sample.allowedUncertainty.length).toBeGreaterThan(12);
      expect(sample.source.version).toBe(GROUNDING_BENCHMARK_VERSION);
    }
  });

  test(
    "Runs without a provider key or live probe",
    async () => {
      const result = await runChild("bun", ["run", "ai:grounding-check"], {
        cwd: root,
        env: { NODE_ENV: "test", PATH: process.env.PATH },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"score": 1');
      expect(result.stdout).toContain('"failed": 0');
      expect(result.stderr.trim()).toBe("$ bun scripts/benchmark-ai-grounding.ts");
    },
    CHILD_TEST_TIMEOUT_MS
  );
});
