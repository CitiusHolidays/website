import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import {
  clearGuestDraft,
  normalizeGuestWishlist,
  readGuestDraft,
  writeGuestDraft,
} from "./guestStorage";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/sacred-bharat",
});

beforeAll(() => {
  globalThis.window = dom.window;
});

beforeEach(() => clearGuestDraft());
afterAll(() => dom.window.close());

describe("Sacred Bharat Guest Storage", () => {
  test("canonicalizes and deduplicates visit and wishlist aliases", () => {
    writeGuestDraft({
      templeIds: ["rameswaram", "ramanathaswamy"],
      wishlist: [
        { itemId: "varanasi", itemType: "temple" },
        { itemId: "kashi-vishwanath", itemType: "temple" },
      ],
    });

    expect(readGuestDraft()).toEqual({
      templeIds: ["ramanathaswamy"],
      wishlist: [{ itemId: "kashi-vishwanath", itemType: "temple" }],
    });
  });

  test("preserves valid wishlist-only drafts and rejects malformed items", () => {
    expect(
      normalizeGuestWishlist([
        { itemId: "shiva-trail", itemType: "trail" },
        { itemId: "", itemType: "trail" },
        { itemId: "kedarnath", itemType: "unknown" },
      ])
    ).toEqual([{ itemId: "shiva-trail", itemType: "trail" }]);
  });
});
