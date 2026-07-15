import { describe, expect, test } from "bun:test";
import { shouldContinueCursorPage } from "./cursorPagination";

describe("portal cursor pagination policy", () => {
  test("fills past access-filtered source pages until the visible target is reached", () => {
    expect(
      shouldContinueCursorPage({
        automaticLoads: 0,
        loadedCount: 12,
        maxAutomaticLoads: 2,
        status: "CanLoadMore",
        targetCount: 50,
      })
    ).toBe(true);
    expect(
      shouldContinueCursorPage({
        automaticLoads: 0,
        loadedCount: 50,
        maxAutomaticLoads: 2,
        status: "CanLoadMore",
        targetCount: 50,
      })
    ).toBe(false);
  });

  test("never drains the cursor after the visible target is filled", () => {
    expect(
      shouldContinueCursorPage({
        automaticLoads: 0,
        loadedCount: 50,
        maxAutomaticLoads: 2,
        status: "CanLoadMore",
        targetCount: 50,
      })
    ).toBe(false);
    expect(
      shouldContinueCursorPage({
        automaticLoads: 1,
        loadedCount: 20,
        maxAutomaticLoads: 2,
        status: "CanLoadMore",
        targetCount: 50,
      })
    ).toBe(true);
  });

  test("stops automatic fill after a bounded number of sparse pages", () => {
    expect(
      shouldContinueCursorPage({
        automaticLoads: 2,
        loadedCount: 0,
        maxAutomaticLoads: 2,
        status: "CanLoadMore",
        targetCount: 50,
      })
    ).toBe(false);
  });
});
