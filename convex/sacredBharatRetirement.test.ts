import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import {
  archiveGroup,
  createGroup,
  getGroupLeaderboard,
  getLeaderboard,
  getLeaderboardWithMe,
  getMyLeaderboardRank,
  getMyPassportProfile,
  getMyProgress,
  getPublicPassportBySlug,
  joinGroupByInviteCode,
  leaveGroup,
  listMyGroups,
  markTempleVisited,
  mergeGuestProgress,
  renameGroup,
  rotateGroupInviteCode,
  setLeaderboardOptOut,
  toggleWishlistItem,
  unmarkTempleVisited,
  upsertMyPassportProfile,
} from "./sacredBharat";

const retiredCapabilities = [
  archiveGroup,
  createGroup,
  getGroupLeaderboard,
  getLeaderboard,
  getLeaderboardWithMe,
  getMyLeaderboardRank,
  getMyPassportProfile,
  getMyProgress,
  getPublicPassportBySlug,
  joinGroupByInviteCode,
  leaveGroup,
  listMyGroups,
  markTempleVisited,
  mergeGuestProgress,
  renameGroup,
  rotateGroupInviteCode,
  setLeaderboardOptOut,
  toggleWishlistItem,
  unmarkTempleVisited,
  upsertMyPassportProfile,
] as const;

describe("Retired Sacred Bharat public API", () => {
  test("fails every historical call before context access", () => {
    expect(retiredCapabilities).toHaveLength(20);
    const unreadableContext = new Proxy(
      {},
      {
        get() {
          throw new Error("A retired capability accessed its Convex context");
        },
      }
    );

    for (const registered of retiredCapabilities) {
      // SAFETY: every array member is a Convex registration; this test intentionally reaches its framework-owned handler seam.
      const capability = fromAny<any, unknown>(registered);
      expect(() => capability._handler(unreadableContext, {})).toThrow(
        "SACRED_BHARAT_TRACKER_RETIRED"
      );
    }
  });
});
