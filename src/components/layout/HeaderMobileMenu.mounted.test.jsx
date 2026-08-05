// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks stay close to their harness.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { HeaderMobileMenu } from "./HeaderMobileMenu";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});

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
});

afterAll(() => dom.window.close());

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div id="background-content">
        <button id="menu-trigger" onClick={() => setOpen(true)} type="button">
          Open menu
        </button>
      </div>
      <HeaderMobileMenu
        canAccessPortal={false}
        isOpen={open}
        navLinks={[{ href: "/", label: "Home" }]}
        onClose={() => setOpen(false)}
        onLogout={() => undefined}
        user={{ name: "Test traveller" }}
      />
    </>
  );
}

describe("HeaderMobileMenu", () => {
  test("traps focus, makes the page inert, and restores the trigger on Escape", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => root.render(<Harness />));
    const trigger = container.querySelector("#menu-trigger");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const dialog = container.querySelector('[role="dialog"]');
    const close = dialog.querySelector('button[aria-label="Close menu"]');
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector("#background-content").hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(close);

    await act(async () =>
      dialog.dispatchEvent(new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Tab" }))
    );
    expect(document.activeElement).not.toBe(trigger);

    await act(async () =>
      dialog.dispatchEvent(
        new dom.window.KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector("#background-content").hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
