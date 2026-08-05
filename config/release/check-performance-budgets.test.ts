import { describe, expect, test } from "bun:test";
import { evaluatePerformanceBudgets } from "./check-performance-budgets";

const manifest = {
  budgets: [
    { maxBytes: 100, path: "public/hero.mp4", purpose: "desktop hero video" },
    { maxBytes: 50, path: "public/hero-sm.mp4", purpose: "mobile hero video" },
  ],
  schemaVersion: 1,
};

describe("versioned public performance budgets", () => {
  test("passes assets at or below their declared limits", () => {
    expect(
      evaluatePerformanceBudgets(manifest, {
        "public/hero-sm.mp4": 50,
        "public/hero.mp4": 99,
      })
    ).toEqual([]);
  });

  test("reports over-budget and missing assets without silently passing", () => {
    expect(
      evaluatePerformanceBudgets(manifest, {
        "public/hero-sm.mp4": 51,
      })
    ).toEqual([
      {
        actualBytes: undefined,
        maxBytes: 100,
        path: "public/hero.mp4",
        purpose: "desktop hero video",
      },
      {
        actualBytes: 51,
        maxBytes: 50,
        path: "public/hero-sm.mp4",
        purpose: "mobile hero video",
      },
    ]);
  });
});
