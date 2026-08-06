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

describe("customer Account journey composition", () => {
  test("uses journey photography across the upcoming, stay, and past journey sections", async () => {
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        pastBookings={[pastJourney]}
        upcomingBookings={[upcomingJourney]}
      />
    );

    expect(view.container.textContent).toContain("Kailash Journey");
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
    await act(async () => itineraryButton.click());
    expect(view.container.textContent).toContain("Back to journeys");
    expect(view.container.textContent).toContain("Itinerary snapshot");

    await view.unmount();
  });

  test("opens a past journey inside the customer account", async () => {
    const view = await mount(
      <AccountJourneysPanel
        cancelledBookings={[]}
        pastBookings={[pastJourney]}
        upcomingBookings={[]}
      />
    );

    const pastJourneyButton = view.container.querySelector(
      'button[aria-label="Open itinerary for Kathmandu Discovery"]'
    );
    await act(async () => pastJourneyButton.click());

    expect(view.container.textContent).toContain("Back to journeys");
    expect(view.container.textContent).toContain("Itinerary snapshot");

    await view.unmount();
  });

  test("keeps an honest empty state when there is no upcoming journey", async () => {
    const view = await mount(
      <AccountJourneysPanel cancelledBookings={[]} pastBookings={[]} upcomingBookings={[]} />
    );

    expect(view.container.textContent).toContain("No upcoming journeys");
    expect(view.container.textContent).toContain("Your completed journeys will collect here.");

    await view.unmount();
  });
});
