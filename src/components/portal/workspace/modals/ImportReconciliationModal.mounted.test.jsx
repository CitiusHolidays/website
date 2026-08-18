// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useCallback, useState } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal",
});

let createRoot;
let ImportReconciliationModal;

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
  ({ createRoot } = await import("react-dom/client"));
  ({ ImportReconciliationModal } = await import("./ImportReconciliationModal"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const flushDialog = () => act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

function Harness({ onClose }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    onClose();
    setOpen(false);
  }, [onClose]);
  return (
    <>
      <button data-testid="reconciliation-opener" onClick={show} type="button">
        Show reconciliation
      </button>
      <ImportReconciliationModal
        jobCode="JC-0001-NS"
        onClose={close}
        open={open}
        roomSummaryText="Twin: 2"
        rows={[
          {
            disposition: "created",
            message: "Created",
            rowNumber: 2,
            travellerName: "Asha Rao",
          },
        ]}
        summary={{ created: 1, failed: 0, total: 1, updated: 0 }}
      />
    </>
  );
}

describe("ImportReconciliationModal", () => {
  test("Preserves Escape-no/backdrop-yes behavior, geometry, copy, and focus restoration", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let closeCount = 0;
    const recordClose = () => {
      closeCount += 1;
    };
    await act(async () => root.render(<Harness onClose={recordClose} />));
    const opener = container.querySelector('[data-testid="reconciliation-opener"]');
    opener.focus();
    await act(async () => opener.click());
    await flushDialog();

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.className).toContain("max-w-3xl");
    expect(dialog?.className).toContain("max-h-[min(90vh,48rem)]");
    expect(dialog?.parentElement.className).toContain("z-[100]");
    expect(dialog?.textContent).toContain("Import reconciliation");
    expect(dialog?.textContent).toContain("JC-0001-NS");
    expect(dialog?.textContent).toContain("Download CSV");
    expect(dialog?.textContent).toContain("Done");
    expect(dialog?.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });
    await flushDialog();
    expect(closeCount).toBe(0);
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);

    const backdrop = document.querySelector('button[aria-label="Close reconciliation report"]');
    act(() => {
      backdrop.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushDialog();
    expect(closeCount).toBe(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => opener.click());
    await flushDialog();
    const reopened = document.querySelector('[role="dialog"]');
    const done = [...reopened.querySelectorAll("button")].find(
      (button) => button.textContent === "Done"
    );
    await act(async () => done.click());
    await flushDialog();
    expect(closeCount).toBe(2);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);

    await act(async () => root.unmount());
    container.remove();
  });
});
