import { describe, expect, test } from "bun:test";
import { assertClSlLapseFiscalYear, fiscalYearEndingOn31March, isClSlLapseDay } from "./leaveLapse";

describe("leaveLapse", () => {
  test("detects 31 March in India timezone", () => {
    const march31 = new Date("2025-03-31T18:00:00.000Z");
    expect(isClSlLapseDay(march31)).toBe(true);
    expect(fiscalYearEndingOn31March(march31)).toBe("2024-2025");
  });

  test("ignores other dates", () => {
    const april1 = new Date("2025-04-01T18:00:00.000Z");
    expect(isClSlLapseDay(april1)).toBe(false);
    expect(fiscalYearEndingOn31March(april1)).toBeNull();
  });

  test("uses the exact India midnight boundary", () => {
    expect(isClSlLapseDay(new Date("2025-03-30T18:29:59.999Z"))).toBe(false);
    expect(isClSlLapseDay(new Date("2025-03-30T18:30:00.000Z"))).toBe(true);
    expect(fiscalYearEndingOn31March(new Date("2025-03-30T18:30:00.000Z"))).toBe("2024-2025");
    expect(isClSlLapseDay(new Date("2025-03-31T18:29:59.999Z"))).toBe(true);
    expect(isClSlLapseDay(new Date("2025-03-31T18:30:00.000Z"))).toBe(false);
  });

  test("accepts only consecutive four-digit fiscal years", () => {
    expect(assertClSlLapseFiscalYear("2025-2026")).toBe("2025-2026");
    expect(() => assertClSlLapseFiscalYear("2025-27")).toThrow();
    expect(() => assertClSlLapseFiscalYear("2025-2027")).toThrow();
    expect(() => assertClSlLapseFiscalYear("2025/2026")).toThrow();
  });
});
