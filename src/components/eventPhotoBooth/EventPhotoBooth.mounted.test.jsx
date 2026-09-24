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
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  dom.window.HTMLElement.prototype.scrollIntoView = () => undefined;
  Object.defineProperty(document, "fonts", { value: { ready: Promise.resolve() } });
  mock.module("@/lib/eventPhotoBooth/imageEngine", () => ({
    exportBoothPhoto: () => Promise.resolve(new Blob(["photo"], { type: "image/png" })),
    loadBoothArtwork: () => Promise.resolve(document.createElement("img")),
    loadSourcePhoto: async () => ({
      canvas: document.createElement("canvas"),
      height: 400,
      width: 300,
    }),
    releaseBoothPhoto: () => undefined,
    renderBoothPhoto: ({ canvas }) => canvas,
  }));
  globalThis.fetch = mock((url, options) => {
    requests.push({ options, url });
    return Promise.resolve(new Response(null, { status: 202 }));
  });
  ({ createRoot } = await import("react-dom/client"));
  ({ EventPhotoBoothView } = await import("./EventPhotoBooth"));
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
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

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

async function selectPhoto(container) {
  const picker = container.querySelector('input[aria-label="Choose a photo"]');
  Object.defineProperty(picker, "files", {
    configurable: true,
    value: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
  });
  await act(() => picker.dispatchEvent(new Event("change", { bubbles: true })));
}

async function createFrame(container) {
  await act(() => button(container, "Keep original photo").click());
  await selectPhoto(container);
  await settle();
  expect(button(container, "Download photo").disabled).toBe(false);
  expect(container.querySelector("details").open).toBe(false);
}

async function openDiscard(trigger) {
  trigger.focus();
  await act(() => trigger.click());
  await settle();
  expect(document.body.querySelector('[role="alertdialog"]')).not.toBeNull();
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
    expect(container.textContent).toContain("पूरी तस्वीर रखें");
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

  test("discard cancellation returns to the opener and confirmed reset focuses the visible photo summary", async () => {
    const { container, root } = await mount(openState);
    await createFrame(container);
    const startOver = button(container, "Start over");
    await openDiscard(startOver);
    await act(() => button(document.body, "Cancel").click());
    await settle();
    expect(document.activeElement).toBe(startOver);

    await act(() => container.querySelector("summary").click());
    const choosePhoto = button(container, "Choose a photo");
    choosePhoto.focus();
    await selectPhoto(container);
    await settle();
    await act(() => button(document.body, "Cancel").click());
    await settle();
    expect(document.activeElement).toBe(choosePhoto);
    expect(container.querySelector("details").open).toBe(true);

    await openDiscard(startOver);
    await act(() =>
      document.activeElement.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      )
    );
    await settle();
    expect(document.activeElement).toBe(startOver);

    await openDiscard(startOver);
    await act(() => button(document.body, "Continue without saving").click());
    await settle();
    expect(document.activeElement).toBe(container.querySelector("summary"));
    expect(button(container, "Start over")).toBeUndefined();
    await act(() => root.unmount());
  });

  test("discard after event closure focuses the page heading even when confirmed reset removes the editor", async () => {
    const { container, root } = await mount(openState);
    await createFrame(container);
    await openDiscard(button(container, "Start over"));
    await act(() =>
      root.render(
        <EventPhotoBoothView
          state={{ ...openState, availability: "closed", canParticipate: false, scenes: [] }}
        />
      )
    );
    await act(() => button(document.body, "Continue without saving").click());
    await settle();
    expect(document.activeElement).toBe(container.querySelector("h1"));
    expect(container.querySelector("summary")).toBeNull();
    await act(() => root.unmount());
  });
});
