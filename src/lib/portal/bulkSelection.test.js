import { describe, expect, test } from "bun:test";
import {
  allVisibleRowsSelected,
  pruneSelectionToVisible,
  someVisibleRowsSelected,
  toggleAllVisibleSelection,
} from "./bulkSelection.js";

describe("bulkSelection", () => {
  test("drops selections that are no longer visible", () => {
    expect(pruneSelectionToVisible(new Set(["a", "b", "c"]), ["a", "c"])).toEqual(
      new Set(["a", "c"]),
    );
  });

  test("selects all visible rows when none were selected", () => {
    expect(toggleAllVisibleSelection(new Set(), ["a", "b"])).toEqual(new Set(["a", "b"]));
  });

  test("clears selection when every visible row is already selected", () => {
    expect(toggleAllVisibleSelection(new Set(["a", "b"]), ["a", "b"])).toEqual(new Set());
  });

  test("leaves selection unchanged when there are no visible rows", () => {
    const current = new Set(["a"]);
    expect(toggleAllVisibleSelection(current, [])).toBe(current);
  });

  test("prunes selection when status filter narrows visible rows", () => {
    const selected = new Set(["a", "b", "c"]);
    const visibleAfterFilter = ["a"];
    expect(pruneSelectionToVisible(selected, visibleAfterFilter)).toEqual(new Set(["a"]));
  });

  test("reports header checkbox state from visible rows only", () => {
    const selected = new Set(["a", "hidden"]);
    expect(allVisibleRowsSelected(selected, ["a", "b"])).toBe(false);
    expect(someVisibleRowsSelected(selected, ["a", "b"])).toBe(true);
    expect(allVisibleRowsSelected(new Set(["a", "b"]), ["a", "b"])).toBe(true);
  });
});
