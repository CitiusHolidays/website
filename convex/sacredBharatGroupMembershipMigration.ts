import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import {
  MAX_SACRED_BHARAT_GROUP_MEMBERS,
  SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY,
} from "./lib/sacredBharatGroups";

const DEFAULT_PAGE_SIZE = 20;
const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("verified"),
  v.literal("failed")
);
const migrationResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  oversizedGroups: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
});
const migrationStatusResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
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
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_PAGE_SIZE), 1), DEFAULT_PAGE_SIZE);
}

async function getRegistry(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY))
    .unique();
}

async function inspectGroup(ctx: QueryCtx | MutationCtx, groupId: Id<"sacredBharatGroups">) {
  const members = await ctx.db
    .query("sacredBharatGroupMembers")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .take(MAX_SACRED_BHARAT_GROUP_MEMBERS + 1);
  return {
    count: members.length,
    oversized: members.length > MAX_SACRED_BHARAT_GROUP_MEMBERS,
  };
}

export const backfillGroupMemberCounts = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const timestamp = Date.now();
    let registry = await getRegistry(ctx);
    if (registry?.status === "verified") {
      return {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        oversizedGroups: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
      };
    }
    if (registry?.stage === "verify" && registry.status === "running") {
      return {
        converted: 0,
        cursor: registry.cursor,
        legacyRemaining: registry.legacyRemaining,
        oversizedGroups: registry.quarantined ?? 0,
        processed: 0,
        stage: "verify" as const,
        status: "running" as const,
      };
    }
    if (!registry) {
      const registryId = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key: SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
      });
      registry = await ctx.db.get("dataMigrationRegistry", registryId);
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
      throw new ConvexError("Unable to initialize Sacred Bharat group-count migration");
    }

    const page = await ctx.db
      .query("sacredBharatGroups")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedPageSize(args.limit) });
    const inspections = await Promise.all(
      page.page.map(async (group) => ({ group, ...(await inspectGroup(ctx, group._id)) }))
    );
    const oversizedGroups = inspections.filter(({ oversized }) => oversized).length;
    const updates = inspections.filter(
      ({ count, group, oversized }) => !oversized && group.memberCount !== count
    );
    await Promise.all(
      updates.map(({ count, group }) =>
        ctx.db.patch("sacredBharatGroups", group._id, {
          memberCount: count,
          updatedAt: timestamp,
        })
      )
    );
    const converted = updates.length;

    const totalOversized = (registry.quarantined ?? 0) + oversizedGroups;
    const cursor = page.isDone ? null : page.continueCursor;
    const stage = page.isDone && totalOversized === 0 ? "verify" : "backfill";
    const status = page.isDone && totalOversized > 0 ? "failed" : "running";
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted: registry.converted + converted,
      cursor,
      legacyRemaining: totalOversized,
      processed: registry.processed + page.page.length,
      quarantined: totalOversized,
      stage,
      status,
      updatedAt: timestamp,
    });
    return {
      converted,
      cursor,
      legacyRemaining: totalOversized,
      oversizedGroups,
      processed: page.page.length,
      stage: stage as "backfill" | "verify",
      status: status as "running" | "failed",
    };
  },
  returns: migrationResultValidator,
});

export const verifyGroupMemberCounts = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await getRegistry(ctx);
    if (registry?.stage !== "verify" || registry.status !== "running") {
      throw new ConvexError("GROUP_MEMBER_COUNT_BACKFILL_INCOMPLETE");
    }
    const timestamp = Date.now();
    const page = await ctx.db
      .query("sacredBharatGroups")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedPageSize(args.limit) });
    const inspections = await Promise.all(
      page.page.map(async (group) => ({ group, ...(await inspectGroup(ctx, group._id)) }))
    );
    const mismatches = inspections.filter(
      ({ count, group, oversized }) => oversized || group.memberCount !== count
    ).length;
    const totalMismatches = registry.legacyRemaining + mismatches;
    const cursor = page.isDone ? null : page.continueCursor;
    const verified = page.isDone && totalMismatches === 0;
    const stage = page.isDone ? "complete" : "verify";
    let status: "failed" | "running" | "verified" = "running";
    if (verified) {
      status = "verified";
    } else if (page.isDone) {
      status = "failed";
    }
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor,
      legacyRemaining: totalMismatches,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: timestamp,
      verifiedAt: verified ? timestamp : undefined,
    });
    return {
      converted: 0,
      cursor,
      legacyRemaining: totalMismatches,
      oversizedGroups: inspections.filter(({ oversized }) => oversized).length,
      processed: page.page.length,
      stage: stage as "verify" | "complete",
      status: status as "running" | "verified" | "failed",
    };
  },
  returns: migrationResultValidator,
});

export const getGroupMemberCountMigrationStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const registry = await getRegistry(ctx);
    if (!registry) {
      return {
        converted: 0,
        cursor: null,
        key: SACRED_BHARAT_GROUP_COUNT_MIGRATION_KEY,
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
      converted: registry.converted,
      cursor: registry.cursor,
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
