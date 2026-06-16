import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { applyGuestProgressMerge } from "./lib/sacredBharatGuestMerge";
import {
  computeProgressSummary,
  computeScore,
  getLevelForScore,
  normalizeVisitedSet,
} from "./lib/sacredBharatScoring";

const now = () => Date.now();
const RESERVED_PASSPORT_SLUGS = new Set(["leaderboard", "trails", "groups", "challenges", "admin"]);

const getIdentity = async (ctx: QueryCtx | MutationCtx) => {
  return await ctx.auth.getUserIdentity();
};

const getIdentityOrThrow = async (ctx: QueryCtx | MutationCtx) => {
  const identity = await getIdentity(ctx);
  if (!identity) {
    throw new ConvexError("UNAUTHORIZED");
  }
  return identity;
};

const getVisitsForUser = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  return await ctx.db
    .query("sacredBharatVisits")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();
};

const getWishlistForUser = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  return await ctx.db
    .query("sacredBharatWishlist")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .collect();
};

const toVisitApi = (visit: Doc<"sacredBharatVisits">) => ({
  templeId: visit.templeId,
  visitedAt: visit.visitedAt,
  visitedOn: visit.visitedOn ?? null,
  note: visit.note ?? null,
  source: visit.source ?? "self",
});

const toWishlistApi = (item: Doc<"sacredBharatWishlist">) => ({
  itemType: item.itemType,
  itemId: item.itemId,
  createdAt: item.createdAt,
});

const buildProgressPayload = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  const [visits, wishlist] = await Promise.all([
    getVisitsForUser(ctx, authUserId),
    getWishlistForUser(ctx, authUserId),
  ]);
  const templeIds = visits.map((v) => v.templeId);
  const summary = computeProgressSummary(templeIds);

  return {
    visits: visits.map(toVisitApi).sort((a, b) => b.visitedAt - a.visitedAt),
    wishlist: wishlist.map(toWishlistApi),
    visitedTempleIds: [...normalizeVisitedSet(templeIds)],
    ...summary,
    score: computeScore(templeIds),
    level: getLevelForScore(computeScore(templeIds)),
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
    displayName: passport?.displayName || profile?.name || "Sacred Yatri",
    slug: passport?.isPublic ? passport.slug : null,
    score: progress.score,
    templeCount: progress.templeCount,
    levelTitle: progress.levelTitle,
    badges: [],
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
});

export const markTempleVisited = mutation({
  args: {
    templeId: v.string(),
    visitedOn: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const visitedSet = normalizeVisitedSet([args.templeId]);
    if (visitedSet.size === 0) {
      throw new ConvexError("INVALID_TEMPLE");
    }

    const existing = await ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId_templeId", (q) =>
        q.eq("authUserId", identity.subject).eq("templeId", args.templeId),
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("sacredBharatVisits", {
        authUserId: identity.subject,
        templeId: args.templeId,
        visitedAt: now(),
        visitedOn: args.visitedOn,
        note: args.note,
        source: "self",
      });
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
});

export const getMyPassportProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) return null;
    const profile = await getPassportProfileForUser(ctx, identity.subject);
    return profile
      ? {
          id: profile._id,
          slug: profile.slug,
          displayName: profile.displayName,
          bio: profile.bio ?? "",
          homeCity: profile.homeCity ?? "",
          isPublic: profile.isPublic,
          shareWishlist: profile.shareWishlist,
          shareRecentVisits: profile.shareRecentVisits,
        }
      : null;
  },
});

export const upsertMyPassportProfile = mutation({
  args: {
    slug: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    homeCity: v.optional(v.string()),
    isPublic: v.boolean(),
    shareWishlist: v.boolean(),
    shareRecentVisits: v.boolean(),
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
      slug,
      displayName: args.displayName.trim() || "Sacred Yatri",
      bio: args.bio?.trim(),
      homeCity: args.homeCity?.trim(),
      isPublic: args.isPublic,
      shareWishlist: args.shareWishlist,
      shareRecentVisits: args.shareRecentVisits,
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
});

export const unmarkTempleVisited = mutation({
  args: { templeId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const existing = await ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId_templeId", (q) =>
        q.eq("authUserId", identity.subject).eq("templeId", args.templeId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
});

export const mergeGuestProgress = mutation({
  args: {
    templeIds: v.array(v.string()),
    wishlist: v.optional(
      v.array(
        v.object({
          itemType: v.union(v.literal("temple"), v.literal("trail")),
          itemId: v.string(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const timestamp = now();
    await applyGuestProgressMerge(
      ctx,
      identity.subject,
      { templeIds: args.templeIds, wishlist: args.wishlist },
      { visitedAt: timestamp, createdAt: timestamp },
    );

    return await buildProgressPayload(ctx, identity.subject);
  },
});

export const toggleWishlistItem = mutation({
  args: {
    itemType: v.union(v.literal("temple"), v.literal("trail")),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const existing = await ctx.db
      .query("sacredBharatWishlist")
      .withIndex("by_authUserId_item", (q) =>
        q
          .eq("authUserId", identity.subject)
          .eq("itemType", args.itemType)
          .eq("itemId", args.itemId),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("sacredBharatWishlist", {
        authUserId: identity.subject,
        itemType: args.itemType,
        itemId: args.itemId,
        createdAt: now(),
      });
    }

    return await buildProgressPayload(ctx, identity.subject);
  },
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
});

const getDisplayName = async (ctx: QueryCtx, authUserId: string) => {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  const name = profile?.name?.trim();
  if (name) return name;
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
      if (isOptedOut || templeIds.length === 0) return null;
      const summary = computeProgressSummary(templeIds);
      const passport = await getPassportProfileForUser(ctx, authUserId);
      return {
        authUserId,
        displayName: passport?.displayName || (await getDisplayName(ctx, authUserId)),
        passportSlug: passport?.isPublic ? passport.slug : null,
        score: summary.score,
        levelTitle: summary.levelTitle,
        levelSlug: summary.levelSlug,
        templeCount: summary.templeCount,
        completedTrailCount: summary.completedTrailCount,
      };
    }),
  );
  for (const entry of entryResults) {
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.templeCount !== a.templeCount) return b.templeCount - a.templeCount;
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
      rank: index + 1,
      displayName: entry.displayName,
      passportSlug: entry.passportSlug,
      score: entry.score,
      levelTitle: entry.levelTitle,
      levelSlug: entry.levelSlug,
      templeCount: entry.templeCount,
      completedTrailCount: entry.completedTrailCount,
      isCurrentUser: false,
    }));
  },
});

export const getLeaderboardWithMe = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const entries = await buildLeaderboardEntries(ctx);

    const top = entries.slice(0, limit).map((entry, index) => ({
      rank: index + 1,
      displayName: entry.displayName,
      passportSlug: entry.passportSlug,
      score: entry.score,
      levelTitle: entry.levelTitle,
      levelSlug: entry.levelSlug,
      templeCount: entry.templeCount,
      completedTrailCount: entry.completedTrailCount,
      isCurrentUser: identity?.subject === entry.authUserId,
    }));

    let myRank = null;
    if (identity) {
      const idx = entries.findIndex((e) => e.authUserId === identity.subject);
      if (idx >= 0) {
        const entry = entries[idx];
        myRank = {
          rank: idx + 1,
          totalPlayers: entries.length,
          percentile:
            entries.length <= 1 ? 100 : Math.round(((entries.length - idx) / entries.length) * 100),
          score: entry.score,
          levelTitle: entry.levelTitle,
          displayName: entry.displayName,
        };
      }
    }

    return { entries: top, myRank };
  },
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
      rank: idx + 1,
      totalPlayers: entries.length,
      percentile:
        entries.length <= 1 ? 100 : Math.round(((entries.length - idx) / entries.length) * 100),
      score: entry.score,
      levelTitle: entry.levelTitle,
      displayName: entry.displayName,
      passportSlug: entry.passportSlug,
    };
  },
});

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function requireGroupMember(ctx: QueryCtx | MutationCtx, groupId: any, authUserId: string) {
  const membership = await ctx.db
    .query("sacredBharatGroupMembers")
    .withIndex("by_groupId_authUserId", (q) =>
      q.eq("groupId", groupId).eq("authUserId", authUserId),
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
      if (!existing) break;
      inviteCode = makeInviteCode();
    }
    const groupId = await ctx.db.insert("sacredBharatGroups", {
      name: args.name.trim() || "Sacred Bharat Group",
      ownerAuthUserId: identity.subject,
      inviteCode,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      groupId,
      authUserId: identity.subject,
      role: "owner",
      joinedAt: timestamp,
    });
    return { id: groupId, inviteCode };
  },
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
        q.eq("groupId", group._id).eq("authUserId", identity.subject),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("sacredBharatGroupMembers", {
        groupId: group._id,
        authUserId: identity.subject,
        role: "member",
        joinedAt: now(),
      });
    }
    return { id: group._id };
  },
});

export const listMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) return [];
    const memberships = await ctx.db
      .query("sacredBharatGroupMembers")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .collect();
    const groups = await Promise.all(
      memberships.map((membership) => ctx.db.get(membership.groupId)),
    );
    return groups.flatMap((group, index) =>
      group && !group.isArchived
        ? [
            {
              id: group._id,
              name: group.name,
              inviteCode: group.inviteCode,
              role: memberships[index].role,
              memberCount: memberships.length,
            },
          ]
        : [],
    );
  },
});

export const getGroupLeaderboard = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) throw new ConvexError("Invalid group id");
    const group = await ctx.db.get(groupId);
    if (!group || group.isArchived) throw new ConvexError("GROUP_NOT_FOUND");
    const [membership, members] = await Promise.all([
      requireGroupMember(ctx, groupId, identity.subject),
      ctx.db
        .query("sacredBharatGroupMembers")
        .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
        .collect(),
    ]);
    const summaries = await Promise.all(
      members.map((member) => buildGroupMemberSummary(ctx, member.authUserId)),
    );
    summaries.sort((a, b) => b.score - a.score || b.templeCount - a.templeCount);
    return {
      group: {
        id: group._id,
        name: group.name,
        inviteCode: group.inviteCode,
        role: membership.role,
      },
      entries: summaries.map((summary, index) => ({
        rank: index + 1,
        ...summary,
        isCurrentUser: summary.authUserId === identity.subject,
      })),
    };
  },
});

export const renameGroup = mutation({
  args: { groupId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) throw new ConvexError("Invalid group id");
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role !== "owner") throw new ConvexError("FORBIDDEN");
    await ctx.db.patch(groupId, { name: args.name.trim(), updatedAt: now() });
    return { id: groupId };
  },
});

export const archiveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) throw new ConvexError("Invalid group id");
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role !== "owner") throw new ConvexError("FORBIDDEN");
    await ctx.db.patch(groupId, { isArchived: true, updatedAt: now() });
    return { id: groupId };
  },
});

export const leaveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) throw new ConvexError("Invalid group id");
    const membership = await requireGroupMember(ctx, groupId, identity.subject);
    if (membership.role === "owner") {
      throw new ConvexError("Archive the group before leaving as owner");
    }
    await ctx.db.delete(membership._id);
    return { id: groupId };
  },
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
      profile: {
        slug: passport.slug,
        displayName: passport.displayName,
        bio: passport.bio ?? "",
        homeCity: passport.homeCity ?? "",
        isPublic: passport.isPublic,
        shareWishlist: passport.shareWishlist,
        shareRecentVisits: passport.shareRecentVisits,
      },
      progress: {
        ...progress,
        visits: passport.shareRecentVisits ? progress.visits.slice(0, 8) : [],
        wishlist: passport.shareWishlist ? wishlist.map(toWishlistApi) : [],
      },
      leaderboardRank:
        leaderboardIndex >= 0
          ? { rank: leaderboardIndex + 1, totalPlayers: leaderboardEntries.length }
          : null,
    };
  },
});
