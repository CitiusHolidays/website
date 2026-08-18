import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { cn } from "../src/lib/utils.js";
import {
  buildBenchmarkCases,
  CNFAST_BENCHMARK_FIXTURES,
  compareMergerOutputs,
  parseBenchmarkOptions,
  summarizeSamples,
} from "./benchmark-cnfast";

describe("Cnfast benchmark harness", () => {
  test("Uses privacy-safe worked examples from every Citius interface boundary", () => {
    expect(new Set(CNFAST_BENCHMARK_FIXTURES.map(({ surface }) => surface))).toEqual(
      new Set(["Public site", "Sacred Bharat", "Customer Travel Account", "Staff Workspace"])
    );
    expect(CNFAST_BENCHMARK_FIXTURES.length).toBeGreaterThanOrEqual(8);

    for (const fixture of CNFAST_BENCHMARK_FIXTURES) {
      expect(cn(...fixture.inputs), fixture.name).toBe(fixture.expected);
      expect(existsSync(fixture.source), fixture.source).toBe(true);
    }
  });

  test("Reports byte-level output disagreements through the merger interface", () => {
    expect(compareMergerOutputs(cn, cn)).toEqual({ checked: 8, mismatches: [] });

    const comparison = compareMergerOutputs(cn, () => "not-the-baseline");
    expect(comparison.checked).toBe(8);
    expect(comparison.mismatches).toHaveLength(8);
    expect(comparison.mismatches[0]).toEqual({
      actual: "not-the-baseline",
      expected: CNFAST_BENCHMARK_FIXTURES[0]?.expected,
      fixture: CNFAST_BENCHMARK_FIXTURES[0]?.name,
      surface: CNFAST_BENCHMARK_FIXTURES[0]?.surface,
    });
  });

  test("Summarizes repeated measurements without hiding spread", () => {
    expect(summarizeSamples([10, 20, 30, 40, 50])).toEqual({
      maximum: 50,
      mean: 30,
      median: 30,
      minimum: 10,
      relativeStandardDeviation: 0.527,
      standardDeviation: 15.811,
    });
  });

  test("Builds repeatable warm cases and unique cold-cache cases", () => {
    const cases = buildBenchmarkCases(16);

    expect(cases.warm).toHaveLength(16);
    expect(cases.cold).toHaveLength(16);
    expect(new Set(cases.cold.map((inputs) => inputs.at(-1))).size).toBe(16);
    expect(cases.warm[0]).toEqual(CNFAST_BENCHMARK_FIXTURES[0]?.inputs);
    expect(cases.warm[8]).toEqual(CNFAST_BENCHMARK_FIXTURES[0]?.inputs);
  });

  test("Parses a bounded reproducible benchmark command", () => {
    expect(
      parseBenchmarkOptions([
        "--candidate",
        "/tmp/cnfast/dist/index.mjs",
        "--iterations",
        "1200",
        "--trials",
        "5",
      ])
    ).toEqual({
      candidatePath: "/tmp/cnfast/dist/index.mjs",
      iterations: 1200,
      trials: 5,
    });
    expect(() => parseBenchmarkOptions([])).toThrow("--candidate");
    expect(() => parseBenchmarkOptions(["--candidate", "candidate.mjs", "--trials", "2"])).toThrow(
      "at least 3"
    );
  });
});
