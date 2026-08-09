"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  downloadFileResultValidator,
  fileOperationSuccessValidator,
  uploadUrlResultValidator,
} from "./fileReturnContracts";
import {
  isAllowedAttachmentMimeType,
  isExactAttachmentSize,
  normalizeMimeType,
  resolveStorageMimeType,
  storageMimeTypeMatchesClaim,
} from "./fileValidation";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";
import { PERMISSIONS } from "./lib/rolePolicy";

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/plain",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument.",
];

interface WritableCommercialSource {
  id: string;
  sourceType: string;
  teamAreas: string[];
}

function isAllowedMimeType(mimeType: string) {
  return isAllowedAttachmentMimeType(mimeType, ALLOWED_MIME_PREFIXES);
}

/**
 * Rejecting an upload must not leave an unreferenced blob in Convex Storage.
 * Check every attachment owner first so a retry that names an existing blob
 * cannot delete a document that another record already uses.  Cleanup is
 * best-effort: the original validation/authorization error remains the one
 * returned to the caller and the scheduled orphan sweep can retry later.
 */
async function cleanupUnreferencedUpload(ctx: any, storageId: string) {
  try {
    await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  } catch (error) {
    console.error("Failed to clean up rejected query attachment upload:", error);
  }
}

async function buildDownloadFile(
  ctx: any,
  record: {
    storageId: string;
    fileName: string;
    mimeType: string;
  }
) {
  const blob = await ctx.storage.get(record.storageId);
  if (!blob) {
    throw new ConvexError("File is no longer available");
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    fileName: record.fileName,
    mimeType: record.mimeType,
  };
}

export const generateUploadUrl = action({
  args: { queryId: v.string() },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.MANAGE_QUERIES))) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedQueryId = await ctx.runMutation(internal.crm.queryAttachments.resolveQueryId, {
      queryId: args.queryId,
    });
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedQueryId),
      entryPoint: "query",
      limit: 1,
    });
    const writableQuery = sourceResult.writableSources.find(
      (source: WritableCommercialSource) =>
        source.sourceType === "query" && source.id === String(normalizedQueryId)
    );
    if (!writableQuery?.teamAreas.includes("sales")) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
  returns: uploadUrlResultValidator,
});

export const attachFile = action({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    queryId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.MANAGE_QUERIES))) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedQueryId = await ctx.runMutation(internal.crm.queryAttachments.resolveQueryId, {
      queryId: args.queryId,
    });
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedQueryId),
      entryPoint: "query",
      limit: 1,
    });
    const writableQuery = sourceResult.writableSources.find(
      (source: WritableCommercialSource) =>
        source.sourceType === "query" && source.id === String(normalizedQueryId)
    );
    if (!writableQuery?.teamAreas.includes("sales")) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!isAllowedMimeType(args.mimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError(
        "File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text."
      );
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }
    const actualMimeType = resolveStorageMimeType(blob.type, args.mimeType);
    if (!storageMimeTypeMatchesClaim(blob.type, args.mimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Uploaded file type does not match its declared MIME type.");
    }
    if (!isAllowedMimeType(actualMimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError(
        "File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text."
      );
    }
    if (!isExactAttachmentSize(blob.size, args.fileSize)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Each file must be between 1 byte and 15 MB.");
    }

    try {
      await ctx.runMutation(internal.crm.queryAttachments.saveAttachment, {
        createdBy: access.authUserId || "unknown",
        fileName: args.fileName.trim() || "attachment",
        fileSize: blob.size,
        mimeType: normalizeMimeType(actualMimeType),
        queryId: normalizedQueryId,
        storageId: args.storageId,
      });
    } catch (error) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw error;
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const getDownloadUrl = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

    const record: {
      storageId: string;
      fileName: string;
      mimeType: string;
    } | null = await ctx.runQuery(api.crm.queryAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

    return await buildDownloadFile(ctx, record);
  },
  returns: downloadFileResultValidator,
});

export const getDownloadFile = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

    const record: {
      storageId: string;
      fileName: string;
      mimeType: string;
    } | null = await ctx.runQuery(api.crm.queryAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

    return await buildDownloadFile(ctx, record);
  },
  returns: downloadFileResultValidator,
});

export const removeAttachment = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.MANAGE_QUERIES))) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.queryAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

    await ctx.runMutation(api.crm.commercialFiles.deleteFile, {
      fileId: `legacy-query:${String(record.id)}`,
    });

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});
