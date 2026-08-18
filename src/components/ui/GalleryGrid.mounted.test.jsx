// biome-ignore-all lint/performance/noJsxPropsBind: mounted test callbacks are intentionally local.
import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";

const REDUCED_MOTION_QUERY = /prefers-reduced-motion:\s*reduce/;
const doNothing = () => undefined;

let createRoot;
let GalleryGrid;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/gallery",
});

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
  ({ createRoot } = await import("react-dom/client"));
  ({ default: GalleryGrid } = await import("./GalleryGrid"));
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const images = [
  { _key: "sunrise", alt: "Sunrise over the Himalayas", asset: { url: "/sunrise.webp" } },
  { _key: "lake", alt: "Travellers beside a mountain lake", asset: { url: "/lake.webp" } },
];

describe("Mounted GalleryGrid", () => {
  test("Opens a labelled modal, navigates by arrow key, and restores tile focus", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<GalleryGrid images={images} />));

    const tiles = container.querySelectorAll('button[aria-haspopup="dialog"]:not([hidden])');
    expect(tiles).toHaveLength(2);
    expect(tiles[0].getAttribute("aria-label")).toContain("Sunrise over the Himalayas");
    tiles[0].focus();
    await act(async () => tiles[0].click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close gallery");
    expect(dialog.textContent).toContain("Sunrise over the Himalayas");

    await act(async () =>
      dialog.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }))
    );
    expect(dialog.textContent).toContain("Travellers beside a mountain lake");

    await act(async () =>
      dialog.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(tiles[0]);

    await act(async () => root.unmount());
  });
});
