import { describe, expect, test } from "bun:test";
import {
  displayDateFromIsoDay,
  formatDisplayDate,
  formatDisplayDateForExport,
  formatDisplayDateInputDigits,
  formatDisplayDateTime,
  isoDayFromDisplayDate,
} from "./formatDate";

describe("FormatDisplayDate", () => {
  test("Formats ISO date-only strings as DD/MM/YYYY", () => {
    expect(formatDisplayDate("2026-06-04")).toBe("04/06/2026");
  });

  test("Formats timestamps", () => {
    expect(formatDisplayDate(Date.parse("2026-06-04T12:00:00Z"))).toMatch(/04\/06\/2026/);
  });

  test("Returns dash for empty values", () => {
    expect(formatDisplayDate("")).toBe("-");
    expect(formatDisplayDate(null)).toBe("-");
  });
});

describe("FormatDisplayDateTime", () => {
  test("Includes time", () => {
    const formatted = formatDisplayDateTime(Date.parse("2026-06-04T15:30:00"));
    expect(formatted).toContain("04/06/2026");
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("FormatDisplayDateForExport", () => {
  test("Returns empty string when missing", () => {
    expect(formatDisplayDateForExport("")).toBe("");
  });

  test("Formats stored dates for spreadsheets", () => {
    expect(formatDisplayDateForExport("2026-01-15")).toBe("15/01/2026");
  });
});

describe("IsoDayFromDisplayDate", () => {
  test("Parses DD/MM/YYYY", () => {
    expect(isoDayFromDisplayDate("04/06/2026")).toBe("2026-06-04");
  });

  test("Accepts ISO passthrough", () => {
    expect(isoDayFromDisplayDate("2026-06-04")).toBe("2026-06-04");
  });

  test("Rejects invalid calendar dates", () => {
    expect(isoDayFromDisplayDate("31/02/2026")).toBeNull();
  });
});

describe("DisplayDateFromIsoDay", () => {
  test("Formats ISO for inputs", () => {
    expect(displayDateFromIsoDay("2026-06-04")).toBe("04/06/2026");
  });
});

describe("FormatDisplayDateInputDigits", () => {
  test("Inserts slashes while typing", () => {
    expect(formatDisplayDateInputDigits("04062026")).toBe("04/06/2026");
  });
});
