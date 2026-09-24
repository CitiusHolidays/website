import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { DEFAULT_BOOTH_SCENES } from "@/lib/eventPhotoBooth/contracts";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/photo-booth",
});
let createRoot;
let EventPhotoBoothView;
const originalFetch = globalThis.fetch;
const requests = [];
const scenes = DEFAULT_BOOTH_SCENES.map((scene) => ({
  ...scene,
  artworkUrl: `/images/event-photo-booth/${scene.id}.webp`,
}));
const openState = {
  availability: "open",
  canParticipate: true,
  privilegedAccess: false,
  revision: 0,
  scenes,
};

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.fetch = mock((url, options) => {
    requests.push({ options, url });
    return Promise.resolve(new Response(null, { status: 202 }));
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ EventPhotoBoothView } = await import("./EventPhotoBooth"));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  dom.window.close();
});
afterEach(() => {
  requests.length = 0;
  document.body.replaceChildren();
});

async function mount(state) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(<EventPhotoBoothView state={state} />));
  return { container, root };
}
function button(container, label) {
  return [...container.querySelectorAll("button")].find((item) => item.textContent === label);
}

describe("Photo Booth participant access and bilingual choices", () => {
  test("unknown and Closed access fail closed even if a stale scene array exists", async () => {
    const { container, root } = await mount(undefined);
    expect(container.textContent).toContain("Checking whether");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    await act(() =>
      root.render(
        <EventPhotoBoothView
          state={{ ...openState, availability: "closed", canParticipate: false }}
        />
      )
    );
    expect(container.textContent).toContain("The photo booth is closed");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(requests).toHaveLength(0);
    await act(() => root.unmount());
  });

  test("Open guests choose all six scenes and Hindi with no photo/model network", async () => {
    const { container, root } = await mount(openState);
    expect(button(container, "Paris")).toBeDefined();
    expect(button(container, "Bali")).toBeDefined();
    expect(button(container, "Dubai")).toBeDefined();
    expect(button(container, "Create my photo").disabled).toBe(true);
    await act(() => button(container, "Pilgrimage").click());
    expect(button(container, "Kashi")).toBeDefined();
    expect(button(container, "Ayodhya")).toBeDefined();
    expect(button(container, "Kedarnath")).toBeDefined();
    await act(() => button(container, "Kashi").click());
    expect(button(container, "Kashi").getAttribute("aria-pressed")).toBe("true");
    await act(() => button(container, "हिन्दी").click());
    expect(container.querySelector('[lang="hi"]')).not.toBeNull();
    expect(container.textContent).toContain("काशी");
    expect(container.textContent).toContain("पूरी तस्वीर का फ़्रेम");
    await act(() => root.unmount());
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("/api/event-photo-booth/events");
    expect(JSON.parse(requests[0].options.body)).toEqual({
      events: [{ count: 1, event: "visit" }],
    });
  });

  test("server-verified privileged access remains usable while Closed and reacts to revocation", async () => {
    const state = { ...openState, availability: "closed", privilegedAccess: true };
    const { container, root } = await mount(state);
    expect(container.textContent).toContain("Staff preview");
    expect(button(container, "Choose a photo").disabled).toBe(false);
    await act(() =>
      root.render(
        <EventPhotoBoothView
          state={{ ...state, canParticipate: false, privilegedAccess: false, scenes: [] }}
        />
      )
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(container.textContent).toContain("The photo booth is closed");
    await act(() => root.unmount());
  });
});
