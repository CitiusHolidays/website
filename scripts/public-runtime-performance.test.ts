import { describe, expect, test } from "bun:test";
import {
  aggregatePublicRuntimeP95Trials,
  aggregatePublicRuntimeTrials,
  assertLocalPerformanceTarget,
  assertServedBuildRevision,
  summarizePublicRuntimeEntries,
} from "./public-runtime-performance";

describe("public runtime performance collector", () => {
  test("classifies first-party, third-party, critical, script, css, and gated media transfer", () => {
    const summary = summarizePublicRuntimeEntries("http://localhost:3000/", [
      {
        duration: 10,
        initiatorType: "navigation",
        name: "http://localhost:3000/",
        transferSize: 100,
      },
      {
        duration: 20,
        initiatorType: "script",
        name: "http://localhost:3000/app.js",
        transferSize: 200,
      },
      {
        duration: 5,
        initiatorType: "link",
        name: "http://localhost:3000/app.css",
        transferSize: 50,
      },
      {
        duration: 50,
        initiatorType: "video",
        name: "http://localhost:3000/hero.mp4",
        transferSize: 500,
      },
      { duration: 4, initiatorType: "fetch", name: "https://example.test/a", transferSize: 25 },
    ]);

    expect(summary).toMatchObject({
      criticalTransferBytes: 350,
      cssTransferBytes: 50,
      firstPartyTransferBytes: 850,
      gatedMediaTransferBytes: 500,
      jsTransferBytes: 200,
      thirdPartyTransferBytes: 25,
    });
    expect(summary.slowestFirstPartyResources[0]?.path).toBe("/hero.mp4");
  });

  test("aggregates repeated trials by median and retains the slowest resource evidence", () => {
    const trial = {
      criticalTransferBytes: 100,
      cssTransferBytes: 10,
      domCompleteMs: 100,
      domInteractiveMs: 90,
      fcpMs: 60,
      firstPartyTransferBytes: 120,
      gatedMediaTransferBytes: 0,
      heroVideoRequests: 0,
      jsTransferBytes: 80,
      lcpMs: 70,
      loadMs: 110,
      requests: 5,
      slowestFirstPartyResources: [
        { durationMs: 10, path: "/a.js", transferBytes: 80, type: "script" },
      ],
      thirdPartyTransferBytes: 0,
      ttfbMs: 20,
    };
    const result = aggregatePublicRuntimeTrials([
      { ...trial, lcpMs: 90 },
      { ...trial, lcpMs: 70 },
      { ...trial, lcpMs: 80 },
    ]);

    expect(result.lcpMs).toBe(80);
    expect(result.trials).toBe(3);
    expect(result.slowestFirstPartyResources[0]?.path).toBe("/a.js");
    expect(
      aggregatePublicRuntimeP95Trials([
        { ...trial, lcpMs: 90 },
        { ...trial, lcpMs: 70 },
        { ...trial, lcpMs: 80 },
      ]).lcpMs
    ).toBe(90);
  });

  test("rejects a stale served Next build identity", () => {
    const revision = "59e703531feb7e63887382801cef860badde9546";
    expect(assertServedBuildRevision(revision, revision)).toBe(revision);
    expect(() =>
      assertServedBuildRevision("a8052f3a0f1a211c110a69decdaf5fc34358a957", revision)
    ).toThrow("build ID");
  });

  test("refuses production and non-loopback targets", () => {
    expect(() => assertLocalPerformanceTarget("https://citiusholidays.com")).toThrow("loopback");
    expect(() => assertLocalPerformanceTarget("https://preview.example.test")).toThrow("loopback");
    expect(assertLocalPerformanceTarget("http://localhost:3000").hostname).toBe("localhost");
  });
});
