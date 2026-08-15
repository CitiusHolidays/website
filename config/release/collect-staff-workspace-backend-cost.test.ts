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

function trialEvidence() {
  return targets.map((target, targetIndex) => ({
    cold: {
      finishedAtUnixMs: 1000 + targetIndex * 100 + 40,
      startedAtUnixMs: 1000 + targetIndex * 100,
      subscriptions: [`crm.${target}.list`, "crm.shell.list"],
      target,
      warm: false,
    },
    revision,
    target,
    warm: {
      finishedAtUnixMs: 1000 + targetIndex * 100 + 90,
      startedAtUnixMs: 1000 + targetIndex * 100 + 50,
      subscriptions: [`crm.${target}.list`, "crm.shell.list"],
      target,
      warm: true,
    },
  }));
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
    const browserEvidence = trialEvidence();
    const completions = browserEvidence.flatMap((entry, targetIndex) => [
      completion(providerIdentifier(`crm.${entry.target}.list`), 1000 + targetIndex * 100 + 10),
      completion(providerIdentifier("crm.shell.list"), 1000 + targetIndex * 100 + 20, {
        executionTime: 0.006,
        usageStats: {
          databaseIoReadBytes: 45,
          databaseReadBytes: 50,
          databaseReadDocuments: 2,
        },
        willRetry: targetIndex === 0,
      }),
      completion(providerIdentifier(`crm.${entry.target}.list`), 1000 + targetIndex * 100 + 60, {
        cachedResult: true,
        executionTime: 0.001,
        usageStats: {
          databaseIoReadBytes: 0,
          databaseReadBytes: 0,
          databaseReadDocuments: 0,
        },
      }),
      completion(providerIdentifier("crm.shell.list"), 1000 + targetIndex * 100 + 70, {
        cachedResult: true,
        executionTime: 0.001,
        usageStats: {
          databaseIoReadBytes: 0,
          databaseReadBytes: 0,
          databaseReadDocuments: 0,
        },
      }),
      completion("crm.private.unrelated", 1000 + targetIndex * 100 + 30),
    ]);

    const result = buildStaffWorkspaceBackendCostMetricsExport({
      browserEvidence,
      completionEvents: completions,
      revision,
      target: { id: "preview-fixture-preview-branch-123", kind: "preview" },
    });

    expect(result).toMatchObject({ revision, schemaVersion: 2 });
    expect(result.samples).toHaveLength(16);
    expect(result.samples[0]).toEqual({
      databaseIoReadBytes: 135,
      databaseReadBytes: 150,
      documentsRead: 5,
      executionMs: 10,
      occRetries: 1,
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
    const browserEvidence = trialEvidence();
    const completions = browserEvidence.flatMap((entry, targetIndex) => [
      completion(providerIdentifier(`crm.${entry.target}.list`), 1000 + targetIndex * 100 + 10),
      completion(providerIdentifier("crm.shell.list"), 1000 + targetIndex * 100 + 20),
      completion(providerIdentifier(`crm.${entry.target}.list`), 1000 + targetIndex * 100 + 60),
      completion(providerIdentifier("crm.shell.list"), 1000 + targetIndex * 100 + 70),
    ]);
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        browserEvidence,
        completionEvents: completions.slice(1),
        revision,
        target: { id: "preview-fixture-preview-branch-123", kind: "preview" },
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
        completionEvents: completions,
        revision,
        target: { id: "preview-fixture-preview-branch-123", kind: "preview" },
      })
    ).toThrow("privacy-safe");
    expect(() =>
      buildStaffWorkspaceBackendCostMetricsExport({
        browserEvidence: [
          { ...browserEvidence[0], revision: "other" },
          ...browserEvidence.slice(1),
        ],
        completionEvents: completions,
        revision,
        target: { id: "preview-fixture-preview-branch-123", kind: "preview" },
      })
    ).toThrow("revision");
  });
});
