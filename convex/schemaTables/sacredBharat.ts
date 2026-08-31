import { defineTable } from "convex/server";
import { v } from "convex/values";

export const sacredBharatTables = {
  // Anonymous Sacred Bharat edition analytics. This intentionally remains
  // separate from legacy Yatri identity, progress, visit, and wishlist data.
  sacredBharatEditionEvents: defineTable({
    attributedReferrerPlayerTokenHash: v.optional(v.string()),
    attributionExpiresAt: v.optional(v.number()),
    correct: v.optional(v.boolean()),
    createdAt: v.number(),
    edition: v.string(),
    event: v.union(
      v.literal("edition_started"),
      v.literal("question_answered"),
      v.literal("edition_completed"),
      v.literal("share_clicked"),
      v.literal("share_link_copied"),
      v.literal("result_downloaded"),
      v.literal("journey_cta_clicked"),
      v.literal("edition_restarted")
    ),
    eventId: v.string(),
    playerTokenHash: v.string(),
    questionId: v.optional(v.string()),
    referrerTokenHash: v.optional(v.string()),
    score: v.optional(v.number()),
    shareTokenHash: v.optional(v.string()),
    style: v.optional(v.string()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_playerTokenHash_createdAt", ["playerTokenHash", "createdAt"])
    .index("by_shareTokenHash", ["shareTokenHash"])
    .index("by_edition_createdAt", ["edition", "createdAt"]),

  sacredBharatGroupMembers: defineTable({
    authUserId: v.string(),
    groupId: v.id("sacredBharatGroups"),
    joinedAt: v.number(),
    role: v.union(v.literal("owner"), v.literal("member")),
  })
    .index("by_groupId", ["groupId"])
    .index("by_authUserId", ["authUserId"])
    .index("by_groupId_authUserId", ["groupId", "authUserId"]),

  sacredBharatGroups: defineTable({
    createdAt: v.number(),
    inviteCode: v.string(),
    isArchived: v.boolean(),
    // Optional while sacred-bharat-group-count-v1 is backfilled and verified.
    memberCount: v.optional(v.number()),
    name: v.string(),
    ownerAuthUserId: v.string(),
    updatedAt: v.number(),
  })
    .index("by_ownerAuthUserId", ["ownerAuthUserId"])
    .index("by_inviteCode", ["inviteCode"]),

  sacredBharatInviteAttempts: defineTable({
    attemptCount: v.number(),
    authUserId: v.string(),
    updatedAt: v.number(),
    windowStartedAt: v.number(),
  }).index("by_authUserId", ["authUserId"]),

  // One compact row per participant keeps leaderboard reads proportional to
  // the number of players rather than every visit event. Rows are refreshed
  // by the visit/profile mutations and can be backfilled independently.
  sacredBharatLeaderboardSummaries: defineTable({
    authUserId: v.string(),
    completedTrailCount: v.number(),
    displayName: v.string(),
    levelSlug: v.string(),
    levelTitle: v.string(),
    optedOut: v.boolean(),
    passportSlug: v.union(v.string(), v.null()),
    score: v.number(),
    templeCount: v.number(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_score", ["score", "templeCount", "authUserId"]),

  sacredBharatProfiles: defineTable({
    authUserId: v.string(),
    bio: v.optional(v.string()),
    createdAt: v.number(),
    displayName: v.string(),
    homeCity: v.optional(v.string()),
    isPublic: v.boolean(),
    shareRecentVisits: v.boolean(),
    shareWishlist: v.boolean(),
    slug: v.string(),
    updatedAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_slug", ["slug"])
    .index("by_isPublic", ["isPublic"]),

  sacredBharatRateLimitKeys: defineTable({
    cleanupAfter: v.number(),
    keyHash: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_cleanupAfter", ["cleanupAfter"]),

  sacredBharatVisits: defineTable({
    authUserId: v.string(),
    citiusBookingId: v.optional(v.id("bookings")),
    note: v.optional(v.string()),
    source: v.optional(v.union(v.literal("self"), v.literal("citius_booking"))),
    templeId: v.string(),
    visitedAt: v.number(),
    visitedOn: v.optional(v.string()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_templeId", ["authUserId", "templeId"]),

  sacredBharatWishlist: defineTable({
    authUserId: v.string(),
    createdAt: v.number(),
    itemId: v.string(),
    itemType: v.union(v.literal("temple"), v.literal("trail")),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_authUserId_item", ["authUserId", "itemType", "itemId"]),
};
