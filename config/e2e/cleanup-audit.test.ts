import { describe, expect, test } from "bun:test";
import { parseZeroE2eTargetCleanupAudit } from "./cleanup-audit";

const TARGET_ID = "preview-elegant-bullfrog-454-test";
const cleanAudit = {
  activeActors: 0,
  auditedAt: "2026-08-15T12:00:00.000Z",
  boundExceeded: false,
  exportSourceChunks: 0,
  importOperationBatches: 0,
  incompleteRuns: 0,
  latestRun: {
    mutatedRecords: 0,
    ownedRecords: 0,
    runId: "018fbe7a-62c8-7f35-9d2f-2d3f53f9e000",
    status: "complete",
  },
  mutatedRecords: 0,
  ownedRecords: 0,
  passengerExportOperations: 0,
  passengerImportOperations: 0,
  runsAudited: 5,
  storageReferences: 0,
  syntheticTravellers: 0,
  targetId: TARGET_ID,
};

describe("Target-wide E2E cleanup audit", () => {
  test("Accepts a bounded content-free zero-residual result", () => {
    expect(parseZeroE2eTargetCleanupAudit(cleanAudit, TARGET_ID)).toEqual(cleanAudit);
  });

  test("Fails closed on any target-wide residual, bound, or identity mismatch", () => {
    expect(() =>
      parseZeroE2eTargetCleanupAudit({ ...cleanAudit, ownedRecords: 1 }, TARGET_ID)
    ).toThrow("ownedRecords");
    expect(() =>
      parseZeroE2eTargetCleanupAudit({ ...cleanAudit, boundExceeded: true }, TARGET_ID)
    ).toThrow("scan bound");
    expect(() => parseZeroE2eTargetCleanupAudit(cleanAudit, "preview-other")).toThrow("targetId");
  });
});
