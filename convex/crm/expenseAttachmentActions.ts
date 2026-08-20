"use node";

import { createHash } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { recordCompletedDocumentAccess } from "./documentPreviewAudit";
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
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument.",
];

function isAllowedMimeType(mimeType: string) {
  return isAllowedAttachmentMimeType(mimeType, ALLOWED_MIME_PREFIXES);
}

function canPrepareExpenseFileUpload(
  access: { allowed?: boolean; permissions: string[] } | null | undefined
) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.CREATE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_ALL_EXPENSES))
  );
}

async function cleanupUnreferencedExpenseBlob(
  ctx: ActionCtx,
  storageId: Id<"_storage">,
  operation: string
) {
  try {
    await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  } catch (error) {
    console.error(`Failed to clean up ${operation} expense proof:`, error);
  }
}

async function buildDownloadFile(
  ctx: ActionCtx,
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
  args: {
    expenseId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canPrepareExpenseFileUpload(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    await ctx.runQuery(api.crm.expenseAttachments.verifyExpenseProofMutationAccess, {
      expenseId: args.expenseId,
    });
    return await ctx.storage.generateUploadUrl();
  },
  returns: uploadUrlResultValidator,
});

export const attachProof = action({
  args: {
    expenseId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canPrepareExpenseFileUpload(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const { id: expenseId } = await ctx.runQuery(
      api.crm.expenseAttachments.verifyExpenseProofMutationAccess,
      { expenseId: args.expenseId }
    );
    const cleanupRejectedUpload = async () => {
      await cleanupUnreferencedExpenseBlob(ctx, args.storageId, "rejected");
    };

    if (!isAllowedMimeType(args.mimeType)) {
      await cleanupRejectedUpload();
      throw new ConvexError("File type not allowed. Use PDF, Office, or image files.");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }
    const actualMimeType = resolveStorageMimeType(blob.type, args.mimeType);
    if (!storageMimeTypeMatchesClaim(blob.type, args.mimeType)) {
      await cleanupRejectedUpload();
      throw new ConvexError("Uploaded file type does not match its declared MIME type.");
    }
    if (!isAllowedMimeType(actualMimeType)) {
      await cleanupRejectedUpload();
      throw new ConvexError("File type not allowed. Use PDF, Office, or image files.");
    }
    const actualSize = blob.size ?? 0;
    if (!isExactAttachmentSize(actualSize, args.fileSize)) {
      await cleanupRejectedUpload();
      throw new ConvexError("Each file must be between 1 byte and 15 MB.");
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    const contentDigest = createHash("sha256").update(bytes).digest("hex");

    try {
      await ctx.runMutation(internal.crm.expenseAttachments.saveExpenseProof, {
        contentDigest,
        createdBy: access.authUserId || "unknown",
        expenseId,
        fileName: args.fileName.trim() || "expense proof",
        mimeType: normalizeMimeType(actualMimeType) || "application/octet-stream",
        storageId: args.storageId,
      });
    } catch (error) {
      await cleanupRejectedUpload();
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
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.VIEW_EXPENSES))) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record?.storageId) {
      throw new ConvexError("Attachment not found");
    }

    const file = await buildDownloadFile(ctx, record);
    await recordCompletedDocumentAccess(ctx, {
      // SAFETY: the expense-attachment record was loaded through a validator-backed Convex query.
      expectedSourceStorageId: record.storageId as Id<"_storage">,
      operation: "download",
      sourceId: args.attachmentId,
      sourceType: "expenseAttachment",
    });
    return file;
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
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.VIEW_EXPENSES))) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record?.storageId) {
      throw new ConvexError("Attachment not found");
    }

    const file = await buildDownloadFile(ctx, record);
    await recordCompletedDocumentAccess(ctx, {
      // SAFETY: the expense-attachment record was loaded through a validator-backed Convex query.
      expectedSourceStorageId: record.storageId as Id<"_storage">,
      operation: "download",
      sourceId: args.attachmentId,
      sourceType: "expenseAttachment",
    });
    return file;
  },
  returns: downloadFileResultValidator,
});

export const removeProof = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }
    await ctx.runQuery(api.crm.expenseAttachments.verifyExpenseProofMutationAccess, {
      expenseId: record.expenseId,
    });

    await ctx.runMutation(internal.crm.expenseAttachments.deleteExpenseProof, {
      attachmentId: record.id,
    });

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});
