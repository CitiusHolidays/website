import { describe, expect, test } from "bun:test";
import {
  evaluateStaffWorkspaceBackendCost,
  evaluateStaffWorkspaceBackendCostRelativeRegression,
  parseStaffWorkspaceBackendCostBaseline,
  parseStaffWorkspaceBackendCostBudgetManifest,
} from "./staff-workspace-backend-cost";
import baselineJson from "./staff-workspace-backend-cost-baseline.json";
import budgetJson from "./staff-workspace-backend-cost-budgets.json";

describe("Staff Workspace backend-cost evidence", () => {
  const manifest = parseStaffWorkspaceBackendCostBudgetManifest(budgetJson);

  test("keeps measured evidence complete and bound to an explicit Preview", () => {
    const baseline = parseStaffWorkspaceBackendCostBaseline(baselineJson);
    expect(baseline).toMatchObject({
      comparison: {
        fixedFindingCount: 0,
        p95RelativeComparison: "fixed_only",
        relativeFindingCount: 0,
      },
      revision: "70e9d30f316d1cc524f456f88bb55ad677711fdd",
      schemaVersion: 3,
      status: "measured",
      target: {
        id: "preview-elegant-bullfrog-454-1d7192c",
        kind: "preview",
      },
      targetBinding: {
        convexSourceHash: "f05cf209be4d56eef6062f87cf240d20832af3a27c8c56f4eaba6fe43bca397f",
        revision: "70e9d30f316d1cc524f456f88bb55ad677711fdd",
        target: "preview",
      },
      trialCount: 5,
    });
    expect(baseline.samples).toHaveLength(16);
    expect(baseline.p95Samples).toHaveLength(16);
    expect(baseline.samples.every((sample) => sample.occRetries === 0)).toBe(true);
  });

  test("fails a deliberate per-row read regression", () => {
    expect(
      evaluateStaffWorkspaceBackendCost(manifest, {
        databaseIoReadBytes: 1,
        databaseReadBytes: 1,
        documentsRead: 81,
        executionMs: 1,
        occRetries: 0,
        target: "queries",
        warm: false,
      })
    ).toEqual([
      expect.objectContaining({
        actual: 81,
        maximum: 80,
        metric: "maxDocumentsRead",
        target: "queries",
      }),
    ]);
  });

  test("uses only provider-native Convex completion metrics", () => {
    expect(manifest.schemaVersion).toBe(3);
    expect(() =>
      parseStaffWorkspaceBackendCostBaseline({
        environment: "authenticated preview backend metrics",
        revision: "abcdef1",
        samples: Array.from({ length: 16 }, (_, index) => ({
          databaseIoReadBytes: 1,
          databaseRangesRead: 1,
          databaseReadBytes: 1,
          documentsRead: 1,
          executionMs: 1,
          occRetries: 0,
          target: [
            "queries",
            "proposals",
            "job-cards",
            "contracting",
            "finance",
            "tickets",
            "hotels",
            "visa",
          ][Math.floor(index / 2)],
          warm: index % 2 === 1,
        })),
        schemaVersion: 2,
        sourceFiles: ["package.json"],
        sourceHash: "a".repeat(64),
        status: "measured",
        target: { id: "preview-fixture-preview", kind: "preview" },
      })
    ).toThrow("databaseRangesRead");
  });

  test("fails a calibrated relative provider-cost regression below the hard cap", () => {
    const accepted = {
      databaseIoReadBytes: 10_000,
      databaseReadBytes: 10_000,
      documentsRead: 20,
      executionMs: 100,
      occRetries: 0,
      target: "queries" as const,
      warm: false,
    };
    expect(
      evaluateStaffWorkspaceBackendCostRelativeRegression(
        manifest,
        { ...accepted, documentsRead: 35 },
        accepted
      )
    ).toEqual([expect.objectContaining({ baseline: 20, limit: 30, metric: "documentsRead" })]);
  });

  test("rejects Production identities and partial measured evidence", () => {
    expect(() =>
      parseStaffWorkspaceBackendCostBaseline({
        ...baselineJson,
        environment: "Production",
        revision: "abcdef1",
        samples: [],
        sourceFiles: ["package.json"],
        sourceHash: "a".repeat(64),
        status: "measured",
        target: { id: "preview-production-live", kind: "preview" },
      })
    ).toThrow("non-production kind");
    expect(() =>
      parseStaffWorkspaceBackendCostBaseline({
        ...baselineJson,
        revision: "abcdef1",
        samples: [],
        sourceFiles: [],
        sourceHash: "a".repeat(64),
        status: "measured",
        target: { id: "preview-fixture-preview", kind: "preview" },
      })
    ).toThrow("sourceFiles");
    expect(() =>
      parseStaffWorkspaceBackendCostBaseline({ ...baselineJson, undeclared: true })
    ).toThrow("undeclared");
  });
});
