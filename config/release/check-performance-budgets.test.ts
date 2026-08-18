import { describe, expect, test } from "bun:test";
import {
  evaluatePerformanceBudgets,
  isStaffWorkspacePerformanceBaselineFresh,
  parsePerformanceBudgetManifest,
  parseStaffWorkspacePerformanceBaseline,
} from "./check-performance-budgets";
import {
  evaluateStaffWorkspacePerformanceBudget,
  evaluateStaffWorkspaceRelativeRegression,
  parseStaffWorkspacePerformanceBudgetManifest,
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
} from "./staff-workspace-performance-budget";
import staffWorkspaceBudgetJson from "./staff-workspace-performance-budgets.json";

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

describe("Versioned public performance budgets", () => {
  test("Rejects unsupported, incomplete, duplicate, and invalid public manifests", () => {
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

  test("Passes assets at or below their declared limits", () => {
    expect(
      evaluatePerformanceBudgets(manifest, {
        "public/hero-sm.mp4": 50,
        "public/hero.mp4": 99,
      })
    ).toEqual([]);
  });

  test("Reports over-budget and missing assets without silently passing", () => {
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

describe("Authenticated Staff Workspace performance budgets", () => {
  const targetBinding = {
    convexSiteOrigin: "https://elegant-bullfrog-454.convex.site",
    convexSourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
    frontendOrigin: "https://preview.example.test",
    id: "preview-elegant-bullfrog-454-test",
    revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
    target: "preview" as const,
  };
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
      // SAFETY: This test controls the asserted value at the framework boundary below.
      proposals: {} as never,
      // SAFETY: This test controls the asserted value at the framework boundary below.
      queries: {} as never,
    },
    relativeRegression: {
      applicationPayloadBytes: { maxIncreaseFraction: 0.15, minAbsoluteIncrease: 20 },
      duplicateSubscriptions: { maxIncreaseFraction: 0, minAbsoluteIncrease: 0 },
      firstContentMs: { maxIncreaseFraction: 0.25, minAbsoluteIncrease: 100 },
      logicalSubscriptions: { maxIncreaseFraction: 0.1, minAbsoluteIncrease: 1 },
      routeReadyMs: { maxIncreaseFraction: 0.5, minAbsoluteIncrease: 100 },
      routeResourceTransferBytes: { maxIncreaseFraction: 0.2, minAbsoluteIncrease: 100 },
    },
    schemaVersion: 2,
  };

  test("Fails an oversized route sample with the exact breached metrics", () => {
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

  test("Fails relative regressions only beyond both the percentage and noise floor", () => {
    const accepted = {
      applicationPayloadBytes: 100,
      duplicateSubscriptions: 0,
      firstContentMs: 100,
      logicalSubscriptions: 1,
      routeReadyMs: 100,
      routeResourceTransferBytes: 100,
      target: "job-cards" as const,
      warm: false,
    };
    expect(
      evaluateStaffWorkspaceRelativeRegression(
        staffManifest,
        { ...accepted, firstContentMs: 200 },
        accepted
      )
    ).toEqual([]);
    expect(
      evaluateStaffWorkspaceRelativeRegression(
        staffManifest,
        { ...accepted, firstContentMs: 201 },
        accepted
      )
    ).toEqual([expect.objectContaining({ baseline: 100, limit: 200, metric: "firstContentMs" })]);
  });

  test("Keeps relative route and warm-transfer gates below their fixed ceilings", () => {
    const previewManifest = parseStaffWorkspacePerformanceBudgetManifest(staffWorkspaceBudgetJson);
    const acceptedHotelsCold = {
      applicationPayloadBytes: 1034,
      duplicateSubscriptions: 0,
      firstContentMs: 1433,
      logicalSubscriptions: 8,
      routeReadyMs: 30,
      routeResourceTransferBytes: 52_165,
      target: "hotels" as const,
      warm: false,
    };
    const acceptedHotelsWarm = {
      ...acceptedHotelsCold,
      firstContentMs: 1475,
      routeReadyMs: 16,
      routeResourceTransferBytes: 10_596,
      warm: true,
    };

    expect(
      evaluateStaffWorkspaceRelativeRegression(
        previewManifest,
        { ...acceptedHotelsCold, routeReadyMs: 490 },
        acceptedHotelsCold
      )
    ).toEqual([expect.objectContaining({ baseline: 30, metric: "routeReadyMs" })]);
    expect(
      evaluateStaffWorkspaceRelativeRegression(
        previewManifest,
        { ...acceptedHotelsWarm, routeResourceTransferBytes: 22_357 },
        acceptedHotelsWarm
      )
    ).toEqual([
      expect.objectContaining({ baseline: 10_596, metric: "routeResourceTransferBytes" }),
    ]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...acceptedHotelsCold,
        routeReadyMs: 1251,
      })
    ).toEqual([expect.objectContaining({ metric: "maxRouteReadyMs" })]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...acceptedHotelsWarm,
        routeResourceTransferBytes: 35_001,
      })
    ).toEqual([expect.objectContaining({ metric: "maxRouteResourceTransferBytes" })]);

    const acceptedContractingCold = {
      ...acceptedHotelsCold,
      applicationPayloadBytes: 5243,
      logicalSubscriptions: 6,
      routeReadyMs: 24,
      routeResourceTransferBytes: 33_994,
      target: "contracting" as const,
    };
    expect(
      evaluateStaffWorkspaceRelativeRegression(
        previewManifest,
        { ...acceptedContractingCold, routeResourceTransferBytes: 60_000 },
        acceptedContractingCold
      )
    ).toEqual([
      expect.objectContaining({
        baseline: 33_994,
        metric: "routeResourceTransferBytes",
      }),
    ]);
  });

  test("Calibrates hard tails while retaining the tighter warm route-ready ceiling", () => {
    const previewManifest = parseStaffWorkspacePerformanceBudgetManifest(staffWorkspaceBudgetJson);
    const queriesCold = {
      applicationPayloadBytes: 2203,
      duplicateSubscriptions: 0,
      firstContentMs: 2213.2,
      logicalSubscriptions: 5,
      routeReadyMs: 1116.3,
      routeResourceTransferBytes: 41_386,
      target: "queries" as const,
      warm: false,
    };

    expect(evaluateStaffWorkspacePerformanceBudget(previewManifest, queriesCold)).toEqual([]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...queriesCold,
        routeReadyMs: 1250.1,
      })
    ).toEqual([expect.objectContaining({ maximum: 1250, metric: "maxRouteReadyMs" })]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...queriesCold,
        firstContentMs: 2500.1,
      })
    ).toEqual([expect.objectContaining({ maximum: 2500, metric: "maxFirstContentMs" })]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...queriesCold,
        routeReadyMs: 750.1,
        routeResourceTransferBytes: 19_503,
        warm: true,
      })
    ).toEqual([expect.objectContaining({ maximum: 750, metric: "maxRouteReadyMs" })]);
    expect(
      evaluateStaffWorkspacePerformanceBudget(previewManifest, {
        ...queriesCold,
        firstContentMs: 2500.1,
        routeReadyMs: 433,
        target: "proposals",
      })
    ).toEqual([expect.objectContaining({ maximum: 2500, metric: "maxFirstContentMs" })]);
  });

  test("Fails a committed baseline when measured source has changed", () => {
    const baseline = {
      cleanupAudit: { targetId: targetBinding.id },
      comparison: {
        fixedFindingCount: 0,
        p95RelativeComparison: "not_available" as const,
        relativeFindingCount: 0,
      },
      createdAt: "2026-08-15T12:00:00.000Z",
      environment: "authenticated explicit non-production browser target",
      measurementVersion: 2,
      // SAFETY: This test controls the asserted value at the framework boundary below.
      p95Samples: Array.from({ length: STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2 }, () => ({
        target: "queries",
      })) as any,
      pendingTargets: [],
      revision: targetBinding.revision,
      samples: [],
      schemaVersion: 5,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "measured-hash",
      targetBinding,
      trialCount: 5,
    };

    expect(isStaffWorkspacePerformanceBaselineFresh(baseline, "measured-hash")).toBe(true);
    expect(isStaffWorkspacePerformanceBaselineFresh(baseline, "changed-source-hash")).toBe(false);
    expect(
      isStaffWorkspacePerformanceBaselineFresh({ ...baseline, sourceFiles: [] }, "measured-hash")
    ).toBe(false);
  });

  test("Rejects incomplete or invalid Staff Workspace budget manifests", () => {
    expect(() =>
      parseStaffWorkspacePerformanceBudgetManifest({ budgets: {}, schemaVersion: 2 })
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
        relativeRegression: staffManifest.relativeRegression,
        schemaVersion: 2,
      })
    ).toThrow("budgets.queries.cold.maxApplicationPayloadBytes");
  });

  test("Rejects empty, duplicate, missing, unknown, and incomplete baseline samples", () => {
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
      createdAt: "2026-08-15T12:00:00.000Z",
      environment: "authenticated explicit non-production browser target",
      measurementVersion: 2,
      pendingTargets: [],
      revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
      samples: [],
      schemaVersion: 4,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
      targetBinding,
      trialCount: 3,
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
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        pendingTargets: ["finance", "finance"],
      })
    ).toThrow("duplicates");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        pendingTargets: ["finance"],
        samples: [{ ...sample, target: "finance" }],
      })
    ).toThrow("pending target");
  });

  test("Fails closed on malformed or unsafe Staff baseline provenance", () => {
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
      createdAt: "2026-08-15T12:00:00.000Z",
      environment: "authenticated explicit non-production browser target",
      measurementVersion: 2,
      pendingTargets: STAFF_WORKSPACE_PERFORMANCE_TARGETS.filter((target) => target !== "queries"),
      revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
      samples: [sample, { ...sample, warm: true }],
      schemaVersion: 4,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
      targetBinding,
      trialCount: 3,
    };

    expect(parseStaffWorkspacePerformanceBaseline(baseline)).toMatchObject({
      createdAt: baseline.createdAt,
      revision: baseline.revision,
      targetBinding,
    });
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, createdAt: "yesterday" })
    ).toThrow("createdAt");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, revision: "not-a-revision" })
    ).toThrow("revision");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        targetBinding: { ...targetBinding, target: "production" },
      })
    ).toThrow("targetBinding");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, customerEmail: "person@example.test" })
    ).toThrow("undeclared");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        samples: [
          { ...sample, queryArguments: { clientId: "private" } },
          { ...sample, warm: true },
        ],
      })
    ).toThrow("undeclared");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, environment: "production" })
    ).toThrow("environment");
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({ ...baseline, measurementVersion: 1 })
    ).toThrow("measurementVersion");
    expect(() => parseStaffWorkspacePerformanceBaseline({ ...baseline, trialCount: 2 })).toThrow(
      "trialCount"
    );
    expect(() =>
      parseStaffWorkspacePerformanceBaseline({
        ...baseline,
        targetBinding: {
          ...targetBinding,
          convexSiteOrigin: "https://other-preview.convex.site",
        },
      })
    ).toThrow("targetBinding");
  });

  test("Parses legacy single-trial Staff evidence only as an explicit v1 transition source", () => {
    const legacy = {
      createdAt: "2026-08-15T12:00:00.000Z",
      environment: "authenticated explicit non-production browser target",
      pendingTargets: STAFF_WORKSPACE_PERFORMANCE_TARGETS,
      revision: targetBinding.revision,
      samples: [],
      schemaVersion: 3,
      sourceFiles: ["convex/crm/queries.ts"],
      sourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
      targetBinding,
    };

    expect(parseStaffWorkspacePerformanceBaseline(legacy)).toMatchObject({
      measurementVersion: 1,
      schemaVersion: 3,
      trialCount: 1,
    });
    expect(
      isStaffWorkspacePerformanceBaselineFresh(
        parseStaffWorkspacePerformanceBaseline(legacy),
        legacy.sourceHash
      )
    ).toBe(false);
  });
});
