// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useRef, useState } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/",
});

let createRoot;
let HeaderUserMenu;
let SignInDropdown;
let SpiritualTrailsDropdown;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.FocusEvent = dom.window.FocusEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = dom.window.matchMedia;
  ({ createRoot } = await import("react-dom/client"));
  ({ HeaderUserMenu } = await import("./HeaderUserMenu"));
  ({ SignInDropdown } = await import("./HeaderSignInDropdown"));
  ({ SpiritualTrailsDropdown } = await import("./HeaderSpiritualTrailsDropdown"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return { container, root };
}

async function flushDisclosure() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 180)));
}

async function verifyDisclosure(element, triggerName) {
  const { container, root } = await mount(element);
  const trigger = container.querySelector(`button[aria-label="${triggerName}"]`);
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  trigger.focus();
  await act(async () => trigger.click());
  await flushDisclosure();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const panel = document.getElementById(trigger.getAttribute("aria-controls"));
  expect(panel).not.toBeNull();
  await act(async () =>
    trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
  );
  await flushDisclosure();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(trigger);
  await act(async () => root.unmount());
}

function UserMenuHarness() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  return (
    <HeaderUserMenu
      canAccessPortal
      isScrolled={false}
      onLogout={() => undefined}
      setUserMenuOpen={setOpen}
      user={{ email: "guest@example.com", name: "Guest User" }}
      userMenuOpen={open}
      userMenuRef={menuRef}
    />
  );
}

describe("mounted public header disclosures", () => {
  test("Spiritual Trails exposes state and restores trigger focus on Escape", async () => {
    await verifyDisclosure(<SpiritualTrailsDropdown isScrolled={false} />, "Spiritual Trails");
  });

  test("Sign In exposes state and restores trigger focus on Escape", async () => {
    await verifyDisclosure(<SignInDropdown isScrolled={false} />, "Sign In");
  });

  test("the signed-in Account disclosure restores trigger focus on Escape", async () => {
    await verifyDisclosure(<UserMenuHarness />, "Account menu");
  });
});
