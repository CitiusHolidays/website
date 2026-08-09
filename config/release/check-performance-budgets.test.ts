import { describe, expect, test } from "bun:test";
import {
  evaluatePerformanceBudgets,
  isStaffWorkspacePerformanceBaselineFresh,
} from "./check-performance-budgets";
import { evaluateStaffWorkspacePerformanceBudget } from "./staff-workspace-performance-budget";

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

describe("authenticated Staff Workspace performance budgets", () => {
  const staffManifest = {
    budgets: {
      "job-cards": {
        cold: {
          maxApplicationPayloadBytes: 100,
          maxDuplicateSubscriptions: 0,
          maxFirstContentMs: 1000,
          maxLogicalSubscriptions: 1,
          maxRouteReadyMs: 500,
          maxRouteResourceTransferBytes: 200,
        },
        warm: {
          maxApplicationPayloadBytes: 100,
          maxDuplicateSubscriptions: 0,
          maxFirstContentMs: 1000,
          maxLogicalSubscriptions: 1,
          maxRouteReadyMs: 500,
          maxRouteResourceTransferBytes: 100,
        },
      },
      proposals: {} as never,
      queries: {} as never,
    },
    schemaVersion: 1,
  };

  test("fails an oversized route sample with the exact breached metrics", () => {
    expect(
      evaluateStaffWorkspacePerformanceBudget(staffManifest, {
        applicationPayloadBytes: 101,
        duplicateSubscriptions: 1,
        firstContentMs: 1000,
        logicalSubscriptions: 1,
        routeReadyMs: 501,
        routeResourceTransferBytes: 200,
        target: "job-cards",
        warm: false,
      })
    ).toEqual([
      expect.objectContaining({ actual: 101, metric: "maxApplicationPayloadBytes" }),
      expect.objectContaining({ actual: 1, metric: "maxDuplicateSubscriptions" }),
      expect.objectContaining({ actual: 501, metric: "maxRouteReadyMs" }),
    ]);
  });

  test("fails a committed baseline when measured source has changed", () => {
    const baseline = {
      environment: "authenticated local",
      samples: [],
      schemaVersion: 1,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "measured-hash",
    };

    expect(isStaffWorkspacePerformanceBaselineFresh(baseline, "measured-hash")).toBe(true);
    expect(isStaffWorkspacePerformanceBaselineFresh(baseline, "changed-source-hash")).toBe(false);
    expect(
      isStaffWorkspacePerformanceBaselineFresh({ ...baseline, sourceFiles: [] }, "measured-hash")
    ).toBe(false);
  });
});
