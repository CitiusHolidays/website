"use node";

import { createHash } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  downloadFileResultValidator,
  fileOperationSuccessValidator,
  uploadUrlResultValidator,
} from "./fileReturnContracts";
import { PERMISSIONS } from "./lib/rolePolicy";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument.",
];

function isAllowedMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  return Boolean(
    normalized && ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function canPrepareExpenseFileUpload(access: any) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.CREATE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_ALL_EXPENSES))
  );
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
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
    };

    if (!isAllowedMimeType(args.mimeType)) {
      await cleanupRejectedUpload();
      throw new ConvexError("File type not allowed. Use PDF, Office, or image files.");
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }
    const actualSize = blob.size ?? args.fileSize;
    if (actualSize < 1 || actualSize > MAX_FILE_BYTES) {
      await cleanupRejectedUpload();
      throw new ConvexError("Each file must be between 1 byte and 15 MB.");
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    const contentDigest = createHash("sha256").update(bytes).digest("hex");

    let previousStorageId: string | null = null;
    try {
      ({ previousStorageId } = await ctx.runMutation(
        internal.crm.expenseAttachments.saveExpenseProof,
        {
          contentDigest,
          createdBy: access.authUserId || "unknown",
          expenseId,
          fileName: args.fileName.trim() || "expense proof",
          mimeType: args.mimeType.trim() || "application/octet-stream",
          storageId: args.storageId,
        }
      ));
    } catch (error) {
      await cleanupRejectedUpload();
      throw error;
    }

    if (previousStorageId) {
      try {
        await ctx.storage.delete(previousStorageId);
      } catch (err) {
        console.error("Failed to delete previous expense proof:", err);
      }
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

    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record?.storageId) {
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
    if (!(access?.allowed && access.permissions.includes(PERMISSIONS.VIEW_EXPENSES))) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record?.storageId) {
      throw new ConvexError("Attachment not found");
    }

    return await buildDownloadFile(ctx, record);
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

    const { storageId } = await ctx.runMutation(
      internal.crm.expenseAttachments.deleteExpenseProof,
      { attachmentId: record.id }
    );
    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete expense proof from storage:", err);
      }
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});
