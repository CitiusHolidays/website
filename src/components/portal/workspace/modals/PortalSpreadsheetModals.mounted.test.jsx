import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";

let createRoot;
let FlightExportModal;
let FlightImportModal;
let PassengerExportModal;
let PassengerImportModal;
let PASSENGER_IMPORT_MODAL_CONFIGS;
let PortalToastProvider;
let PortalWorkspaceSpreadsheetModals;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ FlightExportModal } = await import("./FlightExportModal"));
  ({ FlightImportModal } = await import("./FlightImportModal"));
  ({ PassengerExportModal } = await import("./PassengerExportModal"));
  ({ PassengerImportModal } = await import("./PassengerImportModal"));
  ({ PASSENGER_IMPORT_MODAL_CONFIGS } = await import("./spreadsheetModalConfigs"));
  ({ PortalWorkspaceSpreadsheetModals } = await import("./PortalWorkspaceSpreadsheetModals"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const doNothing = () => undefined;
const returnExportOperation = async () => ({ operationId: "passengerExportOperations_1" });
const returnExportDownload = async () => ({
  fileName: "JC-0001-passengers.xlsx",
  url: "https://example.com/export.xlsx",
});
const returnEmptyPreview = async () => ({ rows: [] });
const returnImportResult = async () => ({ created: 0, updated: 0 });
const returnFlightImportResult = async () => ({ createdSegments: 0, updatedSegments: 0 });

function SpreadsheetHarness({ onClose }) {
  const [open, setOpen] = useState(false);
  const openModal = () => setOpen(true);
  const closeModal = () => {
    onClose();
    setOpen(false);
  };
  return (
    <PortalToastProvider>
      <button data-testid="spreadsheet-opener" onClick={openModal} type="button">
        Import passengers
      </button>
      <PassengerImportModal
        close={closeModal}
        commitPassengerImport={returnImportResult}
        jobCards={[]}
        open={open}
        previewPassengerImport={returnEmptyPreview}
      />
    </PortalToastProvider>
  );
}

const flushDialog = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

describe("Mounted spreadsheet modal loading boundary", () => {
  test("Maps all passenger-family imports to durable operation kinds", () => {
    expect(
      PASSENGER_IMPORT_MODAL_CONFIGS.map(({ importKind, modal }) => [modal, importKind])
    ).toEqual([
      ["passengerImport", "passenger"],
      ["travellerImport", "traveller"],
      ["roomingImport", "rooming"],
      ["passportImport", "passport"],
      ["visaImport", "visa"],
    ]);
  });
  test("Keeps spreadsheet imports as native file inputs with exact workbook acceptance", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <PortalToastProvider>
          <PassengerImportModal
            close={doNothing}
            commitPassengerImport={returnImportResult}
            jobCards={[]}
            open
            previewPassengerImport={returnEmptyPreview}
          />
        </PortalToastProvider>
      )
    );
    await flushDialog();

    const input = document.querySelector('input[type="file"]');
    expect(input?.getAttribute("accept")).toBe(".xlsx,.xls");
    expect(document.body.textContent).toContain("Passenger spreadsheet");
    expect(document.body.textContent).toContain("Upload Passengers");
    expect(document.body.textContent).toContain("Job Card * required");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps spreadsheet geometry and blocks outside or Escape until an explicit close", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let closeCount = 0;
    const recordClose = () => {
      closeCount += 1;
    };
    await act(async () => root.render(<SpreadsheetHarness onClose={recordClose} />));
    const opener = container.querySelector('[data-testid="spreadsheet-opener"]');
    opener.focus();
    await act(async () => opener.click());
    await flushDialog();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("max-w-6xl");
    expect(dialog?.className).toContain("max-h-[90vh]");
    expect(dialog?.parentElement.className).toContain("z-[75]");
    expect(dialog?.hasAttribute("data-starting-style")).toBe(false);
    expect(dialog?.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushDialog();
    expect(closeCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);

    const backdrop = document.querySelector(".bg-slate-950\\/65");
    act(() => {
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushDialog();
    expect(closeCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);

    const closeButton = [...dialog.querySelectorAll("button")].find(
      (button) => button.textContent === "Close"
    );
    await act(async () => {
      closeButton.click();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(() => {
      dialog.dispatchEvent(new dom.window.Event("animationend", { bubbles: true }));
    });
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps inactive spreadsheet modal host free of dialogs on the dashboard path", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <PortalToastProvider>
          <PortalWorkspaceSpreadsheetModals
            workspace={{
              closeModal: doNothing,
              commitFlightImport: returnFlightImportResult,
              commitPassengerImport: returnImportResult,
              flightItinerary: undefined,
              form: {},
              getPassengerExportDownload: returnExportDownload,
              jobCards: undefined,
              modal: null,
              passengerExportOperations: undefined,
              passengerImportOperations: undefined,
              previewPassengerImport: returnEmptyPreview,
              startPassengerExport: returnExportOperation,
            }}
          />
        </PortalToastProvider>
      )
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => root.unmount());
  });

  test("Keeps every closed spreadsheet dialog safe before job cards load", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <PortalToastProvider>
          <PassengerImportModal
            close={doNothing}
            commitPassengerImport={returnImportResult}
            jobCards={undefined}
            open={false}
            previewPassengerImport={returnEmptyPreview}
          />
          <FlightImportModal
            close={doNothing}
            commitFlightImport={returnFlightImportResult}
            itinerary={undefined}
            jobCards={undefined}
            open={false}
          />
          <PassengerExportModal
            close={doNothing}
            getPassengerExportDownload={returnExportDownload}
            jobCards={undefined}
            open={false}
            startPassengerExport={returnExportOperation}
          />
          <FlightExportModal
            close={doNothing}
            itinerary={undefined}
            jobCards={undefined}
            open={false}
          />
        </PortalToastProvider>
      )
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => root.unmount());
  });

  test("Shows durable export completion and downloads the stored workbook", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const anchorClick = spyOn(dom.window.HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined
    );
    const fetchDownload = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    );
    const createObjectUrl = spyOn(URL, "createObjectURL").mockReturnValue(
      "blob:https://citiusholidays.com/export"
    );
    const revokeObjectUrl = spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    try {
      await act(async () =>
        root.render(
          <PortalToastProvider>
            <PassengerExportModal
              close={doNothing}
              getPassengerExportDownload={returnExportDownload}
              jobCards={[{ id: "jobCards_1", jobCode: "JC-0001" }]}
              open
              operations={[
                {
                  exportKind: "passenger",
                  id: "passengerExportOperations_1",
                  jobCardId: "jobCards_1",
                  rowsProcessed: 325,
                  stalled: false,
                  status: "completed",
                },
              ]}
              startPassengerExport={returnExportOperation}
            />
          </PortalToastProvider>
        )
      );
      await flushDialog();
      const select = document.querySelector('[role="combobox"]');
      await act(async () => {
        select.focus();
        select.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
        );
        await Promise.resolve();
      });
      const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(
        (candidate) => candidate.textContent.includes("JC-0001")
      );
      await act(async () => option.click());
      expect(document.body.textContent).toContain("325 rows are ready to download");
      const download = Array.from(document.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Download Spreadsheet")
      );
      await act(async () => download.click());
      expect(fetchDownload).toHaveBeenCalledWith("https://example.com/export.xlsx", {
        credentials: "same-origin",
      });
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(anchorClick).toHaveBeenCalledTimes(1);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:https://citiusholidays.com/export");
    } finally {
      revokeObjectUrl.mockRestore();
      createObjectUrl.mockRestore();
      fetchDownload.mockRestore();
      anchorClick.mockRestore();
      await act(async () => root.unmount());
      container.remove();
    }
  });
});
