import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  groupCreateResultValidator,
  groupIdResultValidator,
  groupJoinResultValidator,
  groupLeaderboardResultValidator,
  leaderboardPreferenceResultValidator,
  leaderboardResultValidator,
  leaderboardWithMeResultValidator,
  myGroupsResultValidator,
  myLeaderboardRankResultValidator,
  nullablePassportProfileValidator,
  nullableSacredProgressValidator,
  passportProfileIdResultValidator,
  publicPassportResultValidator,
  sacredProgressValidator,
} from "./sacredBharatReturnContracts";

const RETIRED_SACRED_BHARAT_TRACKER_ERROR = "SACRED_BHARAT_TRACKER_RETIRED";

function retiredSacredBharatTracker(): never {
  throw new ConvexError(RETIRED_SACRED_BHARAT_TRACKER_ERROR);
}

// Keep the historical public names and validators addressable for old callers, but fail before
// authentication or database work. Historical tables, helpers, and migrations are retained until
// a separately authorized target-specific retention decision is made.
export const getMyProgress = query({
  args: {},
  handler: retiredSacredBharatTracker,
  returns: nullableSacredProgressValidator,
});

export const markTempleVisited = mutation({
  args: {
    note: v.optional(v.string()),
    templeId: v.string(),
    visitedOn: v.optional(v.string()),
  },
  handler: retiredSacredBharatTracker,
  returns: sacredProgressValidator,
});

export const getMyPassportProfile = query({
  args: {},
  handler: retiredSacredBharatTracker,
  returns: nullablePassportProfileValidator,
});

export const upsertMyPassportProfile = mutation({
  args: {
    bio: v.optional(v.string()),
    displayName: v.string(),
    homeCity: v.optional(v.string()),
    isPublic: v.boolean(),
    shareRecentVisits: v.boolean(),
    shareWishlist: v.boolean(),
    slug: v.string(),
  },
  handler: retiredSacredBharatTracker,
  returns: passportProfileIdResultValidator,
});

export const unmarkTempleVisited = mutation({
  args: { templeId: v.string() },
  handler: retiredSacredBharatTracker,
  returns: sacredProgressValidator,
});

export const mergeGuestProgress = mutation({
  args: {
    templeIds: v.array(v.string()),
    wishlist: v.optional(
      v.array(
        v.object({
          itemId: v.string(),
          itemType: v.union(v.literal("temple"), v.literal("trail")),
        })
      )
    ),
  },
  handler: retiredSacredBharatTracker,
  returns: sacredProgressValidator,
});

export const toggleWishlistItem = mutation({
  args: {
    itemId: v.string(),
    itemType: v.union(v.literal("temple"), v.literal("trail")),
  },
  handler: retiredSacredBharatTracker,
  returns: sacredProgressValidator,
});

export const setLeaderboardOptOut = mutation({
  args: { optOut: v.boolean() },
  handler: retiredSacredBharatTracker,
  returns: leaderboardPreferenceResultValidator,
});

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: retiredSacredBharatTracker,
  returns: leaderboardResultValidator,
});

export const getLeaderboardWithMe = query({
  args: { limit: v.optional(v.number()) },
  handler: retiredSacredBharatTracker,
  returns: leaderboardWithMeResultValidator,
});

export const getMyLeaderboardRank = query({
  args: {},
  handler: retiredSacredBharatTracker,
  returns: myLeaderboardRankResultValidator,
});

export const createGroup = mutation({
  args: { name: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupCreateResultValidator,
});

export const rotateGroupInviteCode = mutation({
  args: { groupId: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupCreateResultValidator,
});

export const joinGroupByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupJoinResultValidator,
});

export const listMyGroups = query({
  args: {},
  handler: retiredSacredBharatTracker,
  returns: myGroupsResultValidator,
});

export const getGroupLeaderboard = query({
  args: { groupId: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupLeaderboardResultValidator,
});

export const renameGroup = mutation({
  args: { groupId: v.string(), name: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupIdResultValidator,
});

export const archiveGroup = mutation({
  args: { groupId: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupIdResultValidator,
});

export const leaveGroup = mutation({
  args: { groupId: v.string() },
  handler: retiredSacredBharatTracker,
  returns: groupIdResultValidator,
});

export const getPublicPassportBySlug = query({
  args: { slug: v.string() },
  handler: retiredSacredBharatTracker,
  returns: publicPassportResultValidator,
});
