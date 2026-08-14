import type { PaginationOptions } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  assertRecognizedTravelBatchSummaries,
  type TransitionalTravelBatchSummary,
  travelBatchCountFromSummaries,
  travelBatchSummaryVariant,
} from "./lib/travelBatchSummary";
import { assertMigrationSecret } from "./migrationAuth";

const TRAVEL_BATCH_MIGRATION_LIMIT = 100;
export const TRAVEL_BATCH_SUMMARY_MIGRATION_KEY = "travel-batch-summary-v2";

const migrationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("verified"),
  v.literal("failed")
);

export const travelBatchSummaryRegistryResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
});

export const travelBatchSummaryRegistryStatusValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  legacyRemaining: v.number(),
  processed: v.number(),
  stage: v.union(v.literal("backfill"), v.literal("verify"), v.literal("complete")),
  status: migrationStatusValidator,
  updatedAt: v.number(),
  verified: v.boolean(),
  verifiedAt: v.union(v.number(), v.null()),
});

function boundedTravelBatchSummaryMigrationLimit(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? TRAVEL_BATCH_MIGRATION_LIMIT), 1), 100);
}

async function getTravelBatchSummaryMigration(ctx: MutationCtx | QueryCtx) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", TRAVEL_BATCH_SUMMARY_MIGRATION_KEY))
    .unique();
}

export async function auditTravelBatchSummariesHandler(
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions; secret: string }
) {
  assertMigrationSecret(args.secret);
  const result = await ctx.db.query("jobCards").paginate(args.paginationOpts);
  return {
    ...result,
    page: result.page.flatMap((job) => {
      const summaries = (job.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
      if (summaries.length === 0) {
        return [];
      }
      return [
        {
          derivedCount: travelBatchCountFromSummaries(summaries),
          id: job._id,
          jobCode: job.jobCode,
          storedCount: job.travelBatchCount ?? null,
          variants: Array.from(new Set(summaries.map(travelBatchSummaryVariant))),
        },
      ];
    }),
  };
}

export async function migrateTravelBatchSummariesHandler(
  ctx: MutationCtx,
  args: { jobCardIds: Id<"jobCards">[]; secret: string }
) {
  assertMigrationSecret(args.secret);
  if (args.jobCardIds.length > TRAVEL_BATCH_MIGRATION_LIMIT) {
    throw new ConvexError(`Migrate at most ${TRAVEL_BATCH_MIGRATION_LIMIT} Job Cards per call`);
  }
  const uniqueJobCardIds = Array.from(new Set(args.jobCardIds));
  const duplicateCount = args.jobCardIds.length - uniqueJobCardIds.length;
  const outcomes = await Promise.all(
    uniqueJobCardIds.map(async (jobCardId) => {
      const job = await ctx.db.get("jobCards", jobCardId);
      const summaries = (job?.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
      if (!job || summaries.length === 0) {
        return "skipped" as const;
      }
      await ctx.db.patch("jobCards", jobCardId, {
        travelBatchCount: Math.max(
          job.travelBatchCount ?? 0,
          travelBatchCountFromSummaries(summaries)
        ),
        travelBatchSummaries: undefined,
        updatedAt: Date.now(),
      });
      return "migrated" as const;
    })
  );
  const migrated = outcomes.filter((outcome) => outcome === "migrated").length;
  const skipped = outcomes.filter((outcome) => outcome === "skipped").length + duplicateCount;
  return { migrated, skipped, total: args.jobCardIds.length };
}

export async function backfillTravelBatchSummariesHandler(
  ctx: MutationCtx,
  args: { limit?: number; secret: string }
) {
  assertMigrationSecret(args.secret);
  const limit = boundedTravelBatchSummaryMigrationLimit(args.limit);
  const now = Date.now();
  let registry = await getTravelBatchSummaryMigration(ctx);
  if (registry?.status === "verified") {
    return {
      converted: 0,
      cursor: null,
      legacyRemaining: 0,
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
      processed: 0,
      stage: "verify" as const,
      status: "running" as const,
    };
  }
  if (!registry) {
    const id = await ctx.db.insert("dataMigrationRegistry", {
      converted: 0,
      cursor: null,
      key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
      legacyRemaining: 0,
      processed: 0,
      stage: "backfill",
      startedAt: now,
      status: "running",
      updatedAt: now,
    });
    registry = await ctx.db.get("dataMigrationRegistry", id);
  } else if (registry.status === "failed") {
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
  if (!registry) {
    throw new ConvexError("Unable to initialize Travel Batch summary migration");
  }

  const page = await ctx.db
    .query("jobCards")
    .order("asc")
    .paginate({ cursor: registry.cursor, numItems: limit });
  const patches = page.page.flatMap((job) => {
    const summaries = (job.travelBatchSummaries ?? []) as TransitionalTravelBatchSummary[];
    if (summaries.length === 0) {
      return [];
    }
    assertRecognizedTravelBatchSummaries(summaries);
    return [
      {
        id: job._id,
        value: {
          travelBatchCount: Math.max(
            job.travelBatchCount ?? 0,
            travelBatchCountFromSummaries(summaries)
          ),
          travelBatchSummaries: undefined,
          updatedAt: now,
        },
      },
    ];
  });
  await Promise.all(patches.map(({ id, value }) => ctx.db.patch("jobCards", id, value)));
  const converted = patches.length;
  const stage = page.isDone ? ("verify" as const) : ("backfill" as const);
  const cursor = page.isDone ? null : page.continueCursor;
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    converted: registry.converted + converted,
    cursor,
    legacyRemaining: 0,
    processed: page.isDone ? 0 : registry.processed + page.page.length,
    stage,
    status: "running",
    updatedAt: now,
  });
  return {
    converted,
    cursor,
    legacyRemaining: 0,
    processed: page.page.length,
    stage,
    status: "running" as const,
  };
}

export async function verifyTravelBatchSummariesHandler(
  ctx: MutationCtx,
  args: { limit?: number; secret: string }
) {
  assertMigrationSecret(args.secret);
  const registry = await getTravelBatchSummaryMigration(ctx);
  if (!registry) {
    throw new ConvexError("Run the Travel Batch summary backfill first");
  }
  if (registry.status === "verified" && registry.stage === "complete") {
    return {
      converted: 0,
      cursor: null,
      legacyRemaining: 0,
      processed: 0,
      stage: "complete" as const,
      status: "verified" as const,
    };
  }
  if (registry.status === "failed" || registry.stage !== "verify") {
    throw new ConvexError("Travel Batch summary backfill is not ready for verification");
  }

  const page = await ctx.db
    .query("jobCards")
    .order("asc")
    .paginate({
      cursor: registry.cursor,
      numItems: boundedTravelBatchSummaryMigrationLimit(args.limit),
    });
  const pageResiduals = page.page.filter(
    (job) => (job.travelBatchSummaries?.length ?? 0) > 0
  ).length;
  const legacyRemaining = registry.legacyRemaining + pageResiduals;
  let status: "failed" | "running" | "verified" = "running";
  if (page.isDone) {
    status = legacyRemaining === 0 ? "verified" : "failed";
  }
  const stage = status === "verified" ? ("complete" as const) : ("verify" as const);
  const cursor = page.isDone ? null : page.continueCursor;
  const now = Date.now();
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
    legacyRemaining,
    processed: page.page.length,
    stage,
    status,
  };
}

export async function getTravelBatchSummaryMigrationStatusHandler(
  ctx: QueryCtx,
  args: { secret: string }
) {
  assertMigrationSecret(args.secret);
  const registry = await getTravelBatchSummaryMigration(ctx);
  const status = registry?.status ?? "pending";
  const stage: "backfill" | "complete" | "verify" =
    registry?.stage === "verify" || registry?.stage === "complete" ? registry.stage : "backfill";
  const legacyRemaining = registry?.legacyRemaining ?? 0;
  return {
    converted: registry?.converted ?? 0,
    cursor: registry?.cursor ?? null,
    key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
    legacyRemaining,
    processed: registry?.processed ?? 0,
    stage,
    status,
    updatedAt: registry?.updatedAt ?? 0,
    verified: status === "verified" && stage === "complete" && legacyRemaining === 0,
    verifiedAt: registry?.verifiedAt ?? null,
  };
}
