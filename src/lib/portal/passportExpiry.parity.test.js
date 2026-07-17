import { describe, expect, test } from "bun:test";
import { classifyPassportExpiryUrgency } from "../../../convex/crm/passportExpiry";
import {
  attachPassportExpiryUrgency,
  filterByPassportExpiryUrgency,
  getPassportExpiryInfo,
} from "./passportExpiry.js";

const PARITY_FIXTURES = [
  {
    expiryDate: "",
    referenceDate: "2026-01-01",
    travelDate: "2026-08-01",
    urgency: "unknown",
  },
  {
    expiryDate: "2025-12-31",
    referenceDate: "2026-01-01",
    travelDate: "2026-08-01",
    urgency: "expired",
  },
  {
    expiryDate: "2026-08-01",
    referenceDate: "2026-01-01",
    travelDate: "2026-03-01",
    urgency: "critical",
  },
  {
    expiryDate: "2026-06-01",
    referenceDate: "2026-01-01",
    travelDate: "2026-02-01",
    urgency: "warning",
  },
  {
    expiryDate: "2028-06-01",
    referenceDate: "2026-01-01",
    travelDate: "2026-08-01",
    urgency: "ok",
  },
];

describe("passport expiry parity (portal vs Convex)", () => {
  const today = new Date("2026-01-01T12:00:00.000Z");

  for (const fixture of PARITY_FIXTURES) {
    test(`${fixture.urgency} for expiry ${fixture.expiryDate || "empty"}`, () => {
      const convexUrgency = classifyPassportExpiryUrgency({
        expiryDate: fixture.expiryDate,
        referenceDate: fixture.referenceDate,
        travelDate: fixture.travelDate,
      });
      const portalInfo = getPassportExpiryInfo({
        expiryDate: fixture.expiryDate,
        today,
        travelDate: fixture.travelDate,
      });
      expect(portalInfo.level).toBe(convexUrgency);
    });
  }

  test("filter count matches badge urgency for fixture rows", () => {
    const rows = attachPassportExpiryUrgency(
      PARITY_FIXTURES.filter((fixture) => fixture.expiryDate).map((fixture, index) => ({
        id: String(index),
        passportExpiryDate: fixture.expiryDate,
        travelStartDate: fixture.travelDate,
      })),
      today
    );
    for (const urgency of ["critical", "warning", "ok", "expired"]) {
      const filtered = filterByPassportExpiryUrgency(rows, urgency);
      expect(filtered.every((row) => row._passportExpiryUrgency === urgency)).toBe(true);
    }
  });
});
