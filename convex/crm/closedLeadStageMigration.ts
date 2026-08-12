import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";

export const CLOSED_LEAD_STAGE_MIGRATION_KEY = "query-lead-stage-closed-to-lost-v1";
const DEFAULT_LIMIT = 100;

const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("verified"),
  v.literal("failed")
);

const resultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  dryRun: v.boolean(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
});

const statusValidator = v.object({
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

function boundedLimit(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), DEFAULT_LIMIT);
}

function registryKey(dryRun: boolean) {
  return dryRun ? `${CLOSED_LEAD_STAGE_MIGRATION_KEY}:dry-run` : CLOSED_LEAD_STAGE_MIGRATION_KEY;
}

function backfillCompletion(dryRun: boolean, isDone: boolean, legacyRemaining: number) {
  if (!isDone) {
    return { stage: "backfill" as const, status: "running" as const };
  }
  if (!dryRun) {
    return { stage: "verify" as const, status: "running" as const };
  }
  return {
    stage: "complete" as const,
    status: legacyRemaining === 0 ? ("verified" as const) : ("failed" as const),
  };
}

function verificationCompletion(isDone: boolean, legacyRemaining: number) {
  if (!isDone) {
    return { stage: "verify" as const, status: "running" as const };
  }
  return {
    stage: "complete" as const,
    status: legacyRemaining === 0 ? ("verified" as const) : ("failed" as const),
  };
}

async function loadRegistry(ctx: MutationCtx | QueryCtx, key: string) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export const migrateClosedLeadStages = internalMutation({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const key = registryKey(args.dryRun);
    const now = Date.now();
    const limit = boundedLimit(args.limit);
    let registry = await loadRegistry(ctx, key);
    if (registry?.status === "verified" || (args.dryRun && registry?.status === "failed")) {
      return {
        converted: registry.converted,
        cursor: null,
        dryRun: args.dryRun,
        legacyRemaining: registry.legacyRemaining,
        processed: 0,
        stage: "complete" as const,
        status: registry.status,
      };
    }
    if (!args.dryRun && registry?.status === "failed") {
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: now,
        status: "running",
        updatedAt: now,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get("dataMigrationRegistry", registry._id);
    }
    if (registry?.stage === "verify") {
      return {
        converted: registry.converted,
        cursor: registry.cursor,
        dryRun: args.dryRun,
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
        key,
        legacyRemaining: 0,
        processed: 0,
        stage: "backfill",
        startedAt: now,
        status: "running",
        updatedAt: now,
      });
      registry = await ctx.db.get("dataMigrationRegistry", id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize the Closed lead-stage migration");
    }

    const page = await ctx.db
      .query("queries")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: limit });
    const legacyQueries = page.page.filter((query) => query.leadStage === "Closed");
    const pageLegacy = legacyQueries.length;
    await Promise.all(
      args.dryRun
        ? []
        : legacyQueries.map((query) =>
            ctx.db.patch("queries", query._id, { leadStage: "Lost", updatedAt: now })
          )
    );
    const pageConverted = args.dryRun ? 0 : pageLegacy;
    const converted = registry.converted + pageConverted;
    const processed = registry.processed + page.page.length;
    const legacyRemaining = args.dryRun
      ? registry.legacyRemaining + pageLegacy
      : registry.legacyRemaining;
    const cursor = page.isDone ? null : page.continueCursor;
    const { stage, status } = backfillCompletion(args.dryRun, page.isDone, legacyRemaining);
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted,
      cursor,
      legacyRemaining,
      processed,
      stage,
      status,
      updatedAt: now,
      ...(status === "verified" ? { verifiedAt: now } : {}),
    });
    return {
      converted: pageConverted,
      cursor,
      dryRun: args.dryRun,
      legacyRemaining,
      processed: page.page.length,
      stage,
      status,
    };
  },
  returns: resultValidator,
});

export const verifyClosedLeadStages = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await loadRegistry(ctx, CLOSED_LEAD_STAGE_MIGRATION_KEY);
    if (!registry) {
      throw new ConvexError("Run the Closed lead-stage migration first");
    }
    if (registry.status === "verified") {
      return {
        converted: 0,
        cursor: null,
        dryRun: false,
        legacyRemaining: 0,
        processed: 0,
        stage: "complete" as const,
        status: "verified" as const,
      };
    }
    if (registry.stage !== "verify" || registry.status !== "running") {
      throw new ConvexError("Closed lead-stage migration is not ready for verification");
    }
    const now = Date.now();
    const page = await ctx.db
      .query("queries")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedLimit(args.limit) });
    const pageResiduals = page.page.filter((query) => query.leadStage === "Closed").length;
    const legacyRemaining = registry.legacyRemaining + pageResiduals;
    const cursor = page.isDone ? null : page.continueCursor;
    const { stage, status } = verificationCompletion(page.isDone, legacyRemaining);
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor,
      legacyRemaining,
      processed: registry.processed + page.page.length,
      stage,
      status,
      updatedAt: now,
      ...(status === "verified" ? { verifiedAt: now } : {}),
    });
    return {
      converted: 0,
      cursor,
      dryRun: false,
      legacyRemaining,
      processed: page.page.length,
      stage,
      status,
    };
  },
  returns: resultValidator,
});

export const getClosedLeadStageMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const row = await loadRegistry(ctx, CLOSED_LEAD_STAGE_MIGRATION_KEY);
    const status = row?.status ?? "pending";
    return {
      converted: row?.converted ?? 0,
      cursor: row?.cursor ?? null,
      key: CLOSED_LEAD_STAGE_MIGRATION_KEY,
      legacyRemaining: row?.legacyRemaining ?? 0,
      processed: row?.processed ?? 0,
      stage: row?.stage ?? "backfill",
      status,
      updatedAt: row?.updatedAt ?? 0,
      verified: status === "verified" && row?.stage === "complete" && row.legacyRemaining === 0,
      verifiedAt: row?.verifiedAt ?? null,
    };
  },
  returns: statusValidator,
});
