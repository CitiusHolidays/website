import { describe, expect, test } from "bun:test";
import {
  evaluatePublicRuntimePerformance,
  isPublicRuntimeBaselineFresh,
  PUBLIC_RUNTIME_SCENARIOS,
  type PublicRuntimeMetric,
  parsePublicRuntimeBaseline,
  parsePublicRuntimeBudgetManifest,
} from "./public-runtime-performance";

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
  scenarios: Object.fromEntries(
    PUBLIC_RUNTIME_SCENARIOS.map((scenario) => [scenario.id, metricPolicy])
  ),
  schemaVersion: 1,
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
    trials: 3,
    ttfbMs: 50,
    variant: scenario.variant,
    viewport: scenario.viewport,
  };
}

const validBaseline = {
  browser: "Chromium fixture",
  buildMode: "local Next production build",
  measuredAt: "2026-08-12T00:00:00.000Z",
  revision: "abc123",
  samples: PUBLIC_RUNTIME_SCENARIOS.map((scenario) => sampleFor(scenario.id)),
  schemaVersion: 1,
  sourceFiles: ["src/components/pages/HeroVideo.js"],
  sourceHash: "source-hash",
};

describe("public runtime performance contract", () => {
  test("fails closed for empty, unknown, incomplete, and invalid budget manifests", () => {
    expect(() => parsePublicRuntimeBudgetManifest({ scenarios: {}, schemaVersion: 2 })).toThrow(
      "schemaVersion"
    );
    expect(() => parsePublicRuntimeBudgetManifest({ scenarios: {}, schemaVersion: 1 })).toThrow(
      "home-desktop"
    );
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

  test("requires one metadata-bound sample for every declared scenario", () => {
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

  test("reports warning and failure thresholds and forbids gated video in opt-out variants", () => {
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

  test("binds freshness to the monitored public runtime source hash", () => {
    expect(
      isPublicRuntimeBaselineFresh(parsePublicRuntimeBaseline(validBaseline), "source-hash")
    ).toBe(true);
    expect(isPublicRuntimeBaselineFresh(parsePublicRuntimeBaseline(validBaseline), "changed")).toBe(
      false
    );
  });
});
