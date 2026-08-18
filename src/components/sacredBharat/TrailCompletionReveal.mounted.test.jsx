import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import TrailCompletionReveal, { trailCompletionMotion } from "./TrailCompletionReveal";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/sacred-bharat/trails/shiva-trail",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    matches: false,
    media: String(query),
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  globalThis.matchMedia = matchMedia;
  dom.window.matchMedia = matchMedia;
});

afterAll(() => dom.window.close());

function props(complete) {
  return { badgeName: "Shiva Seeker", complete, completionBonus: 250 };
}

async function mountReveal(complete) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<TrailCompletionReveal {...props(complete)} />));
  return {
    container,
    rerender: async (nextComplete) =>
      act(async () => root.render(<TrailCompletionReveal {...props(nextComplete)} />)),
    unmount: async () => act(async () => root.unmount()),
  };
}

describe("Mounted Sacred Bharat trail completion reveal", () => {
  test("Reveals badge and bonus once on the first incomplete-to-complete edge", async () => {
    const view = await mountReveal(false);
    expect(view.container.querySelector('[role="status"]')).toBeNull();

    await view.rerender(true);
    expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(view.container.textContent).toContain("Shiva Seeker");
    expect(view.container.textContent).toContain("+250");

    await view.rerender(false);
    await view.rerender(true);
    expect(view.container.querySelector('[role="status"]')).toBeNull();
    await view.unmount();
  });

  test("Does not replay a completed trail on initial hydration", async () => {
    const view = await mountReveal(true);
    expect(view.container.querySelector('[role="status"]')).toBeNull();
    await view.unmount();
  });

  test("Uses the lively recipe and removes spatial motion for reduced motion", () => {
    const full = trailCompletionMotion(false);
    expect(full.initial).toMatchObject({ opacity: 0, scale: 0.97, y: 6 });
    expect(full.transition.default).toMatchObject({
      damping: 17.453_292_519_943_293,
      stiffness: 621.668_203_646_344,
      type: "spring",
    });

    const reduced = trailCompletionMotion(true);
    expect(reduced.initial).toEqual({ opacity: 0, scale: 1, y: 0 });
    expect(reduced.transition).toEqual({ duration: 0.21, ease: "linear" });
  });
});
