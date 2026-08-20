import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "../_generated/server";
import {
  canRetryDocumentPreview,
  classifyDocumentPreview,
  type DocumentPreviewErrorCode,
  type DocumentPreviewSourceType,
  type DocumentPreviewStatusResult,
  documentPreviewErrorCodeValidator,
  documentPreviewKindValidator,
  documentPreviewOperationKindValidator,
  documentPreviewSizeBand,
  documentPreviewSourceTypeValidator,
  documentPreviewStatusResultValidator,
  isNativeDocumentPreview,
  isOfficeDocumentPreview,
  normalizeDocumentPreviewWarnings,
} from "./documentPreviewContract";
import { invalidateDocumentPreviewSource } from "./documentPreviewLifecycle";
import {
  assertDocumentPreviewRolloutAllowed,
  documentPreviewRolloutStage,
  isDocumentPreviewRolloutAllowed,
} from "./documentPreviewRollout";
import {
  authorizeDocumentPreviewSource,
  type DocumentPreviewSourceRecord,
  resolveAuthorizedDocumentPreviewSource,
  resolveSystemDocumentPreviewSource,
} from "./documentPreviewSource";
import { requireStaff } from "./lib";
import { recordOperationalEffect, resolveOperationalControl } from "./lib/operationalControls";

const PREPARATION_LEASE_MS = 5 * 60 * 1000;
const PREPARATION_CLAIM_SCAN_LIMIT = 20;
const WARM_PAGE_SIZE = 25;
const MAX_AUTOMATIC_ATTEMPTS = 3;
const MAX_PREVIEW_ARTIFACT_BYTES = 30 * 1024 * 1024;
const DELIVERY_TTL_MS = 2 * 60 * 1000;
const WARM_KEY = "activeCommercialDocuments" as const;

interface WarmPageResult {
  continueCursor: string;
  isDone: boolean;
  processed: number;
}

const continueWarmActiveSourcesRef = makeFunctionReference<
  "mutation",
  { continuation: number; runId: Id<"documentPreviewWarmRuns"> },
  null
>("crm/documentPreview:continueWarmActiveSources");
const expireDeliveryRef = makeFunctionReference<
  "mutation",
  { deliveryId: Id<"documentPreviewDeliveries"> },
  null
>("crm/documentPreview:expireDelivery");

const deliveryClaimValidator = v.union(
  v.null(),
  v.object({
    deliveryId: v.id("documentPreviewDeliveries"),
    encrypted: v.boolean(),
    expectedSourceStorageId: v.id("_storage"),
    fileName: v.string(),
    generation: v.number(),
    mimeType: v.string(),
    previewKind: documentPreviewKindValidator,
    servingArtifact: v.boolean(),
    sourceId: v.string(),
    sourceType: documentPreviewSourceTypeValidator,
    storageId: v.id("_storage"),
    warningCodes: v.array(v.string()),
  })
);

const nullableAuthorizedFileStateValidator = v.union(
  v.null(),
  v.object({
    artifactMimeType: v.optional(v.string()),
    artifactStorageId: v.optional(v.id("_storage")),
    canRetry: v.boolean(),
    encrypted: v.boolean(),
    errorCode: v.optional(documentPreviewErrorCodeValidator),
    fileName: v.string(),
    generation: v.number(),
    mimeType: v.string(),
    previewKind: documentPreviewKindValidator,
    sourceStorageId: v.id("_storage"),
    status: v.union(v.literal("preparing"), v.literal("ready"), v.literal("unavailable")),
    warningCodes: v.array(v.string()),
  })
);

const claimedSourceValidator = v.union(
  v.null(),
  v.object({
    encrypted: v.boolean(),
    fileName: v.string(),
    generation: v.number(),
    mimeType: v.string(),
    operationId: v.id("documentPreviewOperations"),
    previewKind: documentPreviewOperationKindValidator,
    sourceStorageId: v.id("_storage"),
  })
);

function operationForSource(
  ctx: QueryCtx | MutationCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  return ctx.db
    .query("documentPreviewOperations")
    .withIndex("by_sourceType_and_sourceId", (q) =>
      q.eq("sourceType", sourceType).eq("sourceId", sourceId)
    )
    .unique();
}

function unavailableStatus(
  source: DocumentPreviewSourceRecord,
  previewKind: ReturnType<typeof classifyDocumentPreview>,
  generation: number,
  errorCode: DocumentPreviewErrorCode,
  warningCodes: string[] = []
): DocumentPreviewStatusResult {
  return {
    canRetry: canRetryDocumentPreview(errorCode),
    errorCode,
    fileName: source.fileName,
    generation,
    mimeType: source.mimeType,
    pageCount: null,
    previewKind,
    sheetCount: null,
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    status: "unavailable",
    warningCodes,
  };
}

function statusForSource(
  source: DocumentPreviewSourceRecord,
  operation: Doc<"documentPreviewOperations"> | null
): DocumentPreviewStatusResult {
  const previewKind = classifyDocumentPreview(source.fileName, source.mimeType);
  if (isNativeDocumentPreview(previewKind)) {
    return {
      canRetry: false,
      errorCode: null,
      fileName: source.fileName,
      generation: 0,
      mimeType: source.mimeType,
      pageCount: null,
      previewKind,
      sheetCount: null,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      status: "ready",
      warningCodes: [],
    };
  }
  if (!isOfficeDocumentPreview(previewKind)) {
    return unavailableStatus(source, previewKind, 0, "unsupported_format");
  }
  const current = operation && String(operation.sourceStorageId) === String(source.storageId);
  if (!current) {
    return {
      canRetry: false,
      errorCode: null,
      fileName: source.fileName,
      generation: (operation?.generation ?? 0) + 1,
      mimeType: source.mimeType,
      pageCount: null,
      previewKind,
      sheetCount: null,
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      status: "preparing",
      warningCodes: [],
    };
  }
  if (operation.status === "unavailable") {
    return unavailableStatus(
      source,
      previewKind,
      operation.generation,
      operation.errorCode ?? "conversion_failed",
      operation.warningCodes
    );
  }
  return {
    canRetry: false,
    errorCode: null,
    fileName: source.fileName,
    generation: operation.generation,
    mimeType: source.mimeType,
    pageCount: operation.pageCount ?? null,
    previewKind,
    sheetCount: operation.sheetCount ?? null,
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    status: operation.status,
    warningCodes: operation.warningCodes,
  };
}

async function ensurePreparation(
  ctx: MutationCtx,
  source: DocumentPreviewSourceRecord,
  retryUnavailable: boolean
) {
  const previewKind = classifyDocumentPreview(source.fileName, source.mimeType);
  if (!isOfficeDocumentPreview(previewKind)) {
    return null;
  }
  const existing = await operationForSource(ctx, source.sourceType, source.sourceId);
  const now = Date.now();
  const sourceChanged =
    Boolean(existing) && String(existing?.sourceStorageId) !== String(source.storageId);
  const retryingUnavailable = Boolean(
    existing?.status === "unavailable" &&
      retryUnavailable &&
      canRetryDocumentPreview(existing.errorCode)
  );
  const needsPreparation = !existing || sourceChanged || retryingUnavailable;
  if (needsPreparation) {
    const control = await resolveOperationalControl(ctx, "files.document_preview_preparation", {
      at: now,
    });
    const disposition = control.enabled ? "queued" : "suppressed";
    await recordOperationalEffect(ctx, {
      control,
      disposition,
      effectId: `document-preview:${source.sourceType}:${source.sourceId}:${String(source.storageId)}:${disposition}`,
      entityId: source.sourceId,
      entityType: source.sourceType,
    });
    if (!control.enabled) {
      return existing;
    }
  }
  if (!existing) {
    const id = await ctx.db.insert("documentPreviewOperations", {
      attemptCount: 0,
      createdAt: now,
      generation: 1,
      previewKind,
      sourceId: source.sourceId,
      sourceMimeType: source.mimeType,
      sourceSize: source.fileSize,
      sourceStorageId: source.storageId,
      sourceType: source.sourceType,
      status: "preparing",
      updatedAt: now,
      warningCodes: [],
    });
    return await ctx.db.get("documentPreviewOperations", id);
  }
  if (String(existing.sourceStorageId) !== String(source.storageId)) {
    const oldArtifactId = existing.artifactStorageId;
    await ctx.db.patch("documentPreviewOperations", existing._id, {
      artifactMimeType: undefined,
      artifactStorageId: undefined,
      attemptCount: 0,
      durationMs: undefined,
      errorCode: undefined,
      generation: existing.generation + 1,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      pageCount: undefined,
      previewKind,
      sheetCount: undefined,
      sourceMimeType: source.mimeType,
      sourceSize: source.fileSize,
      sourceStorageId: source.storageId,
      status: "preparing",
      updatedAt: now,
      warningCodes: [],
    });
    if (oldArtifactId) {
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { storageId: Id<"_storage"> }, { deleted: boolean }>(
          "crm/storageReferences:deleteIfUnreferenced"
        ),
        { storageId: oldArtifactId }
      );
    }
    return await ctx.db.get("documentPreviewOperations", existing._id);
  }
  if (
    existing.status === "unavailable" &&
    retryUnavailable &&
    canRetryDocumentPreview(existing.errorCode)
  ) {
    await ctx.db.patch("documentPreviewOperations", existing._id, {
      errorCode: undefined,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      status: "preparing",
      updatedAt: now,
      warningCodes: [],
    });
    return await ctx.db.get("documentPreviewOperations", existing._id);
  }
  return existing;
}

async function prepareSystemSource(
  ctx: MutationCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  const source = await resolveSystemDocumentPreviewSource(ctx, sourceType, sourceId);
  if (!source) {
    await invalidateDocumentPreviewSource(ctx, sourceType, sourceId);
    return false;
  }
  if (
    !isDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    )
  ) {
    return false;
  }
  return Boolean(await ensurePreparation(ctx, source, false));
}

export const getStatus = query({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await resolveAuthorizedDocumentPreviewSource(
      ctx,
      args.sourceType,
      args.sourceId
    );
    assertDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    );
    const operation = await operationForSource(ctx, args.sourceType, args.sourceId);
    return statusForSource(source, operation);
  },
  returns: documentPreviewStatusResultValidator,
});

export const retry = mutation({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await resolveAuthorizedDocumentPreviewSource(
      ctx,
      args.sourceType,
      args.sourceId
    );
    assertDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    );
    const operation = await ensurePreparation(ctx, source, true);
    return statusForSource(source, operation);
  },
  returns: documentPreviewStatusResultValidator,
});

export const requestPreparation = internalMutation({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await resolveAuthorizedDocumentPreviewSource(
      ctx,
      args.sourceType,
      args.sourceId
    );
    assertDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    );
    const operation = await ensurePreparation(ctx, source, false);
    return statusForSource(source, operation);
  },
  returns: documentPreviewStatusResultValidator,
});

export const recoverMissingArtifact = internalMutation({
  args: {
    expectedArtifactStorageId: v.id("_storage"),
    sourceId: v.string(),
    sourceType: documentPreviewSourceTypeValidator,
  },
  handler: async (ctx, args) => {
    const source = await resolveAuthorizedDocumentPreviewSource(
      ctx,
      args.sourceType,
      args.sourceId
    );
    assertDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    );
    const operation = await operationForSource(ctx, args.sourceType, args.sourceId);
    if (
      operation?.status === "ready" &&
      String(operation.sourceStorageId) === String(source.storageId) &&
      String(operation.artifactStorageId ?? "") === String(args.expectedArtifactStorageId)
    ) {
      await ctx.db.patch("documentPreviewOperations", operation._id, {
        artifactMimeType: undefined,
        artifactStorageId: undefined,
        attemptCount: 0,
        durationMs: undefined,
        errorCode: undefined,
        leaseExpiresAt: undefined,
        leaseId: undefined,
        pageCount: undefined,
        sheetCount: undefined,
        status: "preparing",
        updatedAt: Date.now(),
        warningCodes: [],
      });
    }
    return null;
  },
  returns: v.null(),
});

export const prepareUploadedSource = internalMutation({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args) => {
    await prepareSystemSource(ctx, args.sourceType, args.sourceId);
    return null;
  },
  returns: v.null(),
});

export const invalidateSourceBatch = internalMutation({
  args: {
    sourceIds: v.array(v.string()),
    sourceType: v.union(
      v.literal("commercialFile"),
      v.literal("proposalAttachment"),
      v.literal("queryAttachment")
    ),
  },
  handler: async (ctx, args) => {
    if (args.sourceIds.length > 25) {
      throw new ConvexError("Document preview invalidation batch exceeds 25 sources");
    }
    await Promise.all(
      args.sourceIds.map((sourceId) =>
        invalidateDocumentPreviewSource(ctx, args.sourceType, sourceId)
      )
    );
    return null;
  },
  returns: v.null(),
});

export const getAuthorizedFileState = internalQuery({
  args: { sourceId: v.string(), sourceType: documentPreviewSourceTypeValidator },
  handler: async (ctx, args) => {
    const source = await resolveAuthorizedDocumentPreviewSource(
      ctx,
      args.sourceType,
      args.sourceId
    );
    assertDocumentPreviewRolloutAllowed(
      source.sourceType,
      classifyDocumentPreview(source.fileName, source.mimeType)
    );
    const operation = await operationForSource(ctx, args.sourceType, args.sourceId);
    const status = statusForSource(source, operation);
    const currentOperation =
      operation && String(operation.sourceStorageId) === String(source.storageId)
        ? operation
        : null;
    return {
      artifactMimeType: currentOperation?.artifactMimeType,
      artifactStorageId: currentOperation?.artifactStorageId,
      canRetry: status.canRetry,
      encrypted: source.encrypted,
      errorCode: status.errorCode ?? undefined,
      fileName: source.fileName,
      generation: status.generation,
      mimeType: source.mimeType,
      previewKind: status.previewKind,
      sourceStorageId: source.storageId,
      status: status.status,
      warningCodes: status.warningCodes,
    };
  },
  returns: nullableAuthorizedFileStateValidator,
});

export const issuePortalDelivery = internalMutation({
  args: {
    deliveryStorageId: v.id("_storage"),
    expectedSourceStorageId: v.id("_storage"),
    generation: v.number(),
    previewKind: documentPreviewKindValidator,
    servingArtifact: v.boolean(),
    sourceId: v.string(),
    sourceType: documentPreviewSourceTypeValidator,
    tokenHash: v.string(),
    warningCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const source = await authorizeDocumentPreviewSource(ctx, args.sourceType, args.sourceId);
    const previewKind = classifyDocumentPreview(source.fileName, source.mimeType);
    assertDocumentPreviewRolloutAllowed(source.sourceType, previewKind);
    if (
      String(source.storageId) !== String(args.expectedSourceStorageId) ||
      previewKind !== args.previewKind
    ) {
      throw new ConvexError("Document source changed while delivery was being prepared");
    }
    if (args.servingArtifact) {
      const operation = await operationForSource(ctx, args.sourceType, args.sourceId);
      if (
        operation?.status !== "ready" ||
        operation.generation !== args.generation ||
        String(operation.sourceStorageId) !== String(source.storageId) ||
        String(operation.artifactStorageId ?? "") !== String(args.deliveryStorageId) ||
        operation.artifactMimeType !== "application/pdf"
      ) {
        throw new ConvexError("Document preview artifact changed before delivery");
      }
    } else if (String(args.deliveryStorageId) !== String(source.storageId)) {
      throw new ConvexError("Document source changed while delivery was being prepared");
    }
    const now = Date.now();
    const expiresAt = now + DELIVERY_TTL_MS;
    const deliveryId = await ctx.db.insert("documentPreviewDeliveries", {
      actorId: access.authUserId ?? access.email,
      createdAt: now,
      deliveryStorageId: args.deliveryStorageId,
      encrypted: !args.servingArtifact && source.encrypted,
      expectedSourceStorageId: source.storageId,
      expiresAt,
      generation: args.generation,
      kind: "portal",
      previewKind,
      servingArtifact: args.servingArtifact,
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      tokenHash: args.tokenHash,
      warningCodes: normalizeDocumentPreviewWarnings(args.warningCodes),
    });
    await ctx.scheduler.runAt(expiresAt, expireDeliveryRef, { deliveryId });
    return { expiresAt };
  },
  returns: v.object({ expiresAt: v.number() }),
});

export const issueWorkerDelivery = internalMutation({
  args: {
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get("documentPreviewOperations", args.operationId);
    if (
      operation?.status !== "preparing" ||
      operation.generation !== args.generation ||
      operation.leaseId !== args.leaseId ||
      !operation.leaseExpiresAt ||
      operation.leaseExpiresAt <= Date.now()
    ) {
      return null;
    }
    const source = await resolveSystemDocumentPreviewSource(
      ctx,
      operation.sourceType,
      operation.sourceId
    );
    if (
      !source ||
      String(source.storageId) !== String(operation.sourceStorageId) ||
      !isDocumentPreviewRolloutAllowed(
        source.sourceType,
        classifyDocumentPreview(source.fileName, source.mimeType)
      )
    ) {
      return null;
    }
    const now = Date.now();
    const expiresAt = Math.min(now + DELIVERY_TTL_MS, operation.leaseExpiresAt);
    const deliveryId = await ctx.db.insert("documentPreviewDeliveries", {
      createdAt: now,
      deliveryStorageId: source.storageId,
      encrypted: source.encrypted,
      expectedSourceStorageId: source.storageId,
      expiresAt,
      generation: operation.generation,
      kind: "worker",
      leaseId: args.leaseId,
      operationId: operation._id,
      previewKind: operation.previewKind,
      servingArtifact: false,
      sourceId: operation.sourceId,
      sourceType: operation.sourceType,
      tokenHash: args.tokenHash,
      warningCodes: [],
    });
    await ctx.scheduler.runAt(expiresAt, expireDeliveryRef, { deliveryId });
    return {
      expiresAt,
      fileName: source.fileName,
      generation: operation.generation,
      mimeType: source.mimeType,
      operationId: operation._id,
      previewKind: operation.previewKind,
    };
  },
  returns: v.union(
    v.null(),
    v.object({
      expiresAt: v.number(),
      fileName: v.string(),
      generation: v.number(),
      mimeType: v.string(),
      operationId: v.id("documentPreviewOperations"),
      previewKind: documentPreviewOperationKindValidator,
    })
  ),
});

export const claimPortalDelivery = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const delivery = await ctx.db
      .query("documentPreviewDeliveries")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (
      delivery?.kind !== "portal" ||
      delivery.claimedAt !== undefined ||
      delivery.expiresAt <= Date.now() ||
      delivery.actorId !== (access.authUserId ?? access.email)
    ) {
      return null;
    }
    const source = await authorizeDocumentPreviewSource(
      ctx,
      delivery.sourceType,
      delivery.sourceId
    );
    const previewKind = classifyDocumentPreview(source.fileName, source.mimeType);
    if (
      !isDocumentPreviewRolloutAllowed(source.sourceType, previewKind) ||
      String(source.storageId) !== String(delivery.expectedSourceStorageId) ||
      previewKind !== delivery.previewKind
    ) {
      return null;
    }
    if (delivery.servingArtifact) {
      const operation = await operationForSource(ctx, delivery.sourceType, delivery.sourceId);
      if (
        operation?.status !== "ready" ||
        operation.generation !== delivery.generation ||
        String(operation.sourceStorageId) !== String(source.storageId) ||
        String(operation.artifactStorageId ?? "") !== String(delivery.deliveryStorageId) ||
        operation.artifactMimeType !== "application/pdf"
      ) {
        return null;
      }
    } else if (String(delivery.deliveryStorageId) !== String(source.storageId)) {
      return null;
    }
    await ctx.db.patch("documentPreviewDeliveries", delivery._id, { claimedAt: Date.now() });
    return {
      deliveryId: delivery._id,
      encrypted: delivery.encrypted,
      expectedSourceStorageId: delivery.expectedSourceStorageId,
      fileName: source.fileName,
      generation: delivery.generation,
      mimeType: delivery.servingArtifact ? "application/pdf" : source.mimeType,
      previewKind,
      servingArtifact: delivery.servingArtifact,
      sourceId: delivery.sourceId,
      sourceType: delivery.sourceType,
      storageId: delivery.deliveryStorageId,
      warningCodes: delivery.warningCodes,
    };
  },
  returns: deliveryClaimValidator,
});

export const completePortalDelivery = internalMutation({
  args: { deliveryId: v.id("documentPreviewDeliveries") },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const delivery = await ctx.db.get("documentPreviewDeliveries", args.deliveryId);
    if (
      delivery?.kind !== "portal" ||
      delivery.claimedAt === undefined ||
      delivery.expiresAt <= Date.now() ||
      delivery.actorId !== (access.authUserId ?? access.email)
    ) {
      return false;
    }
    const source = await authorizeDocumentPreviewSource(
      ctx,
      delivery.sourceType,
      delivery.sourceId
    );
    const previewKind = classifyDocumentPreview(source.fileName, source.mimeType);
    if (
      !isDocumentPreviewRolloutAllowed(source.sourceType, previewKind) ||
      String(source.storageId) !== String(delivery.expectedSourceStorageId) ||
      previewKind !== delivery.previewKind
    ) {
      await ctx.db.delete("documentPreviewDeliveries", delivery._id);
      return false;
    }
    if (delivery.servingArtifact) {
      const operation = await operationForSource(ctx, delivery.sourceType, delivery.sourceId);
      if (
        operation?.status !== "ready" ||
        operation.generation !== delivery.generation ||
        String(operation.sourceStorageId) !== String(source.storageId) ||
        String(operation.artifactStorageId ?? "") !== String(delivery.deliveryStorageId) ||
        operation.artifactMimeType !== "application/pdf"
      ) {
        await ctx.db.delete("documentPreviewDeliveries", delivery._id);
        return false;
      }
    } else if (String(delivery.deliveryStorageId) !== String(source.storageId)) {
      await ctx.db.delete("documentPreviewDeliveries", delivery._id);
      return false;
    }
    await ctx.db.insert("activityLogs", {
      action: "document_preview_opened",
      actorId: access.authUserId ?? access.email,
      actorName: access.name || "Staff user",
      createdAt: Date.now(),
      entityId: delivery.sourceId,
      entityType: delivery.sourceType,
      message: "Document preview opened",
      metadata: { operation: "preview", sourceType: delivery.sourceType },
    });
    await ctx.db.delete("documentPreviewDeliveries", delivery._id);
    return true;
  },
  returns: v.boolean(),
});

export const claimWorkerDelivery = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const delivery = await ctx.db
      .query("documentPreviewDeliveries")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (
      delivery?.kind !== "worker" ||
      delivery.claimedAt !== undefined ||
      delivery.expiresAt <= Date.now() ||
      !delivery.operationId ||
      !delivery.leaseId
    ) {
      return null;
    }
    const operation = await ctx.db.get("documentPreviewOperations", delivery.operationId);
    if (
      operation?.status !== "preparing" ||
      operation.generation !== delivery.generation ||
      operation.leaseId !== delivery.leaseId ||
      !operation.leaseExpiresAt ||
      operation.leaseExpiresAt <= Date.now()
    ) {
      return null;
    }
    const source = await resolveSystemDocumentPreviewSource(
      ctx,
      delivery.sourceType,
      delivery.sourceId
    );
    if (
      !source ||
      String(source.storageId) !== String(delivery.expectedSourceStorageId) ||
      String(source.storageId) !== String(delivery.deliveryStorageId) ||
      !isDocumentPreviewRolloutAllowed(
        source.sourceType,
        classifyDocumentPreview(source.fileName, source.mimeType)
      )
    ) {
      return null;
    }
    await ctx.db.patch("documentPreviewDeliveries", delivery._id, { claimedAt: Date.now() });
    return {
      deliveryId: delivery._id,
      encrypted: delivery.encrypted,
      expectedSourceStorageId: delivery.expectedSourceStorageId,
      fileName: source.fileName,
      generation: delivery.generation,
      mimeType: source.mimeType,
      previewKind: delivery.previewKind,
      servingArtifact: false,
      sourceId: delivery.sourceId,
      sourceType: delivery.sourceType,
      storageId: delivery.deliveryStorageId,
      warningCodes: [],
    };
  },
  returns: deliveryClaimValidator,
});

export const completeWorkerDelivery = internalMutation({
  args: { deliveryId: v.id("documentPreviewDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("documentPreviewDeliveries", args.deliveryId);
    if (
      delivery?.kind !== "worker" ||
      delivery.claimedAt === undefined ||
      delivery.expiresAt <= Date.now() ||
      !delivery.operationId ||
      !delivery.leaseId
    ) {
      return false;
    }
    const operation = await ctx.db.get("documentPreviewOperations", delivery.operationId);
    const source = await resolveSystemDocumentPreviewSource(
      ctx,
      delivery.sourceType,
      delivery.sourceId
    );
    const current = Boolean(
      operation?.status === "preparing" &&
        operation.generation === delivery.generation &&
        operation.leaseId === delivery.leaseId &&
        operation.leaseExpiresAt &&
        operation.leaseExpiresAt > Date.now() &&
        source &&
        String(source.storageId) === String(delivery.expectedSourceStorageId) &&
        isDocumentPreviewRolloutAllowed(
          source.sourceType,
          classifyDocumentPreview(source.fileName, source.mimeType)
        )
    );
    await ctx.db.delete("documentPreviewDeliveries", delivery._id);
    return current;
  },
  returns: v.boolean(),
});

export const expireDelivery = internalMutation({
  args: { deliveryId: v.id("documentPreviewDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("documentPreviewDeliveries", args.deliveryId);
    if (delivery && delivery.expiresAt <= Date.now()) {
      await ctx.db.delete("documentPreviewDeliveries", delivery._id);
    }
    return null;
  },
  returns: v.null(),
});

export const cancelDelivery = internalMutation({
  args: { deliveryId: v.id("documentPreviewDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("documentPreviewDeliveries", args.deliveryId);
    if (delivery) {
      await ctx.db.delete("documentPreviewDeliveries", delivery._id);
    }
    return null;
  },
  returns: v.null(),
});

export const recordCompletedAccess = internalMutation({
  args: {
    expectedSourceStorageId: v.id("_storage"),
    operation: v.union(v.literal("download"), v.literal("preview")),
    sourceId: v.string(),
    sourceType: documentPreviewSourceTypeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    const source = await authorizeDocumentPreviewSource(ctx, args.sourceType, args.sourceId);
    if (args.operation === "preview") {
      assertDocumentPreviewRolloutAllowed(
        source.sourceType,
        classifyDocumentPreview(source.fileName, source.mimeType)
      );
    }
    if (String(source.storageId) !== String(args.expectedSourceStorageId)) {
      throw new ConvexError("Document source changed while it was being read");
    }
    await ctx.db.insert("activityLogs", {
      action: args.operation === "preview" ? "document_preview_opened" : "file_downloaded",
      actorId: access.authUserId ?? access.email,
      actorName: access.name || "Staff user",
      createdAt: Date.now(),
      entityId: args.sourceId,
      entityType: args.sourceType,
      message: args.operation === "preview" ? "Document preview opened" : "File downloaded",
      metadata: { operation: args.operation, sourceType: args.sourceType },
    });
    return null;
  },
  returns: v.null(),
});

export const claimNextPreparation = internalMutation({
  args: { leaseId: v.string() },
  handler: async (ctx, args) => {
    const leaseId = args.leaseId.trim();
    if (!leaseId) {
      throw new ConvexError("A worker lease id is required");
    }
    const now = Date.now();
    const candidates = await ctx.db
      .query("documentPreviewOperations")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "preparing"))
      .order("asc")
      .take(PREPARATION_CLAIM_SCAN_LIMIT);
    for (const operation of candidates) {
      if (operation.leaseExpiresAt && operation.leaseExpiresAt > now) {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: claims must validate and mutate one candidate at a time so only the first current source receives this lease.
      const source = await resolveSystemDocumentPreviewSource(
        ctx,
        operation.sourceType,
        operation.sourceId
      );
      if (!source) {
        await invalidateDocumentPreviewSource(ctx, operation.sourceType, operation.sourceId);
        continue;
      }
      if (
        !isDocumentPreviewRolloutAllowed(
          source.sourceType,
          classifyDocumentPreview(source.fileName, source.mimeType)
        )
      ) {
        continue;
      }
      if (String(source.storageId) !== String(operation.sourceStorageId)) {
        await ensurePreparation(ctx, source, false);
        continue;
      }
      await ctx.db.patch("documentPreviewOperations", operation._id, {
        attemptCount: operation.attemptCount + 1,
        leaseExpiresAt: now + PREPARATION_LEASE_MS,
        leaseId,
        updatedAt: now,
      });
      return {
        generation: operation.generation,
        leaseId,
        operationId: operation._id,
        previewKind: operation.previewKind,
        sourceId: operation.sourceId,
        sourceType: operation.sourceType,
      };
    }
    return null;
  },
  returns: v.union(
    v.null(),
    v.object({
      generation: v.number(),
      leaseId: v.string(),
      operationId: v.id("documentPreviewOperations"),
      previewKind: documentPreviewOperationKindValidator,
      sourceId: v.string(),
      sourceType: documentPreviewSourceTypeValidator,
    })
  ),
});

export const getClaimedSource = internalQuery({
  args: {
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get("documentPreviewOperations", args.operationId);
    if (
      operation?.status !== "preparing" ||
      operation.generation !== args.generation ||
      operation.leaseId !== args.leaseId ||
      !operation.leaseExpiresAt ||
      operation.leaseExpiresAt <= Date.now()
    ) {
      return null;
    }
    const source = await resolveSystemDocumentPreviewSource(
      ctx,
      operation.sourceType,
      operation.sourceId
    );
    if (!source || String(source.storageId) !== String(operation.sourceStorageId)) {
      return null;
    }
    if (
      !isDocumentPreviewRolloutAllowed(
        source.sourceType,
        classifyDocumentPreview(source.fileName, source.mimeType)
      )
    ) {
      return null;
    }
    return {
      encrypted: source.encrypted,
      fileName: source.fileName,
      generation: operation.generation,
      mimeType: source.mimeType,
      operationId: operation._id,
      previewKind: operation.previewKind,
      sourceStorageId: source.storageId,
    };
  },
  returns: claimedSourceValidator,
});

export const commitValidatedPreparation = internalMutation({
  args: {
    artifactMimeType: v.string(),
    artifactStorageId: v.id("_storage"),
    durationMs: v.number(),
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
    pageCount: v.optional(v.number()),
    sheetCount: v.optional(v.number()),
    validationErrorCode: v.optional(documentPreviewErrorCodeValidator),
    warningCodes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get("documentPreviewOperations", args.operationId);
    const source = operation
      ? await resolveSystemDocumentPreviewSource(ctx, operation.sourceType, operation.sourceId)
      : null;
    const artifact = await ctx.db.system.get("_storage", args.artifactStorageId);
    if (
      !(operation && source && artifact) ||
      operation.status !== "preparing" ||
      operation.generation !== args.generation ||
      operation.leaseId !== args.leaseId ||
      !operation.leaseExpiresAt ||
      operation.leaseExpiresAt <= Date.now() ||
      String(source.storageId) !== String(operation.sourceStorageId)
    ) {
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { storageId: Id<"_storage"> }, { deleted: boolean }>(
          "crm/storageReferences:deleteIfUnreferenced"
        ),
        { storageId: args.artifactStorageId }
      );
      return { accepted: false };
    }
    const artifactMimeType = args.artifactMimeType.trim().toLowerCase();
    const expectedMimeType =
      operation.previewKind === "spreadsheet" ? "application/json" : "application/pdf";
    const storedMimeType = artifact.contentType?.trim().toLowerCase();
    const invalidMime =
      artifactMimeType !== expectedMimeType ||
      Boolean(storedMimeType && storedMimeType !== expectedMimeType);
    const invalidSize = artifact.size < 1 || artifact.size > MAX_PREVIEW_ARTIFACT_BYTES;
    if (args.validationErrorCode || invalidMime || invalidSize) {
      const errorCode =
        args.validationErrorCode ?? (invalidMime ? "signature_mismatch" : "resource_limit");
      await ctx.db.patch("documentPreviewOperations", operation._id, {
        errorCode,
        leaseExpiresAt: undefined,
        leaseId: undefined,
        status: "unavailable",
        updatedAt: Date.now(),
        warningCodes: [],
      });
      await ctx.db.insert("documentPreviewMetrics", {
        createdAt: Date.now(),
        durationMs: Math.max(0, Math.floor(args.durationMs)),
        errorCode,
        format: operation.previewKind,
        outcome: "unavailable",
        sizeBand: documentPreviewSizeBand(operation.sourceSize),
      });
      await ctx.scheduler.runAfter(
        0,
        makeFunctionReference<"mutation", { storageId: Id<"_storage"> }, { deleted: boolean }>(
          "crm/storageReferences:deleteIfUnreferenced"
        ),
        { storageId: args.artifactStorageId }
      );
      return { accepted: false };
    }
    const warningCodes = normalizeDocumentPreviewWarnings(args.warningCodes);
    const durationMs = Math.max(0, Math.floor(args.durationMs));
    await ctx.db.patch("documentPreviewOperations", operation._id, {
      artifactMimeType,
      artifactStorageId: args.artifactStorageId,
      durationMs,
      errorCode: undefined,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      pageCount: args.pageCount === undefined ? undefined : Math.max(0, Math.floor(args.pageCount)),
      sheetCount:
        args.sheetCount === undefined ? undefined : Math.max(0, Math.floor(args.sheetCount)),
      status: "ready",
      updatedAt: Date.now(),
      warningCodes,
    });
    await ctx.db.insert("documentPreviewMetrics", {
      createdAt: Date.now(),
      durationMs,
      format: operation.previewKind,
      outcome: "ready",
      pageCount: args.pageCount === undefined ? undefined : Math.max(0, Math.floor(args.pageCount)),
      sheetCount:
        args.sheetCount === undefined ? undefined : Math.max(0, Math.floor(args.sheetCount)),
      sizeBand: documentPreviewSizeBand(operation.sourceSize),
    });
    return { accepted: true };
  },
  returns: v.object({ accepted: v.boolean() }),
});

export const failPreparation = internalMutation({
  args: {
    durationMs: v.number(),
    errorCode: documentPreviewErrorCodeValidator,
    generation: v.number(),
    leaseId: v.string(),
    operationId: v.id("documentPreviewOperations"),
  },
  handler: async (ctx, args) => {
    const operation = await ctx.db.get("documentPreviewOperations", args.operationId);
    if (
      operation?.status !== "preparing" ||
      operation.generation !== args.generation ||
      operation.leaseId !== args.leaseId ||
      !operation.leaseExpiresAt ||
      operation.leaseExpiresAt <= Date.now()
    ) {
      return { accepted: false, retryScheduled: false };
    }
    const source = await resolveSystemDocumentPreviewSource(
      ctx,
      operation.sourceType,
      operation.sourceId
    );
    if (!source || String(source.storageId) !== String(operation.sourceStorageId)) {
      await invalidateDocumentPreviewSource(ctx, operation.sourceType, operation.sourceId);
      return { accepted: false, retryScheduled: false };
    }
    const durationMs = Math.max(0, Math.floor(args.durationMs));
    const retryScheduled =
      canRetryDocumentPreview(args.errorCode) && operation.attemptCount < MAX_AUTOMATIC_ATTEMPTS;
    await ctx.db.patch("documentPreviewOperations", operation._id, {
      durationMs,
      errorCode: args.errorCode,
      leaseExpiresAt: undefined,
      leaseId: undefined,
      status: retryScheduled ? "preparing" : "unavailable",
      updatedAt: Date.now(),
      warningCodes: [],
    });
    await ctx.db.insert("documentPreviewMetrics", {
      createdAt: Date.now(),
      durationMs,
      errorCode: args.errorCode,
      format: operation.previewKind,
      outcome: "unavailable",
      sizeBand: documentPreviewSizeBand(operation.sourceSize),
    });
    return { accepted: true, retryScheduled };
  },
  returns: v.object({ accepted: v.boolean(), retryScheduled: v.boolean() }),
});

export const startWarmActiveSources = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (documentPreviewRolloutStage() === "off") {
      throw new ConvexError("DOCUMENT_PREVIEW_DISABLED");
    }
    const existing = await ctx.db
      .query("documentPreviewWarmRuns")
      .withIndex("by_key", (q) => q.eq("key", WARM_KEY))
      .unique();
    if (existing?.status === "running") {
      await ctx.scheduler.runAfter(0, continueWarmActiveSourcesRef, {
        continuation: existing.continuation,
        runId: existing._id,
      });
      return { generation: existing.generation, runId: existing._id, scheduled: true };
    }
    const now = Date.now();
    const generation = (existing?.generation ?? 0) + 1;
    const values = {
      completedAt: undefined,
      continuation: 0,
      createdAt: now,
      cursor: null,
      failureCode: undefined,
      generation,
      key: WARM_KEY,
      prepared: 0,
      processed: 0,
      stage: "commercialFiles" as const,
      status: "running" as const,
      updatedAt: now,
    };
    let runId: Id<"documentPreviewWarmRuns">;
    if (existing) {
      await ctx.db.patch("documentPreviewWarmRuns", existing._id, values);
      runId = existing._id;
    } else {
      runId = await ctx.db.insert("documentPreviewWarmRuns", values);
    }
    await ctx.scheduler.runAfter(0, continueWarmActiveSourcesRef, { continuation: 0, runId });
    return { generation, runId, scheduled: true };
  },
  returns: v.object({
    generation: v.number(),
    runId: v.id("documentPreviewWarmRuns"),
    scheduled: v.boolean(),
  }),
});

export const continueWarmActiveSources = internalMutation({
  args: { continuation: v.number(), runId: v.id("documentPreviewWarmRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("documentPreviewWarmRuns", args.runId);
    if (
      run?.status !== "running" ||
      run.continuation !== args.continuation ||
      run.stage === "complete"
    ) {
      return null;
    }
    let prepared = 0;
    let pageResult: WarmPageResult;
    if (run.stage === "commercialFiles") {
      const page = await ctx.db
        .query("commercialFiles")
        .order("asc")
        .paginate({ cursor: run.cursor, numItems: WARM_PAGE_SIZE });
      const preparedSources = await Promise.all(
        page.page.flatMap((row) =>
          row.lifecycle === "active"
            ? [prepareSystemSource(ctx, "commercialFile", String(row._id))]
            : []
        )
      );
      prepared += preparedSources.filter(Boolean).length;
      pageResult = {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        processed: page.page.length,
      };
    } else {
      const page = await ctx.db
        .query("proposals")
        .order("asc")
        .paginate({ cursor: run.cursor, numItems: WARM_PAGE_SIZE });
      const preparedSources = await Promise.all(
        page.page.flatMap((row) =>
          row.finalizedPdfStorageId
            ? [prepareSystemSource(ctx, "proposalDocument", String(row._id))]
            : []
        )
      );
      prepared += preparedSources.filter(Boolean).length;
      pageResult = {
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        processed: page.page.length,
      };
    }
    const now = Date.now();
    if (!pageResult.isDone) {
      await ctx.db.patch("documentPreviewWarmRuns", run._id, {
        continuation: run.continuation + 1,
        cursor: pageResult.continueCursor,
        prepared: run.prepared + prepared,
        processed: run.processed + pageResult.processed,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, continueWarmActiveSourcesRef, {
        continuation: run.continuation + 1,
        runId: run._id,
      });
      return null;
    }
    if (run.stage === "commercialFiles") {
      await ctx.db.patch("documentPreviewWarmRuns", run._id, {
        continuation: run.continuation + 1,
        cursor: null,
        prepared: run.prepared + prepared,
        processed: run.processed + pageResult.processed,
        stage: "proposals",
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, continueWarmActiveSourcesRef, {
        continuation: run.continuation + 1,
        runId: run._id,
      });
      return null;
    }
    await ctx.db.patch("documentPreviewWarmRuns", run._id, {
      completedAt: now,
      continuation: run.continuation + 1,
      cursor: null,
      prepared: run.prepared + prepared,
      processed: run.processed + pageResult.processed,
      stage: "complete",
      status: "completed",
      updatedAt: now,
    });
    return null;
  },
  returns: v.null(),
});

export const getWarmStatus = internalQuery({
  args: {},
  handler: async (ctx) =>
    await ctx.db
      .query("documentPreviewWarmRuns")
      .withIndex("by_key", (q) => q.eq("key", WARM_KEY))
      .unique(),
  returns: v.union(
    v.null(),
    v.object({
      _creationTime: v.number(),
      _id: v.id("documentPreviewWarmRuns"),
      completedAt: v.optional(v.number()),
      continuation: v.number(),
      createdAt: v.number(),
      cursor: v.union(v.string(), v.null()),
      failureCode: v.optional(v.string()),
      generation: v.number(),
      key: v.literal("activeCommercialDocuments"),
      prepared: v.number(),
      processed: v.number(),
      stage: v.union(v.literal("commercialFiles"), v.literal("proposals"), v.literal("complete")),
      status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
      updatedAt: v.number(),
    })
  ),
});
