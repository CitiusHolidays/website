import { describe, expect, test } from "bun:test";
import { rotatePerformanceTrialOrder } from "./performance-trial-order";

describe("authenticated performance trial order", () => {
  test("rotates the infrastructure cold-start slot between trials", () => {
    const scenarios = ["queries", "proposals", "job-cards", "contracting"];

    expect(rotatePerformanceTrialOrder(scenarios, "1")).toEqual(scenarios);
    expect(rotatePerformanceTrialOrder(scenarios, "2")).toEqual([
      "proposals",
      "job-cards",
      "contracting",
      "queries",
    ]);
    expect(rotatePerformanceTrialOrder(scenarios, "3")).toEqual([
      "job-cards",
      "contracting",
      "queries",
      "proposals",
    ]);
  });

  test("fails closed for an invalid collector trial index", () => {
    expect(() => rotatePerformanceTrialOrder(["queries"], "0")).toThrow("trial index");
    expect(() => rotatePerformanceTrialOrder(["queries"], "two")).toThrow("trial index");
  });
});
