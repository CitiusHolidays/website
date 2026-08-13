import { describe, expect, test } from "bun:test";
import { assertReferenceDate, assertReferenceNow } from "./referenceTimePolicy";

describe("reference time policy", () => {
  test("accepts deterministic date-only and millisecond inputs", () => {
    expect(assertReferenceDate("2026-08-13")).toBe("2026-08-13");
    expect(assertReferenceNow(1_765_497_600_000)).toBe(1_765_497_600_000);
  });

  test("rejects malformed, rolled-over, and non-finite inputs", () => {
    for (const referenceDate of ["2026-8-13", "2026-02-29", "2026-13-01", "not-a-date"]) {
      expect(() => assertReferenceDate(referenceDate)).toThrow(
        "A valid reference date is required"
      );
    }
    for (const referenceNow of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(() => assertReferenceNow(referenceNow)).toThrow("A valid reference time is required");
    }
  });
});
