import { describe, expect, test } from "bun:test";
import {
  getEntityModalFieldColumns,
  getEntityModalMaxWidthClass,
  getEntityModalSize,
} from "./entityModalLayout";

describe("EntityModalLayout", () => {
  test("Sizes compact workflow modals for content-fit width", () => {
    expect(getEntityModalSize("salesDecision")).toBe("compact");
    expect(getEntityModalMaxWidthClass("salesDecision")).toBe("max-w-md");
    expect(getEntityModalFieldColumns("salesDecision")).toBe(1);
  });

  test("Keeps large task sheets on full width", () => {
    expect(getEntityModalSize("query")).toBe("full");
    expect(getEntityModalMaxWidthClass("query")).toBe("max-w-3xl");
    expect(getEntityModalFieldColumns("query")).toBe(2);
  });

  test("Uses medium width for focused operational forms", () => {
    expect(getEntityModalSize("assignQueryTeams")).toBe("medium");
    expect(getEntityModalMaxWidthClass("expense")).toBe("max-w-lg");
  });
});
