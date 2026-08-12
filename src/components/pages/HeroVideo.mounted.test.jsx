import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import HeroVideo from "./HeroVideo";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com",
});
let intersectionCallback;
let prefersReducedMotion = false;
const doNothing = () => undefined;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
  });
  window.matchMedia = () => ({
    addEventListener: doNothing,
    matches: prefersReducedMotion,
    removeEventListener: doNothing,
  });
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      intersectionCallback = callback;
    }
    disconnect() {
      // This fake observer owns no resources.
    }
    observe() {
      // Observation is driven explicitly through intersectionCallback.
    }
    unobserve() {
      // Next's intersection hook requires cleanup even though this fake observer owns no resources.
    }
  };
  dom.window.HTMLMediaElement.prototype.load = () => undefined;
  dom.window.HTMLMediaElement.prototype.pause = () => undefined;
  dom.window.HTMLMediaElement.prototype.play = () => Promise.resolve();
});

afterAll(() => dom.window.close());

describe("poster-first home hero", () => {
  test("mounts no media sources until the eligible hero enters the viewport", async () => {
    prefersReducedMotion = false;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<HeroVideo className="hero" />));

    const video = container.querySelector("video");
    expect(video.getAttribute("preload")).toBe("none");
    expect(video.getAttribute("poster")).toBe("/gallery/hero-poster.webp");
    expect(video.querySelectorAll("source")).toHaveLength(0);

    await act(async () => intersectionCallback([{ isIntersecting: true }]));
    expect(video.querySelectorAll("source")).toHaveLength(2);
    expect(video.querySelector('source[media="(max-width: 768px)"]').src).toContain("/hero-sm.mp4");
    expect(video.querySelector("source:not([media])").src).toContain("/hero.mp4");
    expect(video.querySelectorAll('source[type="video/webm"]')).toHaveLength(0);
    const pauseControl = container.querySelector('button[aria-label="Pause background video"]');
    expect(pauseControl).not.toBeNull();
    expect(pauseControl.className).toContain("right-[max(6rem,var(--safe-area-inset-right))]");

    await act(async () =>
      container.querySelector('button[aria-label="Pause background video"]').click()
    );
    expect(container.querySelector('button[aria-label="Play background video"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  test("keeps the poster-only fallback when reduced motion is requested", async () => {
    prefersReducedMotion = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<HeroVideo className="hero" />));
    await act(async () => intersectionCallback([{ isIntersecting: true }]));
    expect(container.querySelectorAll("source")).toHaveLength(0);
    expect(container.querySelector("button")).toBeNull();
    await act(async () => root.unmount());
  });
});
