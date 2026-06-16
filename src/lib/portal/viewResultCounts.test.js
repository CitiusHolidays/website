import { describe, expect, test } from "bun:test";
import { buildViewResultCountMap, getViewResultCount } from "./viewResultCounts.js";

describe("viewResultCounts", () => {
  test("returns row length for known views", () => {
    const map = buildViewResultCountMap({
      filteredQueries: [{ id: "1" }, { id: "2" }],
      filteredRoomingTravellers: [{ id: "a" }],
    });
    expect(getViewResultCount("queries", map)).toBe(2);
    expect(getViewResultCount("hotels", map)).toBe(1);
    expect(getViewResultCount("settings", map)).toBeNull();
  });
});
