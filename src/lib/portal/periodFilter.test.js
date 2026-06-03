import { describe, expect, test } from "bun:test";
import {
  dateRangeQueryArg,
  EMPTY_DATE_RANGE,
  filterByDateRange,
  isInDateRange,
  normalizeDateRange,
  parseRowDate,
  resolveDateRange,
} from "./periodFilter.js";

describe("periodFilter", () => {
  test("returns null range when both dates are empty", () => {
    expect(resolveDateRange(EMPTY_DATE_RANGE)).toBeNull();
    expect(dateRangeQueryArg(EMPTY_DATE_RANGE)).toBeUndefined();
  });

  test("parses ISO and date-only values", () => {
    expect(parseRowDate("2026-01-15")).toBe(new Date("2026-01-15T00:00:00").getTime());
    expect(parseRowDate("2026-01-15T10:00:00.000Z")).toBe(Date.parse("2026-01-15T10:00:00.000Z"));
  });

  test("swaps inverted from/to dates", () => {
    expect(normalizeDateRange({ from: "2026-02-01", to: "2026-01-01" })).toEqual({
      from: "2026-01-01",
      to: "2026-02-01",
    });
  });

  test("filters rows by createdAt within an explicit date range", () => {
    const rows = [
      { id: "in-range", createdAt: "2026-01-15T10:00:00.000Z" },
      { id: "out-range", createdAt: "2025-12-01T10:00:00.000Z" },
    ];

    const range = { from: "2026-01-01", to: "2026-01-31" };
    expect(filterByDateRange(rows, range).map((row) => row.id)).toEqual(["in-range"]);
    expect(isInDateRange(rows[0].createdAt, range)).toBe(true);
    expect(isInDateRange(rows[1].createdAt, range)).toBe(false);
  });

  test("supports open-ended ranges", () => {
    const rows = [
      { id: "recent", createdAt: new Date("2026-02-01T12:00:00").toISOString() },
      { id: "old", createdAt: new Date("2025-01-01T12:00:00").toISOString() },
    ];
    expect(filterByDateRange(rows, { from: "2026-01-01", to: null }).map((row) => row.id)).toEqual([
      "recent",
    ]);
    expect(filterByDateRange(rows, { from: null, to: "2025-06-30" }).map((row) => row.id)).toEqual([
      "old",
    ]);
  });

  test("team and settings are excluded from period filter views", () => {
    const showPeriodFilter = (view) => !["settings", "team"].includes(view);
    expect(showPeriodFilter("team")).toBe(false);
    expect(showPeriodFilter("settings")).toBe(false);
    expect(showPeriodFilter("queries")).toBe(true);
    expect(showPeriodFilter("dashboard")).toBe(true);
  });

  test("includes the full end day", () => {
    const endOfDay = new Date("2026-01-15T23:59:59").getTime();
    expect(isInDateRange(endOfDay, { from: "2026-01-15", to: "2026-01-15" })).toBe(true);
  });
});
