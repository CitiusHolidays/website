import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import TrendingDestinations from "./TrendingDestinations";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

const international = [
  {
    description: "Temples, neighbourhoods, and seasonal food traditions.",
    image: "/gallery/aboutus.webp",
    name: "Kyoto",
    percentage: 94,
    rank: 1,
  },
];

const domestic = [
  {
    description: "Coastlines, heritage quarters, and unhurried local stays.",
    image: "/gallery/aboutus.webp",
    name: "Goa",
    percentage: 91,
    rank: 1,
  },
];

async function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <TrendingDestinations
        domesticDestinations={domestic}
        internationalDestinations={international}
      />
    );
  });
  return {
    container,
    unmount: async () => {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Home trending destination rail", () => {
  test("Keeps a short rest state and expands the full description on the card control", async () => {
    const view = await mount();
    const [internationalButton, domesticButton] =
      view.container.querySelectorAll("fieldset button");
    const expandControl = view.container.querySelector("article button");

    expect(internationalButton.getAttribute("aria-pressed")).toBe("true");
    expect(domesticButton.getAttribute("aria-pressed")).toBe("false");
    expect(view.container.textContent).toContain(international[0].description);
    expect(view.container.querySelector("article .grid-rows-\\[3rem\\]")).not.toBeNull();
    expect(view.container.querySelectorAll("article")).toHaveLength(1);
    expect(expandControl?.getAttribute("aria-expanded")).toBe("false");

    await act(() => expandControl.click());
    expect(expandControl.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelector("article .grid-rows-\\[1fr\\]")).not.toBeNull();
    expect(view.container.querySelector("article .grid-rows-\\[3rem\\]")).toBeNull();

    await act(() => domesticButton.click());

    expect(internationalButton.getAttribute("aria-pressed")).toBe("false");
    expect(domesticButton.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.textContent).toContain(domestic[0].description);
    expect(view.container.textContent).not.toContain(international[0].description);
    expect(
      view.container.querySelector('[aria-label="Domestic trending destinations"]')
    ).not.toBeNull();
    await view.unmount();
  });
});
