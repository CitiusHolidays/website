// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.
// biome-ignore-all lint/suspicious/useAwait: React act callbacks intentionally flush synchronously.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import SaveViewDialog from "./SaveViewDialog";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});
const DESKTOP_QUERY_PATTERN = /min-width:\s*1024px/;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: DESKTOP_QUERY_PATTERN.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
});

afterAll(() => dom.window.close());

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button id="save-view-trigger" onClick={() => setOpen(true)} type="button">
        Save view
      </button>
      <SaveViewDialog onClose={() => setOpen(false)} onSave={async () => undefined} open={open} />
    </>
  );
}

describe("SaveViewDialog", () => {
  test("uses modal semantics, traps focus, and restores the trigger on Escape", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("#save-view-trigger");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog.querySelector('input[aria-label="View name"]');
    const cancel = dialog.querySelector('button[type="button"]:not([aria-label])');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(container.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(input);

    await act(async () => {
      input.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab", shiftKey: true })
      );
    });
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      cancel.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab" }));
    });
    expect(document.activeElement).toBe(input);

    await act(async () =>
      dialog.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
