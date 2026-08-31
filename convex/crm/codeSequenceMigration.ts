import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  assertTargetBoundMigration,
  migrationTargetResultFields,
  targetBoundMigrationArgs,
  targetBoundMigrationRegistryKey,
} from "../migrationAuth";
import {
  type CodeTableName,
  CRM_CODE_CONFIG_BY_TABLE,
  CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION,
  crmCodeSequenceMigrationKey,
  isTrustedCrmCodeAllocator,
} from "./lib/codes";
import type { OperationalTargetIdentity } from "./lib/operationalTargetIdentity";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;

const codeTableValidator = v.union(
  v.literal("approvalRequests"),
  v.literal("jobCards"),
  v.literal("proposals"),
  v.literal("queries")
);

const resultValidator = v.object({
  ...migrationTargetResultFields,
  anomalies: v.number(),
  applied: v.boolean(),
  cursor: v.union(v.string(), v.null()),
  key: v.string(),
  maximumObserved: v.number(),
  processed: v.number(),
  processedThisPage: v.number(),
  sequenceLastAllocated: v.union(v.number(), v.null()),
  stage: v.union(
    v.literal("inventory"),
    v.literal("reset"),
    v.literal("ready"),
    v.literal("complete")
  ),
  status: v.union(v.literal("running"), v.literal("verified"), v.literal("failed")),
  tableName: codeTableValidator,
});
const anomalyValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("crmCodeSequenceInventoryAnomalies"),
  allocation: v.optional(v.number()),
  code: v.string(),
  key: v.string(),
  kind: v.union(v.literal("duplicate"), v.literal("malformed")),
  sourceId: v.string(),
});
const anomalyPageResultValidator = paginationResultValidator(anomalyValidator).extend(
  migrationTargetResultFields
);

function boundedPageSize(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
}

function migrationKey(tableName: CodeTableName, target: OperationalTargetIdentity) {
  return targetBoundMigrationRegistryKey(crmCodeSequenceMigrationKey(tableName), target);
}

function targetResult(target: OperationalTargetIdentity) {
  return {
    targetDeployment: target.targetDeployment,
    targetEnvironment: target.targetEnvironment,
    targetRevision: target.targetRevision,
  };
}

function allocationFromCode(tableName: CodeTableName, code: string) {
  const { prefix } = CRM_CODE_CONFIG_BY_TABLE[tableName];
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = tableName === "jobCards" ? "(?:-[A-Z]{1,4})?" : "";
  const match = code.match(new RegExp(`^${escapedPrefix}-(\\d{4,})${suffix}$`));
  if (!match) {
    return null;
  }
  const allocation = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(allocation) && allocation > 0 ? allocation : null;
}

async function pageSummary(
  ctx: MutationCtx,
  tableName: CodeTableName,
  page: { continueCursor: string; isDone: boolean },
  rows: { code: string; sourceId: string }[],
  key: string
) {
  const uniqueAllocations = new Map<number, { code: string; sourceId: string }>();
  const anomalies: {
    allocation?: number;
    code: string;
    key: string;
    kind: "duplicate" | "malformed";
    sourceId: string;
  }[] = [];
  let maximumObserved = 0;
  for (const row of rows) {
    const allocation = allocationFromCode(tableName, row.code);
    if (allocation === null) {
      anomalies.push({ ...row, key, kind: "malformed" });
      continue;
    }
    maximumObserved = Math.max(maximumObserved, allocation);
    if (uniqueAllocations.has(allocation)) {
      anomalies.push({ ...row, allocation, key, kind: "duplicate" });
    } else {
      uniqueAllocations.set(allocation, row);
    }
  }
  const allocations = [...uniqueAllocations.entries()];
  const existing = await Promise.all(
    allocations.map(([allocation]) =>
      ctx.db
        .query("crmCodeSequenceInventoryAllocations")
        .withIndex("by_key_allocation", (q) => q.eq("key", key).eq("allocation", allocation))
        .unique()
    )
  );
  const missing = allocations.filter((_, index) => {
    if (existing[index]) {
      const [allocation, row] = allocations[index];
      anomalies.push({ ...row, allocation, key, kind: "duplicate" });
      return false;
    }
    return true;
  });
  await Promise.all([
    ...missing.map(([allocation, row]) =>
      ctx.db.insert("crmCodeSequenceInventoryAllocations", {
        allocation,
        code: row.code,
        key,
        sourceId: row.sourceId,
      })
    ),
    ...anomalies.map((anomaly) => ctx.db.insert("crmCodeSequenceInventoryAnomalies", anomaly)),
  ]);
  return {
    anomalies: anomalies.length,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    maximumObserved,
    processed: rows.length,
  };
}

async function inventoryPage(
  ctx: MutationCtx,
  tableName: CodeTableName,
  cursor: string | null,
  limit: number,
  key: string
) {
  const paginationOpts = { cursor, numItems: limit };
  switch (tableName) {
    case "approvalRequests": {
      const page = await ctx.db.query("approvalRequests").order("asc").paginate(paginationOpts);
      return await pageSummary(
        ctx,
        tableName,
        page,
        page.page.map((row) => ({ code: row.requestCode, sourceId: String(row._id) })),
        key
      );
    }
    case "jobCards": {
      const page = await ctx.db.query("jobCards").order("asc").paginate(paginationOpts);
      return await pageSummary(
        ctx,
        tableName,
        page,
        page.page.map((row) => ({ code: row.jobCode, sourceId: String(row._id) })),
        key
      );
    }
    case "proposals": {
      const page = await ctx.db.query("proposals").order("asc").paginate(paginationOpts);
      return await pageSummary(
        ctx,
        tableName,
        page,
        page.page.map((row) => ({ code: row.proposalCode, sourceId: String(row._id) })),
        key
      );
    }
    case "queries": {
      const page = await ctx.db.query("queries").order("asc").paginate(paginationOpts);
      return await pageSummary(
        ctx,
        tableName,
        page,
        page.page.map((row) => ({ code: row.queryCode, sourceId: String(row._id) })),
        key
      );
    }
    default:
      throw new ConvexError("Unknown CRM code sequence table");
  }
}

async function migrationRegistry(ctx: MutationCtx | QueryCtx, key: string) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function currentSequence(ctx: MutationCtx | QueryCtx, tableName: CodeTableName) {
  const { key } = CRM_CODE_CONFIG_BY_TABLE[tableName];
  return await ctx.db
    .query("crmCodeSequences")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function currentTrust(ctx: MutationCtx | QueryCtx, tableName: CodeTableName) {
  const { key } = CRM_CODE_CONFIG_BY_TABLE[tableName];
  return await ctx.db
    .query("crmCodeSequenceTrust")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

function settledResult(
  tableName: CodeTableName,
  registry: Doc<"dataMigrationRegistry">,
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null,
  target: OperationalTargetIdentity
) {
  const anomalies = registry.quarantined ?? 0;
  const checkpoint = registry.checkpoint ?? 0;
  const complete =
    registry.stage === "complete" &&
    registry.status === "verified" &&
    anomalies === 0 &&
    Number.isSafeInteger(checkpoint) &&
    checkpoint >= 0 &&
    sequence !== null &&
    isTrustedCrmCodeAllocator(sequence, trust) &&
    sequence.lastAllocated >= checkpoint;
  let status: "failed" | "running" | "verified" = "running";
  if (complete) {
    status = "verified";
  } else if (registry.status === "failed" || anomalies > 0) {
    status = "failed";
  }
  let stage: "complete" | "inventory" | "ready" | "reset" = "ready";
  const registryStage = registry.stage;
  if (complete) {
    stage = "complete";
  } else if (registryStage === "inventory" || registryStage === "reset") {
    stage = registryStage;
  }
  return {
    ...targetResult(target),
    anomalies,
    applied: false,
    cursor: registry.cursor,
    key: registry.key,
    maximumObserved: checkpoint,
    processed: registry.processed,
    processedThisPage: 0,
    sequenceLastAllocated: sequence?.lastAllocated ?? null,
    stage,
    status,
    tableName,
  };
}

async function downgradeCompletedInventory(
  ctx: MutationCtx,
  registry: Doc<"dataMigrationRegistry">,
  now: number
) {
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    cursor: null,
    legacyRemaining: 1,
    stage: "reset",
    status: "running",
    updatedAt: now,
    verifiedAt: undefined,
  });
  const downgraded = await ctx.db.get("dataMigrationRegistry", registry._id);
  if (!downgraded) {
    throw new ConvexError("Unable to downgrade CRM code sequence inventory");
  }
  return downgraded;
}

function inventoryRequiresFollowUp(
  anomalies: number,
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null,
  maximumObserved: number
) {
  return (
    anomalies > 0 ||
    !sequence ||
    !isTrustedCrmCodeAllocator(sequence, trust) ||
    sequence.lastAllocated < maximumObserved
  );
}

function safeAllocatorValue(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function assertAllocatorFloors(
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null
) {
  if (sequence && !safeAllocatorValue(sequence.lastAllocated)) {
    throw new ConvexError("CRM code sequence allocator state is invalid");
  }
  if (
    trust &&
    (!safeAllocatorValue(trust.lastAllocated) ||
      trust.version !== CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION)
  ) {
    throw new ConvexError("CRM code sequence trust state is invalid");
  }
}

function allocatorFloor(
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null
) {
  assertAllocatorFloors(sequence, trust);
  return Math.max(sequence?.lastAllocated ?? 0, trust?.lastAllocated ?? 0);
}

async function requireReconciliation(
  ctx: MutationCtx,
  tableName: CodeTableName,
  sequence: Doc<"crmCodeSequences"> | null,
  trust: Doc<"crmCodeSequenceTrust"> | null,
  now: number
) {
  const lastAllocated = allocatorFloor(sequence, trust);
  if (trust) {
    await ctx.db.patch("crmCodeSequenceTrust", trust._id, {
      lastAllocated,
      reconciliationRequired: true,
      updatedAt: now,
    });
    const blocked = await ctx.db.get("crmCodeSequenceTrust", trust._id);
    if (!blocked) {
      throw new ConvexError("Unable to block CRM code sequence allocation");
    }
    return blocked;
  }
  const trustId = await ctx.db.insert("crmCodeSequenceTrust", {
    activatedAt: now,
    key: CRM_CODE_CONFIG_BY_TABLE[tableName].key,
    lastAllocated,
    reconciliationRequired: true,
    updatedAt: now,
    version: CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION,
  });
  const blocked = await ctx.db.get("crmCodeSequenceTrust", trustId);
  if (!blocked) {
    throw new ConvexError("Unable to initialize CRM code sequence trust state");
  }
  return blocked;
}

function inventoryNeedsReset(registry: Doc<"dataMigrationRegistry"> | null) {
  return (
    (registry?.stage === "ready" && registry.status === "failed") ||
    (registry?.stage === "reset" && registry.status === "running")
  );
}

function inventoryIsReady(registry: Doc<"dataMigrationRegistry"> | null) {
  return registry?.stage === "ready" && registry.status === "running";
}

async function resetInventoryObservations(
  ctx: MutationCtx,
  key: string,
  registry: Doc<"dataMigrationRegistry">,
  limit: number,
  now: number
) {
  const observations = await ctx.db
    .query("crmCodeSequenceInventoryAllocations")
    .withIndex("by_key_allocation", (q) => q.eq("key", key))
    .take(limit + 1);
  const discardedObservations = observations.slice(0, limit);
  const remainingLimit = limit - discardedObservations.length;
  const anomalyRows = await ctx.db
    .query("crmCodeSequenceInventoryAnomalies")
    .withIndex("by_key", (q) => q.eq("key", key))
    .take(Math.max(remainingLimit + 1, 1));
  const discardedAnomalies = anomalyRows.slice(0, remainingLimit);
  await Promise.all([
    ...discardedObservations.map((observation) =>
      ctx.db.delete("crmCodeSequenceInventoryAllocations", observation._id)
    ),
    ...discardedAnomalies.map((anomaly) =>
      ctx.db.delete("crmCodeSequenceInventoryAnomalies", anomaly._id)
    ),
  ]);
  const resetComplete = observations.length <= limit && anomalyRows.length <= remainingLimit;
  const checkpoint = registry.checkpoint ?? 0;
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    checkpoint: Number.isSafeInteger(checkpoint) && checkpoint >= 0 ? checkpoint : 0,
    converted: 0,
    cursor: null,
    legacyRemaining: 1,
    processed: 0,
    quarantined: 0,
    stage: resetComplete ? "inventory" : "reset",
    startedAt: resetComplete ? now : registry.startedAt,
    status: "running",
    updatedAt: now,
    verifiedAt: undefined,
  });
  const reset = await ctx.db.get("dataMigrationRegistry", registry._id);
  if (!reset) {
    throw new ConvexError("Unable to reset CRM code sequence inventory");
  }
  return reset;
}

async function ensureInventoryRegistry(
  ctx: MutationCtx,
  key: string,
  registry: Doc<"dataMigrationRegistry"> | null,
  now: number
) {
  if (registry) {
    return registry;
  }
  const registryId = await ctx.db.insert("dataMigrationRegistry", {
    checkpoint: 0,
    converted: 0,
    cursor: null,
    key,
    legacyRemaining: 0,
    processed: 0,
    quarantined: 0,
    stage: "inventory",
    startedAt: now,
    status: "running",
    updatedAt: now,
  });
  const initialized = await ctx.db.get("dataMigrationRegistry", registryId);
  if (!initialized) {
    throw new ConvexError("Unable to initialize CRM code sequence inventory");
  }
  return initialized;
}

export const listCrmCodeSequenceInventoryAnomalies = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    ...targetBoundMigrationArgs,
    tableName: codeTableValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    if (
      !Number.isSafeInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > MAX_PAGE_SIZE
    ) {
      throw new ConvexError(`CRM code sequence anomaly page size must be 1-${MAX_PAGE_SIZE}`);
    }
    const page = await ctx.db
      .query("crmCodeSequenceInventoryAnomalies")
      .withIndex("by_key", (q) => q.eq("key", migrationKey(args.tableName, target)))
      .paginate(args.paginationOpts);
    return { ...page, ...targetResult(target) };
  },
  returns: anomalyPageResultValidator,
});

export const inventoryCrmCodeSequenceSeed = internalMutation({
  args: {
    limit: v.optional(v.number()),
    ...targetBoundMigrationArgs,
    tableName: codeTableValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const now = Date.now();
    const key = migrationKey(args.tableName, target);
    let [registry, sequence, trust] = await Promise.all([
      migrationRegistry(ctx, key),
      currentSequence(ctx, args.tableName),
      currentTrust(ctx, args.tableName),
    ]);
    if (registry?.stage === "complete" && registry.status === "verified") {
      const settled = settledResult(args.tableName, registry, sequence, trust, target);
      if (settled.stage === "complete") {
        return settled;
      }
      trust = await requireReconciliation(ctx, args.tableName, sequence, trust, now);
      const downgraded = await downgradeCompletedInventory(ctx, registry, now);
      return settledResult(args.tableName, downgraded, sequence, trust, target);
    }
    trust = await requireReconciliation(ctx, args.tableName, sequence, trust, now);
    if (inventoryNeedsReset(registry) && registry) {
      registry = await resetInventoryObservations(
        ctx,
        key,
        registry,
        boundedPageSize(args.limit),
        now
      );
      return settledResult(args.tableName, registry, sequence, trust, target);
    }
    if (inventoryIsReady(registry) && registry) {
      return settledResult(args.tableName, registry, sequence, trust, target);
    }
    if (registry && (registry.stage !== "inventory" || registry.status !== "running")) {
      throw new ConvexError("CRM code sequence inventory registry is not resumable");
    }
    registry = await ensureInventoryRegistry(ctx, key, registry, now);

    const page = await inventoryPage(
      ctx,
      args.tableName,
      registry.cursor,
      boundedPageSize(args.limit),
      key
    );
    [sequence, trust] = await Promise.all([
      currentSequence(ctx, args.tableName),
      currentTrust(ctx, args.tableName),
    ]);
    const maximumObserved = Math.max(
      registry.checkpoint ?? 0,
      page.maximumObserved,
      allocatorFloor(sequence, trust)
    );
    const anomalies = (registry.quarantined ?? 0) + page.anomalies;
    const processed = registry.processed + page.processed;
    const stage = page.isDone ? ("ready" as const) : ("inventory" as const);
    const status = page.isDone && anomalies > 0 ? ("failed" as const) : ("running" as const);
    const cursor = page.isDone ? null : page.continueCursor;
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      checkpoint: maximumObserved,
      cursor,
      legacyRemaining:
        page.isDone && inventoryRequiresFollowUp(anomalies, sequence, trust, maximumObserved)
          ? 1
          : 0,
      processed,
      quarantined: anomalies,
      stage,
      status,
      updatedAt: now,
    });
    return {
      ...targetResult(target),
      anomalies,
      applied: false,
      cursor,
      key,
      maximumObserved,
      processed,
      processedThisPage: page.processed,
      sequenceLastAllocated: sequence?.lastAllocated ?? null,
      stage,
      status,
      tableName: args.tableName,
    };
  },
  returns: resultValidator,
});

export const applyCrmCodeSequenceSeed = internalMutation({
  args: { ...targetBoundMigrationArgs, tableName: codeTableValidator },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const [registry, sequence, trust] = await Promise.all([
      migrationRegistry(ctx, migrationKey(args.tableName, target)),
      currentSequence(ctx, args.tableName),
      currentTrust(ctx, args.tableName),
    ]);
    if ((registry?.quarantined ?? 0) > 0) {
      throw new ConvexError("CRM code sequence inventory found malformed or duplicate codes");
    }
    if (!registry) {
      throw new ConvexError("Complete CRM code sequence inventory before apply");
    }
    if (registry.stage === "complete" && registry.status === "verified") {
      const settled = settledResult(args.tableName, registry, sequence, trust, target);
      if (settled.stage === "complete") {
        return settled;
      }
      throw new ConvexError("Re-inventory CRM code sequence allocator drift before apply");
    }
    if (!(registry.stage === "ready" && registry.status === "running")) {
      throw new ConvexError("Complete CRM code sequence inventory before apply");
    }
    const checkpoint = registry.checkpoint ?? 0;
    if (!Number.isSafeInteger(checkpoint) || checkpoint < 0) {
      throw new ConvexError("CRM code sequence inventory checkpoint is invalid");
    }
    const maximumObserved = Math.max(checkpoint, allocatorFloor(sequence, trust));
    const now = Date.now();
    const config = CRM_CODE_CONFIG_BY_TABLE[args.tableName];
    const applied =
      !sequence ||
      sequence.lastAllocated !== maximumObserved ||
      !trust ||
      trust.lastAllocated !== maximumObserved ||
      trust.reconciliationRequired;
    if (!sequence) {
      await ctx.db.insert("crmCodeSequences", {
        key: config.key,
        lastAllocated: maximumObserved,
        legacyRowsScanned: registry.processed,
        seededAt: now,
        updatedAt: now,
      });
    } else if (sequence.lastAllocated !== maximumObserved) {
      await ctx.db.patch("crmCodeSequences", sequence._id, {
        lastAllocated: maximumObserved,
        updatedAt: now,
      });
    }
    if (trust) {
      await ctx.db.patch("crmCodeSequenceTrust", trust._id, {
        lastAllocated: maximumObserved,
        reconciliationRequired: false,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("crmCodeSequenceTrust", {
        activatedAt: now,
        key: config.key,
        lastAllocated: maximumObserved,
        reconciliationRequired: false,
        updatedAt: now,
        version: CRM_CODE_SEQUENCE_SEED_MIGRATION_VERSION,
      });
    }
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      checkpoint: maximumObserved,
      converted: Math.max(registry.converted, applied ? 1 : 0),
      cursor: null,
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
      updatedAt: now,
      verifiedAt: now,
    });
    return {
      ...targetResult(target),
      anomalies: 0,
      applied,
      cursor: null,
      key: registry.key,
      maximumObserved,
      processed: registry.processed,
      processedThisPage: 0,
      sequenceLastAllocated: maximumObserved,
      stage: "complete" as const,
      status: "verified" as const,
      tableName: args.tableName,
    };
  },
  returns: resultValidator,
});
