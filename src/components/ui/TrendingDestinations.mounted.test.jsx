import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { PUBLIC_DESTINATIONS, PUBLIC_DESTINATIONS_VERSION } from "@/data/publicDestinations";
import {
  DESTINATION_PLAN_SCHEMA_VERSION,
  DESTINATION_PLAN_STORAGE_KEY,
} from "@/lib/public/destinationPlan";
import TrendingDestinations from "./TrendingDestinations";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/",
});
const originalFetch = globalThis.fetch;
let createRoot;

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (frame) => clearTimeout(frame);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.matchMedia = () => ({
    addEventListener() {
      // Motion subscribes to preference changes; this fixture stays non-reduced.
    },
    matches: false,
    removeEventListener() {
      // Motion cleanup mirrors the inert fixture subscription above.
    },
  });
  globalThis.matchMedia = dom.window.matchMedia;
  globalThis.ResizeObserver = class {
    disconnect() {
      // The fixture does not emit resize records.
    }
    observe() {
      // The fixture does not emit resize records.
    }
    unobserve() {
      // The fixture does not emit resize records.
    }
  };
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  localStorage.clear();
  document.body.replaceChildren();
});
afterAll(() => dom.window.close());

const international = [
  {
    description: "Temples, neighbourhoods, and seasonal food traditions.",
    id: "japan",
    image: "/gallery/aboutus.webp",
    name: "Japan",
    percentage: 94,
    rank: 1,
    region: "international",
  },
];

const domestic = [
  {
    description: "Coastlines, heritage quarters, and unhurried local stays.",
    id: "goa",
    image: "/gallery/aboutus.webp",
    name: "Goa",
    percentage: 91,
    rank: 1,
    region: "domestic",
  },
];

async function mount({ internationalDestinations = international } = {}) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => {
    root.render(
      <TrendingDestinations
        domesticDestinations={domestic}
        internationalDestinations={internationalDestinations}
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
    const expandControl = view.container.querySelector(
      '[aria-label="Show the full Japan description"]'
    );

    expect(internationalButton.getAttribute("aria-pressed")).toBe("true");
    expect(domesticButton.getAttribute("aria-pressed")).toBe("false");
    expect(view.container.textContent).toContain(international[0].description);
    expect(view.container.querySelector('[data-copy-open="false"]')).not.toBeNull();
    expect(view.container.querySelectorAll("article")).toHaveLength(1);
    expect(expandControl?.getAttribute("aria-expanded")).toBe("false");

    await act(() => expandControl.click());
    expect(expandControl.getAttribute("aria-expanded")).toBe("true");
    expect(view.container.querySelector('[data-copy-open="true"]')).not.toBeNull();
    expect(view.container.querySelector('[data-copy-open="false"]')).toBeNull();

    await act(() => domesticButton.click());

    expect(internationalButton.getAttribute("aria-pressed")).toBe("false");
    expect(domesticButton.getAttribute("aria-pressed")).toBe("true");
    expect(view.container.textContent).toContain(domestic[0].description);
    expect(view.container.textContent).not.toContain(international[0].description);
    expect(
      view.container.querySelector("section[aria-label]").getAttribute("aria-label")
    ).toContain("Domestic");
    await view.unmount();
  });

  test("saves, edits, reviews, and submits only after the mounted consent step", async () => {
    const requests = [];
    globalThis.fetch = (_url, options) => {
      requests.push(JSON.parse(options.body));
      return {
        json: () => ({ accepted: true, receiptReference: "ENQ-M123-ABCDEF12" }),
        ok: true,
      };
    };
    const view = await mount();
    const saveJapan = view.container.querySelector('[aria-label="Save Japan to your shortlist"]');

    expect(view.container.querySelector("#destination-shortlist")).toBeNull();
    expect(view.container.querySelector('input[name="destination"]')).toBeNull();
    expect(requests).toEqual([]);

    await act(() => saveJapan.click());
    expect(saveJapan.getAttribute("aria-pressed")).toBe("true");
    expect(saveJapan.textContent).toBe("Saved");
    expect(view.container.textContent).toContain("Saved on this device");
    expect(view.container.querySelector("#destination-shortlist details").textContent).toContain(
      "not an Account record"
    );
    expect(view.container.querySelector('a[href="/contact"]').textContent).toContain(
      "Contact Citius without a saved plan"
    );
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY))).toMatchObject({
      draft: { destination: "Japan" },
      schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
      shortlist: [{ id: "japan", name: "Japan", region: "international" }],
    });
    expect(requests).toEqual([]);

    const destinationInput = view.container.querySelector(
      '#destination-shortlist input[name="destination"]'
    );
    const inputSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    ).set;
    const paxInput = view.container.querySelector('#destination-shortlist input[name="paxCount"]');
    await act(() => {
      inputSetter.call(paxInput, "0");
      paxInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(async () => {
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent === "Save draft on this device")
        .click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.activeElement).toBe(paxInput);
    expect(view.container.textContent).toContain(
      "Group size must be a whole number between 1 and 1,000."
    );
    await act(() => {
      inputSetter.call(paxInput, "");
      paxInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      inputSetter.call(destinationInput, "Japan with a Kyoto extension");
      destinationInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    await act(() =>
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent === "Save draft on this device")
        .click()
    );
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).draft).toEqual({
      destination: "Japan with a Kyoto extension",
    });
    expect(requests).toEqual([]);

    await act(() =>
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent === "Review with Citius")
        .click()
    );
    const handoffForm = view.container.querySelector("form");
    expect(handoffForm).not.toBeNull();
    expect(handoffForm.querySelector('input[name="destination"]').value).toBe(
      "Japan with a Kyoto extension"
    );
    expect(view.container.textContent).toContain(
      "Your browser shortlist, local storage, and Concierge conversation are not attached."
    );
    await act(async () =>
      handoffForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(requests).toEqual([]);
    expect(view.container.textContent).toContain("Confirm that Citius may contact you.");

    const setInput = (name, value) => {
      const input = handoffForm.querySelector(`[name="${name}"]`);
      inputSetter.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    };
    await act(() => {
      setInput("clientName", "Traveller");
      setInput("contactEmail", "traveller@example.com");
      handoffForm.querySelector('input[name="consent"]').click();
    });
    await act(async () => {
      handoffForm.dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      brief: { destination: "Japan with a Kyoto extension" },
      clientName: "Traveller",
      consent: true,
      contactEmail: "traveller@example.com",
      source: "Citius Concierge",
    });
    expect(requests[0]).not.toHaveProperty("shortlist");
    expect(requests[0]).not.toHaveProperty("catalogVersion");
    await act(() =>
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent.includes("Reset plan"))
        .click()
    );
    expect(view.container.querySelector("form")).toBeNull();
    expect(view.container.querySelector("#destination-shortlist")).toBeNull();
    expect(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).toBeNull();
    await view.unmount();
  });

  test("supports card deletion and reset with named, keyboard-sized controls", async () => {
    const view = await mount();
    const saveJapan = view.container.querySelector('[aria-label="Save Japan to your shortlist"]');
    await act(() => saveJapan.click());

    const savedJapan = view.container.querySelector('[aria-label="Save Japan to your shortlist"]');
    expect(savedJapan.className).toContain("min-h-11");
    await act(() => savedJapan.click());
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).shortlist).toEqual([]);

    await act(() =>
      view.container.querySelector('[aria-label="Save Japan to your shortlist"]').click()
    );
    const remove = view.container.querySelector('[aria-label="Remove Japan from shortlist"]');
    expect(remove.className).toContain("size-11");
    await act(() => remove.click());
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).shortlist).toEqual([]);

    await act(() =>
      view.container.querySelector('[aria-label="Save Japan to your shortlist"]').click()
    );
    await act(() =>
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent.includes("Reset plan"))
        .click()
    );
    expect(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).toBeNull();
    expect(view.container.textContent).toContain("saved destination plan was reset");
    expect(view.container.querySelector("#destination-shortlist")).toBeNull();
    await view.unmount();
  });

  test("blocks stale catalog storage until the visitor explicitly resets it", async () => {
    localStorage.setItem(
      DESTINATION_PLAN_STORAGE_KEY,
      JSON.stringify({
        catalogVersion: "retired-catalog",
        draft: { destination: "Old destination" },
        schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
        shortlist: [{ id: "japan", name: "Japan", region: "international" }],
      })
    );
    const view = await mount();

    expect(view.container.textContent).toContain("older destination catalogue");
    expect(view.container.textContent).not.toContain("Review with Citius");
    expect(view.container.querySelector("form")).toBeNull();
    await act(() =>
      view.container.querySelector('[aria-label="Save Japan to your shortlist"]').click()
    );
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).catalogVersion).toBe(
      "retired-catalog"
    );

    await act(() =>
      [...view.container.querySelectorAll("button")]
        .find(({ textContent }) => textContent.includes("Reset saved plan"))
        .click()
    );
    expect(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).toBeNull();
    expect(view.container.querySelector("#destination-shortlist")).toBeNull();
    await view.unmount();
  });

  test("reveals restored device saves and preserves the three-destination cap", async () => {
    const destinations = PUBLIC_DESTINATIONS.filter(({ region }) => region === "international");
    localStorage.setItem(
      DESTINATION_PLAN_STORAGE_KEY,
      JSON.stringify({
        catalogVersion: PUBLIC_DESTINATIONS_VERSION,
        draft: { destination: "Japan with a Kyoto extension", paxCount: 6 },
        schemaVersion: DESTINATION_PLAN_SCHEMA_VERSION,
        shortlist: [{ id: "japan", name: "Japan", region: "international" }],
      })
    );
    const view = await mount({ internationalDestinations: destinations });
    expect(
      view.container.querySelector('#destination-shortlist input[name="destination"]').value
    ).toBe("Japan with a Kyoto extension");
    expect(
      view.container.querySelector('#destination-shortlist input[name="paxCount"]').value
    ).toBe("6");
    for (const destination of destinations.slice(1, 4)) {
      // biome-ignore lint/performance/noAwaitInLoops: each save must commit before the next card is selected.
      await act(() =>
        view.container
          .querySelector(`[aria-label="Save ${destination.name} to your shortlist"]`)
          .click()
      );
    }
    expect(view.container.querySelectorAll("#destination-shortlist ol li")).toHaveLength(3);
    expect(view.container.textContent).toContain(
      "Your shortlist can include up to 3 destinations."
    );
    expect(JSON.parse(localStorage.getItem(DESTINATION_PLAN_STORAGE_KEY)).shortlist).toHaveLength(
      3
    );
    expect(view.container.querySelector("form")).toBeNull();
    await view.unmount();
  });

  test("reveals an in-page shortlist when device storage is unavailable", async () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(dom.window, "localStorage");
    Object.defineProperty(dom.window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage unavailable");
      },
    });
    const view = await mount();
    try {
      expect(view.container.querySelector("#destination-shortlist")).toBeNull();
      await act(() =>
        view.container.querySelector('[aria-label="Save Japan to your shortlist"]').click()
      );
      expect(
        view.container.querySelector('#destination-shortlist input[name="destination"]').value
      ).toBe("Japan");
      expect(view.container.textContent).toContain("Saving on this device is unavailable");
      expect(view.container.textContent).not.toContain("Saved on this device");
      expect(view.container.querySelector("form")).toBeNull();
    } finally {
      await view.unmount();
      Object.defineProperty(dom.window, "localStorage", storageDescriptor);
    }
  });
});
