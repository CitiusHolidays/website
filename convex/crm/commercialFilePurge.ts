import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import { invalidateDocumentPreviewSource } from "./documentPreviewLifecycle";

export const COMMERCIAL_FILE_PURGE_PAGE_SIZE = 10;
const COMMERCIAL_FILE_PURGE_LEASE_MS = 5 * 60 * 1000;
const COMMERCIAL_FILE_PURGE_KEY = "commercialFiles" as const;

const purgeStageValidator = v.union(v.literal("upload_sessions"), v.literal("deleted_files"));
const purgeStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("completed_with_failures"),
  v.literal("failed")
);

export const purgeRunResultValidator = v.object({
  continuation: v.number(),
  failedFiles: v.number(),
  failedSessions: v.number(),
  generation: v.number(),
  processedFiles: v.number(),
  processedSessions: v.number(),
  purgedFiles: v.number(),
  purgedSessions: v.number(),
  runId: v.id("commercialFilePurgeRuns"),
  scheduled: v.boolean(),
  stage: purgeStageValidator,
  status: purgeStatusValidator,
});

async function hasStorageReference(ctx: MutationCtx, storageId: Id<"_storage">) {
  const storageKey = String(storageId);
  const [commercial, queryAttachment, proposalAttachment, passport, generic, proposalPdf] =
    await Promise.all([
      ctx.db
        .query("commercialFiles" as const)
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("proposalAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("passportDetails")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("attachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageKey))
        .first(),
      ctx.db
        .query("proposals")
        .withIndex("by_finalizedPdfStorageId", (q) => q.eq("finalizedPdfStorageId", storageId))
        .first(),
    ]);
  return Boolean(
    commercial || queryAttachment || proposalAttachment || passport || generic || proposalPdf
  );
}

export async function purgeStorageRecord(dependencies: {
  deleteMetadata: () => Promise<void>;
  deleteStorage: () => Promise<void>;
  hasStorage: boolean;
  isReferenced: () => Promise<boolean>;
}) {
  if (!dependencies.hasStorage || (await dependencies.isReferenced())) {
    await dependencies.deleteMetadata();
    return { failureCode: null, purged: true, storageDeleted: false } as const;
  }
  try {
    await dependencies.deleteStorage();
  } catch {
    return {
      failureCode: "storage_delete_failed",
      purged: false,
      storageDeleted: false,
    } as const;
  }
  await dependencies.deleteMetadata();
  return { failureCode: null, purged: true, storageDeleted: true } as const;
}

async function hasOtherStorageReference(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  commercialFileId: Id<"commercialFiles">
) {
  const storageKey = String(storageId);
  const [commercial, queryAttachment, proposalAttachment, passport, generic, proposalPdf] =
    await Promise.all([
      ctx.db
        .query("commercialFiles")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .take(2),
      ctx.db
        .query("queryAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("proposalAttachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("passportDetails")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first(),
      ctx.db
        .query("attachments")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageKey))
        .first(),
      ctx.db
        .query("proposals")
        .withIndex("by_finalizedPdfStorageId", (q) => q.eq("finalizedPdfStorageId", storageId))
        .first(),
    ]);
  return Boolean(
    commercial.some((row) => row._id !== commercialFileId) ||
      queryAttachment ||
      proposalAttachment ||
      passport ||
      generic ||
      proposalPdf
  );
}

type CommercialFilePurgeRun = Doc<"commercialFilePurgeRuns">;

function purgeRunResult(run: CommercialFilePurgeRun, scheduled: boolean) {
  return {
    continuation: run.continuation,
    failedFiles: run.failedFiles,
    failedSessions: run.failedSessions,
    generation: run.generation,
    processedFiles: run.processedFiles,
    processedSessions: run.processedSessions,
    purgedFiles: run.purgedFiles,
    purgedSessions: run.purgedSessions,
    runId: run._id,
    scheduled,
    stage: run.stage,
    status: run.status,
  };
}

async function writePurgePageAudit(
  ctx: MutationCtx,
  args: {
    failedFileRows: Array<{ failureCode: string; row: Doc<"commercialFiles"> }>;
    failedSessionIds: string[];
    purgedFileRows: Doc<"commercialFiles">[];
    purgedSessions: number;
    runId: Id<"commercialFilePurgeRuns">;
    stage: CommercialFilePurgeRun["stage"];
  }
) {
  if (
    args.failedFileRows.length === 0 &&
    args.failedSessionIds.length === 0 &&
    args.purgedFileRows.length === 0 &&
    args.purgedSessions === 0
  ) {
    return;
  }
  const now = Date.now();
  await ctx.db.insert("activityLogs", {
    action: "commercial_file_purge_page",
    actorId: "system",
    actorName: "System",
    createdAt: now,
    entityId: String(args.runId),
    entityType: "commercialFiles",
    message: `Commercial File purge processed a bounded ${args.stage} page`,
    metadata: {
      failedFiles: args.failedFileRows.map(({ failureCode, row }) => ({
        failureCode,
        fileId: String(row._id),
        sourceId: row.sourceId,
        sourceType: row.sourceType,
      })),
      failedSessionIds: args.failedSessionIds,
      purgedFiles: args.purgedFileRows.map((row) => ({
        category: row.category,
        fileId: String(row._id),
        fileName: row.fileName,
        sourceId: row.sourceId,
        sourceType: row.sourceType,
      })),
      purgedSessions: args.purgedSessions,
      runId: String(args.runId),
      stage: args.stage,
    },
  });
}

async function processUploadSessionPurgePage(ctx: MutationCtx, run: CommercialFilePurgeRun) {
  const page = await ctx.db
    .query("commercialFileUploadSessions")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", run.cutoffAt))
    .paginate({ cursor: run.cursor ?? null, numItems: COMMERCIAL_FILE_PURGE_PAGE_SIZE });
  const failedSessionIds: string[] = [];
  let purgedSessions = 0;
  for (const session of page.page) {
    // biome-ignore lint/performance/noAwaitInLoops: reference checks must observe prior metadata deletion when a page shares storage.
    const result = await purgeStorageRecord({
      deleteMetadata: () =>
        ctx.db.delete("commercialFileUploadSessions", session._id).then(() => undefined),
      deleteStorage: () =>
        session.storageId ? ctx.storage.delete(session.storageId) : Promise.resolve(),
      hasStorage: Boolean(session.storageId),
      isReferenced: () =>
        session.storageId ? hasStorageReference(ctx, session.storageId) : Promise.resolve(false),
    });
    if (result.purged) {
      purgedSessions += 1;
    } else {
      failedSessionIds.push(String(session._id));
    }
  }
  await writePurgePageAudit(ctx, {
    failedFileRows: [],
    failedSessionIds,
    purgedFileRows: [],
    purgedSessions,
    runId: run._id,
    stage: run.stage,
  });
  return {
    failed: failedSessionIds.length,
    isDone: page.isDone,
    nextCursor: page.isDone ? undefined : page.continueCursor,
    processed: page.page.length,
    purged: purgedSessions,
  };
}

async function processDeletedFilePurgePage(ctx: MutationCtx, run: CommercialFilePurgeRun) {
  const page = await ctx.db
    .query("commercialFiles")
    .withIndex("by_purgeAfter", (q) => q.gt("purgeAfter", 0).lt("purgeAfter", run.cutoffAt))
    .paginate({ cursor: run.cursor ?? null, numItems: COMMERCIAL_FILE_PURGE_PAGE_SIZE });
  const failedFileRows: Array<{ failureCode: string; row: Doc<"commercialFiles"> }> = [];
  const purgedFileRows: Doc<"commercialFiles">[] = [];
  for (const row of page.page) {
    if (row.lifecycle !== "deleted") {
      failedFileRows.push({ failureCode: "lifecycle_not_deleted", row });
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: reference checks must observe prior metadata deletion when a page shares storage.
    const result = await purgeStorageRecord({
      deleteMetadata: async () => {
        await invalidateDocumentPreviewSource(ctx, "commercialFile", String(row._id));
        await ctx.db.delete("commercialFiles", row._id);
      },
      deleteStorage: () => ctx.storage.delete(row.storageId),
      hasStorage: true,
      isReferenced: () => hasOtherStorageReference(ctx, row.storageId, row._id),
    });
    if (result.purged) {
      purgedFileRows.push(row);
    } else {
      failedFileRows.push({ failureCode: result.failureCode ?? "storage_delete_failed", row });
    }
  }
  await writePurgePageAudit(ctx, {
    failedFileRows,
    failedSessionIds: [],
    purgedFileRows,
    purgedSessions: 0,
    runId: run._id,
    stage: run.stage,
  });
  return {
    failed: failedFileRows.length,
    isDone: page.isDone,
    nextCursor: page.isDone ? undefined : page.continueCursor,
    processed: page.page.length,
    purged: purgedFileRows.length,
  };
}

interface PurgePageResult {
  failed: number;
  isDone: boolean;
  nextCursor?: string;
  processed: number;
  purged: number;
}

function nextPurgeRunValue(run: CommercialFilePurgeRun, page: PurgePageResult, now: number) {
  const nextStage = run.stage === "upload_sessions" && page.isDone ? "deleted_files" : run.stage;
  const processedSessions =
    run.processedSessions + (run.stage === "upload_sessions" ? page.processed : 0);
  const purgedSessions = run.purgedSessions + (run.stage === "upload_sessions" ? page.purged : 0);
  const failedSessions = run.failedSessions + (run.stage === "upload_sessions" ? page.failed : 0);
  const processedFiles = run.processedFiles + (run.stage === "deleted_files" ? page.processed : 0);
  const purgedFiles = run.purgedFiles + (run.stage === "deleted_files" ? page.purged : 0);
  const failedFiles = run.failedFiles + (run.stage === "deleted_files" ? page.failed : 0);
  const complete = run.stage === "deleted_files" && page.isDone;
  let status: CommercialFilePurgeRun["status"] = "running";
  if (complete) {
    status = failedFiles + failedSessions > 0 ? "completed_with_failures" : "completed";
  }
  return {
    complete,
    value: {
      ...propertiesWhen(complete, () => ({ completedAt: now })),
      continuation: run.continuation + 1,
      cursor: page.isDone ? undefined : page.nextCursor,
      failedFiles,
      failedSessions,
      leaseExpiresAt: now + COMMERCIAL_FILE_PURGE_LEASE_MS,
      processedFiles,
      processedSessions,
      purgedFiles,
      purgedSessions,
      stage: nextStage,
      startedAt: run.startedAt ?? now,
      status,
      updatedAt: now,
    },
  };
}

export async function continuePurgeExpiredHandler(
  ctx: MutationCtx,
  args: { continuation: number; runId: Id<"commercialFilePurgeRuns"> }
) {
  const run = await ctx.db.get("commercialFilePurgeRuns", args.runId);
  if (!run) {
    throw new ConvexError("Commercial File purge run not found");
  }
  if (
    run.continuation !== args.continuation ||
    !(run.status === "queued" || run.status === "running")
  ) {
    return purgeRunResult(run, false);
  }
  const now = Date.now();
  const page =
    run.stage === "upload_sessions"
      ? await processUploadSessionPurgePage(ctx, run)
      : await processDeletedFilePurgePage(ctx, run);
  const { complete, value } = nextPurgeRunValue(run, page, now);
  await ctx.db.patch("commercialFilePurgeRuns", run._id, value);
  const updated = { ...run, ...value };
  if (!complete) {
    await ctx.scheduler.runAfter(0, internal.crm.commercialFiles.continuePurgeExpired, {
      continuation: value.continuation,
      runId: run._id,
    });
  }
  return purgeRunResult(updated, !complete);
}

export async function purgeExpiredHandler(ctx: MutationCtx) {
  const now = Date.now();
  const state = await ctx.db
    .query("commercialFilePurgeState")
    .withIndex("by_key", (q) => q.eq("key", COMMERCIAL_FILE_PURGE_KEY))
    .unique();
  const activeRun = state?.activeRunId
    ? await ctx.db.get("commercialFilePurgeRuns", state.activeRunId)
    : null;
  if (
    activeRun &&
    (activeRun.status === "queued" || activeRun.status === "running") &&
    activeRun.leaseExpiresAt > now
  ) {
    return purgeRunResult(activeRun, false);
  }
  if (
    activeRun &&
    (activeRun.status === "queued" || activeRun.status === "running") &&
    activeRun.leaseExpiresAt <= now
  ) {
    await ctx.db.patch("commercialFilePurgeRuns", activeRun._id, {
      completedAt: now,
      failureCode: "lease_expired",
      status: "failed",
      updatedAt: now,
    });
  }
  const generation = (state?.generation ?? 0) + 1;
  const runId = await ctx.db.insert("commercialFilePurgeRuns", {
    continuation: 0,
    createdAt: now,
    cutoffAt: now,
    failedFiles: 0,
    failedSessions: 0,
    generation,
    key: COMMERCIAL_FILE_PURGE_KEY,
    leaseExpiresAt: now + COMMERCIAL_FILE_PURGE_LEASE_MS,
    processedFiles: 0,
    processedSessions: 0,
    purgedFiles: 0,
    purgedSessions: 0,
    stage: "upload_sessions",
    status: "queued",
    updatedAt: now,
  });
  if (state) {
    await ctx.db.patch("commercialFilePurgeState", state._id, {
      activeRunId: runId,
      generation,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("commercialFilePurgeState", {
      activeRunId: runId,
      generation,
      key: COMMERCIAL_FILE_PURGE_KEY,
      updatedAt: now,
    });
  }
  await ctx.scheduler.runAfter(0, internal.crm.commercialFiles.continuePurgeExpired, {
    continuation: 0,
    runId,
  });
  const run = await ctx.db.get("commercialFilePurgeRuns", runId);
  if (!run) {
    throw new ConvexError("Commercial File purge run was not created");
  }
  return purgeRunResult(run, true);
}

export async function getPurgeStatusHandler(ctx: QueryCtx) {
  const state = await ctx.db
    .query("commercialFilePurgeState")
    .withIndex("by_key", (q) => q.eq("key", COMMERCIAL_FILE_PURGE_KEY))
    .unique();
  if (!state?.activeRunId) {
    return null;
  }
  const run = await ctx.db.get("commercialFilePurgeRuns", state.activeRunId);
  return run ? purgeRunResult(run, false) : null;
}
