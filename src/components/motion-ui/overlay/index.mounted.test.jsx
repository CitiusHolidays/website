// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { useFocusTrap } from ".";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal",
});
let nativeFocus;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  nativeFocus = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function browserLikeFocus(options) {
    if (
      this.closest("[inert]") ||
      (this instanceof dom.window.HTMLButtonElement && this.disabled) ||
      this.getAttribute("aria-disabled") === "true"
    ) {
      return;
    }
    nativeFocus.call(this, options);
  };
});

afterAll(() => {
  dom.window.HTMLElement.prototype.focus = nativeFocus;
  dom.window.close();
});

function Harness({ removeTriggerOnClose = false }) {
  const [open, setOpen] = useState(false);
  const [showTrigger, setShowTrigger] = useState(true);
  const overlayRef = useRef(null);
  const closeRef = useRef(null);

  const close = () => {
    if (removeTriggerOnClose) {
      setShowTrigger(false);
    }
    setOpen(false);
  };

  useFocusTrap({
    active: open,
    container: overlayRef,
    inertSiblingsOf: overlayRef,
    initialFocus: closeRef,
    onEscape: close,
  });

  return (
    <>
      <div id="parent-dialog" role="dialog">
        {showTrigger ? (
          <button id="trigger" onClick={() => setOpen(true)} type="button">
            Open overlay
          </button>
        ) : null}
        <button id="fallback" type="button">
          Parent fallback
        </button>
      </div>
      {open ? (
        <div aria-modal="true" ref={overlayRef} role="dialog">
          <button id="close" onClick={close} ref={closeRef} type="button">
            Close overlay
          </button>
        </div>
      ) : null}
    </>
  );
}

async function openOverlay(container) {
  const trigger = container.querySelector("#trigger");
  trigger.focus();
  await act(async () => trigger.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return trigger;
}

describe("shared overlay focus lifecycle", () => {
  test("removes inertness before restoring focus to the opener", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness />));
    const trigger = await openOverlay(container);

    expect(container.querySelector("#parent-dialog")?.hasAttribute("inert")).toBe(true);
    await act(async () => container.querySelector("#close").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.querySelector("#parent-dialog")?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("falls back inside the surviving parent overlay when the opener is removed", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<Harness removeTriggerOnClose />));
    await openOverlay(container);

    await act(async () => container.querySelector("#close").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.querySelector("#trigger")).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("#fallback"));

    await act(async () => root.unmount());
    container.remove();
  });
});
