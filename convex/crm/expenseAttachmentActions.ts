"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { PERMISSIONS } from "./lib";

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

function canManageExpenseFiles(access: any) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.MANAGE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_FINANCE))
  );
}

function canPrepareExpenseFileUpload(access: any) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.CREATE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_EXPENSES) ||
      access.permissions.includes(PERMISSIONS.MANAGE_FINANCE))
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
  args: {},
  handler: async (ctx) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canPrepareExpenseFileUpload(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
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
    if (!isAllowedMimeType(args.mimeType)) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
      throw new ConvexError("File type not allowed. Use PDF, Office, or image files.");
    }

    if (args.fileSize < 1 || args.fileSize > MAX_FILE_BYTES) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
      throw new ConvexError("Each file must be between 1 byte and 15 MB.");
    }

    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canPrepareExpenseFileUpload(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    const [{ id: expenseId }, blob] = await Promise.all([
      ctx.runQuery(api.crm.expenseAttachments.verifyExpenseProofMutationAccess, {
        expenseId: args.expenseId,
      }),
      ctx.storage.get(args.storageId),
    ]);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }

    const { previousStorageId } = await ctx.runMutation(
      internal.crm.expenseAttachments.saveExpenseProof,
      {
        createdBy: access.authUserId || "unknown",
        expenseId,
        fileName: args.fileName.trim() || "expense proof",
        mimeType: args.mimeType.trim() || "application/octet-stream",
        storageId: args.storageId,
      }
    );

    if (previousStorageId) {
      try {
        await ctx.storage.delete(previousStorageId);
      } catch (err) {
        console.error("Failed to delete previous expense proof:", err);
      }
    }

    return { success: true };
  },
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
});

export const removeProof = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canManageExpenseFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.expenseAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

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
});
