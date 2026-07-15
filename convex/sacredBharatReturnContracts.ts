import { v } from "convex/values";

const levelValidator = v.object({
  maxScore: v.union(v.number(), v.null()),
  minScore: v.number(),
  slug: v.string(),
  title: v.string(),
});
const visitValidator = v.object({
  note: v.union(v.string(), v.null()),
  source: v.union(v.literal("self"), v.literal("citius_booking")),
  templeId: v.string(),
  visitedAt: v.number(),
  visitedOn: v.union(v.string(), v.null()),
});
const wishlistValidator = v.object({
  createdAt: v.number(),
  itemId: v.string(),
  itemType: v.union(v.literal("temple"), v.literal("trail")),
});
export const sacredProgressValidator = v.object({
  completedTrailCount: v.number(),
  level: levelValidator,
  levelSlug: v.string(),
  levelTitle: v.string(),
  score: v.number(),
  templeCount: v.number(),
  totalTrails: v.number(),
  visitedTempleIds: v.array(v.string()),
  visits: v.array(visitValidator),
  wishlist: v.array(wishlistValidator),
});
export const nullableSacredProgressValidator = v.union(sacredProgressValidator, v.null());

export const passportProfileValidator = v.object({
  bio: v.string(),
  displayName: v.string(),
  homeCity: v.string(),
  id: v.id("sacredBharatProfiles"),
  isPublic: v.boolean(),
  shareRecentVisits: v.boolean(),
  shareWishlist: v.boolean(),
  slug: v.string(),
});
export const nullablePassportProfileValidator = v.union(passportProfileValidator, v.null());
export const passportProfileIdResultValidator = v.object({
  id: v.id("sacredBharatProfiles"),
  slug: v.string(),
});
export const leaderboardPreferenceResultValidator = v.object({ optOut: v.boolean() });

export const leaderboardEntryValidator = v.object({
  completedTrailCount: v.number(),
  displayName: v.string(),
  isCurrentUser: v.boolean(),
  levelSlug: v.string(),
  levelTitle: v.string(),
  passportSlug: v.union(v.string(), v.null()),
  rank: v.number(),
  score: v.number(),
  templeCount: v.number(),
});
export const leaderboardResultValidator = v.array(leaderboardEntryValidator);
const personalRankValidator = v.object({
  displayName: v.string(),
  levelTitle: v.string(),
  percentile: v.number(),
  rank: v.number(),
  score: v.number(),
  totalPlayers: v.number(),
});
export const leaderboardWithMeResultValidator = v.object({
  entries: v.array(leaderboardEntryValidator),
  myRank: v.union(personalRankValidator, v.null()),
});
export const myLeaderboardRankResultValidator = v.union(
  v.null(),
  v.object({
    displayName: v.string(),
    levelTitle: v.string(),
    passportSlug: v.union(v.string(), v.null()),
    percentile: v.number(),
    rank: v.number(),
    score: v.number(),
    totalPlayers: v.number(),
  })
);

export const groupCreateResultValidator = v.object({
  id: v.id("sacredBharatGroups"),
  inviteCode: v.string(),
});
export const groupIdResultValidator = v.object({ id: v.id("sacredBharatGroups") });
const groupRoleValidator = v.union(v.literal("owner"), v.literal("member"));
export const myGroupsResultValidator = v.array(
  v.object({
    id: v.id("sacredBharatGroups"),
    inviteCode: v.string(),
    memberCount: v.number(),
    name: v.string(),
    role: groupRoleValidator,
  })
);
export const groupLeaderboardResultValidator = v.object({
  entries: v.array(
    v.object({
      authUserId: v.string(),
      badges: v.array(v.string()),
      displayName: v.string(),
      isCurrentUser: v.boolean(),
      levelTitle: v.string(),
      rank: v.number(),
      score: v.number(),
      slug: v.union(v.string(), v.null()),
      templeCount: v.number(),
    })
  ),
  group: v.object({
    id: v.id("sacredBharatGroups"),
    inviteCode: v.string(),
    name: v.string(),
    role: groupRoleValidator,
  }),
});

const publicPassportProfileValidator = v.object({
  bio: v.string(),
  displayName: v.string(),
  homeCity: v.string(),
  isPublic: v.boolean(),
  shareRecentVisits: v.boolean(),
  shareWishlist: v.boolean(),
  slug: v.string(),
});
export const publicPassportResultValidator = v.union(
  v.null(),
  v.object({
    leaderboardRank: v.union(v.null(), v.object({ rank: v.number(), totalPlayers: v.number() })),
    profile: publicPassportProfileValidator,
    progress: sacredProgressValidator,
  })
);
