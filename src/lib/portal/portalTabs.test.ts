import { describe, expect, test } from "bun:test";
import { nextTabId, resolveTabId } from "./portalTabs";

const ids = ["hotels", "rooming", "room-count"];

describe("portal tabs contract", () => {
  test("falls back when a restored tab is not available", () => {
    expect(resolveTabId(ids, "legacy", "room-count")).toBe("room-count");
    expect(resolveTabId(ids, "rooming", "room-count")).toBe("rooming");
  });

  test("supports wrapping arrow movement and Home or End navigation", () => {
    expect(nextTabId(ids, "hotels", "ArrowLeft")).toBe("room-count");
    expect(nextTabId(ids, "room-count", "ArrowRight")).toBe("hotels");
    expect(nextTabId(ids, "rooming", "Home")).toBe("hotels");
    expect(nextTabId(ids, "rooming", "End")).toBe("room-count");
  });
});
