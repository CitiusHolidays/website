// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.
// biome-ignore-all lint/suspicious/useAwait: React act callbacks intentionally flush synchronously.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";

let createRoot;
let SaveViewDialog;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal/queries",
});
const DESKTOP_QUERY_PATTERN = /min-width:\s*1024px/;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
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
  ({ createRoot } = await import("react-dom/client"));
  ({ default: SaveViewDialog } = await import("./SaveViewDialog"));
});

afterAll(() => dom.window.close());

function Harness({ onSave = async () => undefined, saving = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button id="save-view-trigger" onClick={() => setOpen(true)} type="button">
        Save view
      </button>
      <SaveViewDialog onClose={() => setOpen(false)} onSave={onSave} open={open} saving={saving} />
    </>
  );
}

async function enterViewName(input, value) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" })
    );
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("SaveViewDialog", () => {
  test("preserves the established desktop frame, surface, content, and controls", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    await act(async () => container.querySelector("#save-view-trigger").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const viewport = document.querySelector(".portal-command-overlay");
    const backdrop = viewport.querySelector(".portal-command-backdrop");
    const panel = viewport.querySelector(".portal-save-view-panel");
    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog.querySelector('input[aria-label="View name"]');
    const buttons = [...dialog.querySelectorAll("button")];

    expect(viewport.style.position).toBe("fixed");
    expect(viewport.style.insetInlineStart).toBe("");
    expect(viewport.style.left).toBe("256px");
    expect(viewport.style.top).toBe("68px");
    expect(viewport.style.bottom).toBe("0px");
    expect(viewport.style.width).toBe("calc(100vw - 256px)");
    expect(viewport.style.zIndex).toBe("55");
    expect(backdrop.style.position).toBe("absolute");
    expect(backdrop.style.inset).toBe("0px");
    expect(backdrop.style.pointerEvents).toBe("auto");
    expect(panel.style.position).toBe("fixed");
    expect(panel.style.left).toBe("256px");
    expect(panel.style.paddingInline).toBe("0.75rem");
    expect(panel.style.top).toBe("calc(9.25rem)");
    expect(panel.style.width).toBe("calc(100vw - 256px)");
    expect(panel.style.zIndex).toBe("55");
    expect(dialog.tagName).toBe("FORM");
    expect(dialog.className).toContain("max-w-md");
    expect(dialog.className).toContain("rounded-xl");
    expect(dialog.textContent).toContain("Save current view");
    expect(dialog.textContent).toContain("View name");
    expect(input.placeholder).toBe("e.g. My open queries");
    expect(buttons.map((button) => button.textContent.trim())).toEqual(["Cancel", "Save"]);

    await act(async () => root.unmount());
    container.remove();
  });

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
    expect(container.getAttribute("aria-hidden")).toBe("true");
    expect(document.body.style.overflowY).toBe("hidden");
    expect(document.documentElement.hasAttribute("data-base-ui-scroll-locked")).toBe(true);
    expect(document.activeElement).toBe(input);

    const [beforeGuard, afterGuard] = dialog.parentElement.querySelectorAll(
      '[data-base-ui-focus-guard][data-type="inside"]'
    );
    await act(async () => {
      beforeGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(cancel);

    await act(async () => {
      afterGuard.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(input);

    await act(async () =>
      dialog.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(container.hasAttribute("aria-hidden")).toBe(false);
    expect(document.body.style.overflowY).toBe("");
    expect(document.documentElement.hasAttribute("data-base-ui-scroll-locked")).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("dismisses outside, restores focus, and clears the draft", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("#save-view-trigger");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const input = document.querySelector('input[aria-label="View name"]');
    await enterViewName(input, "Temporary name");
    const backdrop = document.querySelector(".portal-command-backdrop");
    await act(async () => {
      backdrop.dispatchEvent(
        new globalThis.PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "mouse",
        })
      );
      backdrop.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => trigger.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.querySelector('input[aria-label="View name"]').value).toBe("");

    await act(async () => root.unmount());
    container.remove();
  });

  test("blocks Escape, outside dismissal, cancel, and submit while saving", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness saving />));
    await act(async () => container.querySelector("#save-view-trigger").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const dialog = document.querySelector('[role="dialog"]');
    const [cancel, save] = dialog.querySelectorAll("button");
    expect(cancel.disabled).toBe(true);
    expect(save.disabled).toBe(true);

    await act(async () =>
      dialog.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    const backdrop = document.querySelector(".portal-command-backdrop");
    await act(async () => {
      backdrop.dispatchEvent(
        new globalThis.PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          pointerType: "mouse",
        })
      );
      backdrop.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[role="dialog"]')).toBe(dialog);

    await act(async () => root.unmount());
    container.remove();
  });

  test("trims the saved name, keeps favorite metadata, and closes after success", async () => {
    const saves = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness onSave={async (...args) => saves.push(args)} />));
    const trigger = container.querySelector("#save-view-trigger");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    const dialog = document.querySelector('[role="dialog"]');
    const input = dialog.querySelector('input[aria-label="View name"]');
    await enterViewName(input, "  Leadership view  ");
    expect(input.value).toBe("  Leadership view  ");
    expect(dialog.querySelector('button[type="submit"]').disabled).toBe(false);
    await act(async () => {
      dialog.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(saves).toEqual([["Leadership view", { isFavorite: true }]]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
