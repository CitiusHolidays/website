import { describe, expect, test } from "bun:test";
import type { ApprovedE2eTarget } from "../e2e/target-identity";
import { buildStaffWorkspaceBackendCostCandidate } from "./ingest-staff-workspace-backend-cost";
import {
  parseStaffWorkspaceBackendCostMetricsExport,
  type StaffWorkspaceBackendCostSample,
} from "./staff-workspace-backend-cost";
import { STAFF_WORKSPACE_PERFORMANCE_TARGETS } from "./staff-workspace-performance-budget";

const approvedTarget: ApprovedE2eTarget = {
  convexSiteOrigin: "https://fixture-preview.convex.site",
  convexSourceHash: "2a4c1731bb9979f020154062b6aa396ed06ac1fc45a8f45cb571007672bb8b99",
  frontendOrigin: "https://branch.example.test",
  id: "preview-fixture-preview-branch-123",
  revision: "a8052f3a0f1a211c110a69decdaf5fc34358a957",
  target: "preview",
};
const revision = "abcdef1234567890";
const samples = STAFF_WORKSPACE_PERFORMANCE_TARGETS.flatMap((target) =>
  [false, true].map(
    (warm): StaffWorkspaceBackendCostSample => ({
      databaseIoReadBytes: 90,
      databaseReadBytes: 100,
      documentsRead: 3,
      executionMs: 4,
      occRetries: 0,
      target,
      warm,
    })
  )
);

describe("Staff Workspace backend-cost evidence ingestion", () => {
  test("builds only revision-bound evidence for the approved non-production target", () => {
    const metricsExport = parseStaffWorkspaceBackendCostMetricsExport({
      revision,
      samples,
      schemaVersion: 2,
      target: { id: approvedTarget.id, kind: approvedTarget.target },
    });
    expect(
      buildStaffWorkspaceBackendCostCandidate({
        approvedTarget,
        currentRevision: revision,
        metricsExport,
        sourceFiles: ["package.json"],
        sourceHash: "a".repeat(64),
      })
    ).toMatchObject({
      revision,
      samples,
      status: "measured",
      target: { id: approvedTarget.id, kind: "preview" },
    });
    expect(() =>
      buildStaffWorkspaceBackendCostCandidate({
        approvedTarget,
        currentRevision: "1111111",
        metricsExport,
        sourceFiles: ["package.json"],
        sourceHash: "a".repeat(64),
      })
    ).toThrow("revision");
  });

  test("rejects unknown fields, missing route samples, and Production-like targets", () => {
    expect(() =>
      parseStaffWorkspaceBackendCostMetricsExport({
        rawArguments: ["must-not-pass"],
        revision,
        samples,
        schemaVersion: 2,
        target: { id: approvedTarget.id, kind: approvedTarget.target },
      })
    ).toThrow("rawArguments");
    expect(() =>
      parseStaffWorkspaceBackendCostMetricsExport({
        revision,
        samples: samples.slice(1),
        schemaVersion: 2,
        target: { id: approvedTarget.id, kind: approvedTarget.target },
      })
    ).toThrow("missing queries cold");
    expect(() =>
      parseStaffWorkspaceBackendCostMetricsExport({
        revision,
        samples,
        schemaVersion: 2,
        target: { id: "preview-production", kind: "preview" },
      })
    ).toThrow("non-production kind");
  });
});
