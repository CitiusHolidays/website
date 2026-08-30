import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createAccountJourneyUrlKey } from "@/lib/accountJourneyUrlKey.server";
import { resolveAccountUrlState } from "@/lib/accountUrlState";

let AccountClient;

mock.module("next/image", () => ({
  default: () => null,
}));

const BOOKING_ID = "bookings_private_record_1";
const JOURNEY_KEY = createAccountJourneyUrlKey(BOOKING_ID);
const journey = {
  booking: { id: BOOKING_ID, status: "confirmed", travelers: 2 },
  category: "upcoming",
  detailAvailable: true,
  entitlement: { role: "purchaser", source: "public_booking_owner" },
  journeyKey: JOURNEY_KEY,
  trip: {
    coverImage: "/gallery/spiritual/aerial-view.webp",
    endDate: "2099-06-17",
    gallery: [],
    itinerary: [],
    name: "Kailash Journey",
    slug: "kailash-journey",
    startDate: "2099-06-10",
  },
};
const journeys = { referenceNow: 123, summaries: [journey] };
const user = {
  createdAt: "2026-01-01T00:00:00.000Z",
  email: "traveller@example.com",
  name: "Test Traveller",
};
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account?tab=journeys",
});
let scrollPosition = 0;
const scrollCalls = [];

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PopStateEvent = dom.window.PopStateEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  Object.defineProperty(dom.window, "scrollY", {
    configurable: true,
    get: () => scrollPosition,
  });
  dom.window.scrollTo = (options) => {
    const top = options?.top || 0;
    scrollPosition = top;
    scrollCalls.push(top);
  };
  ({ default: AccountClient } = await import("./page.client"));
});

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/account?tab=journeys");
  scrollPosition = 0;
  scrollCalls.length = 0;
});

afterEach(() => document.body.replaceChildren());
afterAll(() => dom.window.close());

async function mount(initialUrlState, loadJourneyDetail, journeyData = journeys) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <AccountClient
        initialUrlState={initialUrlState}
        journeys={journeyData}
        loadJourneyDetail={loadJourneyDetail}
        user={user}
      />
    )
  );
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function historyMove(direction) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("History navigation timed out")), 2000);
    window.addEventListener(
      "popstate",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
    window.history[direction]();
  });
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("Customer Account URL continuity", () => {
  test("preserves tab and journey state across back/forward with focus and scroll restoration", async () => {
    const requested = [];
    const view = await mount(
      resolveAccountUrlState(new URLSearchParams(window.location.search), [journey]),
      (journeyKey) => {
        requested.push(journeyKey);
        return Promise.resolve(journey);
      }
    );

    const profile = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Profile"
    );
    await act(async () => profile.click());
    expect(window.location.search).toBe("?tab=profile");
    expect(view.container.textContent).toContain("Personal Details");
    await act(async () => historyMove("back"));
    await act(async () => nextAnimationFrame());

    scrollPosition = 420;
    const trigger = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("View itinerary")
    );
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(window.location.search).toBe(`?tab=journeys&journey=${JOURNEY_KEY}`);
    expect(window.location.href).not.toContain(BOOKING_ID);
    expect(requested).toEqual([JOURNEY_KEY]);
    expect(document.activeElement?.textContent).toBe("Kailash Journey");

    scrollPosition = 0;
    await act(async () => historyMove("back"));
    await act(async () => nextAnimationFrame());
    const restored = view.container.querySelector(`[data-account-journey-key="${JOURNEY_KEY}"]`);
    expect(scrollCalls).toContain(420);
    expect(document.activeElement).toBe(restored);

    await act(async () => historyMove("forward"));
    await act(async () => nextAnimationFrame());
    expect(requested).toEqual([JOURNEY_KEY, JOURNEY_KEY]);
    expect(view.container.textContent).toContain("Itinerary snapshot");

    scrollPosition = 0;
    await act(async () => historyMove("back"));
    await act(async () => nextAnimationFrame());
    expect(scrollCalls.filter((top) => top === 420)).toHaveLength(2);
    expect(document.activeElement).toBe(
      view.container.querySelector(`[data-account-journey-key="${JOURNEY_KEY}"]`)
    );
    expect(window.history.state.accountJourneyRestore).toEqual({
      journeyKey: JOURNEY_KEY,
      scrollY: 420,
    });

    await act(async () => historyMove("forward"));
    await act(async () => nextAnimationFrame());
    expect(requested).toEqual([JOURNEY_KEY, JOURNEY_KEY, JOURNEY_KEY]);
    expect(document.activeElement?.textContent).toBe("Kailash Journey");
    await view.unmount();
  });

  test("uses external history state so Next synchronizes pushed and canonicalized URLs", async () => {
    window.history.replaceState(
      { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: "account" } },
      "",
      "/account?tab=staff"
    );
    const nativePushState = window.history.pushState.bind(window.history);
    const nativeReplaceState = window.history.replaceState.bind(window.history);
    const synchronizedTransitions = [];
    const copyNextState = (state) => ({
      ...state,
      __NA: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: window.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE,
    });
    window.history.pushState = (state, unused, url) => {
      if (!(state?.__NA || state?._N) && url) {
        synchronizedTransitions.push({ method: "push", url: String(url) });
      }
      return nativePushState(state?.__NA || state?._N ? state : copyNextState(state), unused, url);
    };
    window.history.replaceState = (state, unused, url) => {
      if (!(state?.__NA || state?._N) && url) {
        synchronizedTransitions.push({ method: "replace", url: String(url) });
      }
      return nativeReplaceState(
        state?.__NA || state?._N ? state : copyNextState(state),
        unused,
        url
      );
    };

    let view;
    try {
      view = await mount(
        resolveAccountUrlState(new URLSearchParams(window.location.search), [journey]),
        () => Promise.resolve(journey)
      );
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
      expect(window.location.search).toBe("?tab=journeys");

      const profile = [...view.container.querySelectorAll("button")].find(
        (button) => button.textContent.trim() === "Profile"
      );
      await act(async () => profile.click());
      expect(synchronizedTransitions).toEqual([
        { method: "replace", url: "/account?tab=journeys" },
        { method: "push", url: "/account?tab=profile" },
      ]);
      expect(window.history.state.__NA).toBe(true);
      expect(view.container.textContent).toContain("Personal Details");
    } finally {
      window.history.pushState = nativePushState;
      window.history.replaceState = nativeReplaceState;
      await view?.unmount();
    }
  });

  test("preserves the existing Staff denial marker without showing journey recovery", async () => {
    window.history.replaceState({}, "", "/account?portal=unauthorized");
    const view = await mount(
      resolveAccountUrlState(new URLSearchParams(window.location.search), [journey]),
      () => Promise.resolve(journey)
    );

    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(window.location.search).toBe("?portal=unauthorized");
    expect(view.container.querySelector("#account-journey-recovery")).toBeNull();
    await view.unmount();
  });

  test("reloads an authorized opaque link but canonicalizes an unauthorized one without a read", async () => {
    window.history.replaceState({}, "", `/account?tab=journeys&journey=${JOURNEY_KEY}`);
    let requested = 0;
    let view = await mount(
      resolveAccountUrlState(new URLSearchParams(window.location.search), [journey]),
      () => {
        requested += 1;
        return Promise.resolve(journey);
      }
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(requested).toBe(1);
    expect(view.container.textContent).toContain("Itinerary snapshot");
    await view.unmount();

    window.history.replaceState({}, "", `/account?tab=journeys&journey=${JOURNEY_KEY}`);
    const stale = resolveAccountUrlState(new URLSearchParams(window.location.search), []);
    view = await mount(
      stale,
      () => {
        requested += 1;
        return Promise.resolve(journey);
      },
      { referenceNow: 123, summaries: [] }
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    expect(window.location.search).toBe("?tab=journeys");
    expect(document.activeElement?.id).toBe("account-journey-recovery");
    expect(view.container.querySelector('a[href="/contact"]')).not.toBeNull();
    expect(requested).toBe(1);
    await view.unmount();
  });
});
