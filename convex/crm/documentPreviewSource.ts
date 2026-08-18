import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { resolveCommercialFileRecord } from "./commercialFiles";
import type { DocumentPreviewSourceType } from "./documentPreviewContract";
import { requireVisibleExpense } from "./expenseScope";
import { PERMISSIONS, requireAnyPermission } from "./lib";
import { loadPassportMetadata } from "./passport";
import { resolveProposalAttachmentRecord } from "./proposalAttachments";
import { handleGetFinalizedPdfRecord } from "./proposalDocumentState";
import { resolveQueryAttachmentRecord } from "./queryAttachments";

type DocumentPreviewCtx = QueryCtx | MutationCtx;

export interface DocumentPreviewSourceRecord {
  encrypted: boolean;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sourceId: string;
  sourceType: DocumentPreviewSourceType;
  storageId: Id<"_storage">;
}

async function storedFileSize(ctx: DocumentPreviewCtx, storageId: Id<"_storage">) {
  const metadata = await ctx.db.system.get("_storage", storageId);
  return metadata?.size ?? 0;
}

async function withStoredFileSize(
  ctx: DocumentPreviewCtx,
  source: Omit<DocumentPreviewSourceRecord, "fileSize"> & { fileSize?: number }
) {
  return {
    ...source,
    fileSize: source.fileSize ?? (await storedFileSize(ctx, source.storageId)),
  } satisfies DocumentPreviewSourceRecord;
}

async function finishAuthorizedSource(
  ctx: DocumentPreviewCtx,
  loadFileSize: boolean,
  source: Omit<DocumentPreviewSourceRecord, "fileSize"> & { fileSize?: number }
) {
  if (loadFileSize) {
    return await withStoredFileSize(ctx, source);
  }
  return { ...source, fileSize: source.fileSize ?? 0 } satisfies DocumentPreviewSourceRecord;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: explicit source dispatch keeps each authorization policy visible and avoids a weaker shared-policy abstraction.
async function resolveAuthorizedDocumentPreviewSourceInternal(
  ctx: DocumentPreviewCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string,
  loadFileSize: boolean
): Promise<DocumentPreviewSourceRecord> {
  if (sourceType === "commercialFile") {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const record = await resolveCommercialFileRecord(ctx, access, sourceId);
    if (!record) {
      throw new ConvexError("FORBIDDEN");
    }
    return await finishAuthorizedSource(ctx, loadFileSize, {
      encrypted: false,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      sourceId,
      sourceType,
      storageId: record.storageId,
    });
  }

  if (sourceType === "queryAttachment") {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const record = await resolveQueryAttachmentRecord(ctx, access, sourceId);
    if (!record) {
      throw new ConvexError("FORBIDDEN");
    }
    return await finishAuthorizedSource(ctx, loadFileSize, {
      encrypted: false,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      sourceId,
      sourceType,
      storageId: record.storageId,
    });
  }

  if (sourceType === "proposalAttachment") {
    const record = await resolveProposalAttachmentRecord(ctx, sourceId);
    if (!record) {
      throw new ConvexError("FORBIDDEN");
    }
    return await finishAuthorizedSource(ctx, loadFileSize, {
      encrypted: false,
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      sourceId,
      sourceType,
      storageId: record.storageId,
    });
  }

  if (sourceType === "proposalDocument") {
    const record = await handleGetFinalizedPdfRecord(ctx, { proposalId: sourceId });
    if (!record) {
      throw new ConvexError("FORBIDDEN");
    }
    return await finishAuthorizedSource(ctx, loadFileSize, {
      encrypted: false,
      fileName: record.fileName,
      mimeType: "application/pdf",
      sourceId,
      sourceType,
      storageId: record.storageId,
    });
  }

  if (sourceType === "passport") {
    const record = await loadPassportMetadata(ctx, sourceId);
    if (!record?.storageId) {
      throw new ConvexError("FORBIDDEN");
    }
    return await finishAuthorizedSource(ctx, loadFileSize, {
      encrypted: true,
      fileName: record.fileName ?? "passport.pdf",
      mimeType: record.mimeType ?? "application/pdf",
      sourceId,
      sourceType,
      storageId: record.storageId,
    });
  }

  const attachmentId = ctx.db.normalizeId("attachments", sourceId);
  const attachment = attachmentId ? await ctx.db.get("attachments", attachmentId) : null;
  if (attachment?.entityType !== "expense" || !attachment.storageId) {
    throw new ConvexError("FORBIDDEN");
  }
  const expenseId = ctx.db.normalizeId("expenseEntries", attachment.entityId);
  if (!expenseId) {
    throw new ConvexError("FORBIDDEN");
  }
  const { expense } = await requireVisibleExpense(ctx, expenseId);
  if (String(expense.proofAttachmentId ?? "") !== String(attachment._id)) {
    throw new ConvexError("FORBIDDEN");
  }
  // Generic attachments predate typed storage IDs. The owning attachment and
  // SAFETY: the current authorized expense proof relationship above validates this value;
  // Convex does not support normalizeId for the system storage table.
  const storageId = attachment.storageId as Id<"_storage">;
  return await finishAuthorizedSource(ctx, loadFileSize, {
    encrypted: false,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType ?? "application/octet-stream",
    sourceId,
    sourceType,
    storageId,
  });
}

export async function authorizeDocumentPreviewSource(
  ctx: DocumentPreviewCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  return await resolveAuthorizedDocumentPreviewSourceInternal(ctx, sourceType, sourceId, false);
}

export async function resolveAuthorizedDocumentPreviewSource(
  ctx: DocumentPreviewCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
) {
  return await resolveAuthorizedDocumentPreviewSourceInternal(ctx, sourceType, sourceId, true);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: lifecycle workers must resolve the same explicit source union without invoking user authorization.
export async function resolveSystemDocumentPreviewSource(
  ctx: DocumentPreviewCtx,
  sourceType: DocumentPreviewSourceType,
  sourceId: string
): Promise<DocumentPreviewSourceRecord | null> {
  if (sourceType === "commercialFile") {
    const id = ctx.db.normalizeId("commercialFiles", sourceId);
    const row = id ? await ctx.db.get("commercialFiles", id) : null;
    if (!row || row.lifecycle === "deleted") {
      return null;
    }
    return await withStoredFileSize(ctx, {
      encrypted: false,
      fileName: row.fileName,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      sourceId,
      sourceType,
      storageId: row.storageId,
    });
  }
  if (sourceType === "queryAttachment") {
    const id = ctx.db.normalizeId("queryAttachments", sourceId);
    const row = id ? await ctx.db.get("queryAttachments", id) : null;
    return row
      ? await withStoredFileSize(ctx, {
          encrypted: false,
          fileName: row.fileName,
          fileSize: row.fileSize,
          mimeType: row.mimeType,
          sourceId,
          sourceType,
          storageId: row.storageId,
        })
      : null;
  }
  if (sourceType === "proposalAttachment") {
    const id = ctx.db.normalizeId("proposalAttachments", sourceId);
    const row = id ? await ctx.db.get("proposalAttachments", id) : null;
    return row
      ? await withStoredFileSize(ctx, {
          encrypted: false,
          fileName: row.fileName,
          fileSize: row.fileSize,
          mimeType: row.mimeType,
          sourceId,
          sourceType,
          storageId: row.storageId,
        })
      : null;
  }
  if (sourceType === "proposalDocument") {
    const id = ctx.db.normalizeId("proposals", sourceId);
    const proposal = id ? await ctx.db.get("proposals", id) : null;
    if (!(proposal?.finalizedPdfStorageId && proposal.finalizedPdfFileName)) {
      return null;
    }
    return await withStoredFileSize(ctx, {
      encrypted: false,
      fileName: proposal.finalizedPdfFileName,
      mimeType: "application/pdf",
      sourceId,
      sourceType,
      storageId: proposal.finalizedPdfStorageId,
    });
  }
  if (sourceType === "passport") {
    const travellerId = ctx.db.normalizeId("travellers", sourceId);
    const passport = travellerId
      ? await ctx.db
          .query("passportDetails")
          .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
          .unique()
      : null;
    if (!passport?.storageId) {
      return null;
    }
    return await withStoredFileSize(ctx, {
      encrypted: true,
      fileName: passport.fileName ?? "passport.pdf",
      mimeType: passport.mimeType ?? "application/pdf",
      sourceId,
      sourceType,
      storageId: passport.storageId,
    });
  }
  const attachmentId = ctx.db.normalizeId("attachments", sourceId);
  const attachment = attachmentId ? await ctx.db.get("attachments", attachmentId) : null;
  if (attachment?.entityType !== "expense" || !attachment.storageId) {
    return null;
  }
  const expenseId = ctx.db.normalizeId("expenseEntries", attachment.entityId);
  const expense = expenseId ? await ctx.db.get("expenseEntries", expenseId) : null;
  if (!expense || String(expense.proofAttachmentId ?? "") !== String(attachment._id)) {
    return null;
  }
  // Generic attachments predate typed storage IDs. The owning attachment and
  // SAFETY: the current expense proof relationship above is the authoritative validation
  // seam; Convex does not support normalizeId for the system storage table.
  const storageId = attachment.storageId as Id<"_storage">;
  return await withStoredFileSize(ctx, {
    encrypted: false,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType ?? "application/octet-stream",
    sourceId,
    sourceType,
    storageId,
  });
}
