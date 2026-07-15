import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { resolveCanonicalTempleId } from "./lib/sacredBharatAliases";
import { applyGuestProgressMerge } from "./lib/sacredBharatGuestMerge";
import {
  computeProgressSummary,
  computeScore,
  getLevelForScore,
  normalizeVisitedSet,
} from "./lib/sacredBharatScoring";
import {
  groupCreateResultValidator,
  groupIdResultValidator,
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

const now = () => Date.now();
const RESERVED_PASSPORT_SLUGS = new Set(["leaderboard", "trails", "groups", "challenges", "admin"]);

const getIdentity = async (ctx: QueryCtx | MutationCtx) => await ctx.auth.getUserIdentity();

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const getVisitsForUser = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("sacredBharatVisits")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();

const getWishlistForUser = async (ctx: QueryCtx | MutationCtx, authUserId: string) =>
  await ctx.db
    .query("sacredBharatWishlist")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();

const toVisitApi = (visit: Doc<"sacredBharatVisits">) => ({
  note: visit.note ?? null,
  source: visit.source ?? "self",
  templeId: visit.templeId,
  visitedAt: visit.visitedAt,
  visitedOn: visit.visitedOn ?? null,
});

const toWishlistApi = (item: Doc<"sacredBharatWishlist">) => ({
  createdAt: item.createdAt,
  itemId: item.itemId,
  itemType: item.itemType,
});

const buildProgressPayload = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  const [visits, wishlist] = await Promise.all([
    getVisitsForUser(ctx, authUserId),
    getWishlistForUser(ctx, authUserId),
  ]);
  const templeIds = visits.map((v) => v.templeId);
  const summary = computeProgressSummary(templeIds);

  return {
    visitedTempleIds: [...normalizeVisitedSet(templeIds)],
    visits: visits.map(toVisitApi).sort((a, b) => b.visitedAt - a.visitedAt),
    wishlist: wishlist.map(toWishlistApi),
    ...summary,
    level: getLevelForScore(computeScore(templeIds)),
    score: computeScore(templeIds),
  };
};

function normalizePassportSlug(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || RESERVED_PASSPORT_SLUGS.has(slug)) {
    throw new ConvexError("PASSPORT_SLUG_RESERVED");
  }
  if (slug.length < 3 || slug.length > 48) {
    throw new ConvexError("PASSPORT_SLUG_INVALID");
  }
  return slug;
}

async function getPassportProfileForUser(ctx: QueryCtx | MutationCtx, authUserId: string) {
  return await ctx.db
    .query("sacredBharatProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

async function buildGroupMemberSummary(ctx: QueryCtx, authUserId: string) {
  const [passport, profile, progress] = await Promise.all([
    getPassportProfileForUser(ctx, authUserId),
    ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
    buildProgressPayload(ctx, authUserId),
  ]);
  return {
    authUserId,
    badges: [],
    displayName: passport?.displayName || profile?.name || "Sacred Yatri",
    levelTitle: progress.levelTitle,
    score: progress.score,
    slug: passport?.isPublic ? passport.slug : null,
    templeCount: progress.templeCount,
  };
}

export const getMyProgress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return null;
    }
    return await buildProgressPayload(ctx, identity.subject);
  },
  returns: nullableSacredProgressValidator,
});

export const markTempleVisited = mutation({
  args: {
    note: v.optional(v.string()),
    templeId: v.string(),
    visitedOn: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const templeId = resolveCanonicalTempleId(args.templeId);
    const visitedSet = normalizeVisitedSet([templeId]);
    if (visitedSet.size === 0) {
      throw new ConvexError("INVALID_TEMPLE");
    }

    const existing = await ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId_templeId", (q) =>
        q.eq("authUserId", identity.subject).eq("templeId", templeId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("sacredBharatVisits", {
        authUserId: identity.subject,
        note: args.note,
        source: "self",
        templeId,
        visitedAt: now(),
        visitedOn: args.visitedOn,
      });
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
  returns: sacredProgressValidator,
});

export const getMyPassportProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return null;
    }
    const profile = await getPassportProfileForUser(ctx, identity.subject);
    return profile
      ? {
          bio: profile.bio ?? "",
          displayName: profile.displayName,
          homeCity: profile.homeCity ?? "",
          id: profile._id,
          isPublic: profile.isPublic,
          shareRecentVisits: profile.shareRecentVisits,
          shareWishlist: profile.shareWishlist,
          slug: profile.slug,
        }
      : null;
  },
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
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const slug = normalizePassportSlug(args.slug);
    const [existingSlug, existing] = await Promise.all([
      ctx.db
        .query("sacredBharatProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique(),
      getPassportProfileForUser(ctx, identity.subject),
    ]);
    if (existingSlug && existingSlug.authUserId !== identity.subject) {
      throw new ConvexError("PASSPORT_SLUG_TAKEN");
    }
    const timestamp = now();
    const patch = {
      bio: args.bio?.trim(),
      displayName: args.displayName.trim() || "Sacred Yatri",
      homeCity: args.homeCity?.trim(),
      isPublic: args.isPublic,
      shareRecentVisits: args.shareRecentVisits,
      shareWishlist: args.shareWishlist,
      slug,
      updatedAt: timestamp,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return { id: existing._id, slug };
    }
    const id = await ctx.db.insert("sacredBharatProfiles", {
      authUserId: identity.subject,
      ...patch,
      createdAt: timestamp,
    });
    return { id, slug };
  },
  returns: passportProfileIdResultValidator,
});

export const unmarkTempleVisited = mutation({
  args: { templeId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const templeId = resolveCanonicalTempleId(args.templeId);
    const existing = await ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId_templeId", (q) =>
        q.eq("authUserId", identity.subject).eq("templeId", templeId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
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
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const timestamp = now();
    await applyGuestProgressMerge(
      ctx,
      identity.subject,
      { templeIds: args.templeIds, wishlist: args.wishlist },
      { createdAt: timestamp, visitedAt: timestamp }
    );

    return await buildProgressPayload(ctx, identity.subject);
  },
  returns: sacredProgressValidator,
});

export const toggleWishlistItem = mutation({
  args: {
    itemId: v.string(),
    itemType: v.union(v.literal("temple"), v.literal("trail")),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const itemId =
      args.itemType === "temple" ? resolveCanonicalTempleId(args.itemId) : args.itemId.trim();
    const existing = await ctx.db
      .query("sacredBharatWishlist")
      .withIndex("by_authUserId_item", (q) =>
        q.eq("authUserId", identity.subject).eq("itemType", args.itemType).eq("itemId", itemId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("sacredBharatWishlist", {
        authUserId: identity.subject,
        createdAt: now(),
        itemId,
        itemType: args.itemType,
      });
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
  returns: sacredProgressValidator,
});

export const setLeaderboardOptOut = mutation({
  args: { optOut: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();

    if (!profile) {
      throw new ConvexError("PROFILE_NOT_FOUND");
    }

    await ctx.db.patch(profile._id, {
      sacredBharatLeaderboardOptOut: args.optOut,
      updatedAt: now(),
    });

    return { optOut: args.optOut };
  },
  returns: leaderboardPreferenceResultValidator,
});

const getDisplayName = async (ctx: QueryCtx, authUserId: string) => {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  const name = profile?.name?.trim();
  if (name) {
    return name;
  }
  return "Sacred Yatri";
};

const isLeaderboardOptedOut = async (ctx: QueryCtx, authUserId: string) => {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  return profile?.sacredBharatLeaderboardOptOut === true;
};

async function buildLeaderboardEntries(ctx: QueryCtx) {
  const allVisits = await ctx.db.query("sacredBharatVisits").collect();
  const byUser = new Map<string, Set<string>>();

  for (const visit of allVisits) {
    const set = byUser.get(visit.authUserId) ?? new Set<string>();
    set.add(visit.templeId);
    byUser.set(visit.authUserId, set);
  }

  const entries: {
    authUserId: string;
    displayName: string;
    passportSlug: string | null;
    score: number;
    levelTitle: string;
    levelSlug: string;
    templeCount: number;
    completedTrailCount: number;
  }[] = [];

  const entryResults = await Promise.all(
    Array.from(byUser, async ([authUserId, templeSet]) => {
      const templeIds = [...templeSet];
      const isOptedOut = await isLeaderboardOptedOut(ctx, authUserId);
      if (isOptedOut || templeIds.length === 0) {
        return null;
      }
      const summary = computeProgressSummary(templeIds);
      const passport = await getPassportProfileForUser(ctx, authUserId);
      return {
        authUserId,
        completedTrailCount: summary.completedTrailCount,
        displayName: passport?.displayName || (await getDisplayName(ctx, authUserId)),
        levelSlug: summary.levelSlug,
        levelTitle: summary.levelTitle,
        passportSlug: passport?.isPublic ? passport.slug : null,
        score: summary.score,
        templeCount: summary.templeCount,
      };
    })
  );
  for (const entry of entryResults) {
    if (entry) {
      entries.push(entry);
    }
  }

  entries.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.templeCount !== a.templeCount) {
      return b.templeCount - a.templeCount;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return entries;
}

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const entries = await buildLeaderboardEntries(ctx);
    return entries.slice(0, limit).map((entry, index) => ({
      completedTrailCount: entry.completedTrailCount,
      displayName: entry.displayName,
      isCurrentUser: false,
      levelSlug: entry.levelSlug,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      rank: index + 1,
      score: entry.score,
      templeCount: entry.templeCount,
    }));
  },
  returns: leaderboardResultValidator,
});

export const getLeaderboardWithMe = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const entries = await buildLeaderboardEntries(ctx);

    const top = entries.slice(0, limit).map((entry, index) => ({
      completedTrailCount: entry.completedTrailCount,
      displayName: entry.displayName,
      isCurrentUser: identity?.subject === entry.authUserId,
      levelSlug: entry.levelSlug,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      rank: index + 1,
      score: entry.score,
      templeCount: entry.templeCount,
    }));

    let myRank = null;
    if (identity) {
      const idx = entries.findIndex((e) => e.authUserId === identity.subject);
      if (idx >= 0) {
        const entry = entries[idx];
        myRank = {
          displayName: entry.displayName,
          levelTitle: entry.levelTitle,
          percentile:
            entries.length <= 1 ? 100 : Math.round(((entries.length - idx) / entries.length) * 100),
          rank: idx + 1,
          score: entry.score,
          totalPlayers: entries.length,
        };
      }
    }

    return { entries: top, myRank };
  },
  returns: leaderboardWithMeResultValidator,
});

export const getMyLeaderboardRank = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return null;
    }

    const entries = await buildLeaderboardEntries(ctx);
    const idx = entries.findIndex((e) => e.authUserId === identity.subject);
    if (idx < 0) {
      return null;
    }

    const entry = entries[idx];
    return {
      displayName: entry.displayName,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      percentile:
        entries.length <= 1 ? 100 : Math.round(((entries.length - idx) / entries.length) * 100),
      rank: idx + 1,
      score: entry.score,
      totalPlayers: entries.length,
    };
  },
  returns: myLeaderboardRankResultValidator,
});

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function requireGroupMember(ctx: QueryCtx | MutationCtx, groupId: any, authUserId: string) {
  const membership = await ctx.db
    .query("sacredBharatGroupMembers")
    .withIndex("by_groupId_authUserId", (q) =>
      q.eq("groupId", groupId).eq("authUserId", authUserId)
    )
    .unique();
  if (!membership) {
    throw new ConvexError("FORBIDDEN");
  }
  return membership;
}

export const createGroup = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const timestamp = now();
    let inviteCode = makeInviteCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await ctx.db
        .query("sacredBharatGroups")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
        .first();
      if (!existing) {
        break;
      }
      inviteCode = makeInviteCode();
    }
    const groupId = await ctx.db.insert("sacredBharatGroups", {
      createdAt: timestamp,
      inviteCode,
      isArchived: false,
      name: args.name.trim() || "Sacred Bharat Group",
      ownerAuthUserId: identity.subject,
      updatedAt: timestamp,
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId: identity.subject,
      groupId,
      joinedAt: timestamp,
      role: "owner",
    });
    return { id: groupId, inviteCode };
  },
  returns: groupCreateResultValidator,
});

export const joinGroupByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const [identity, group] = await Promise.all([
      getIdentityOrThrow(ctx),
      ctx.db
        .query("sacredBharatGroups")
        .withIndex("by_inviteCode", (q) => q.eq("inviteCode", args.inviteCode.trim().toUpperCase()))
        .unique(),
    ]);
    if (!group || group.isArchived) {
      throw new ConvexError("GROUP_NOT_FOUND");
    }
    const existing = await ctx.db
      .query("sacredBharatGroupMembers")
      .withIndex("by_groupId_authUserId", (q) =>
        q.eq("groupId", group._id).eq("authUserId", identity.subject)
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("sacredBharatGroupMembers", {
        authUserId: identity.subject,
        groupId: group._id,
        joinedAt: now(),
        role: "member",
      });
    }
    return { id: group._id };
  },
  returns: groupIdResultValidator,
});

export const listMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return [];
    }
    const memberships = await ctx.db
      .query("sacredBharatGroupMembers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .collect();
    const groups = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.groupId))
    );
    return groups.flatMap((group, index) =>
      group && !group.isArchived
        ? [
            {
              id: group._id,
              inviteCode: group.inviteCode,
              memberCount: memberships.length,
              name: group.name,
              role: memberships[index].role,
            },
          ]
        : []
    );
  },
  returns: myGroupsResultValidator,
});

export const getGroupLeaderboard = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const group = await ctx.db.get(groupId);
    if (!group || group.isArchived) {
      throw new ConvexError("GROUP_NOT_FOUND");
    }
    const [membership, members] = await Promise.all([
      requireGroupMember(ctx, groupId, identity.subject),
      ctx.db
        .query("sacredBharatGroupMembers")
        .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
        .collect(),
    ]);
    const summaries = await Promise.all(
      members.map((member) => buildGroupMemberSummary(ctx, member.authUserId))
    );
    summaries.sort((a, b) => b.score - a.score || b.templeCount - a.templeCount);
    return {
      entries: summaries.map((summary, index) => ({
        rank: index + 1,
        ...summary,
        isCurrentUser: summary.authUserId === identity.subject,
      })),
      group: {
        id: group._id,
        inviteCode: group.inviteCode,
        name: group.name,
        role: membership.role,
      },
    };
  },
  returns: groupLeaderboardResultValidator,
});

export const renameGroup = mutation({
  args: { groupId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role !== "owner") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(groupId, { name: args.name.trim(), updatedAt: now() });
    return { id: groupId };
  },
  returns: groupIdResultValidator,
});

export const archiveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role !== "owner") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch(groupId, { isArchived: true, updatedAt: now() });
    return { id: groupId };
  },
  returns: groupIdResultValidator,
});

export const leaveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role === "owner") {
      throw new ConvexError("Archive the group before leaving as owner");
    }
    await ctx.db.delete(membership._id);
    return { id: groupId };
  },
  returns: groupIdResultValidator,
});

export const getPublicPassportBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const slug = normalizePassportSlug(args.slug);
    const passport = await ctx.db
      .query("sacredBharatProfiles")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!passport?.isPublic) {
      return null;
    }
    const [progress, wishlist, leaderboardEntries, profile] = await Promise.all([
      buildProgressPayload(ctx, passport.authUserId),
      getWishlistForUser(ctx, passport.authUserId),
      buildLeaderboardEntries(ctx),
      ctx.db
        .query("userProfiles")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", passport.authUserId))
        .unique(),
    ]);
    const leaderboardIndex = profile?.sacredBharatLeaderboardOptOut
      ? -1
      : leaderboardEntries.findIndex((entry) => entry.authUserId === passport.authUserId);
    return {
      leaderboardRank:
        leaderboardIndex >= 0
          ? { rank: leaderboardIndex + 1, totalPlayers: leaderboardEntries.length }
          : null,
      profile: {
        bio: passport.bio ?? "",
        displayName: passport.displayName,
        homeCity: passport.homeCity ?? "",
        isPublic: passport.isPublic,
        shareRecentVisits: passport.shareRecentVisits,
        shareWishlist: passport.shareWishlist,
        slug: passport.slug,
      },
      progress: {
        ...progress,
        visits: passport.shareRecentVisits ? progress.visits.slice(0, 8) : [],
        wishlist: passport.shareWishlist ? wishlist.map(toWishlistApi) : [],
      },
    };
  },
  returns: publicPassportResultValidator,
});
