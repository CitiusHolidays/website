import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useCallback, useState } from "react";

let createRoot;
let FlightExportModal;
let FlightImportModal;
let PassengerExportModal;
let PassengerImportModal;
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
  ({ PortalWorkspaceSpreadsheetModals } = await import("./PortalWorkspaceSpreadsheetModals"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const doNothing = () => undefined;
const returnEmptyExport = async () => ({ rows: [] });
const returnEmptyPreview = async () => ({ rows: [] });
const returnImportResult = async () => ({ created: 0, updated: 0 });
const returnFlightImportResult = async () => ({ createdSegments: 0, updatedSegments: 0 });

function SpreadsheetHarness({ onClose }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => {
    onClose();
    setOpen(false);
  }, [onClose]);
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

describe("mounted spreadsheet modal loading boundary", () => {
  test("keeps spreadsheet imports as native file inputs with exact workbook acceptance", async () => {
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

  test("keeps spreadsheet geometry and blocks outside or Escape until an explicit close", async () => {
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
    await act(async () => closeButton.click());
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => root.unmount());
    container.remove();
  });

  test("keeps inactive spreadsheet modal host free of dialogs on the dashboard path", async () => {
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
              getPassengerExportRows: returnEmptyExport,
              jobCards: undefined,
              modal: null,
              previewPassengerImport: returnEmptyPreview,
            }}
          />
        </PortalToastProvider>
      )
    );

    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => root.unmount());
  });

  test("keeps every closed spreadsheet dialog safe before job cards load", async () => {
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
            getPassengerExportRows={returnEmptyExport}
            jobCards={undefined}
            open={false}
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
});
