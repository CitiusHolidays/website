import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  GROUNDING_BENCHMARK_CASES,
  GROUNDING_BENCHMARK_VERSION,
  runCanonicalGroundingBenchmark,
} from "./groundingBenchmark";

const root = resolve(import.meta.dir, "../../..");
const RETRIEVAL_SYSTEM_PATTERN = /vector|embedding|private CRM/i;

describe("offline canonical grounding benchmark", () => {
  test("scores every versioned fact and refusal case deterministically", () => {
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

  test("runs without a provider key or live probe", () => {
    const result = spawnSync("bun", ["run", "ai:grounding-check"], {
      cwd: root,
      encoding: "utf8",
      env: { NODE_ENV: "test", PATH: process.env.PATH },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('"score": 1');
    expect(result.stdout).toContain('"failed": 0');
    expect(result.stderr.trim()).toBe("$ bun scripts/benchmark-ai-grounding.ts");
  });

  test("keeps vector retrieval and private data out of the production fact adapter", () => {
    const adapter = readFileSync("src/lib/ai/canonicalPublicFacts.ts", "utf8");
    const assistant = readFileSync("src/lib/ai/citiusTravelAssistant.js", "utf8");

    expect(`${adapter}\n${assistant}`).not.toMatch(RETRIEVAL_SYSTEM_PATTERN);
    expect(assistant).toContain("checkCitiusBoundary");
  });
});
