import { describe, expect, test } from "bun:test";
import {
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
  const values = STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => ({
    cold: sample(target, false),
    revision: approvedTarget.revision,
    target,
    warm: sample(target, true),
  }));

  test("requires every cold/warm scenario at one exact revision", () => {
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      approvedTarget.revision,
      values,
      ["package.json"],
      "source-hash",
      approvedTarget,
      "2026-08-12T12:00:00.000Z"
    );
    expect(evidence.samples).toHaveLength(STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2);
    expect(evidence).toMatchObject({
      pendingTargets: [],
      revision: approvedTarget.revision,
      schemaVersion: 3,
      sourceHash: "source-hash",
      targetBinding: approvedTarget,
    });
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
        approvedTarget
      )
    ).toThrow("target count");
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence("other", values, [], "x", approvedTarget)
    ).toThrow("approved target");
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        approvedTarget.revision,
        [{ ...values[0], warm: sample("job-cards", false) }, ...values.slice(1)] as any,
        [],
        "x",
        approvedTarget
      )
    ).toThrow("warm sample");
  });
});
