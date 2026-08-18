import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  authorizedCustomerIdentityIds,
  ensureCanonicalIdentityLink,
} from "./lib/customerIdentityAccess";
import { resolveCanonicalTempleId } from "./lib/sacredBharatAliases";
import { applyGuestProgressMerge } from "./lib/sacredBharatGuestMerge";
import { refreshSacredBharatLeaderboardSummary } from "./lib/sacredBharatLeaderboard";
import {
  computeProgressSummary,
  computeScore,
  getLevelForScore,
  normalizeVisitedSet,
} from "./lib/sacredBharatScoring";
import {
  archiveGroupHandler,
  createGroupHandler,
  getGroupLeaderboardHandler,
  joinGroupByInviteCodeHandler,
  leaveGroupHandler,
  listMyGroupsHandler,
  renameGroupHandler,
  rotateGroupInviteCodeHandler,
} from "./sacredBharatGroups";
import {
  getLeaderboardHandler,
  getLeaderboardWithMeHandler,
  getMyLeaderboardRankHandler,
  rankedLeaderboardSnapshot,
} from "./sacredBharatLeaderboard";
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

export const getLeaderboard = query({
  args: { limit: v.optional(v.number()) },
  handler: getLeaderboardHandler,
  returns: leaderboardResultValidator,
});

export const getLeaderboardWithMe = query({
  args: { limit: v.optional(v.number()) },
  handler: getLeaderboardWithMeHandler,
  returns: leaderboardWithMeResultValidator,
});

export const getMyLeaderboardRank = query({
  args: {},
  handler: getMyLeaderboardRankHandler,
  returns: myLeaderboardRankResultValidator,
});
export const createGroup = mutation({
  args: { name: v.string() },
  handler: createGroupHandler,
  returns: groupCreateResultValidator,
});

export const rotateGroupInviteCode = mutation({
  args: { groupId: v.string() },
  handler: rotateGroupInviteCodeHandler,
  returns: groupCreateResultValidator,
});

export const joinGroupByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: joinGroupByInviteCodeHandler,
  returns: groupJoinResultValidator,
});

export const listMyGroups = query({
  args: {},
  handler: listMyGroupsHandler,
  returns: myGroupsResultValidator,
});

export const getGroupLeaderboard = query({
  args: { groupId: v.string() },
  handler: getGroupLeaderboardHandler,
  returns: groupLeaderboardResultValidator,
});

export const renameGroup = mutation({
  args: { groupId: v.string(), name: v.string() },
  handler: renameGroupHandler,
  returns: groupIdResultValidator,
});

export const archiveGroup = mutation({
  args: { groupId: v.string() },
  handler: archiveGroupHandler,
  returns: groupIdResultValidator,
});

export const leaveGroup = mutation({
  args: { groupId: v.string() },
  handler: leaveGroupHandler,
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
