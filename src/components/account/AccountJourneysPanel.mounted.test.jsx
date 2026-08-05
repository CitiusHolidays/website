import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AccountJourneysPanel, JourneyDetailPanel } from "./AccountJourneysPanel";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/account",
});
const INTERNAL_SURFACE_PATTERN = /upload|passport|visa|job card|CRM/i;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
});

afterAll(() => dom.window.close());

const trip = {
  coverImage: "",
  description: "A carefully planned coastal escape.",
  endDate: "2099-06-17",
  id: "trip_1",
  itinerary: [],
  name: "Amalfi Coast Escape",
  slug: "amalfi-coast-escape",
  startDate: "2099-06-10",
};

const booking = {
  booking: {
    confirmedAt: null,
    createdAt: "2099-01-01T00:00:00.000Z",
    currency: "INR",
    id: "booking_123456789",
    status: "confirmed",
    totalAmount: 120_000,
    travelers: 2,
    updatedAt: "2099-01-01T00:00:00.000Z",
  },
  trip,
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

describe("customer Account journeys", () => {
  test("renders an identity-scoped journey link and a useful empty state", async () => {
    const view = await mount(
      <AccountJourneysPanel cancelledBookings={[]} pastBookings={[]} upcomingBookings={[booking]} />
    );

    const link = view.container.querySelector('a[href="/account?journey=booking_123456789"]');
    expect(link).not.toBeNull();
    expect(view.container.textContent).toContain("Amalfi Coast Escape");
    expect(view.container.textContent).toContain("Upcoming journeys");
    await view.unmount();

    const empty = await mount(
      <AccountJourneysPanel cancelledBookings={[]} pastBookings={[]} upcomingBookings={[]} />
    );
    expect(empty.container.querySelector('[role="status"]')).not.toBeNull();
    expect(empty.container.textContent).toContain("Explore journeys");
    await empty.unmount();
  });

  test("renders read-only detail sections and does not expose sensitive controls", async () => {
    const view = await mount(<JourneyDetailPanel booking={booking} />);

    expect(view.container.textContent).toContain("Journey details");
    expect(view.container.textContent).toContain("Itinerary");
    expect(view.container.textContent).toContain("Flight and PNR information will appear here");
    expect(view.container.textContent).toContain("Hotel and room information will appear here");
    expect(view.container.textContent).not.toMatch(INTERNAL_SURFACE_PATTERN);
    expect(view.container.querySelector('a[href="/contact"]')).not.toBeNull();
    await view.unmount();
  });

  test("renders only the allow-listed flight and stay details when supplied", async () => {
    const view = await mount(
      <JourneyDetailPanel
        booking={{
          ...booking,
          booking: {
            ...booking.booking,
            customerTravelDetails: {
              flight: {
                airline: "Citius Air",
                arrival: "Rome · 16:40",
                departure: "Delhi · 09:10",
                flightNumber: "CI 204",
              },
              stay: { hotel: "Harbour House", roomType: "Twin" },
            },
          },
        }}
      />
    );

    expect(view.container.textContent).toContain("CI 204");
    expect(view.container.textContent).toContain("Harbour House");
    await view.unmount();
  });
});
