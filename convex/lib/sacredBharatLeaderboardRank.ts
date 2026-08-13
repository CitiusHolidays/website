import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY = "sacred-bharat-leaderboard-rank-v1";

type LeaderboardNamespace = "eligible" | "hidden";
export type LeaderboardRankKey = [number, number, string, string, string];

export function leaderboardSummaryIsEligible(
  summary: Pick<Doc<"sacredBharatLeaderboardSummaries">, "optedOut" | "templeCount">
) {
  return !summary.optedOut && summary.templeCount > 0;
}

export function leaderboardDisplaySortKey(displayName: string) {
  return displayName.normalize("NFKD").toLowerCase();
}

export function leaderboardRankKey(
  summary: Pick<
    Doc<"sacredBharatLeaderboardSummaries">,
    "authUserId" | "displayName" | "score" | "templeCount"
  >
): LeaderboardRankKey {
  return [
    -summary.score,
    -summary.templeCount,
    leaderboardDisplaySortKey(summary.displayName),
    summary.displayName,
    summary.authUserId,
  ];
}

export function compareLeaderboardRows<
  T extends { authUserId: string; displayName: string; score: number; templeCount: number },
>(left: T, right: T) {
  const leftName = leaderboardDisplaySortKey(left.displayName);
  const rightName = leaderboardDisplaySortKey(right.displayName);
  const compareStrings = (leftValue: string, rightValue: string) => {
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
    return 0;
  };
  return (
    right.score - left.score ||
    right.templeCount - left.templeCount ||
    compareStrings(leftName, rightName) ||
    compareStrings(left.displayName, right.displayName) ||
    compareStrings(left.authUserId, right.authUserId)
  );
}

const component = Reflect.get(components, "sacredBharatLeaderboardRanks");

export const sacredBharatLeaderboardRanks = new TableAggregate<{
  DataModel: DataModel;
  Key: LeaderboardRankKey;
  Namespace: LeaderboardNamespace;
  TableName: "sacredBharatLeaderboardSummaries";
}>(component, {
  namespace: (summary) => (leaderboardSummaryIsEligible(summary) ? "eligible" : "hidden"),
  sortKey: leaderboardRankKey,
});

export async function leaderboardRankProjectionIsVerified(ctx: QueryCtx | MutationCtx) {
  const readiness = await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY))
    .unique();
  return (
    readiness?.status === "verified" &&
    readiness.stage === "complete" &&
    readiness.legacyRemaining === 0
  );
}
