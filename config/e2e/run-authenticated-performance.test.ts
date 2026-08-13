import { describe, expect, test } from "bun:test";
import {
  STAFF_WORKSPACE_PERFORMANCE_TARGETS,
  type StaffWorkspacePerformanceTarget,
} from "../release/staff-workspace-performance-budget";
import { consolidateAuthenticatedPerformanceEvidence } from "./run-authenticated-performance";

function sample(target: StaffWorkspacePerformanceTarget, warm: boolean) {
  return { target, warm };
}

describe("revision-bound authenticated performance evidence", () => {
  const values = STAFF_WORKSPACE_PERFORMANCE_TARGETS.map((target) => ({
    cold: sample(target, false),
    revision: "abc123+dirty.123456789abc",
    target,
    warm: sample(target, true),
  }));

  test("requires every cold/warm scenario at one exact revision", () => {
    const evidence = consolidateAuthenticatedPerformanceEvidence(
      "abc123+dirty.123456789abc",
      values,
      ["package.json"],
      "source-hash",
      "2026-08-12T12:00:00.000Z"
    );
    expect(evidence.samples).toHaveLength(STAFF_WORKSPACE_PERFORMANCE_TARGETS.length * 2);
    expect(evidence).toMatchObject({
      pendingTargets: [],
      revision: "abc123+dirty.123456789abc",
      schemaVersion: 2,
      sourceHash: "source-hash",
    });
  });

  test("fails closed for missing targets, revision mismatch, or malformed warm state", () => {
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        "abc123+dirty.123456789abc",
        values.slice(1),
        [],
        "x"
      )
    ).toThrow("missing");
    expect(() => consolidateAuthenticatedPerformanceEvidence("other", values, [], "x")).toThrow(
      "revision mismatch"
    );
    expect(() =>
      consolidateAuthenticatedPerformanceEvidence(
        "abc123+dirty.123456789abc",
        [{ ...values[0], warm: sample("job-cards", false) }, ...values.slice(1)] as any,
        [],
        "x"
      )
    ).toThrow("warm sample");
  });
});
