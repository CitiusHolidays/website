import { describe, expect, test } from "bun:test";
import {
  formatAccountDate,
  formatAccountDateRange,
  getDepartureLabel,
  getTripDestination,
  getTripNights,
} from "./accountPresentation";

describe("customer account presentation helpers", () => {
  test("formats date-only journey values without a timezone shift", () => {
    expect(formatAccountDate("2025-05-24")).toBe("24 May 2025");
    expect(formatAccountDateRange("2025-05-24", "2025-05-30")).toBe("24 May 2025 – 30 May 2025");
  });

  test("uses safe fallbacks for missing dates and destination metadata", () => {
    expect(formatAccountDate(null)).toBe("Date to follow");
    expect(formatAccountDateRange(null, null)).toBe("Dates to follow");
    expect(getTripDestination({ name: "Santorini Escape" })).toBe("Santorini Escape");
    expect(getTripDestination({})).toBe("Destination details to follow");
  });

  test("calculates nights and a customer-facing departure label", () => {
    expect(getTripNights({ endDate: "2025-05-30", startDate: "2025-05-24" })).toBe(6);
    expect(getDepartureLabel("2025-05-24", Date.parse("2025-05-01T12:00:00Z"))).toBe(
      "Departs in 23 days"
    );
    expect(getDepartureLabel("2025-05-24", Date.parse("2025-05-24T12:00:00Z"))).toBe(
      "Journey in progress"
    );
  });
});
