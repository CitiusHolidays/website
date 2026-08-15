import { describe, expect, test } from "bun:test";
import {
  evaluateStaffWorkspaceBackendCost,
  parseStaffWorkspaceBackendCostBaseline,
  parseStaffWorkspaceBackendCostBudgetManifest,
} from "./staff-workspace-backend-cost";
import baselineJson from "./staff-workspace-backend-cost-baseline.json";
import budgetJson from "./staff-workspace-backend-cost-budgets.json";

describe("Staff Workspace backend-cost evidence", () => {
  const manifest = parseStaffWorkspaceBackendCostBudgetManifest(budgetJson);

  test("keeps an unmeasured baseline explicitly pending", () => {
    expect(parseStaffWorkspaceBackendCostBaseline(baselineJson)).toMatchObject({
      samples: [],
      status: "pending_target_measurement",
      target: null,
    });
  });

  test("fails a deliberate per-row read regression", () => {
    expect(
      evaluateStaffWorkspaceBackendCost(manifest, {
        databaseIoReadBytes: 1,
        databaseReadBytes: 1,
        documentsRead: 501,
        executionMs: 1,
        occRetries: 0,
        target: "queries",
        warm: false,
      })
    ).toEqual([
      expect.objectContaining({
        actual: 501,
        maximum: 500,
        metric: "maxDocumentsRead",
        target: "queries",
      }),
    ]);
  });

  test("uses only provider-native Convex completion metrics", () => {
    expect(manifest.schemaVersion).toBe(2);
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
