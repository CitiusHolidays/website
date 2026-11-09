import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PastJourneyCard } from "./AccountUi";

const BOOKING = {
  booking: { id: "booking-1" },
  trip: {
    endDate: "2026-01-08",
    name: "Synthetic journey",
    slug: "synthetic",
    startDate: "2026-01-01",
  },
};

describe("Past journey card", () => {
  test("Opens the journey in the Account rather than a public services address", () => {
    const markup = renderToStaticMarkup(
      <PastJourneyCard booking={BOOKING} bookingId="booking-1" />
    );
    expect(markup).toContain("Open itinerary for Synthetic journey");
    expect(markup).not.toContain("/services/");
  });
});
