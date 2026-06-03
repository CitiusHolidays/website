import { describe, expect, test } from "bun:test";
import { fiscalYearEndingOn31March, isClSlLapseDay } from "./leaveLapse";

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
});
