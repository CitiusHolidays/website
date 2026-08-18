import { describe, expect, test } from "bun:test";
import { assertDateRangeOrder, getDateRangeError, isIsoDate } from "./dateValidation.js";

describe("DateValidation", () => {
  test("Detects inverted ISO date ranges", () => {
    expect(getDateRangeError("2026-06-04", "2026-01-01")).toBe(
      "Start date must be on or before End date."
    );
    expect(
      getDateRangeError("2026-06-04", "2026-01-01", { endLabel: "To", startLabel: "From" })
    ).toBe("From must be on or before To.");
  });

  test("Allows open-ended ranges", () => {
    expect(getDateRangeError("2026-06-04", "")).toBeNull();
    expect(getDateRangeError("", "2026-06-04")).toBeNull();
  });

  test("AssertDateRangeOrder throws on invalid ranges", () => {
    expect(() =>
      assertDateRangeOrder("2026-06-04", "2026-01-01", {
        endLabel: "Travel end date",
        startLabel: "Travel start date",
      })
    ).toThrow("Travel start date must be on or before Travel end date.");
  });

  test("IsIsoDate validates YYYY-MM-DD", () => {
    expect(isIsoDate("2026-06-04")).toBe(true);
    expect(isIsoDate("04/06/2026")).toBe(false);
  });
});
