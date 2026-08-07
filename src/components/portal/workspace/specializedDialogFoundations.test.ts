import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const adapter = read("src/components/ui/application-dialog.tsx");
const spreadsheet = read("src/components/portal/workspace/modals/spreadsheetModalShell.tsx");
const reconciliation = read("src/components/portal/workspace/modals/ImportReconciliationModal.tsx");
const commercialFiles = read("src/components/portal/workspace/modals/CommercialFilesModal.tsx");
const passportUpload = read("src/components/portal/workspace/operations/PassportUploadModal.tsx");
const passengerImport = read("src/components/portal/workspace/modals/PassengerImportModal.tsx");

describe("specialized portal dialog foundation boundaries", () => {
  test("supports the legacy outside-yes Escape-no policy without taking lifecycle ownership", () => {
    expect(adapter).toContain("escapeDisabled?: boolean");
    expect(adapter).toContain('details.reason === "escape-key"');
    expect(commercialFiles).toContain("escapeDisabled");
    expect(reconciliation).toContain("escapeDisabled");
  });

  test("routes every specialized overlay family through ControlledDialog", () => {
    for (const source of [spreadsheet, reconciliation, commercialFiles, passportUpload]) {
      expect(source).toContain('from "@/components/ui/application-dialog"');
      expect(source).toContain("<ControlledDialog");
      expect(source).not.toContain('role="dialog"');
      expect(source).not.toContain('aria-modal="true"');
      expect(source).not.toContain("useFocusTrap");
      expect(source).not.toContain("useScrollLock");
      expect(source).not.toContain("createPortal");
    }
  });

  test("keeps explicitly controlled close actions for nondismissible workflows", () => {
    expect(spreadsheet).toContain("closeDisabled={open}");
    expect(passportUpload).toContain("closeDisabled={Boolean(uploadTraveller)}");
    expect(spreadsheet).toContain("onClick={close}");
    expect(passportUpload).toContain("onClick={onClose}");
  });

  test("keeps reconciliation in the spreadsheet Dialog tree for native nested ownership", () => {
    const reconciliationIndex = passengerImport.indexOf("<ImportReconciliationModal");
    const outerCloseIndex = passengerImport.indexOf("</ImportModalShell>", reconciliationIndex);

    expect(reconciliationIndex).toBeGreaterThan(0);
    expect(outerCloseIndex).toBeGreaterThan(reconciliationIndex);
  });
});
