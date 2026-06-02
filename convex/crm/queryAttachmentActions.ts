"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import { PERMISSIONS } from "./lib";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/plain",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument.",
];

function isAllowedMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

async function buildDownloadFile(
  ctx: any,
  record: {
    storageId: string;
    fileName: string;
    mimeType: string;
  },
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
    if (!access?.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_QUERIES)) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachFile = action({
  args: {
    queryId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isAllowedMimeType(args.mimeType)) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
      throw new ConvexError(
        "File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text.",
      );
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
    if (!access?.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_QUERIES)) {
      throw new ConvexError("FORBIDDEN");
    }

    const [normalizedQueryId, blob] = await Promise.all([
      ctx.runMutation(internal.crm.queryAttachments.resolveQueryId, {
        queryId: args.queryId,
      }),
      ctx.storage.get(args.storageId),
    ]);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }

    await ctx.runMutation(internal.crm.queryAttachments.saveAttachment, {
      queryId: normalizedQueryId,
      storageId: args.storageId,
      fileName: args.fileName.trim() || "attachment",
      mimeType: args.mimeType.trim() || "application/octet-stream",
      fileSize: args.fileSize,
      createdBy: access.authUserId || "unknown",
    });

    return { success: true };
  },
});

export const getDownloadUrl = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

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
});

export const getDownloadFile = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

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
});

export const removeAttachment = action({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access?.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_QUERIES)) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.queryAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

    const { storageId } = await ctx.runMutation(
      internal.crm.queryAttachments.deleteAttachmentRecord,
      {
        attachmentId: record.id,
      },
    );

    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete query attachment from storage:", err);
      }
    }

    return { success: true };
  },
});
