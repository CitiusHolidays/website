import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY } from "./lib/sacredBharatLeaderboard";
import {
  leaderboardSummaryIsEligible,
  SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY,
  sacredBharatLeaderboardRanks,
} from "./lib/sacredBharatLeaderboardRank";

const PAGE_SIZE = 40;
const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("verified"),
  v.literal("failed")
);
const migrationResultValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  eligibleProcessed: v.number(),
  hiddenProcessed: v.number(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
});
const migrationStatusResultValidator = v.object({
  cursor: v.union(v.string(), v.null()),
  eligibleProcessed: v.number(),
  hiddenProcessed: v.number(),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.string(),
  status: migrationStatusValidator,
  updatedAt: v.number(),
  verified: v.boolean(),
  verifiedAt: v.union(v.number(), v.null()),
});

function assertMigrationSecret(secret: string) {
  const expected = process.env.MIGRATION_SECRET;
  if (!expected || secret !== expected) {
    throw new ConvexError("Invalid migration secret");
  }
}

function boundedPageSize(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? PAGE_SIZE), 1), PAGE_SIZE);
}

async function getRegistry(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function requireSummaryReadiness(ctx: QueryCtx | MutationCtx) {
  const readiness = await getRegistry(ctx, SACRED_BHARAT_LEADERBOARD_MIGRATION_KEY);
  if (
    readiness?.status !== "verified" ||
    readiness.stage !== "complete" ||
    readiness.legacyRemaining !== 0
  ) {
    throw new ConvexError("SACRED_BHARAT_SUMMARY_MIGRATION_INCOMPLETE");
  }
}

export const backfillLeaderboardRanks = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    await requireSummaryReadiness(ctx);
    const timestamp = Date.now();
    let registry = await getRegistry(ctx, SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY);
    if (registry?.status === "verified") {
      return {
        cursor: null,
        eligibleProcessed: 0,
        hiddenProcessed: 0,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
      };
    }
    if (registry?.stage === "verify" && registry.status === "running") {
      return {
        cursor: registry.cursor,
        eligibleProcessed: 0,
        hiddenProcessed: 0,
        legacyRemaining: registry.legacyRemaining,
        processed: 0,
        stage: "verify" as const,
        status: "running" as const,
      };
    }
    if (!registry) {
      const id = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key: SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
      });
      registry = await ctx.db.get("dataMigrationRegistry", id);
    } else if (registry.status === "failed") {
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get("dataMigrationRegistry", registry._id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize Sacred Bharat rank migration");
    }

    const page = await ctx.db
      .query("sacredBharatLeaderboardSummaries")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedPageSize(args.limit) });
    await Promise.all(
      page.page.map((summary) => sacredBharatLeaderboardRanks.insertIfDoesNotExist(ctx, summary))
    );
    const eligibleProcessed = page.page.filter(leaderboardSummaryIsEligible).length;
    const hiddenProcessed = page.page.length - eligibleProcessed;
    const cursor = page.isDone ? null : page.continueCursor;
    const stage: "backfill" | "verify" = page.isDone ? "verify" : "backfill";
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted: page.isDone ? 0 : registry.converted + eligibleProcessed,
      cursor,
      legacyRemaining: 0,
      processed: page.isDone ? 0 : registry.processed + page.page.length,
      quarantined: page.isDone ? 0 : (registry.quarantined ?? 0) + hiddenProcessed,
      stage,
      status: "running",
      updatedAt: timestamp,
    });
    return {
      cursor,
      eligibleProcessed,
      hiddenProcessed,
      legacyRemaining: 0,
      processed: page.page.length,
      stage,
      status: "running" as const,
    };
  },
  returns: migrationResultValidator,
});

async function summaryExistsAtExactRank(
  ctx: MutationCtx,
  summary: Doc<"sacredBharatLeaderboardSummaries">
) {
  try {
    const offset = await sacredBharatLeaderboardRanks.indexOfDoc(ctx, summary);
    const item = await sacredBharatLeaderboardRanks.at(ctx, offset, {
      namespace: leaderboardSummaryIsEligible(summary) ? "eligible" : "hidden",
    });
    return item.id === summary._id;
  } catch {
    return false;
  }
}

export const verifyLeaderboardRanks = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    await requireSummaryReadiness(ctx);
    const registry = await getRegistry(ctx, SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY);
    if (registry?.stage !== "verify" || registry.status !== "running") {
      throw new ConvexError("SACRED_BHARAT_RANK_BACKFILL_INCOMPLETE");
    }
    const timestamp = Date.now();
    const page = await ctx.db
      .query("sacredBharatLeaderboardSummaries")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedPageSize(args.limit) });
    const exactRows = await Promise.all(
      page.page.map((summary) => summaryExistsAtExactRank(ctx, summary))
    );
    let legacyRemaining = registry.legacyRemaining + exactRows.filter((isExact) => !isExact).length;
    const eligibleProcessed = page.page.filter(leaderboardSummaryIsEligible).length;
    const hiddenProcessed = page.page.length - eligibleProcessed;
    const eligibleTotal = registry.converted + eligibleProcessed;
    const hiddenTotal = (registry.quarantined ?? 0) + hiddenProcessed;
    if (page.isDone) {
      const [aggregateEligible, aggregateHidden] = await Promise.all([
        sacredBharatLeaderboardRanks.count(ctx, { namespace: "eligible" }),
        sacredBharatLeaderboardRanks.count(ctx, { namespace: "hidden" }),
      ]);
      legacyRemaining +=
        Math.abs(aggregateEligible - eligibleTotal) + Math.abs(aggregateHidden - hiddenTotal);
    }
    const cursor = page.isDone ? null : page.continueCursor;
    const verified = page.isDone && legacyRemaining === 0;
    const stage: "complete" | "verify" = page.isDone ? "complete" : "verify";
    let status: "failed" | "running" | "verified" = "running";
    if (verified) {
      status = "verified";
    } else if (page.isDone) {
      status = "failed";
    }
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted: eligibleTotal,
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      quarantined: hiddenTotal,
      stage,
      status,
      updatedAt: timestamp,
      verifiedAt: verified ? timestamp : undefined,
    });
    return {
      cursor,
      eligibleProcessed,
      hiddenProcessed,
      legacyRemaining,
      processed: page.page.length,
      stage,
      status,
    };
  },
  returns: migrationResultValidator,
});

export const getLeaderboardRankMigrationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const registry = await getRegistry(ctx, SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY);
    if (!registry) {
      return {
        cursor: null,
        eligibleProcessed: 0,
        hiddenProcessed: 0,
        key: SACRED_BHARAT_LEADERBOARD_RANK_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        status: "pending" as const,
        updatedAt: 0,
        verified: false,
        verifiedAt: null,
      };
    }
    return {
      cursor: registry.cursor,
      eligibleProcessed: registry.converted,
      hiddenProcessed: registry.quarantined ?? 0,
      key: registry.key,
      legacyRemaining: registry.legacyRemaining,
      processed: registry.processed,
      stage: registry.stage,
      status: registry.status,
      updatedAt: registry.updatedAt,
      verified:
        registry.status === "verified" &&
        registry.stage === "complete" &&
        registry.legacyRemaining === 0,
      verifiedAt: registry.verifiedAt ?? null,
    };
  },
  returns: migrationStatusResultValidator,
});
