import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
} from "./lib/customerIdentityAccess";
import { resolveCanonicalTempleId } from "./lib/sacredBharatAliases";
import {
  groupCountProjectionIsVerified,
  MAX_SACRED_BHARAT_GROUP_MEMBERS,
  readBoundedGroupMemberCount,
  verifiedGroupMemberCount,
} from "./lib/sacredBharatGroups";
import { applyGuestProgressMerge } from "./lib/sacredBharatGuestMerge";
import {
  consumeInviteAttempt,
  isStrongInviteCode,
  makeInviteCode,
  normalizeInviteCode,
} from "./lib/sacredBharatInvites";
import {
  refreshSacredBharatLeaderboardSummary,
  SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY,
} from "./lib/sacredBharatLeaderboard";
import {
  compareLeaderboardRows,
  leaderboardRankProjectionIsVerified,
  leaderboardSummaryIsEligible,
  sacredBharatLeaderboardRanks,
} from "./lib/sacredBharatLeaderboardRank";
import {
  computeProgressSummary,
  computeScore,
  getLevelForScore,
  normalizeVisitedSet,
} from "./lib/sacredBharatScoring";
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

async function readIdentityIds(
  ctx: QueryCtx | MutationCtx,
  identity: Awaited<ReturnType<typeof getIdentityOrThrow>>
) {
  return await authorizedCustomerIdentityIds(ctx, identity);
}

async function mutationIdentity(
  ctx: MutationCtx,
  identity: Awaited<ReturnType<typeof getIdentityOrThrow>>
) {
  const authUserId = await ensureCanonicalIdentityLink(ctx, identity);
  return { authUserId, identityIds: await authorizedCustomerIdentityIds(ctx, identity) };
}

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
  const templeIds = visits.map((visit) => visit.templeId);
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

const buildProgressPayloadForIdentityIds = async (
  ctx: QueryCtx | MutationCtx,
  identityIds: string[]
) => {
  const [visitPages, wishlistPages] = await Promise.all([
    Promise.all(identityIds.map((authUserId) => getVisitsForUser(ctx, authUserId))),
    Promise.all(identityIds.map((authUserId) => getWishlistForUser(ctx, authUserId))),
  ]);
  const visits = [
    ...new Map(
      visitPages
        .flat()
        .sort((left, right) => right.visitedAt - left.visitedAt)
        .map((visit) => [resolveCanonicalTempleId(visit.templeId), visit])
    ).values(),
  ];
  const wishlist = [
    ...new Map(
      wishlistPages
        .flat()
        .map((item) => [
          `${item.itemType}:${
            item.itemType === "temple" ? resolveCanonicalTempleId(item.itemId) : item.itemId
          }`,
          item,
        ])
    ).values(),
  ];
  const templeIds = visits.map((visit) => resolveCanonicalTempleId(visit.templeId));
  const summary = computeProgressSummary(templeIds);
  return {
    visitedTempleIds: [...normalizeVisitedSet(templeIds)],
    visits: visits.map(toVisitApi).sort((left, right) => right.visitedAt - left.visitedAt),
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

async function getPassportProfileForIdentityIds(
  ctx: QueryCtx | MutationCtx,
  identityIds: string[]
) {
  const profiles = await Promise.all(
    identityIds.map((authUserId) => getPassportProfileForUser(ctx, authUserId))
  );
  return profiles.find(Boolean) ?? null;
}

async function buildGroupMemberSummary(ctx: QueryCtx, authUserId: string) {
  const materialized = await ctx.db
    .query("sacredBharatLeaderboardSummaries")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  if (materialized) {
    return {
      authUserId,
      badges: [],
      displayName: materialized.displayName,
      levelTitle: materialized.levelTitle,
      score: materialized.score,
      slug: materialized.passportSlug,
      templeCount: materialized.templeCount,
    };
  }
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
    return await buildProgressPayloadForIdentityIds(ctx, await readIdentityIds(ctx, identity));
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
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const templeId = resolveCanonicalTempleId(args.templeId);
    const visitedSet = normalizeVisitedSet([templeId]);
    if (visitedSet.size === 0) {
      throw new ConvexError("INVALID_TEMPLE");
    }

    const existing = (
      await Promise.all(
        identityIds.map((identityId) =>
          ctx.db
            .query("sacredBharatVisits")
            .withIndex("by_authUserId_templeId", (q) =>
              q.eq("authUserId", identityId).eq("templeId", templeId)
            )
            .unique()
        )
      )
    ).find(Boolean);

    if (!existing) {
      await ctx.db.insert("sacredBharatVisits", {
        authUserId,
        note: args.note,
        source: "self",
        templeId,
        visitedAt: now(),
        visitedOn: args.visitedOn,
      });
    }

    await refreshSacredBharatLeaderboardSummary(ctx, authUserId);

    return await buildProgressPayloadForIdentityIds(ctx, identityIds);
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
    const profile = await getPassportProfileForIdentityIds(
      ctx,
      await readIdentityIds(ctx, identity)
    );
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
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const slug = normalizePassportSlug(args.slug);
    const [existingSlug, existing] = await Promise.all([
      ctx.db
        .query("sacredBharatProfiles")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique(),
      getPassportProfileForIdentityIds(ctx, identityIds),
    ]);
    if (existingSlug && !identityIds.includes(existingSlug.authUserId)) {
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
      await ctx.db.patch("sacredBharatProfiles", existing._id, patch);
      await refreshSacredBharatLeaderboardSummary(ctx, authUserId, timestamp);
      return { id: existing._id, slug };
    }
    const id = await ctx.db.insert("sacredBharatProfiles", {
      authUserId,
      ...patch,
      createdAt: timestamp,
    });
    await refreshSacredBharatLeaderboardSummary(ctx, authUserId, timestamp);
    return { id, slug };
  },
  returns: passportProfileIdResultValidator,
});

export const unmarkTempleVisited = mutation({
  args: { templeId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const templeId = resolveCanonicalTempleId(args.templeId);
    const existing = (
      await Promise.all(
        identityIds.map((identityId) =>
          ctx.db
            .query("sacredBharatVisits")
            .withIndex("by_authUserId_templeId", (q) =>
              q.eq("authUserId", identityId).eq("templeId", templeId)
            )
            .unique()
        )
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    await Promise.all(existing.map((row) => ctx.db.delete("sacredBharatVisits", row._id)));

    await refreshSacredBharatLeaderboardSummary(ctx, authUserId);

    return await buildProgressPayloadForIdentityIds(ctx, identityIds);
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
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const timestamp = now();
    await applyGuestProgressMerge(
      ctx,
      authUserId,
      { templeIds: args.templeIds, wishlist: args.wishlist },
      { createdAt: timestamp, visitedAt: timestamp }
    );

    await refreshSacredBharatLeaderboardSummary(ctx, authUserId, timestamp);

    return await buildProgressPayloadForIdentityIds(ctx, identityIds);
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
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const itemId =
      args.itemType === "temple" ? resolveCanonicalTempleId(args.itemId) : args.itemId.trim();
    const existing = (
      await Promise.all(
        identityIds.map((identityId) =>
          ctx.db
            .query("sacredBharatWishlist")
            .withIndex("by_authUserId_item", (q) =>
              q.eq("authUserId", identityId).eq("itemType", args.itemType).eq("itemId", itemId)
            )
            .unique()
        )
      )
    ).filter((row): row is NonNullable<typeof row> => row !== null);

    if (existing.length > 0) {
      await Promise.all(existing.map((row) => ctx.db.delete("sacredBharatWishlist", row._id)));
    } else {
      await ctx.db.insert("sacredBharatWishlist", {
        authUserId,
        createdAt: now(),
        itemId,
        itemType: args.itemType,
      });
    }

    await refreshSacredBharatLeaderboardSummary(ctx, authUserId);

    return await buildProgressPayloadForIdentityIds(ctx, identityIds);
  },
  returns: sacredProgressValidator,
});

export const setLeaderboardOptOut = mutation({
  args: { optOut: v.boolean() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const profiles = await Promise.all(
      identityIds.map((identityId) =>
        ctx.db
          .query("userProfiles")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", identityId))
          .unique()
      )
    );
    const profile = profiles.find(Boolean);

    if (!profile) {
      throw new ConvexError("PROFILE_NOT_FOUND");
    }

    const updatedAt = now();
    await ctx.db.patch("userProfiles", profile._id, {
      sacredBharatLeaderboardOptOut: args.optOut,
      updatedAt,
    });
    await refreshSacredBharatLeaderboardSummary(ctx, authUserId, updatedAt);

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
  const [materialized, readiness] = await Promise.all([
    ctx.db.query("sacredBharatLeaderboardSummaries").withIndex("by_score").order("desc").collect(),
    ctx.db
      .query("dataMigrationRegistry")
      .withIndex("by_key", (q) => q.eq("key", SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY))
      .unique(),
  ]);
  const materializedEntries = materialized
    .filter((entry) => !entry.optedOut && entry.templeCount > 0)
    .map((entry) => ({
      authUserId: entry.authUserId,
      completedTrailCount: entry.completedTrailCount,
      displayName: entry.displayName,
      levelSlug: entry.levelSlug,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      score: entry.score,
      templeCount: entry.templeCount,
    }));
  const sortEntries = <
    T extends { authUserId: string; displayName: string; score: number; templeCount: number },
  >(
    rowsToSort: T[]
  ) => rowsToSort.sort(compareLeaderboardRows);
  if (
    readiness?.status === "verified" &&
    readiness.stage === "complete" &&
    readiness.legacyRemaining === 0
  ) {
    return sortEntries(materializedEntries);
  }

  // Compatibility path remains authoritative until a separate residual scan
  // proves every participant has a materialized summary.
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

  const merged = new Map(materializedEntries.map((entry) => [entry.authUserId, entry]));
  for (const entry of entries) {
    if (!merged.has(entry.authUserId)) {
      merged.set(entry.authUserId, entry);
    }
  }
  return sortEntries([...merged.values()]);
}

function leaderboardEntryFromSummary(summary: Doc<"sacredBharatLeaderboardSummaries">) {
  return {
    authUserId: summary.authUserId,
    completedTrailCount: summary.completedTrailCount,
    displayName: summary.displayName,
    levelSlug: summary.levelSlug,
    levelTitle: summary.levelTitle,
    passportSlug: summary.passportSlug,
    score: summary.score,
    templeCount: summary.templeCount,
  };
}

async function buildRankProjectionSnapshot(
  ctx: QueryCtx,
  limit: number,
  identityIds: string[] = []
) {
  const [{ page }, totalPlayers, identitySummaries] = await Promise.all([
    sacredBharatLeaderboardRanks.paginate(ctx, {
      namespace: "eligible",
      order: "asc",
      pageSize: limit,
    }),
    sacredBharatLeaderboardRanks.count(ctx, { namespace: "eligible" }),
    Promise.all(
      identityIds.map((authUserId) =>
        ctx.db
          .query("sacredBharatLeaderboardSummaries")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
          .unique()
      )
    ),
  ]);
  const summaries = await Promise.all(
    page.map((item) => ctx.db.get("sacredBharatLeaderboardSummaries", item.id))
  );
  if (
    summaries.some((summary) => !(summary && leaderboardSummaryIsEligible(summary))) ||
    summaries.length !== Math.min(limit, totalPlayers)
  ) {
    throw new ConvexError("SACRED_BHARAT_RANK_PROJECTION_DRIFT");
  }
  const top = summaries.map((summary) =>
    leaderboardEntryFromSummary(summary as Doc<"sacredBharatLeaderboardSummaries">)
  );
  const rankCandidates = await Promise.all(
    identitySummaries
      .filter(
        (summary): summary is Doc<"sacredBharatLeaderboardSummaries"> =>
          summary !== null && leaderboardSummaryIsEligible(summary)
      )
      .map(async (summary) => ({
        rank: (await sacredBharatLeaderboardRanks.indexOfDoc(ctx, summary)) + 1,
        summary,
      }))
  );
  rankCandidates.sort((left, right) => left.rank - right.rank);
  return { current: rankCandidates[0] ?? null, top, totalPlayers };
}

async function rankedLeaderboardSnapshot(ctx: QueryCtx, limit: number, identityIds: string[] = []) {
  if (await leaderboardRankProjectionIsVerified(ctx)) {
    return await buildRankProjectionSnapshot(ctx, limit, identityIds);
  }
  const entries = await buildLeaderboardEntries(ctx);
  const identityIdSet = new Set(identityIds);
  const index = entries.findIndex((candidate) => identityIdSet.has(candidate.authUserId));
  return {
    current: index >= 0 ? { rank: index + 1, summary: entries[index] } : null,
    top: entries.slice(0, limit),
    totalPlayers: entries.length,
  };
}

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const snapshot = await rankedLeaderboardSnapshot(ctx, limit);
    return snapshot.top.map((entry, index) => ({
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
    const identityIds = identity ? await readIdentityIds(ctx, identity) : [];
    const identityIdSet = new Set(identityIds);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const snapshot = await rankedLeaderboardSnapshot(ctx, limit, identityIds);

    const top = snapshot.top.map((entry, index) => ({
      completedTrailCount: entry.completedTrailCount,
      displayName: entry.displayName,
      isCurrentUser: identityIdSet.has(entry.authUserId),
      levelSlug: entry.levelSlug,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      rank: index + 1,
      score: entry.score,
      templeCount: entry.templeCount,
    }));

    let myRank: {
      displayName: string;
      levelTitle: string;
      percentile: number;
      rank: number;
      score: number;
      totalPlayers: number;
    } | null = null;
    if (identity && snapshot.current) {
      const { rank, summary: currentEntry } = snapshot.current;
      myRank = {
        displayName: currentEntry.displayName,
        levelTitle: currentEntry.levelTitle,
        percentile:
          snapshot.totalPlayers <= 1
            ? 100
            : Math.round(((snapshot.totalPlayers - rank + 1) / snapshot.totalPlayers) * 100),
        rank,
        score: currentEntry.score,
        totalPlayers: snapshot.totalPlayers,
      };
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

    const identityIds = await readIdentityIds(ctx, identity);
    const snapshot = await rankedLeaderboardSnapshot(ctx, 1, identityIds);
    if (!snapshot.current) {
      return null;
    }

    const { rank, summary: entry } = snapshot.current;
    return {
      displayName: entry.displayName,
      levelTitle: entry.levelTitle,
      passportSlug: entry.passportSlug,
      percentile:
        snapshot.totalPlayers <= 1
          ? 100
          : Math.round(((snapshot.totalPlayers - rank + 1) / snapshot.totalPlayers) * 100),
      rank,
      score: entry.score,
      totalPlayers: snapshot.totalPlayers,
    };
  },
  returns: myLeaderboardRankResultValidator,
});

async function consumeGroupInviteAttempt(ctx: MutationCtx, authUserId: string, at: number) {
  const existing = await ctx.db
    .query("sacredBharatInviteAttempts")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  const result = consumeInviteAttempt(
    existing
      ? { attemptCount: existing.attemptCount, windowStartedAt: existing.windowStartedAt }
      : null,
    at
  );
  const nextRow = {
    attemptCount: result.nextState.attemptCount,
    authUserId,
    updatedAt: at,
    windowStartedAt: result.nextState.windowStartedAt,
  };
  if (existing) {
    await ctx.db.patch("sacredBharatInviteAttempts", existing._id, nextRow);
  } else {
    await ctx.db.insert("sacredBharatInviteAttempts", nextRow);
  }
  return result;
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

async function requireGroupMemberForIdentityIds(
  ctx: QueryCtx | MutationCtx,
  groupId: any,
  identityIds: string[]
) {
  const memberships = await Promise.all(
    identityIds.map(async (authUserId) => {
      try {
        return await requireGroupMember(ctx, groupId, authUserId);
      } catch (error) {
        if (error instanceof ConvexError && error.data === "FORBIDDEN") {
          return null;
        }
        throw error;
      }
    })
  );
  const membership = memberships.find(Boolean);
  if (!membership) {
    throw new ConvexError("FORBIDDEN");
  }
  return membership;
}

async function makeAvailableInviteCode(
  ctx: MutationCtx,
  currentGroupId?: Doc<"sacredBharatGroups">["_id"],
  remainingChecks = 5
): Promise<string> {
  const inviteCode = makeInviteCode();
  const existing = await ctx.db
    .query("sacredBharatGroups")
    .withIndex("by_inviteCode", (q) => q.eq("inviteCode", inviteCode))
    .first();
  if (!existing || existing._id === currentGroupId) {
    return inviteCode;
  }
  if (remainingChecks <= 1) {
    return makeInviteCode();
  }
  return await makeAvailableInviteCode(ctx, currentGroupId, remainingChecks - 1);
}

export const createGroup = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { authUserId } = await mutationIdentity(ctx, identity);
    const timestamp = now();
    const inviteCode = await makeAvailableInviteCode(ctx);
    const groupId = await ctx.db.insert("sacredBharatGroups", {
      createdAt: timestamp,
      inviteCode,
      isArchived: false,
      memberCount: 1,
      name: args.name.trim() || "Sacred Bharat Group",
      ownerAuthUserId: authUserId,
      updatedAt: timestamp,
    });
    await ctx.db.insert("sacredBharatGroupMembers", {
      authUserId,
      groupId,
      joinedAt: timestamp,
      role: "owner",
    });
    return { id: groupId, inviteCode };
  },
  returns: groupCreateResultValidator,
});

export const rotateGroupInviteCode = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { identityIds } = await mutationIdentity(ctx, identity);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const group = await ctx.db.get("sacredBharatGroups", groupId);
    if (!group || group.isArchived) {
      throw new ConvexError("GROUP_NOT_FOUND");
    }
    const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
    if (membership.role !== "owner") {
      throw new ConvexError("FORBIDDEN");
    }

    const inviteCode = await makeAvailableInviteCode(ctx, groupId);
    await ctx.db.patch("sacredBharatGroups", groupId, { inviteCode, updatedAt: now() });
    return { id: groupId, inviteCode };
  },
  returns: groupCreateResultValidator,
});

export const joinGroupByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { authUserId, identityIds } = await mutationIdentity(ctx, identity);
    const attemptRows = await Promise.all(
      identityIds.map((identityId) =>
        ctx.db
          .query("sacredBharatInviteAttempts")
          .withIndex("by_authUserId", (q) => q.eq("authUserId", identityId))
          .unique()
      )
    );
    const [latestAttempt] = attemptRows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => right.updatedAt - left.updatedAt);
    const attempt = latestAttempt
      ? consumeInviteAttempt(
          {
            attemptCount: latestAttempt.attemptCount,
            windowStartedAt: latestAttempt.windowStartedAt,
          },
          now()
        )
      : await consumeGroupInviteAttempt(ctx, authUserId, now());
    if (latestAttempt) {
      const canonicalAttempt = attemptRows.find((row) => row?.authUserId === authUserId);
      const nextRow = {
        attemptCount: attempt.nextState.attemptCount,
        authUserId,
        updatedAt: now(),
        windowStartedAt: attempt.nextState.windowStartedAt,
      };
      if (canonicalAttempt) {
        await ctx.db.patch("sacredBharatInviteAttempts", canonicalAttempt._id, nextRow);
      } else {
        await ctx.db.insert("sacredBharatInviteAttempts", nextRow);
      }
    }
    if (!attempt.allowed) {
      return { rateLimited: true as const, retryAfterMs: attempt.retryAfterMs };
    }

    const normalizedInviteCode = normalizeInviteCode(args.inviteCode);
    const group = await ctx.db
      .query("sacredBharatGroups")
      .withIndex("by_inviteCode", (q) => q.eq("inviteCode", normalizedInviteCode))
      .unique();
    if (!group || group.isArchived) {
      return { notFound: true as const };
    }
    // New groups use a 128-bit code. Legacy rows remain readable during the
    // migration window, but are visible to operators as a rotation candidate.
    // Do not silently downgrade newly generated invite codes.
    if (!isStrongInviteCode(group.inviteCode)) {
      throw new ConvexError("GROUP_INVITE_REQUIRES_ROTATION");
    }
    const existing = (
      await Promise.all(
        identityIds.map((identityId) =>
          ctx.db
            .query("sacredBharatGroupMembers")
            .withIndex("by_groupId_authUserId", (q) =>
              q.eq("groupId", group._id).eq("authUserId", identityId)
            )
            .unique()
        )
      )
    ).find(Boolean);
    if (!existing) {
      const memberCount = await readBoundedGroupMemberCount(ctx, group._id);
      if (memberCount >= MAX_SACRED_BHARAT_GROUP_MEMBERS) {
        return { full: true as const, memberLimit: MAX_SACRED_BHARAT_GROUP_MEMBERS };
      }
      await ctx.db.insert("sacredBharatGroupMembers", {
        authUserId,
        groupId: group._id,
        joinedAt: now(),
        role: "member",
      });
      await ctx.db.patch("sacredBharatGroups", group._id, {
        memberCount: memberCount + 1,
        updatedAt: now(),
      });
    }
    return { id: group._id };
  },
  returns: groupJoinResultValidator,
});

export const listMyGroups = query({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    if (!identity) {
      return [];
    }
    const identityIds = await readIdentityIds(ctx, identity);
    const countProjectionIsVerified = await groupCountProjectionIsVerified(ctx);
    const memberships = (
      await Promise.all(
        identityIds.map((identityId) =>
          ctx.db
            .query("sacredBharatGroupMembers")
            .withIndex("by_authUserId", (q) => q.eq("authUserId", identityId))
            .collect()
        )
      )
    )
      .flat()
      .filter(
        (membership, index, rows) =>
          rows.findIndex((row) => row.groupId === membership.groupId) === index
      );
    const groups = await Promise.all(
      memberships.map((membership) => ctx.db.get("sacredBharatGroups", membership.groupId))
    );
    const memberCounts = await Promise.all(
      groups.map(async (group) => {
        if (!group || group.isArchived) {
          return null;
        }
        return countProjectionIsVerified
          ? verifiedGroupMemberCount(group)
          : await readBoundedGroupMemberCount(ctx, group._id);
      })
    );
    return groups.flatMap((group, index) => {
      const memberCount = memberCounts[index];
      return group && !group.isArchived && memberCount !== null
        ? [
            {
              id: group._id,
              inviteCode: group.inviteCode,
              memberCount,
              name: group.name,
              role: memberships[index].role,
            },
          ]
        : [];
    });
  },
  returns: myGroupsResultValidator,
});

export const getGroupLeaderboard = query({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const identityIds = await readIdentityIds(ctx, identity);
    const identityIdSet = new Set(identityIds);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const group = await ctx.db.get("sacredBharatGroups", groupId);
    if (!group || group.isArchived) {
      throw new ConvexError("GROUP_NOT_FOUND");
    }
    const [membership, members] = await Promise.all([
      requireGroupMemberForIdentityIds(ctx, groupId, identityIds),
      ctx.db
        .query("sacredBharatGroupMembers")
        .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
        .take(MAX_SACRED_BHARAT_GROUP_MEMBERS + 1),
    ]);
    if (members.length > MAX_SACRED_BHARAT_GROUP_MEMBERS) {
      throw new ConvexError("GROUP_MEMBER_LIMIT_REPAIR_REQUIRED");
    }
    const summaries = await Promise.all(
      members.map((member) => buildGroupMemberSummary(ctx, member.authUserId))
    );
    summaries.sort(
      (a, b) =>
        b.score - a.score ||
        b.templeCount - a.templeCount ||
        a.displayName.localeCompare(b.displayName) ||
        a.authUserId.localeCompare(b.authUserId)
    );
    return {
      entries: summaries.map((summary, index) => ({
        rank: index + 1,
        ...summary,
        isCurrentUser: identityIdSet.has(summary.authUserId),
      })),
      group: {
        id: group._id,
        inviteCode: group.inviteCode,
        memberCount: members.length,
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
    const { identityIds } = await mutationIdentity(ctx, identity);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
    if (membership.role !== "owner") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch("sacredBharatGroups", groupId, { name: args.name.trim(), updatedAt: now() });
    return { id: groupId };
  },
  returns: groupIdResultValidator,
});

export const archiveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { identityIds } = await mutationIdentity(ctx, identity);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
    if (membership.role !== "owner") {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.db.patch("sacredBharatGroups", groupId, { isArchived: true, updatedAt: now() });
    return { id: groupId };
  },
  returns: groupIdResultValidator,
});

export const leaveGroup = mutation({
  args: { groupId: v.string() },
  handler: async (ctx, args) => {
    const identity = await getIdentityOrThrow(ctx);
    const { identityIds } = await mutationIdentity(ctx, identity);
    const groupId = ctx.db.normalizeId("sacredBharatGroups", args.groupId);
    if (!groupId) {
      throw new ConvexError("Invalid group id");
    }
    const membership = await requireGroupMemberForIdentityIds(ctx, groupId, identityIds);
    if (membership.role === "owner") {
      throw new ConvexError("Archive the group before leaving as owner");
    }
    const memberCount = await readBoundedGroupMemberCount(ctx, groupId);
    await ctx.db.delete("sacredBharatGroupMembers", membership._id);
    await ctx.db.patch("sacredBharatGroups", groupId, {
      memberCount: Math.max(0, memberCount - 1),
      updatedAt: now(),
    });
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
    const [progress, wishlist, leaderboardSnapshot] = await Promise.all([
      buildProgressPayload(ctx, passport.authUserId),
      getWishlistForUser(ctx, passport.authUserId),
      rankedLeaderboardSnapshot(ctx, 1, [passport.authUserId]),
    ]);
    return {
      leaderboardRank: leaderboardSnapshot.current
        ? {
            rank: leaderboardSnapshot.current.rank,
            totalPlayers: leaderboardSnapshot.totalPlayers,
          }
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
