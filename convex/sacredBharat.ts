import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  computeProgressSummary,
  computeScore,
  getLevelForScore,
  normalizeVisitedSet,
} from "./lib/sacredBharatScoring";

const now = () => Date.now();

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
});

const toWishlistApi = (item: Doc<"sacredBharatWishlist">) => ({
  itemType: item.itemType,
  itemId: item.itemId,
  createdAt: item.createdAt,
});

const buildProgressPayload = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  const visits = await getVisitsForUser(ctx, authUserId);
  const wishlist = await getWishlistForUser(ctx, authUserId);
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
  args: { templeId: v.string() },
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
      });
    }

    return await buildProgressPayload(ctx, identity.subject);
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
  },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const validIds = [...normalizeVisitedSet(args.templeIds)];

    for (const templeId of validIds) {
      const existing = await ctx.db
        .query("sacredBharatVisits")
        .withIndex("by_authUserId_templeId", (q) =>
          q.eq("authUserId", identity.subject).eq("templeId", templeId),
        )
        .unique();

      if (!existing) {
        await ctx.db.insert("sacredBharatVisits", {
          authUserId: identity.subject,
          templeId,
          visitedAt: now(),
        });
      }
    }

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
  const byUser = new Map<string, string[]>();

  for (const visit of allVisits) {
    const list = byUser.get(visit.authUserId) ?? [];
    if (!list.includes(visit.templeId)) {
      list.push(visit.templeId);
    }
    byUser.set(visit.authUserId, list);
  }

  const entries: {
    authUserId: string;
    displayName: string;
    score: number;
    levelTitle: string;
    levelSlug: string;
    templeCount: number;
    completedTrailCount: number;
  }[] = [];

  for (const [authUserId, templeIds] of byUser) {
    if (await isLeaderboardOptedOut(ctx, authUserId)) {
      continue;
    }
    if (templeIds.length === 0) continue;

    const summary = computeProgressSummary(templeIds);
    entries.push({
      authUserId,
      displayName: await getDisplayName(ctx, authUserId),
      score: summary.score,
      levelTitle: summary.levelTitle,
      levelSlug: summary.levelSlug,
      templeCount: summary.templeCount,
      completedTrailCount: summary.completedTrailCount,
    });
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
    };
  },
});
