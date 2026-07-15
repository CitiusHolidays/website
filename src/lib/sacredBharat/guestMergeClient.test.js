import { describe, expect, test } from "bun:test";
import {
  combineGuestAndServerProgress,
  mergeGuestProgressDraft,
  shouldStartGuestMerge,
} from "./guestMergeClient";

const draft = {
  templeIds: ["kedarnath"],
  wishlist: [{ itemId: "shiva-trail", itemType: "trail" }],
};

describe("Sacred Bharat Guest Merge Client", () => {
  test("starts one authenticated merge only after hydration", () => {
    expect(
      shouldStartGuestMerge({
        draft,
        guestHydrated: true,
        isAuthenticated: true,
        mergeStarted: false,
      })
    ).toBe(true);
    expect(
      shouldStartGuestMerge({
        draft,
        guestHydrated: true,
        isAuthenticated: true,
        mergeStarted: true,
      })
    ).toBe(false);
    expect(
      shouldStartGuestMerge({
        draft,
        guestHydrated: false,
        isAuthenticated: true,
        mergeStarted: false,
      })
    ).toBe(false);
  });

  test("combines cross-device server progress with canonical local aliases", () => {
    expect(
      combineGuestAndServerProgress({
        guestTempleIds: ["rameswaram"],
        guestWishlist: [{ itemId: "varanasi", itemType: "temple" }],
        serverTempleIds: ["ramanathaswamy", "kedarnath"],
        serverWishlist: [{ itemId: "kashi-vishwanath", itemType: "temple" }],
      })
    ).toEqual({
      visitedTempleIds: ["ramanathaswamy", "kedarnath"],
      wishlist: [{ itemId: "kashi-vishwanath", itemType: "temple" }],
    });
  });

  test("clears the local draft only after durable success", async () => {
    let clearCount = 0;
    const progress = { visitedTempleIds: ["kedarnath"], wishlist: draft.wishlist };
    const result = await mergeGuestProgressDraft({
      clearDraft: () => {
        clearCount += 1;
      },
      draft,
      merge: async () => progress,
    });

    expect(result).toEqual({ progress, status: "success" });
    expect(clearCount).toBe(1);
  });

  test("preserves the local draft after an offline failure", async () => {
    let clearCount = 0;
    const result = await mergeGuestProgressDraft({
      clearDraft: () => {
        clearCount += 1;
      },
      draft,
      merge: () => Promise.reject(new Error("private server detail")),
    });

    expect(result).toEqual({ progress: null, status: "error" });
    expect(clearCount).toBe(0);
  });

  test("does not call the server for an empty draft", async () => {
    let mergeCount = 0;
    const result = await mergeGuestProgressDraft({
      clearDraft: () => undefined,
      draft: { templeIds: [], wishlist: [] },
      merge: () => {
        mergeCount += 1;
      },
    });

    expect(result.status).toBe("empty");
    expect(mergeCount).toBe(0);
  });
});
