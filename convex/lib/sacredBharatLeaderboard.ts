import type { MutationCtx } from "../_generated/server";
import { sacredBharatLeaderboardRanks } from "./sacredBharatLeaderboardRank";
import { computeProgressSummary } from "./sacredBharatScoring";

export const SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY = "sacred-bharat-leaderboard-v1";

export async function refreshSacredBharatLeaderboardSummary(
  ctx: MutationCtx,
  authUserId: string,
  updatedAt = Date.now()
) {
  const [visits, passport, profile, existing] = await Promise.all([
    ctx.db
      .query("sacredBharatVisits")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .collect(),
    ctx.db
      .query("sacredBharatProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
    ctx.db
      .query("userProfiles")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
    ctx.db
      .query("sacredBharatLeaderboardSummaries")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique(),
  ]);
  const summary = computeProgressSummary(visits.map((visit) => visit.templeId));
  const payload = {
    authUserId,
    completedTrailCount: summary.completedTrailCount,
    displayName: passport?.displayName || profile?.name || "Sacred Yatri",
    levelSlug: summary.levelSlug,
    levelTitle: summary.levelTitle,
    optedOut: profile?.sacredBharatLeaderboardOptOut === true,
    passportSlug: passport?.isPublic ? passport.slug : null,
    score: summary.score,
    templeCount: summary.templeCount,
    updatedAt,
  };
  if (existing) {
    await ctx.db.patch("sacredBharatLeaderboardSummaries", existing._id, payload);
    const updated = await ctx.db.get("sacredBharatLeaderboardSummaries", existing._id);
    if (!updated) {
      throw new Error("Sacred Bharat leaderboard summary disappeared during refresh");
    }
    await sacredBharatLeaderboardRanks.replaceOrInsert(ctx, existing, updated);
    return existing._id;
  }
  const id = await ctx.db.insert("sacredBharatLeaderboardSummaries", payload);
  const inserted = await ctx.db.get("sacredBharatLeaderboardSummaries", id);
  if (!inserted) {
    throw new Error("Sacred Bharat leaderboard summary was not readable after insert");
  }
  await sacredBharatLeaderboardRanks.insertIfDoesNotExist(ctx, inserted);
  return id;
}

export async function refreshExistingSacredBharatLeaderboardSummaries(
  ctx: MutationCtx,
  authUserIds: Array<string | undefined>,
  updatedAt = Date.now()
) {
  const uniqueIds = [...new Set(authUserIds.filter((value): value is string => Boolean(value)))];
  const existing = await Promise.all(
    uniqueIds.map((authUserId) =>
      ctx.db
        .query("sacredBharatLeaderboardSummaries")
        .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
        .unique()
    )
  );
  await Promise.all(
    existing.flatMap((summary) =>
      summary ? [refreshSacredBharatLeaderboardSummary(ctx, summary.authUserId, updatedAt)] : []
    )
  );
}
