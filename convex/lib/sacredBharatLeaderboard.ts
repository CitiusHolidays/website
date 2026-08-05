import type { MutationCtx } from "../_generated/server";
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
    await ctx.db.patch(existing._id, payload);
    return existing._id;
  }
  return await ctx.db.insert("sacredBharatLeaderboardSummaries", payload);
}
