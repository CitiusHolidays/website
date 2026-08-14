import { ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authorizedCustomerIdentityIds } from "./lib/customerIdentityAccess";
import { SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY } from "./lib/sacredBharatLeaderboard";
import {
  compareLeaderboardRows,
  leaderboardRankProjectionIsVerified,
  leaderboardSummaryIsEligible,
  sacredBharatLeaderboardRanks,
} from "./lib/sacredBharatLeaderboardRank";
import { computeProgressSummary } from "./lib/sacredBharatScoring";

async function getPassportProfileForUser(ctx: QueryCtx, authUserId: string) {
  return await ctx.db
    .query("sacredBharatProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

async function getDisplayName(ctx: QueryCtx, authUserId: string) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  return profile?.name?.trim() || "Sacred Yatri";
}

async function isLeaderboardOptedOut(ctx: QueryCtx, authUserId: string) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
  return profile?.sacredBharatLeaderboardOptOut === true;
}

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

  const allVisits = await ctx.db.query("sacredBharatVisits").collect();
  const byUser = new Map<string, Set<string>>();
  for (const visit of allVisits) {
    const set = byUser.get(visit.authUserId) ?? new Set<string>();
    set.add(visit.templeId);
    byUser.set(visit.authUserId, set);
  }

  const entryResults = await Promise.all(
    Array.from(byUser, async ([authUserId, templeSet]) => {
      const templeIds = [...templeSet];
      if ((await isLeaderboardOptedOut(ctx, authUserId)) || templeIds.length === 0) {
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
  const merged = new Map(materializedEntries.map((entry) => [entry.authUserId, entry]));
  for (const entry of entryResults) {
    if (entry && !merged.has(entry.authUserId)) {
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

export async function rankedLeaderboardSnapshot(
  ctx: QueryCtx,
  limit: number,
  identityIds: string[] = []
) {
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

export async function getLeaderboardHandler(ctx: QueryCtx, args: { limit?: number }) {
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
}

export async function getLeaderboardWithMeHandler(ctx: QueryCtx, args: { limit?: number }) {
  const identity = await ctx.auth.getUserIdentity();
  const identityIds = identity ? await authorizedCustomerIdentityIds(ctx, identity) : [];
  const identityIdSet = new Set(identityIds);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
  const snapshot = await rankedLeaderboardSnapshot(ctx, limit, identityIds);
  const entries = snapshot.top.map((entry, index) => ({
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

  if (!(identity && snapshot.current)) {
    return { entries, myRank: null };
  }
  const { rank, summary } = snapshot.current;
  return {
    entries,
    myRank: {
      displayName: summary.displayName,
      levelTitle: summary.levelTitle,
      percentile:
        snapshot.totalPlayers <= 1
          ? 100
          : Math.round(((snapshot.totalPlayers - rank + 1) / snapshot.totalPlayers) * 100),
      rank,
      score: summary.score,
      totalPlayers: snapshot.totalPlayers,
    },
  };
}

export async function getMyLeaderboardRankHandler(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
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
}
