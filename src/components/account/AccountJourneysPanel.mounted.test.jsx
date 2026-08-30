import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AccountJourneysPanel } from "./AccountJourneysPanel";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
});

afterEach(() => {
  document.body.replaceChildren();
});

afterAll(() => dom.window.close());

const upcomingJourney = {
  booking: {
    id: "booking_upcoming",
    status: "confirmed",
    travelers: 2,
  },
  entitlement: { role: "purchaser", source: "public_booking_owner" },
  trip: {
    coverImage: "/gallery/spiritual/aerial-view.webp",
    destination: "Kailash and Mansarovar",
    endDate: "2099-06-17",
    gallery: [
      {
        alt: "Lake Mansarovar at dusk",
        src: "/gallery/spiritual/mansarovar-lake.webp",
      },
    ],
    itinerary: [
      {
        day: "Day 1",
        desc: "Morning flight and transfer",
        title: "Arrival in Kathmandu",
      },
      {
        accommodation: "Lake View Guest House",
        day: "Day 2",
        location: "Mansarovar",
        title: "Stay by the lake",
      },
    ],
    name: "Kailash Journey",
    slug: "kailash-journey",
    startDate: "2099-06-10",
  },
};

const pastJourney = {
  booking: {
    id: "booking_past",
    status: "confirmed",
    travelers: 1,
  },
  trip: {
    coverImage: "/gallery/spiritual/pashupatinath.webp",
    destination: "Kathmandu",
    endDate: "2025-03-18",
    gallery: [],
    itinerary: [],
    name: "Kathmandu Discovery",
    slug: "kathmandu-discovery",
    startDate: "2025-03-12",
  },
};

const loadUpcomingJourney = () => Promise.resolve(upcomingJourney);
const loadPastJourney = () => Promise.resolve(pastJourney);

function confirmedTrip(overrides = {}) {
  const value = {
    confirmation: { at: 1_788_000_000_000, status: "confirmed" },
    confirmedOfferId: "confirmedOffers_1",
    entitlement: { role: "organizer", source: "crm_operator_grant" },
    nextAction: {
      kind: "download_arrival_pack",
      label: "Download offline Arrival Pack",
    },
    readOnly: true,
    staySummary: { asOf: null, source: "unknown", status: "unknown", summary: null },
    travel: {
      asOf: 1_788_000_000_000,
      destination: "Kyoto",
      endDate: "2026-11-10",
      source: "confirmed_offer",
      startDate: "2026-11-01",
    },
    ...overrides,
  };
  return {
    ...value,
    staySummary: { ...value.staySummary, ...overrides.staySummary },
    travel: { ...value.travel, ...overrides.travel },
  };
}

async function mount(element) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("Customer Account journey composition", () => {
  test("Uses journey photography across the upcoming, stay, and past journey sections", async () => {
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        loadJourneyDetail={loadUpcomingJourney}
        pastBookings={[pastJourney]}
        upcomingBookings={[upcomingJourney]}
      />
    );

    expect(view.container.textContent).toContain("Kailash Journey");
    const status = [...view.container.querySelectorAll('[data-surface="account"]')].find(
      (element) => element.textContent === "Confirmed"
    );
    expect(status).not.toBeNull();
    expect(status.className).toContain("account-success");
    expect(view.container.textContent).toContain("Itinerary preview");
    expect(view.container.textContent).toContain("Lake View Guest House");
    expect(view.container.textContent).toContain("Kathmandu Discovery");
    expect(view.container.querySelector('img[alt="Kailash Journey"]')).not.toBeNull();
    expect(view.container.querySelector('img[alt="Lake Mansarovar at dusk"]')).not.toBeNull();
    expect(
      view.container.querySelector('button[aria-label="Open itinerary for Kathmandu Discovery"]')
    ).not.toBeNull();

    const itineraryButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("View itinerary")
    );
    await act(async () => {
      itineraryButton.click();
      await Promise.resolve();
    });
    expect(view.container.textContent).toContain("Back to journeys");
    expect(view.container.textContent).toContain("Itinerary snapshot");

    await view.unmount();
  });

  test("Opens a past journey inside the customer account", async () => {
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        loadJourneyDetail={loadPastJourney}
        pastBookings={[pastJourney]}
        upcomingBookings={[]}
      />
    );

    const pastJourneyButton = view.container.querySelector(
      'button[aria-label="Open itinerary for Kathmandu Discovery"]'
    );
    await act(async () => {
      pastJourneyButton.click();
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain("Back to journeys");
    expect(view.container.textContent).toContain("Itinerary snapshot");

    await view.unmount();
  });

  test("Keeps an honest empty state when there is no upcoming journey", async () => {
    const view = await mount(
      <AccountJourneysPanel cancelledBookings={[]} pastBookings={[]} upcomingBookings={[]} />
    );

    expect(view.container.textContent).toContain("No upcoming trips");
    expect(view.container.textContent).toContain("Completed trips appear here.");

    await view.unmount();
  });

  test("Renders an accessible customer-safe Arrival Pack with honest Unknown state", async () => {
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        confirmedTrips={[confirmedTrip()]}
        pastBookings={[]}
        upcomingBookings={[]}
      />
    );
    expect(view.container.textContent).toContain("Arrival Packs");
    expect(view.container.textContent).toContain("Kyoto");
    expect(view.container.textContent).toContain("Organizer access");
    expect(view.container.textContent).toContain("Journey readiness");
    expect(view.container.textContent).toContain("Pending — Unknown");
    expect(view.container.textContent).toContain(
      "Unknown — no approved confirmed stay summary is available."
    );
    expect(view.container.textContent).not.toContain("JC-0001-AS");
    expect(view.container.textContent).not.toContain("Travellers");
    const download = view.container.querySelector('a[download=""]');
    expect(download?.getAttribute("href")).toBe("/api/account/arrival-pack/confirmedOffers_1");
    expect(download?.textContent).toContain("Download offline Arrival Pack");
    expect(download?.className).toContain("min-h-11");
    expect(view.container.querySelector("article")?.className).toContain("min-w-0");
    expect(view.container.querySelector("article dl")?.className).toContain("grid-cols-1");
    expect(view.container.querySelector("input, textarea, select")).toBeNull();
    await view.unmount();
  });

  test("Loads every confirmed-trip page without replacing the packets already shown", async () => {
    const requestedCursors = [];
    const loadConfirmedTripsPage = (cursor) => {
      requestedCursors.push(cursor);
      return Promise.resolve({
        continueCursor: "",
        isDone: true,
        page: [
          confirmedTrip({
            confirmedOfferId: "confirmedOffers_2",
            travel: {
              destination: "Lisbon",
              endDate: "2027-06-08",
              startDate: "2027-06-01",
            },
          }),
        ],
      });
    };
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        confirmedTrips={[confirmedTrip()]}
        confirmedTripsCursor="cursor-1"
        confirmedTripsDone={false}
        loadConfirmedTripsPage={loadConfirmedTripsPage}
        pastBookings={[]}
        upcomingBookings={[]}
      />
    );

    const loadMore = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load more confirmed trips"
    );
    await act(async () => {
      loadMore.click();
      await Promise.resolve();
    });

    expect(requestedCursors).toEqual(["cursor-1"]);
    expect(view.container.textContent).toContain("Kyoto");
    expect(view.container.textContent).toContain("Lisbon");
    expect(view.container.textContent).not.toContain("Load more confirmed trips");
    expect(view.container.querySelector("input, textarea, select")).toBeNull();
    await view.unmount();
  });

  test("Keeps confirmed-trip pagination retryable after a stable failure message", async () => {
    let attempts = 0;
    const loadConfirmedTripsPage = () => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.reject(new Error("private provider details"));
      }
      return Promise.resolve({
        continueCursor: "",
        isDone: true,
        page: [
          confirmedTrip({
            confirmedOfferId: "confirmedOffers_2",
            travel: { destination: "Lisbon" },
          }),
        ],
      });
    };
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        confirmedTrips={[confirmedTrip()]}
        confirmedTripsCursor="cursor-1"
        confirmedTripsDone={false}
        loadConfirmedTripsPage={loadConfirmedTripsPage}
        pastBookings={[]}
        upcomingBookings={[]}
      />
    );

    let loadMore = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load more confirmed trips"
    );
    await act(async () => {
      loadMore.click();
      await Promise.resolve();
    });
    expect(view.container.querySelector('[role="alert"]')?.textContent).toBe(
      "More confirmed trips could not be loaded. Please try again."
    );
    expect(view.container.textContent).not.toContain("private provider details");

    loadMore = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Load more confirmed trips"
    );
    await act(async () => {
      loadMore.click();
      await Promise.resolve();
    });
    expect(attempts).toBe(2);
    expect(view.container.textContent).toContain("Lisbon");
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
    await view.unmount();
  });

  test("Loads only the selected journey detail and reports a recoverable failure", async () => {
    const requested = [];
    const loadUnavailableJourney = (bookingId) => {
      requested.push(bookingId);
      return requested.length === 1
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(upcomingJourney);
    };
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        loadJourneyDetail={loadUnavailableJourney}
        pastBookings={[pastJourney]}
        referenceNow={123}
        upcomingBookings={[upcomingJourney]}
      />
    );

    expect(requested).toEqual([]);
    const itineraryButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("View itinerary")
    );
    await act(async () => {
      itineraryButton.click();
      await Promise.resolve();
    });
    expect(requested).toEqual(["booking_upcoming"]);
    expect(view.container.textContent).toContain(
      "Journey details could not be loaded. Please try again."
    );
    expect(view.container.textContent).toContain("Back to journeys");
    const retry = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again"
    );
    expect(retry).not.toBeNull();
    expect(view.container.querySelector('a[href="/contact"]')?.textContent).toContain("Get help");
    await act(async () => {
      retry.click();
      await Promise.resolve();
    });
    expect(requested).toEqual(["booking_upcoming", "booking_upcoming"]);
    expect(view.container.textContent).toContain("Itinerary snapshot");

    await view.unmount();
  });

  test("Does not reopen a journey when a pending detail request finishes after Back", async () => {
    const request = deferred();
    const loadPendingJourney = () => request.promise;
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        loadJourneyDetail={loadPendingJourney}
        pastBookings={[]}
        upcomingBookings={[upcomingJourney]}
      />
    );

    const itineraryButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("View itinerary")
    );
    await act(async () => itineraryButton.click());
    const backButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Back to journeys")
    );
    await act(async () => backButton.click());
    await act(async () => {
      request.resolve(upcomingJourney);
      await request.promise;
    });

    expect(view.container.textContent).toContain("Upcoming journey");
    expect(view.container.textContent).not.toContain("Itinerary snapshot");
    await view.unmount();
  });

  test("Ignores an older detail response when two journey requests overlap", async () => {
    const upcomingRequest = deferred();
    const pastRequest = deferred();
    const loadOverlappingJourney = (bookingId) =>
      bookingId === "booking_upcoming" ? upcomingRequest.promise : pastRequest.promise;
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        loadJourneyDetail={loadOverlappingJourney}
        pastBookings={[pastJourney]}
        upcomingBookings={[upcomingJourney]}
      />
    );

    const upcomingButton = [...view.container.querySelectorAll("button")].find((button) =>
      button.textContent.includes("View itinerary")
    );
    const pastButton = view.container.querySelector(
      'button[aria-label="Open itinerary for Kathmandu Discovery"]'
    );
    await act(async () => {
      upcomingButton.click();
      await Promise.resolve();
    });
    await act(async () => pastButton.click());
    await act(async () => {
      pastRequest.resolve(pastJourney);
      await pastRequest.promise;
    });
    await act(async () => {
      upcomingRequest.resolve(upcomingJourney);
      await upcomingRequest.promise;
    });

    expect(view.container.querySelector("section.relative h2")?.textContent).toBe(
      "Kathmandu Discovery"
    );
    await view.unmount();
  });
});
