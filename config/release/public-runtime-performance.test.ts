import { describe, expect, test } from "bun:test";
import {
  evaluatePublicRuntimePerformance,
  evaluatePublicRuntimeRelativeRegression,
  isPublicRuntimeBaselineFresh,
  PUBLIC_RUNTIME_SCENARIOS,
  type PublicRuntimeMetric,
  parsePublicRuntimeBaseline,
  parsePublicRuntimeBudgetManifest,
} from "./public-runtime-performance";

// SAFETY: This test controls the asserted value at the framework boundary below.
const metricPolicy = Object.fromEntries(
  [
    "criticalTransferBytes",
    "cssTransferBytes",
    "domCompleteMs",
    "domInteractiveMs",
    "fcpMs",
    "jsTransferBytes",
    "lcpMs",
    "loadMs",
    "requests",
    "ttfbMs",
  ].map((metric) => [metric, { fail: 200, warn: 100 }])
) as Record<PublicRuntimeMetric, { fail: number; warn: number }>;

const validBudget = {
  relativeRegression: Object.fromEntries(
    Object.keys(metricPolicy).map((metric) => [
      metric,
      { maxIncreaseFraction: 0.25, minAbsoluteIncrease: metric === "requests" ? 5 : 100 },
    ])
  ),
  scenarios: Object.fromEntries(
    PUBLIC_RUNTIME_SCENARIOS.map((scenario) => [scenario.id, metricPolicy])
  ),
  schemaVersion: 2,
};

function sampleFor(id: (typeof PUBLIC_RUNTIME_SCENARIOS)[number]["id"]) {
  const scenario = PUBLIC_RUNTIME_SCENARIOS.find((entry) => entry.id === id)!;
  return {
    cache: "cold",
    criticalTransferBytes: 50,
    cssTransferBytes: 50,
    domCompleteMs: 50,
    domInteractiveMs: 50,
    fcpMs: 50,
    firstPartyTransferBytes: 50,
    gatedMediaTransferBytes: 0,
    heroVideoRequests: 0,
    id,
    jsTransferBytes: 50,
    lcpMs: 50,
    loadMs: 50,
    network: "loopback-unthrottled",
    path: scenario.path,
    requests: 5,
    slowestFirstPartyResources: [],
    thirdPartyTransferBytes: 0,
    trials: 5,
    ttfbMs: 50,
    variant: scenario.variant,
    viewport: scenario.viewport,
  };
}

const validBaseline = {
  browser: "Chromium 151.0.7922.34",
  buildMode: "local Next production server",
  comparison: {
    acceptedBaselineDigest: "a".repeat(64),
    acceptedRevision: "59e703531feb7e63887382801cef860badde9546",
    acceptedSourceHash: "b".repeat(64),
    fixedFindingCount: 0,
    p95RelativeComparison: "fixed_only",
    relativeFindingCount: 0,
  },
  measuredAt: "2026-08-12T00:00:00.000Z",
  p95Samples: PUBLIC_RUNTIME_SCENARIOS.map((scenario) => sampleFor(scenario.id)),
  revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  samples: PUBLIC_RUNTIME_SCENARIOS.map((scenario) => sampleFor(scenario.id)),
  schemaVersion: 2,
  servedBuildId: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  sourceFiles: ["src/components/pages/HeroVideo.js"],
  sourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
};

describe("Public runtime performance contract", () => {
  test("Fails closed for empty, unknown, incomplete, and invalid budget manifests", () => {
    expect(() => parsePublicRuntimeBudgetManifest({ scenarios: {}, schemaVersion: 1 })).toThrow(
      "schemaVersion"
    );
    expect(() =>
      parsePublicRuntimeBudgetManifest({
        relativeRegression: validBudget.relativeRegression,
        scenarios: {},
        schemaVersion: 2,
      })
    ).toThrow("home-desktop");
    expect(() =>
      parsePublicRuntimeBudgetManifest({
        ...validBudget,
        scenarios: { ...validBudget.scenarios, unknown: metricPolicy },
      })
    ).toThrow("unknown");
    expect(() =>
      parsePublicRuntimeBudgetManifest({
        ...validBudget,
        scenarios: {
          ...validBudget.scenarios,
          "home-desktop": { ...metricPolicy, lcpMs: { fail: 90, warn: 100 } },
        },
      })
    ).toThrow("lcpMs.fail");
  });

  test("Requires one metadata-bound sample for every declared scenario", () => {
    expect(() => parsePublicRuntimeBaseline({ ...validBaseline, samples: [] })).toThrow("samples");
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        samples: [...validBaseline.samples, validBaseline.samples[0]],
      })
    ).toThrow("duplicate");
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        samples: validBaseline.samples.map((sample, index) =>
          index === 0 ? { ...sample, path: "/wrong" } : sample
        ),
      })
    ).toThrow("samples[0].path");
  });

  test("Rejects weak or privacy-unsafe replacement provenance", () => {
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        samples: validBaseline.samples.map((sample, index) =>
          index === 0 ? { ...sample, trials: 1 } : sample
        ),
      })
    ).toThrow("trials");
    expect(() => parsePublicRuntimeBaseline({ ...validBaseline, measuredAt: "yesterday" })).toThrow(
      "measuredAt"
    );
    expect(() => parsePublicRuntimeBaseline({ ...validBaseline, revision: "abc123" })).toThrow(
      "revision"
    );
    expect(() =>
      parsePublicRuntimeBaseline({ ...validBaseline, buildMode: "development" })
    ).toThrow("buildMode");
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        servedBuildId: "59e703531feb7e63887382801cef860badde9546",
      })
    ).toThrow("servedBuildId");
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        comparison: { ...validBaseline.comparison, relativeFindingCount: 1 },
      })
    ).toThrow("comparison");
    expect(() =>
      parsePublicRuntimeBaseline({ ...validBaseline, customerEmail: "x@test.dev" })
    ).toThrow("undeclared");
    expect(() =>
      parsePublicRuntimeBaseline({
        ...validBaseline,
        samples: validBaseline.samples.map((sample, index) =>
          index === 0
            ? {
                ...sample,
                slowestFirstPartyResources: [
                  {
                    durationMs: 1,
                    path: "https://example.test/private",
                    transferBytes: 1,
                    type: "fetch",
                  },
                ],
              }
            : sample
        ),
      })
    ).toThrow("same-origin path");
  });

  test("Fails candidate regressions above both relative and absolute noise allowances", () => {
    const accepted = sampleFor("home-desktop");
    const withinNoise = { ...accepted, lcpMs: 140 };
    const regressed = { ...accepted, lcpMs: 151 };

    expect(evaluatePublicRuntimeRelativeRegression(validBudget, withinNoise, accepted)).toEqual([]);
    expect(evaluatePublicRuntimeRelativeRegression(validBudget, regressed, accepted)).toEqual([
      expect.objectContaining({
        baseline: 50,
        limit: 150,
        metric: "lcpMs",
        scenario: "home-desktop",
      }),
    ]);
  });

  test("Reports warning and failure thresholds and forbids gated video in opt-out variants", () => {
    const budget = parsePublicRuntimeBudgetManifest(validBudget);
    const warning = evaluatePublicRuntimePerformance(budget, {
      ...sampleFor("home-desktop"),
      lcpMs: 150,
    });
    const failure = evaluatePublicRuntimePerformance(budget, {
      ...sampleFor("home-reduced-motion"),
      heroVideoRequests: 1,
      jsTransferBytes: 250,
    });

    expect(warning).toEqual([expect.objectContaining({ metric: "lcpMs", severity: "warning" })]);
    expect(failure).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "jsTransferBytes", severity: "failure" }),
        expect.objectContaining({ metric: "heroVideoRequests", severity: "failure" }),
      ])
    );
  });

  test("Binds freshness to the monitored public runtime source hash", () => {
    expect(
      isPublicRuntimeBaselineFresh(
        parsePublicRuntimeBaseline(validBaseline),
        "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99"
      )
    ).toBe(true);
    expect(isPublicRuntimeBaselineFresh(parsePublicRuntimeBaseline(validBaseline), "changed")).toBe(
      false
    );
  });
});
