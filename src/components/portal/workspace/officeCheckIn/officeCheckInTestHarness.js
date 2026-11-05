import { JSDOM } from "jsdom";

const REDUCED_MOTION_QUERY = /prefers-reduced-motion:\s*reduce/;
const doNothing = () => undefined;

/** Installs the JSDOM globals the portal dialogs, selects and tables need. */
export function installPortalDom(url) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url,
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.FocusEvent = dom.window.FocusEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  globalThis.ResizeObserver = class {
    observe() {
      // JSDOM has no layout to observe.
    }
    unobserve() {
      // No observer resources exist in this test double.
    }
    disconnect() {
      // No observer resources exist in this test double.
    }
  };
  const matchMedia = (query) => ({
    addEventListener: doNothing,
    addListener: doNothing,
    dispatchEvent: () => false,
    matches: REDUCED_MOTION_QUERY.test(String(query)),
    media: String(query),
    onchange: null,
    removeEventListener: doNothing,
    removeListener: doNothing,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  return dom;
}

/** Sets a controlled input or textarea value the way React's change tracking expects. */
export function typeInto(dom, element, value) {
  const prototype =
    element.tagName === "TEXTAREA"
      ? dom.window.HTMLTextAreaElement.prototype
      : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

export function findButton(root, text) {
  return [...root.querySelectorAll("button")].find(
    (button) => button.textContent.trim() === text || button.getAttribute("aria-label") === text
  );
}
