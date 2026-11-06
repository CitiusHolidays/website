import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import { expectedAssignedTourManagerStaffIds, sameTourManagerStaffIds } from "./jobCardVisibility";

/**
 * Backfills `jobCards.assignedTourManagerStaffIds` from `tourManagerAssignments`.
 * Runbook: docs/migrations/job-card-assigned-tour-manager-staff-ids.md. The live
 * write paths keep the field in sync; this migration covers Job Cards whose
 * assignments predate the field. `legacyRemaining` counts Job Cards whose stored
 * set differs from the set derived from their assignments.
 */
export const TOUR_MANAGER_VISIBILITY_MIGRATION_KEY = "job-card-assigned-tour-manager-staff-ids-v1";
// Each Job Card reads up to MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD assignment
// rows, so pages stay small to keep every transaction well inside read limits.
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running" as const),
  v.literal("verified" as const),
  v.literal("failed" as const)
);

const resultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  dryRun: v.boolean(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(
    v.literal("backfill" as const),
    v.literal("verify" as const),
    v.literal("complete" as const)
  ),
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
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
}

function registryKey(dryRun: boolean) {
  return dryRun
    ? `${TOUR_MANAGER_VISIBILITY_MIGRATION_KEY}:dry-run`
    : TOUR_MANAGER_VISIBILITY_MIGRATION_KEY;
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

async function staleJobCards(ctx: MutationCtx, jobCards: Doc<"jobCards">[]) {
  const results = await Promise.all(
    jobCards.map(async (job) => {
      const expected = await expectedAssignedTourManagerStaffIds(ctx, job._id);
      return sameTourManagerStaffIds(job.assignedTourManagerStaffIds, expected)
        ? null
        : { expected, job };
    })
  );
  return results.filter((result) => result !== null);
}

export const migrateAssignedTourManagerStaffIds = internalMutation({
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
      throw new ConvexError("Unable to initialize the assigned Tour Manager migration");
    }

    const page = await ctx.db
      .query("jobCards")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: limit });
    const stale = await staleJobCards(ctx, page.page);
    // Patch only the derived field: no updatedAt bump, metric sync or search
    // reindex, because neither list ordering nor search reads this field.
    await Promise.all(
      args.dryRun
        ? []
        : stale.map(({ expected, job }) =>
            ctx.db.patch("jobCards", job._id, { assignedTourManagerStaffIds: expected })
          )
    );
    const pageConverted = args.dryRun ? 0 : stale.length;
    const converted = registry.converted + pageConverted;
    const processed = registry.processed + page.page.length;
    const legacyRemaining = args.dryRun
      ? registry.legacyRemaining + stale.length
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
      ...propertiesWhen(status === "verified", () => ({ verifiedAt: now })),
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

export const verifyAssignedTourManagerStaffIds = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await loadRegistry(ctx, TOUR_MANAGER_VISIBILITY_MIGRATION_KEY);
    if (!registry) {
      throw new ConvexError("Run the assigned Tour Manager migration first");
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
      throw new ConvexError("Assigned Tour Manager migration is not ready for verification");
    }
    const now = Date.now();
    const page = await ctx.db
      .query("jobCards")
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedLimit(args.limit) });
    const pageResiduals = (await staleJobCards(ctx, page.page)).length;
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
      ...propertiesWhen(status === "verified", () => ({ verifiedAt: now })),
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

export const getAssignedTourManagerStaffIdsMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const row = await loadRegistry(ctx, TOUR_MANAGER_VISIBILITY_MIGRATION_KEY);
    const status = row?.status ?? "pending";
    return {
      converted: row?.converted ?? 0,
      cursor: row?.cursor ?? null,
      key: TOUR_MANAGER_VISIBILITY_MIGRATION_KEY,
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
