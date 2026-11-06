import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/settings?tab=workbook",
});

mock.module("convex/react", () => ({
  useConvex: () => ({ query: async () => ({ rows: [], summary: {} }) }),
  useMutation: () => async () => undefined,
}));

let createRoot;
let PortalToastProvider;
let StaffWorkbookImportPanel;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  ({ createRoot } = await import("react-dom/client"));
  ({ PortalToastProvider } = await import("@/components/portal/PortalToast"));
  ({ StaffWorkbookImportPanel } = await import("./StaffWorkbookImportPanel"));
});

afterAll(() => dom.window.close());

describe("Staff workbook import panel", () => {
  test("can be closed and labels its totals in plain, sentence-case words", async () => {
    let closes = 0;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalToastProvider>
          <StaffWorkbookImportPanel
            onClose={() => {
              closes += 1;
            }}
          />
        </PortalToastProvider>
      )
    );

    for (const label of ["Rows read", "Couldn't read", "New staff", "Changes", "No change"]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).not.toContain("Parser skipped");
    expect(container.querySelector(".uppercase")).toBeNull();

    const close = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Close workbook import"
    );
    expect(close?.disabled).toBe(false);
    await act(async () => close.click());
    expect(closes).toBe(1);

    await act(async () => root.unmount());
    container.remove();
  });
});
