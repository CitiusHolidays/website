import { describe, expect, test } from "bun:test";
import {
  evaluatePerformanceBudgets,
  isStaffWorkspacePerformanceBaselineFresh,
  parsePerformanceBudgetManifest,
  parseStaffWorkspacePerformanceBaseline,
} from "./check-performance-budgets";
import {
  evaluateStaffWorkspacePerformanceBudget,
  parseStaffWorkspacePerformanceBudgetManifest,
} from "./staff-workspace-performance-budget";

const manifest = {
  budgets: [
    { maxBytes: 100, path: "public/hero.mp4", purpose: "desktop hero video" },
    { maxBytes: 50, path: "public/hero-sm.mp4", purpose: "mobile hero video" },
  ],
  schemaVersion: 1,
};

const validPublicManifest = {
  budgets: [
    { maxBytes: 250_000, path: "public/gallery/hero-poster.webp", purpose: "LCP poster" },
    { maxBytes: 40_000_000, path: "public/hero-sm.mp4", purpose: "mobile hero video" },
    { maxBytes: 75_000_000, path: "public/hero.mp4", purpose: "desktop hero video" },
  ],
  schemaVersion: 1,
};

describe("versioned public performance budgets", () => {
  test("rejects unsupported, incomplete, duplicate, and invalid public manifests", () => {
    expect(() => parsePerformanceBudgetManifest({ budgets: [], schemaVersion: 2 })).toThrow(
      "schemaVersion"
    );
    expect(() => parsePerformanceBudgetManifest({ budgets: [], schemaVersion: 1 })).toThrow(
      "budgets"
    );
    expect(() =>
      parsePerformanceBudgetManifest({
        ...validPublicManifest,
        budgets: [validPublicManifest.budgets[0], validPublicManifest.budgets[0]],
      })
    ).toThrow("duplicate");
    expect(() =>
      parsePerformanceBudgetManifest({
        ...validPublicManifest,
        budgets: [{ ...validPublicManifest.budgets[0], maxBytes: -1 }],
      })
    ).toThrow("maxBytes");
  });

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

  test("rejects incomplete or invalid Staff Workspace budget manifests", () => {
    expect(() =>
      parseStaffWorkspacePerformanceBudgetManifest({ budgets: {}, schemaVersion: 1 })
    ).toThrow("budgets.queries");
    expect(() =>
      parseStaffWorkspacePerformanceBudgetManifest({
        budgets: {
          ...staffManifest.budgets,
          queries: {
            cold: {
              maxApplicationPayloadBytes: Number.NaN,
            },
            warm: {},
          },
        },
        schemaVersion: 1,
      })
    ).toThrow("budgets.queries.cold.maxApplicationPayloadBytes");
  });

  test("rejects empty, duplicate, missing, unknown, and incomplete baseline samples", () => {
    const sample = {
      applicationPayloadBytes: 1,
      duplicateSubscriptions: 0,
      firstContentMs: 1,
      logicalSubscriptions: 1,
      routeReadyMs: 1,
      routeResourceTransferBytes: 1,
      target: "queries",
      warm: false,
    };
    const baseline = {
      environment: "authenticated local",
      samples: [],
      schemaVersion: 1,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "hash",
    };

    expect(() => parseStaffWorkspacePerformanceBaseline(baseline)).toThrow("samples");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, samples: [sample, sample] })
    ).toThrow("duplicate");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        samples: [{ ...sample, target: "unknown" }],
      })
    ).toThrow("samples[0].target");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        samples: [{ ...sample, routeReadyMs: -1 }],
      })
    ).toThrow("samples[0].routeReadyMs");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        samples: [
          sample,
          { ...sample, warm: true },
          { ...sample, target: "proposals" },
          { ...sample, target: "proposals", warm: true },
          { ...sample, target: "job-cards" },
        ],
      })
    ).toThrow("job-cards warm");
  });
});
