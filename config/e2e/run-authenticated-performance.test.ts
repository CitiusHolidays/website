import { describe, expect, test } from "bun:test";
import {
  isStaffWorkspaceRelativeMetricComparable,
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "../release/staff-workspace-performance-budget";
import { consolidateAuthenticatedPerformanceEvidence } from "./run-authenticated-performance";

function sample(target: StaffWorkspacePerformanceTarget, warm: boolean) {
  return {
    applicationPayloadBytes: 100,
    duplicateSubscriptions: 0,
    firstContentMs: 1000,
    logicalSubscriptions: 5,
    pendingMs: 1,
    routeReadyMs: 25,
    routeResourceTransferBytes: 1000,
    subscriptions: ["crm.queries.listPage"],
    target,
    warm,
  };
}

describe("revision-bound authenticated performance evidence", () => {
  const approvedTarget = {
    convexSiteOrigin: "https://elegant-bullfrog-454.convex.site",
    convexSourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
    frontendOrigin: "https://preview.example.test",
    id: "preview-elegant-bullfrog-454-test",
    revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
    target: "preview" as const,
  };
  const values = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) =>
    [1, 2, 3, 4, 5].map((trial) => ({
      cold: { ...sample(target, false), routeReadyMs: trial === 1 ? 1000 : trial * 10 },
      revision: approvedTarget.revision,
      target,
      warm: { ...sample(target, true), routeReadyMs: trial * 20 },
    }))
  );
  const context = {
    browser: "Chromium 140.0.0.0",
    cleanupAudit: {
      activeActors: 0,
      auditedAt: "2026-08-12T12:00:00.000Z",
      boundExceeded: false as const,
      exportSourceChunks: 0,
      importOperationBatches: 0,
      incompleteRuns: 0,
      latestRun: {
        mutatedRecords: 0,
        ownedRecords: 0,
        runId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e000",
        status: "complete" as const,
      },
      mutatedRecords: 0,
      ownedRecords: 0,
      passengerExportOperations: 0,
      passengerImportOperations: 0,
      runsAudited: 5,
      storageReferences: 0,
      syntheticTravellers: 0,
      targetId: approvedTarget.id,
    },
    comparison: {
      acceptedBaselineDigest: "a".repeat(64),
      acceptedRevision: approvedTarget.revision,
      acceptedSourceHash: "b".repeat(64),
      fixedFindingCount: 0 as const,
      relativeFindingCount: 0 as const,
    },
  };

  test("requires every cold/warm scenario at one exact revision", () => {
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      approvedTarget.revision,
      values,
      ["package.json"],
      "source-hash",
      approvedTarget,
      context,
      "2026-08-12T12:00:00.000Z"
    );
    expect(evidence.samples).toHaveLength(STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2);
    expect(evidence).toMatchObject({
      measurementVersion: 2,
      pendingTargets: [],
      revision: approvedTarget.revision,
      schemaVersion: 5,
      sourceHash: "source-hash",
      targetBinding: approvedTarget,
      trialCount: 5,
    });
    expect(evidence.samples[0]?.routeReadyMs).toBe(40);
    expect(evidence.samples[1]?.routeReadyMs).toBe(60);
    expect(evidence.p95Samples[0]?.routeReadyMs).toBe(1000);
    expect(evidence.samples[0]).not.toHaveProperty("pendingMs");
    expect(evidence.samples[0]).not.toHaveProperty("subscriptions");
  });

  test("fails closed for missing targets, revision mismatch, or malformed warm state", () => {
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        approvedTarget.revision,
        values.slice(1),
        [],
        "x",
        approvedTarget,
        context
      )
    ).toThrow("5 trials");
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence("other", values, [], "x", approvedTarget, context)
    ).toThrow("approved target");
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        approvedTarget.revision,
        [{ ...values[0], warm: sample("job-cards", false) }, ...values.slice(1)] as any,
        [],
        "x",
        approvedTarget,
        context
      )
    ).toThrow("warm sample");
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        approvedTarget.revision,
        values.slice(0, -1),
        [],
        "x",
        approvedTarget,
        context
      )
    ).toThrow("5 trials");
  });
});

describe("Staff Workspace measurement transitions", () => {
  test("compares deterministic metrics while rejecting unsupported version jumps", () => {
    expect(isStaffWorkspaceRelativeMetricComparable(1, 2, "applicationPayloadBytes")).toBe(true);
    expect(isStaffWorkspaceRelativeMetricComparable(1, 2, "logicalSubscriptions")).toBe(true);
    expect(isStaffWorkspaceRelativeMetricComparable(1, 2, "firstContentMs")).toBe(false);
    expect(isStaffWorkspaceRelativeMetricComparable(1, 2, "routeReadyMs")).toBe(false);
    expect(isStaffWorkspaceRelativeMetricComparable(1, 2, "routeResourceTransferBytes")).toBe(
      false
    );
    expect(isStaffWorkspaceRelativeMetricComparable(2, 2, "routeReadyMs")).toBe(true);
    expect(() => isStaffWorkspaceRelativeMetricComparable(1, 3, "applicationPayloadBytes")).toThrow(
      "Unsupported"
    );
  });
});
