import { describe, expect, test } from "bun:test";
import {
  getEntityModalFieldColumns,
  getEntityModalMaxWidthClass,
  getEntityModalSize,
} from "./entityModalLayout";

describe("entityModalLayout", () => {
  test("sizes compact workflow modals for content-fit width", () => {
    expect(getEntityModalSize("salesDecision")).toBe("compact");
    expect(getEntityModalMaxWidthClass("salesDecision")).toBe("max-w-md");
    expect(getEntityModalFieldColumns("salesDecision")).toBe(1);
  });

  test("keeps large task sheets on full width", () => {
    expect(getEntityModalSize("query")).toBe("full");
    expect(getEntityModalMaxWidthClass("query")).toBe("max-w-3xl");
    expect(getEntityModalFieldColumns("query")).toBe(2);
  });

  test("uses medium width for focused operational forms", () => {
    expect(getEntityModalSize("assignQueryTeams")).toBe("medium");
    expect(getEntityModalMaxWidthClass("expense")).toBe("max-w-lg");
  });
});
