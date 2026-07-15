import { describe, expect, test } from "bun:test";
import { mergeFocusedRow, shouldResetLoadedPage } from "./paginatedRows";

describe("paginated row semantics", () => {
  test("keeps the visible page for a prefix-preserving cursor append", () => {
    expect(shouldResetLoadedPage(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  test("returns to page one when a filter replaces the loaded result set", () => {
    expect(shouldResetLoadedPage(["a", "b", "c"], ["b"])).toBe(true);
    expect(shouldResetLoadedPage(["a", "b"], ["b", "a"])).toBe(true);
  });

  test("prepends one focused row and removes cursor duplicates without reordering the page", () => {
    const rows = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
      { id: "b", value: 3 },
    ];
    expect(mergeFocusedRow(rows, { id: "focus", value: 0 })).toEqual([
      { id: "focus", value: 0 },
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    expect(mergeFocusedRow(rows, { id: "b", value: 9 })).toEqual([
      { id: "b", value: 9 },
      { id: "a", value: 1 },
    ]);
  });
});
