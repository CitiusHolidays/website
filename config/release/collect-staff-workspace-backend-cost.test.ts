import { describe, expect, test } from "bun:test";
import { buildStaffWorkspaceBackendCostMetricsExport } from "./collect-staff-workspace-backend-cost";

const revision = "a8052f3a0f1a211c110a69decdaf5fc34358a957";
const targets = [
  "queries",
  "proposals",
  "job-cards",
  "contracting",
  "finance",
  "tickets",
  "hotels",
  "visa",
] as const;

const targetBinding = {
  convexSiteOrigin: "https://elegant-bullfrog-454.convex.site",
  convexSourceHash: "a".repeat(64),
  frontendOrigin: "https://preview.example.test",
  id: "preview-elegant-bullfrog-454-test",
  revision,
  target: "preview" as const,
};
const provider = {
  command: "convex logs --deployment elegant-bullfrog-454 --success --jsonl --history 10000",
  deployment: "elegant-bullfrog-454",
  history: 10_000,
  identityVerifiedAt: "2026-08-15T12:00:00.000Z",
};

function trialEvidence(offset = 0) {
  return targets.map((target, targetIndex) => ({
    cold: {
      finishedAtUnixMs: offset + 1000 + targetIndex * 100 + 40,
      startedAtUnixMs: offset + 1000 + targetIndex * 100,
      subscriptions: [`crm.${target}.list`, "crm.shell.list"],
      target,
      warm: false,
    },
    revision,
    target,
    warm: {
      finishedAtUnixMs: offset + 1000 + targetIndex * 100 + 90,
      startedAtUnixMs: offset + 1000 + targetIndex * 100 + 50,
      subscriptions: [`crm.${target}.list`, "crm.shell.list"],
      target,
      warm: true,
    },
  }));
}

function repeatedTrialEvidence() {
  return Array.from({ length: 5 }, (_, trial) => trialEvidence(trial * 10_000)).flat();
}

function completionEvents(browserEvidence: ReturnType<typeof repeatedTrialEvidence>) {
  return browserEvidence.flatMap((entry, index) => [
    completion(providerIdentifier(`crm.${entry.target}.list`), entry.cold.startedAtUnixMs + 10),
    completion(providerIdentifier("crm.shell.list"), entry.cold.startedAtUnixMs + 20, {
      executionTime: 0.006,
      usageStats: {
        databaseIoReadBytes: 45,
        databaseReadBytes: 50,
        databaseReadDocuments: 2,
      },
      willRetry: index === 0,
    }),
    completion(providerIdentifier(`crm.${entry.target}.list`), entry.warm.startedAtUnixMs + 10, {
      cachedResult: true,
      executionTime: 0.001,
      usageStats: {
        databaseIoReadBytes: 0,
        databaseReadBytes: 0,
        databaseReadDocuments: 0,
      },
    }),
    completion(providerIdentifier("crm.shell.list"), entry.warm.startedAtUnixMs + 20, {
      cachedResult: true,
      executionTime: 0.001,
      usageStats: {
        databaseIoReadBytes: 0,
        databaseReadBytes: 0,
        databaseReadDocuments: 0,
      },
    }),
    completion("crm.private.unrelated", entry.cold.startedAtUnixMs + 30),
  ]);
}

function completion(identifier: string, timestampMs: number, overrides = {}) {
  return {
    cachedResult: false,
    executionTime: 0.004,
    identifier,
    kind: "Completion",
    timestamp: timestampMs / 1000,
    usageStats: {
      databaseIoReadBytes: 90,
      databaseReadBytes: 100,
      databaseReadDocuments: 3,
    },
    willRetry: false,
    ...overrides,
  };
}

function providerIdentifier(subscription: string) {
  const parts = subscription.split(".");
  return `${parts.slice(0, -1).join("/")}:${parts.at(-1)}`;
}

describe("Staff Workspace provider completion aggregation", () => {
  test("joins exact browser windows to allowlisted subscriptions and sums provider metrics", () => {
    const browserEvidence = repeatedTrialEvidence();
    const completions = completionEvents(browserEvidence);

    const result = buildStaffWorkspaceBackendCostMetricsExport({
      browserEvidence,
      capturedAt: "2026-08-15T12:01:00.000Z",
      completionEvents: completions,
      provider,
      revision,
      targetBinding,
    });

    expect(result).toMatchObject({ revision, schemaVersion: 3, targetBinding, trialCount: 5 });
    expect(result.samples).toHaveLength(16);
    expect(result.samples[0]).toEqual({
      databaseIoReadBytes: 135,
      databaseReadBytes: 150,
      documentsRead: 5,
      executionMs: 10,
      occRetries: 0,
      target: "queries",
      warm: false,
    });
    expect(result.samples[1]).toEqual({
      databaseIoReadBytes: 0,
      databaseReadBytes: 0,
      documentsRead: 0,
      executionMs: 2,
      occRetries: 0,
      target: "queries",
      warm: true,
    });
  });

  test("fails closed for missing subscriptions, unsafe names, and mismatched revisions", () => {
    const browserEvidence = repeatedTrialEvidence();
    const completions = completionEvents(browserEvidence);
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        browserEvidence,
        capturedAt: "2026-08-15T12:01:00.000Z",
        completionEvents: completions.slice(1),
        provider,
        revision,
        targetBinding,
      })
    ).toThrow("missing completion");
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        browserEvidence: [
          {
            ...browserEvidence[0],
            cold: { ...browserEvidence[0]!.cold, subscriptions: ["crm.safe", "unsafe token"] },
          },
          ...browserEvidence.slice(1),
        ],
        capturedAt: "2026-08-15T12:01:00.000Z",
        completionEvents: completions,
        provider,
        revision,
        targetBinding,
      })
    ).toThrow("privacy-safe");
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        browserEvidence: [
          { ...browserEvidence[0], revision: "other" },
          ...browserEvidence.slice(1),
        ],
        capturedAt: "2026-08-15T12:01:00.000Z",
        completionEvents: completions,
        provider,
        revision,
        targetBinding,
      })
    ).toThrow("revision");
  });
});
