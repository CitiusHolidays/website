import { describe, expect, it } from "vitest";
import {
  filterByPeriod,
  isInPeriod,
  parseRowDate,
  resolvePeriodRange,
} from "./periodFilter.js";

describe("periodFilter", () => {
  it("returns null range for all time", () => {
    expect(resolvePeriodRange("all")).toBeNull();
  });

  it("parses ISO and date-only values", () => {
    expect(parseRowDate("2026-01-15")).toBe(new Date("2026-01-15T00:00:00").getTime());
    expect(parseRowDate("2026-01-15T10:00:00.000Z")).toBe(
      Date.parse("2026-01-15T10:00:00.000Z"),
    );
  });

  it("filters rows by createdAt within the selected period", () => {
    const now = Date.now();
    const rows = [
      { id: "recent", createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "old", createdAt: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() },
    ];

    expect(filterByPeriod(rows, "all")).toHaveLength(2);
    expect(filterByPeriod(rows, "month").map((row) => row.id)).toEqual(["recent"]);
    expect(isInPeriod(rows[0].createdAt, "month")).toBe(true);
    expect(isInPeriod(rows[1].createdAt, "month")).toBe(false);
  });
});
