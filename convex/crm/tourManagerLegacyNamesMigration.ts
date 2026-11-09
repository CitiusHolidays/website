import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { boundedMigrationLimit } from "../lib/migrationBatch";
import { migrationRegistryState, startedMigrationRegistry } from "../lib/migrationRegistry";
import { assertMigrationSecret } from "../migrationAuth";
import { staleTourManagerVisibilityPatch } from "./jobCardVisibility";

/**
 * Backfills both derived Tour Manager fields on every Job Card,
 * `assignedTourManagerStaffIds` and `legacyTourManagerNames`, through the same
 * `staleTourManagerVisibilityPatch` the live writer uses. Until a Job Card holds
 * `legacyTourManagerNames`, its Job Card-level `tourManagerName` (which can be an
 * external profile's name) still grants a same-named Tour Manager scope.
 * Runbook: docs/migrations/job-card-tour-manager-legacy-names.md. `legacyRemaining`
 * counts Job Cards whose stored fields are missing or differ from the derived ones.
 */
export const TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY = "job-card-tour-manager-legacy-names-v1";
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

export const tourManagerVisibilityMigrationResultValidator = v.object({
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

export const tourManagerVisibilityMigrationStatusValidator = v.object({
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

function registryKey(key: string, dryRun: boolean) {
  return dryRun ? `${key}:dry-run` : key;
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
      const patch = await staleTourManagerVisibilityPatch(ctx, job);
      return patch ? { job, patch } : null;
    })
  );
  return results.filter((result) => result !== null);
}

/**
 * One bounded page of a derived Tour Manager field backfill under `migrationKey`. Every pass
 * writes the fields `staleTourManagerVisibilityPatch` derives, so a later key re-checks every Job
 * Card after the derived fields gain meaning.
 */
export async function runTourManagerVisibilityMigrationPage(
  ctx: MutationCtx,
  args: { dryRun: boolean; limit?: number; secret: string },
  migrationKey: string
) {
  assertMigrationSecret(args.secret);
  const key = registryKey(migrationKey, args.dryRun);
  const now = Date.now();
  const limit = boundedMigrationLimit(args.limit, DEFAULT_LIMIT, MAX_LIMIT);
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
      ...startedMigrationRegistry("backfill", now),
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
      key,
      ...startedMigrationRegistry("backfill", now),
    });
    registry = await ctx.db.get("dataMigrationRegistry", id);
  }
  if (!registry) {
    throw new ConvexError(`Unable to initialize the ${migrationKey} migration`);
  }

  const page = await ctx.db
    .query("jobCards")
    .order("asc")
    .paginate({ cursor: registry.cursor, numItems: limit });
  const stale = await staleJobCards(ctx, page.page);
  // Patch only the derived fields: no updatedAt bump, metric sync or search
  // reindex, because neither list ordering nor search reads this field.
  await Promise.all(
    args.dryRun ? [] : stale.map(({ job, patch }) => ctx.db.patch("jobCards", job._id, patch))
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
    processed,
    ...migrationRegistryState({ cursor, legacyRemaining, stage, status }, now),
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
}

export const migrateTourManagerLegacyNames = internalMutation({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    secret: v.string(),
  },
  handler: async (ctx, args) =>
    await runTourManagerVisibilityMigrationPage(ctx, args, TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY),
  returns: tourManagerVisibilityMigrationResultValidator,
});

/** Independent bounded rescan for `migrationKey`; any residual fails the gate. */
export async function runTourManagerVisibilityVerification(
  ctx: MutationCtx,
  args: { limit?: number; secret: string },
  migrationKey: string
) {
  assertMigrationSecret(args.secret);
  const registry = await loadRegistry(ctx, migrationKey);
  if (!registry) {
    throw new ConvexError(`Run the ${migrationKey} migration first`);
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
    throw new ConvexError(`The ${migrationKey} migration is not ready for verification`);
  }
  const now = Date.now();
  const page = await ctx.db
    .query("jobCards")
    .order("asc")
    .paginate({
      cursor: registry.cursor,
      numItems: boundedMigrationLimit(args.limit, DEFAULT_LIMIT, MAX_LIMIT),
    });
  const pageResiduals = (await staleJobCards(ctx, page.page)).length;
  const legacyRemaining = registry.legacyRemaining + pageResiduals;
  const cursor = page.isDone ? null : page.continueCursor;
  const { stage, status } = verificationCompletion(page.isDone, legacyRemaining);
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    processed: registry.processed + page.page.length,
    ...migrationRegistryState({ cursor, legacyRemaining, stage, status }, now),
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
}

export const verifyTourManagerLegacyNames = internalMutation({
  args: { limit: v.optional(v.number()), secret: v.string() },
  handler: async (ctx, args) =>
    await runTourManagerVisibilityVerification(ctx, args, TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY),
  returns: tourManagerVisibilityMigrationResultValidator,
});

/** Content-free status of the migration under `migrationKey`. */
export async function readTourManagerVisibilityMigrationStatus(
  ctx: QueryCtx,
  args: { secret: string },
  migrationKey: string
) {
  assertMigrationSecret(args.secret);
  const row = await loadRegistry(ctx, migrationKey);
  const status = row?.status ?? "pending";
  return {
    converted: row?.converted ?? 0,
    cursor: row?.cursor ?? null,
    key: migrationKey,
    legacyRemaining: row?.legacyRemaining ?? 0,
    processed: row?.processed ?? 0,
    stage: row?.stage ?? "backfill",
    status,
    updatedAt: row?.updatedAt ?? 0,
    verified: status === "verified" && row?.stage === "complete" && row.legacyRemaining === 0,
    verifiedAt: row?.verifiedAt ?? null,
  };
}

export const getTourManagerLegacyNamesMigrationStatus = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, args) =>
    await readTourManagerVisibilityMigrationStatus(
      ctx,
      args,
      TOUR_MANAGER_LEGACY_NAMES_MIGRATION_KEY
    ),
  returns: tourManagerVisibilityMigrationStatusValidator,
});
