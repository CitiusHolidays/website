import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PortalToastProvider } from "@/components/portal/PortalToast";
import { FlightExportModal } from "./FlightExportModal";
import { FlightImportModal } from "./FlightImportModal";
import { PassengerExportModal } from "./PassengerExportModal";
import { PassengerImportModal } from "./PassengerImportModal";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
});

afterAll(() => dom.window.close());

const doNothing = () => undefined;
const returnEmptyExport = async () => ({ rows: [] });
const returnEmptyPreview = async () => ({ rows: [] });
const returnImportResult = async () => ({ created: 0, updated: 0 });
const returnFlightImportResult = async () => ({ createdSegments: 0, updatedSegments: 0 });

describe("mounted spreadsheet modal loading boundary", () => {
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
