import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const MODAL_FILE = "src/components/portal/workspace/modals/CommercialFilesModal.tsx";
const REGISTRY_FILE = "convex/crm/commercialFiles.ts";
const TABLE_FILES = [
  "src/components/portal/workspace/QueriesView.tsx",
  "src/components/portal/workspace/ContractingView.tsx",
  "src/components/portal/workspace/ProposalsView.tsx",
  "src/components/portal/workspace/accounts/AccountsJobCardView.tsx",
  "src/components/portal/workspace/operations/JobCardRowActions.tsx",
];

function read(file: string) {
  return readFileSync(file, "utf8");
}

describe("Commercial Files in-flow access contract", () => {
  test("keeps the modal on the shared registry and recoverable lifecycle", () => {
    const source = read(MODAL_FILE);

    expect(source).toContain('modal === "commercialFiles"');
    expect(source).toContain("includeHistory: true");
    expect(source).toContain("includeDeleted: showDeleted");
    expect(source).toContain("/api/portal/files/commercial/");
    expect(source).toContain('confirmLabel: "Delete"');
    expect(source).toContain("recoverable for 14 days");
    expect(source).toContain("Restore version");
  });

  test("keeps purge system-only, retryable, and summarized", () => {
    const source = read(REGISTRY_FILE);

    expect(source).toContain("export const purgeExpired = internalMutation");
    expect(source).toContain('failureCode: "storage_delete_failed"');
    expect(source).toContain('action: "commercial_file_purge_page"');
    expect(source).toContain("purgedFiles: args.purgedFileRows.map");
  });

  test("exposes the same Files entry point from every required table", () => {
    for (const file of TABLE_FILES) {
      const source = read(file);
      expect(source).toContain('"commercialFiles"');
    }
  });
});
