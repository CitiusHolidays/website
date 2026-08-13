import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id, TableNames } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { authorizedCustomerIdentityIds } from "../../lib/customerIdentityAccess";

type InsertValue<TableName extends TableNames> = WithoutSystemFields<Doc<TableName>>;
type PatchValue<TableName extends TableNames> = Partial<InsertValue<TableName>>;

const runCache = new WeakMap<object, Promise<Id<"e2eRuns"> | null>>();
const ownershipQueue = new WeakMap<object, Promise<void>>();
const STORAGE_ID_KEY_PATTERN = /storageId$/i;

export const E2E_CLEANUP_TABLE_ORDER = {
  activityLogs: 100,
  approvalRequests: 90,
  checklistTasks: 90,
  clients: 20,
  commandReceipts: 100,
  confirmedOffers: 90,
  contractingAssignments: 90,
  expenseEntries: 50,
  jobCards: 50,
  notificationReads: 100,
  notifications: 100,
  passengerExportOperations: 90,
  passengerExportSourceChunks: 100,
  proposalQueryHandoffs: 95,
  proposalQueryLinks: 90,
  proposals: 50,
  queries: 30,
  queryAttachments: 90,
  queryCommercialProjectionWorkers: 95,
  staffLeaveBalances: 90,
  staffLeaveLedger: 90,
  staffLeaveRecords: 50,
  tickets: 70,
  travellers: 70,
  visaRecords: 90,
} as const satisfies Partial<Record<TableNames, number>>;

export type E2eCleanupTableName = keyof typeof E2E_CLEANUP_TABLE_ORDER;

function cleanupOrder(tableName: TableNames) {
  const order = E2E_CLEANUP_TABLE_ORDER[tableName as E2eCleanupTableName];
  if (order === undefined) {
    throw new Error(`E2E-owned table ${tableName} has no reviewed cleanup strategy`);
  }
  return order;
}

function collectStorageIds(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [] as Id<"_storage">[];
  }
  return Object.entries(value)
    .filter(([key, candidate]) => STORAGE_ID_KEY_PATTERN.test(key) && typeof candidate === "string")
    .map(([, candidate]) => candidate as Id<"_storage">);
}

async function resolveActiveRun(ctx: MutationCtx) {
  const identity = await ctx.auth?.getUserIdentity?.();
  if (!(identity && String(identity.email ?? "").endsWith("@citius-e2e.test"))) {
    return null;
  }
  const identityIds = await authorizedCustomerIdentityIds(ctx, identity);
  const actors = await Promise.all(
    identityIds.map((authUserId) =>
      ctx.db
        .query("e2eRunActors")
        .withIndex("by_authUserId_status", (q) =>
          q.eq("authUserId", authUserId).eq("status", "active")
        )
        .unique()
    )
  );
  const actor = actors.find(Boolean);
  if (!actor) {
    return null;
  }
  const run = await ctx.db
    .query("e2eRuns")
    .withIndex("by_runId", (q) => q.eq("runId", actor.runId))
    .unique();
  return run?.status === "active" ? run._id : null;
}

function activeRun(ctx: MutationCtx) {
  const cached = runCache.get(ctx);
  if (cached) {
    return cached;
  }
  const resolved = resolveActiveRun(ctx);
  runCache.set(ctx, resolved);
  return resolved;
}

export async function hasActiveE2eRun(ctx: MutationCtx) {
  return (await activeRun(ctx)) !== null;
}

function recordOwnership<TableName extends TableNames>(
  ctx: MutationCtx,
  runId: Id<"e2eRuns">,
  tableName: TableName,
  documentId: Id<TableName>,
  value: InsertValue<TableName>
) {
  const previous = ownershipQueue.get(ctx) ?? Promise.resolve();
  const next = previous.then(async () => {
    const run = await ctx.db.get("e2eRuns", runId);
    if (run?.status !== "active") {
      return;
    }
    await ctx.db.insert("e2eOwnedRecords", {
      cleanupOrder: cleanupOrder(tableName),
      createdAt: Date.now(),
      documentId: String(documentId),
      runId: run.runId,
      storageIds: collectStorageIds(value),
      tableName,
    });
    await ctx.db.patch("e2eRuns", runId, {
      ownedCount: run.ownedCount + 1,
      updatedAt: Date.now(),
    });
  });
  ownershipQueue.set(ctx, next);
  return next;
}

function withoutSystemFields<TableName extends TableNames>(document: Doc<TableName>) {
  const { _creationTime: _ignoredCreationTime, _id: _ignoredId, ...value } = document;
  return value as InsertValue<TableName>;
}

async function runDocument(ctx: MutationCtx, runId: string) {
  const run = await ctx.db
    .query("e2eRuns")
    .withIndex("by_runId", (q) => q.eq("runId", runId))
    .unique();
  if (run?.status !== "active") {
    throw new Error("E2E ownership run is not active");
  }
  return run;
}

function recordOriginalValue<TableName extends TableNames>(
  ctx: MutationCtx,
  runId: Id<"e2eRuns">,
  tableName: TableName,
  documentId: Id<TableName>,
  document: Doc<TableName>
) {
  const previous = ownershipQueue.get(ctx) ?? Promise.resolve();
  const next = previous.then(async () => {
    const run = await ctx.db.get("e2eRuns", runId);
    if (run?.status !== "active") {
      return;
    }
    const documentIdString = String(documentId);
    const [owned, existingSnapshot] = await Promise.all([
      ctx.db
        .query("e2eOwnedRecords")
        .withIndex("by_runId_tableName_documentId", (q) =>
          q.eq("runId", run.runId).eq("tableName", tableName).eq("documentId", documentIdString)
        )
        .unique(),
      ctx.db
        .query("e2eMutatedRecords")
        .withIndex("by_runId_tableName_documentId", (q) =>
          q.eq("runId", run.runId).eq("tableName", tableName).eq("documentId", documentIdString)
        )
        .unique(),
    ]);
    if (owned || existingSnapshot) {
      return;
    }
    await ctx.db.insert("e2eMutatedRecords", {
      createdAt: Date.now(),
      documentId: documentIdString,
      originalValue: withoutSystemFields(document),
      runId: run.runId,
      tableName,
    });
    await ctx.db.patch("e2eRuns", runId, {
      mutatedCount: run.mutatedCount + 1,
      updatedAt: Date.now(),
    });
  });
  ownershipQueue.set(ctx, next);
  return next;
}

async function recordPatchedStorageIds<TableName extends TableNames>(
  ctx: MutationCtx,
  runId: Id<"e2eRuns">,
  tableName: TableName,
  documentId: Id<TableName>,
  value: PatchValue<TableName>
) {
  const storageIds = collectStorageIds(value);
  if (storageIds.length === 0) {
    return;
  }
  const run = await ctx.db.get("e2eRuns", runId);
  if (!run) {
    return;
  }
  const owned = await ctx.db
    .query("e2eOwnedRecords")
    .withIndex("by_runId_tableName_documentId", (q) =>
      q.eq("runId", run.runId).eq("tableName", tableName).eq("documentId", String(documentId))
    )
    .unique();
  if (owned) {
    await ctx.db.patch("e2eOwnedRecords", owned._id, {
      storageIds: Array.from(new Set([...owned.storageIds, ...storageIds])),
    });
  }
}

/**
 * Atomically records inserts made by an authenticated E2E actor. Production
 * users and internal workers take the ordinary insert path with no ledger IO.
 */
export async function insertWithE2eOwnership<TableName extends TableNames>(
  ctx: MutationCtx,
  tableName: TableName,
  value: InsertValue<TableName>
) {
  const documentId = await ctx.db.insert(tableName, value);
  const runId = await activeRun(ctx);
  if (!runId) {
    return documentId;
  }
  await recordOwnership(ctx, runId, tableName, documentId, value);
  return documentId;
}

export async function patchWithE2eOwnership<TableName extends TableNames>(
  ctx: MutationCtx,
  tableName: TableName,
  documentId: Id<TableName>,
  value: PatchValue<TableName>
) {
  const [runId, document] = await Promise.all([activeRun(ctx), ctx.db.get(tableName, documentId)]);
  if (runId && document) {
    await recordOriginalValue(ctx, runId, tableName, documentId, document);
    await recordPatchedStorageIds(ctx, runId, tableName, documentId, value);
  }
  // Convex's distributive generic loses the TableName relationship inside this
  // wrapper; callers retain the table-specific PatchValue contract above.
  await ctx.db.patch(tableName, documentId, value as never);
}

export async function insertE2eFixtureWithOwnership<TableName extends TableNames>(
  ctx: MutationCtx,
  runId: string,
  tableName: TableName,
  value: InsertValue<TableName>
) {
  const run = await runDocument(ctx, runId);
  const documentId = await ctx.db.insert(tableName, value);
  await recordOwnership(ctx, run._id, tableName, documentId, value);
  return documentId;
}

export async function patchE2eFixtureWithOwnership<TableName extends TableNames>(
  ctx: MutationCtx,
  runId: string,
  tableName: TableName,
  documentId: Id<TableName>,
  value: PatchValue<TableName>
) {
  const [run, document] = await Promise.all([
    runDocument(ctx, runId),
    ctx.db.get(tableName, documentId),
  ]);
  if (!document) {
    throw new Error(`E2E fixture ${tableName}/${documentId} no longer exists`);
  }
  await recordOriginalValue(ctx, run._id, tableName, documentId, document);
  await ctx.db.patch(tableName, documentId, value as never);
}
