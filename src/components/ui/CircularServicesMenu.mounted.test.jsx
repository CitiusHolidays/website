import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/",
});
let createRoot;
let CircularServicesMenu;
let getReducedMotionServerSnapshot;
let getServiceOrbitPosition;
let sameLinePosition;
let animationFrames = 0;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => {
    animationFrames += 1;
    return setTimeout(() => callback(performance.now()), 0);
  };
  globalThis.cancelAnimationFrame = clearTimeout;
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.innerWidth = 400;
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
  ({
    default: CircularServicesMenu,
    getReducedMotionServerSnapshot,
    getServiceOrbitPosition,
    sameLinePosition,
  } = await import("./CircularServicesMenu"));
});

afterAll(() => dom.window.close());

describe("mounted Circular Services geometry", () => {
  test("keeps the reduced-motion server snapshot deterministic", () => {
    expect(getReducedMotionServerSnapshot()).toBe(false);
  });

  test("rounds orbit coordinates for stable server and client hydration", () => {
    expect(getServiceOrbitPosition(5, 11, 200)).toEqual({ x: 56.347, y: 191.899 });
  });

  test("recognizes unchanged line geometry", () => {
    expect(sameLinePosition(null, null)).toBe(true);
    expect(
      sameLinePosition({ x1: 10, x2: 20, y1: 30, y2: 40 }, { x1: 10, x2: 20, y1: 30, y2: 40 })
    ).toBe(true);
    expect(
      sameLinePosition({ x1: 10, x2: 20, y1: 30, y2: 40 }, { x1: 10, x2: 21, y1: 30, y2: 40 })
    ).toBe(false);
  });

  test("does not schedule a continuous measurement loop while selected", async () => {
    animationFrames = 0;
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<CircularServicesMenu />));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

    await act(async () => container.querySelector("button").click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(container.textContent).toContain("MICE");
    expect(animationFrames).toBeLessThanOrEqual(8);
    await act(async () => root.unmount());
    container.remove();
  });
});
