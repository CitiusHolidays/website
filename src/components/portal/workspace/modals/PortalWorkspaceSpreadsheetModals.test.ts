import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const SPREADSHEET_MODALS_FILE =
  "src/components/portal/workspace/modals/PortalWorkspaceSpreadsheetModals.tsx";

function read(file: string) {
  return readFileSync(file, "utf8");
}

describe("PortalWorkspaceSpreadsheetModals loading boundary", () => {
  test("lazy-loads heavy modal implementations with next/dynamic", () => {
    const source = read(SPREADSHEET_MODALS_FILE);

    expect(source).toContain('import dynamic from "next/dynamic"');
    expect(source).not.toMatch(
      /^import \{ CommercialFilesModal \} from "\.\/CommercialFilesModal";/m
    );
    expect(source).not.toMatch(
      /^import \{ PassengerImportModal \} from "\.\/PassengerImportModal";/m
    );
    expect(source).not.toMatch(
      /^import \{ FlightImportModal \} from "\.\/FlightImportModal";/m
    );
    expect(source).not.toMatch(
      /^import \{ PassengerExportModal \} from "\.\/PassengerExportModal";/m
    );
    expect(source).not.toMatch(
      /^import \{ FlightExportModal \} from "\.\/FlightExportModal";/m
    );
    expect(source).not.toMatch(
      /^import \{ TravelBatchEntityModalBridge \} from "\.\.\/TravelBatchEntityModalBridge";/m
    );
    expect(source).toContain('import("./CommercialFilesModal")');
    expect(source).toContain('import("./PassengerImportModal")');
    expect(source).toContain('import("./FlightImportModal")');
    expect(source).toContain('import("./PassengerExportModal")');
    expect(source).toContain('import("./FlightExportModal")');
    expect(source).toContain('import("../TravelBatchEntityModalBridge")');
  });

  test("mounts each modal implementation only when its matching modal is active", () => {
    const source = read(SPREADSHEET_MODALS_FILE);

    expect(source).toContain('modal === "commercialFiles"');
    expect(source).toContain("shouldLoadEntityModalBridge(modal)");
    expect(source).toContain("modal === config.modal");
    expect(source).toContain('modal === "flightImport"');
    expect(source).toContain('modal === "flightExport"');
    expect(source).not.toMatch(
      /<PassengerImportModal[\s\S]*open=\{workspace\.modal === config\.modal\}/
    );
    expect(source).not.toMatch(/<FlightImportModal[\s\S]*open=\{workspace\.modal === "flightImport"\}/);
  });
});
