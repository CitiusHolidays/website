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
        bytesRead: 1,
        databaseRangesRead: 1,
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
