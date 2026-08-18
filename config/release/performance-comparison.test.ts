import { describe, expect, test } from "bun:test";
import { planPerformanceComparisons } from "./performance-comparison";

const sample = (id: string, value: number) => ({ id, value });

describe("Median and p95 comparison planning", () => {
  test("Does not compare an initial p95 sample to an accepted median", () => {
    const plan = planPerformanceComparisons({
      acceptedMedian: [sample("home", 10)],
      candidateMedian: [sample("home", 11)],
      candidateP95: [],
      key: (entry) => entry.id,
    });

    expect(plan.p95RelativeComparison).toBe("not_available");
    expect(plan.pairs).toEqual([
      { accepted: sample("home", 10), aggregate: "median", candidate: sample("home", 11) },
    ]);
  });

  test("Keeps p95 on fixed gates and compares only matching medians relatively", () => {
    const plan = planPerformanceComparisons({
      acceptedMedian: [sample("home", 10)],
      candidateMedian: [sample("home", 11)],
      candidateP95: [sample("home", 10_000)],
      key: (entry) => entry.id,
    });

    expect(plan.p95RelativeComparison).toBe("fixed_only");
    expect(plan.pairs).toEqual([
      { accepted: sample("home", 10), aggregate: "median", candidate: sample("home", 11) },
    ]);
    expect(() =>
      planPerformanceComparisons({
        acceptedMedian: [sample("home", 10)],
        candidateMedian: [sample("other", 11)],
        candidateP95: [sample("home", 21)],
        key: (entry) => entry.id,
      })
    ).toThrow("Accepted median performance baseline is missing other");
  });
});
