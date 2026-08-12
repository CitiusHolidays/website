import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { registrationsInSource } from "../../config/release/convex-registration-inventory";

const CRM_ROOT = import.meta.dir;
const FACADE = "imports.ts";
const UNTYPED_BOUNDARY_PATTERN = /\bany\b/;
const IMPLEMENTATION_MODULES = [
  "flightImports.ts",
  "passengerImportOperations.ts",
  "passengerImportReceipts.ts",
  "passengerImportRows.ts",
  "passengerExportCleanup.ts",
  "passengerExportOperations.ts",
  "passengerExportSource.ts",
  "passengerExportWorker.ts",
] as const;
const STABLE_REGISTRATIONS = [
  "beginPassengerExportOperation",
  "beginPassengerImportOperation",
  "claimPassengerImportOperationBatch",
  "commitFlightImport",
  "commitPassengerImportRow",
  "completePassengerExportOperation",
  "completePassengerImportOperation",
  "failPassengerExportOperation",
  "finalizePassengerImportBatch",
  "getAuthorizedPassengerExportOperation",
  "getPassengerExportOperation",
  "getPassengerExportSourcePage",
  "getPassengerImportBatchResult",
  "listFlightItinerary",
  "listMyPassengerExportOperations",
  "listMyPassengerImportOperations",
  "logPassengerExport",
  "logPassengerImportActivity",
  "previewPassengerImportRows",
  "purgeExpiredPassengerExports",
  "recordPassengerImportOperationBatch",
  "stagePassengerExportArtifact",
  "updatePassengerExportOperation",
] as const;

function source(file: string) {
  return readFileSync(join(CRM_ROOT, file), "utf8");
}

describe("crm.imports stable registration facade", () => {
  test("preserves every public and internal route under the imports module", () => {
    const registrations = registrationsInSource(source(FACADE), `crm/${FACADE}`)
      .map(({ name }) => name)
      .sort((left, right) => left.localeCompare(right));
    expect(registrations).toEqual(
      [...STABLE_REGISTRATIONS].sort((left, right) => left.localeCompare(right))
    );
  });

  test("keeps the facade and each focused owner below the reviewed module budget", () => {
    expect(source(FACADE).split("\n").length).toBeLessThan(500);
    for (const file of IMPLEMENTATION_MODULES) {
      const implementation = source(file);
      expect(implementation.split("\n").length, file).toBeLessThanOrEqual(500);
      expect(implementation, file).not.toContain('from "./imports"');
    }
  });

  test("keeps cross-runtime export and operation boundaries explicitly typed", () => {
    for (const file of [
      "passengerExportFunctionReferences.ts",
      "passengerExportSource.ts",
      "passengerExportSourceContract.ts",
      "passengerExportWorker.ts",
    ]) {
      expect(source(file), file).not.toMatch(UNTYPED_BOUNDARY_PATTERN);
    }
    expect(source(FACADE)).toContain("handler: getPassengerExportSourcePageHandler");
    expect(source(FACADE)).toContain("handler: commitFlightImportHandler");
    expect(source(FACADE)).toContain("handler: beginPassengerImportOperationHandler");
  });
});
