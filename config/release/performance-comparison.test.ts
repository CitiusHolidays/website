import { describe, expect, test } from "bun:test";
import { planMedianAndP95Comparisons } from "./performance-comparison";

const sample = (id: string, value: number) => ({ id, value });

describe("median and p95 comparison planning", () => {
  test("does not compare an initial p95 sample to an accepted median", () => {
    const plan = planMedianAndP95Comparisons({
      acceptedMedian: [sample("home", 10)],
      candidateMedian: [sample("home", 11)],
      candidateP95: [sample("home", 20)],
      key: (entry) => entry.id,
    });

    expect(plan.p95RelativeComparison).toBe("not_available");
    expect(plan.pairs).toEqual([
      { accepted: sample("home", 10), aggregate: "median", candidate: sample("home", 11) },
    ]);
  });

  test("requires and compares matching p95 samples after the transition", () => {
    const plan = planMedianAndP95Comparisons({
      acceptedMedian: [sample("home", 10)],
      acceptedP95: [sample("home", 20)],
      candidateMedian: [sample("home", 11)],
      candidateP95: [sample("home", 21)],
      key: (entry) => entry.id,
    });

    expect(plan.p95RelativeComparison).toBe("included");
    expect(plan.pairs.map((pair) => pair.aggregate)).toEqual(["median", "p95"]);
    expect(() =>
      planMedianAndP95Comparisons({
        acceptedMedian: [sample("home", 10)],
        acceptedP95: [],
        candidateMedian: [sample("home", 11)],
        candidateP95: [sample("home", 21)],
        key: (entry) => entry.id,
      })
    ).toThrow("Accepted p95 performance baseline is missing home");
  });
});
