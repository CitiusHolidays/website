import { describe, expect, test } from "bun:test";
import { normalizePassportExpiryDate } from "./passportExpiry";

describe("normalizePassportExpiryDate", () => {
  test("returns undefined for empty or UNKNOWN values", () => {
    expect(normalizePassportExpiryDate("")).toBeUndefined();
    expect(normalizePassportExpiryDate("UNKNOWN")).toBeUndefined();
  });

  test("keeps YYYY-MM-DD values", () => {
    expect(normalizePassportExpiryDate("2028-03-15")).toBe("2028-03-15");
  });

  test("parses human-readable dates", () => {
    expect(normalizePassportExpiryDate("15 Mar 2028")).toBe("2028-03-15");
  });
});
