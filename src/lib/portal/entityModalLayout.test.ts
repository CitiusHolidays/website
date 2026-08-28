import { describe, expect, test } from "bun:test";
import {
  getEntityModalFieldColumns,
  getEntityModalMaxWidthClass,
  getEntityModalSize,
} from "./entityModalLayout";

describe("EntityModalLayout", () => {
  test("Sizes compact workflow modals for content-fit width", () => {
    expect(getEntityModalSize("salesDecision")).toBe("compact");
    expect(getEntityModalMaxWidthClass("salesDecision")).toBe("max-w-lg");
    expect(getEntityModalFieldColumns("salesDecision")).toBe(1);
  });

  test("Keeps large task sheets on full width", () => {
    expect(getEntityModalSize("query")).toBe("full");
    expect(getEntityModalMaxWidthClass("query")).toBe("max-w-6xl");
    expect(getEntityModalFieldColumns("query")).toBe(2);
    expect(getEntityModalSize("travelBatch")).toBe("full");
  });

  test("Gives multi-field operational forms room for two columns", () => {
    expect(getEntityModalSize("assignQueryTeams")).toBe("medium");
    expect(getEntityModalMaxWidthClass("assignQueryTeams")).toBe("max-w-2xl");
    expect(getEntityModalMaxWidthClass("expense")).toBe("max-w-4xl");
    expect(getEntityModalFieldColumns("seat")).toBe(2);
  });
});
