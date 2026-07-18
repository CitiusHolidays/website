import { describe, expect, test } from "bun:test";
import { isoDate, portalDisplayDateFromIso } from "./date";

describe("portalDisplayDateFromIso", () => {
  test("formats ISO days as DD/MM/YYYY for portal date inputs", () => {
    expect(portalDisplayDateFromIso("2026-07-17")).toBe("17/07/2026");
  });

  test("isoDate returns YYYY-MM-DD", () => {
    expect(isoDate(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
