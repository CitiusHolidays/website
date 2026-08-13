import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8");
const SEPARATE_STATUS_DOMAINS =
  /Backend operation status, bell-notification status, and email\s+delivery status are separate domains\./;

describe("durable portal operation-status UX contract", () => {
  test("defines every required state without merging email, bell, and backend status", () => {
    const contract = read("docs/PORTAL_OPERATION_STATUS_UX.md");
    for (const state of [
      "loading",
      "empty",
      "running",
      "partial",
      "stalled",
      "failed",
      "completed",
      "expired",
      "retrying",
      "skipped",
      "exhausted",
    ]) {
      expect(contract).toContain(`| \`${state}\` |`);
    }
    expect(contract).toMatch(SEPARATE_STATUS_DOMAINS);
    expect(contract).toContain("authenticated 390px");
    expect(contract).toContain("Source tests are not Production evidence.");
  });

  test("maps the maintained source and automated evidence to the matrix", () => {
    const contract = read("docs/PORTAL_OPERATION_STATUS_UX.md");
    const workflows = read("docs/PORTAL_CRM_WORKFLOWS.md");
    const importModal = read("src/components/portal/workspace/modals/PassengerImportModal.tsx");
    const exportModal = read("src/components/portal/workspace/modals/PassengerExportModal.tsx");
    const activity = read("src/components/portal/workspace/admin/ActivityView.tsx");
    const focusedDetail = read("src/components/portal/entityModal/EntityModalShell.js");

    expect(workflows).toContain("PORTAL_OPERATION_STATUS_UX.md");
    for (const path of [
      "PortalSpreadsheetModals.mounted.test.jsx",
      "ImportReconciliationModal.mounted.test.jsx",
      "usePortalReferenceClock.mounted.test.jsx",
      "EntityModal.mounted.test.jsx",
      "portalOperationsViews.mounted.test.jsx",
      "ActivityView.mounted.test.jsx",
    ]) {
      expect(contract).toContain(path);
    }
    expect(importModal).toContain('aria-live="polite"');
    expect(importModal).toContain("Re-select the same file to resume safely.");
    expect(exportModal).toContain("Retry Export");
    expect(exportModal).toContain("Download Spreadsheet");
    expect(activity).toContain("Counts shown are partial");
    expect(activity).toContain("retrying");
    expect(activity).toContain("exhausted");
    expect(focusedDetail).toContain('detailState === "loading"');
    expect(focusedDetail).toContain('detailState === "missing"');
  });
});
