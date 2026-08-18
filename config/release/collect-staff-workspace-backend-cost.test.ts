import { describe, expect, test } from "bun:test";
import {
  acceptProviderTrialCapture,
  buildStaffWorkspaceBackendCostMetricsExport,
} from "./collect-staff-workspace-backend-cost";

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
  captureCount: 5,
  captureTimeoutMs: 300_000,
  command: "convex logs --deployment elegant-bullfrog-454 --success --jsonl --history 1000",
  deployment: "elegant-bullfrog-454",
  history: 1000,
  identityVerifiedAt: "2026-08-15T12:00:00.000Z",
  terminations: Array.from({ length: 5 }, () => "stopped_after_trial" as const),
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

function completionEvents(browserEvidence: ReturnType<typeof trialEvidence>, retryFirst = false) {
  return browserEvidence.flatMap((entry, index) => [
    completion(providerIdentifier(`crm.${entry.target}.list`), entry.cold.startedAtUnixMs + 10),
    completion(providerIdentifier("crm.shell.list"), entry.cold.startedAtUnixMs + 20, {
      executionTime: 0.006,
      usageStats: {
        databaseIoReadBytes: 45,
        databaseReadBytes: 50,
        databaseReadDocuments: 2,
      },
      willRetry: retryFirst && index === 0,
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

function repeatedTrialCaptures() {
  return Array.from({ length: 5 }, (_, trial) => {
    const browserEvidence = trialEvidence(trial * 10_000);
    return { browserEvidence, completionEvents: completionEvents(browserEvidence, trial === 0) };
  });
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
  test("Accepts only a completed stream or an owner-stopped trial with JSON evidence", () => {
    const stdout = `${JSON.stringify({ kind: "Completion" })}\n`;
    expect(acceptProviderTrialCapture({ error: null, stdout, stoppedByOwner: false })).toEqual({
      output: stdout.trim(),
      termination: "completed",
    });
    expect(acceptProviderTrialCapture({ error: null, stdout, stoppedByOwner: true })).toEqual({
      output: stdout.trim(),
      termination: "stopped_after_trial",
    });
    expect(
      acceptProviderTrialCapture({
        error: { killed: true, signal: "SIGTERM" },
        stdout,
        stoppedByOwner: true,
      })
    ).toEqual({ output: stdout.trim(), termination: "stopped_after_trial" });
    expect(() =>
      acceptProviderTrialCapture({
        error: { killed: true, signal: "SIGTERM" },
        stdout,
        stoppedByOwner: false,
      })
    ).toThrow("failed or exceeded");
    expect(() =>
      acceptProviderTrialCapture({
        error: { killed: true, signal: "SIGTERM" },
        stdout: "provider banner only",
        stoppedByOwner: true,
      })
    ).toThrow("no JSON events");
  });

  test("Joins exact browser windows to allowlisted subscriptions and sums provider metrics", () => {
    const result = buildStaffWorkspaceBackendCostMetricsExport({
      capturedAt: "2026-08-15T12:01:00.000Z",
      provider,
      revision,
      targetBinding,
      trialCaptures: repeatedTrialCaptures(),
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
    expect(result.p95Samples?.[0]?.occRetries).toBe(1);
  });

  test("Fails closed for missing subscriptions, unsafe names, and mismatched revisions", () => {
    const trialCaptures = repeatedTrialCaptures();
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        capturedAt: "2026-08-15T12:01:00.000Z",
        provider,
        revision,
        targetBinding,
        trialCaptures: [
          {
            ...trialCaptures[0]!,
            completionEvents: trialCaptures[0]!.completionEvents.slice(1),
          },
          ...trialCaptures.slice(1),
        ],
      })
    ).toThrow("missing completion");
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        capturedAt: "2026-08-15T12:01:00.000Z",
        provider,
        revision,
        targetBinding,
        trialCaptures: [
          {
            ...trialCaptures[0]!,
            browserEvidence: [
              {
                ...trialCaptures[0]!.browserEvidence[0],
                cold: {
                  ...trialCaptures[0]!.browserEvidence[0]!.cold,
                  subscriptions: ["crm.safe", "unsafe token"],
                },
              },
              ...trialCaptures[0]!.browserEvidence.slice(1),
            ],
          },
          ...trialCaptures.slice(1),
        ],
      })
    ).toThrow("privacy-safe");
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        capturedAt: "2026-08-15T12:01:00.000Z",
        provider,
        revision,
        targetBinding,
        trialCaptures: [
          {
            ...trialCaptures[0]!,
            browserEvidence: [
              { ...trialCaptures[0]!.browserEvidence[0], revision: "other" },
              ...trialCaptures[0]!.browserEvidence.slice(1),
            ],
          },
          ...trialCaptures.slice(1),
        ],
      })
    ).toThrow("revision");
  });
});
