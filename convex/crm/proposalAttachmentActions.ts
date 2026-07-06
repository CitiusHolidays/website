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

function canManageProposalFiles(access: any) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.MANAGE_PROPOSALS) ||
      access.permissions.includes(PERMISSIONS.MANAGE_CONTRACTING))
  );
}

function canSendProposalFiles(access: any) {
  return (
    access?.allowed &&
    (canManageProposalFiles(access) || access.permissions.includes(PERMISSIONS.SEND_PROPOSALS))
  );
}

function isPdfMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase().startsWith("application/pdf");
}

async function buildDownloadFile(
  ctx: any,
  record: {
    storageId: string;
    fileName: string;
    mimeType?: string;
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
    mimeType: record.mimeType ?? "application/octet-stream",
  };
}

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canManageProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachFile = action({
  args: {
    proposalId: v.string(),
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
    if (!canManageProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    const [, normalizedProposalId, blob] = await Promise.all([
      ctx.runQuery(api.crm.proposalAttachments.verifyProposalAccess, {
        proposalId: args.proposalId,
      }),
      ctx.runMutation(internal.crm.proposalAttachments.resolveProposalId, {
        proposalId: args.proposalId,
      }),
      ctx.storage.get(args.storageId),
    ]);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }

    await ctx.runMutation(internal.crm.proposalAttachments.saveAttachment, {
      proposalId: normalizedProposalId,
      storageId: args.storageId,
      fileName: args.fileName.trim() || "proposal attachment",
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
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

    const record: {
      storageId: string;
      fileName: string;
      mimeType: string;
    } | null = await ctx.runQuery(api.crm.proposalAttachments.getAttachmentRecord, {
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
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

    const record: {
      storageId: string;
      fileName: string;
      mimeType: string;
    } | null = await ctx.runQuery(api.crm.proposalAttachments.getAttachmentRecord, {
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
    if (!canManageProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.proposalAttachments.getAttachmentRecord, {
      attachmentId: args.attachmentId,
    });
    if (!record) {
      throw new ConvexError("Attachment not found");
    }

    const { storageId } = await ctx.runMutation(
      internal.crm.proposalAttachments.deleteAttachmentRecord,
      {
        attachmentId: record.id,
      },
    );

    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete proposal attachment from storage:", err);
      }
    }

    return { success: true };
  },
});

export const generateFinalizedPdfUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canSendProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachFinalizedPdf = action({
  args: {
    proposalId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    if (!isPdfMimeType(args.mimeType)) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
      throw new ConvexError("Only PDF files can be uploaded as the finalized proposal.");
    }

    if (args.fileSize < 1 || args.fileSize > MAX_FILE_BYTES) {
      try {
        await ctx.storage.delete(args.storageId);
      } catch {
        // ignore cleanup errors
      }
      throw new ConvexError("The PDF must be between 1 byte and 15 MB.");
    }

    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canSendProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    const [, normalizedProposalId, blob] = await Promise.all([
      ctx.runQuery(api.crm.proposalAttachments.verifyProposalAccess, {
        proposalId: args.proposalId,
      }),
      ctx.runMutation(internal.crm.proposalAttachments.resolveProposalId, {
        proposalId: args.proposalId,
      }),
      ctx.storage.get(args.storageId),
    ]);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }

    const { previousStorageId } = await ctx.runMutation(internal.crm.proposals.saveFinalizedPdf, {
      proposalId: normalizedProposalId,
      storageId: args.storageId,
      fileName: args.fileName.trim() || "proposal.pdf",
      uploadedBy: access.authUserId || "unknown",
    });

    if (previousStorageId) {
      try {
        await ctx.storage.delete(previousStorageId);
      } catch (err) {
        console.error("Failed to delete previous finalized proposal PDF:", err);
      }
    }

    return { success: true };
  },
});

export const getFinalizedPdfUrl = action({
  args: {
    proposalId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string } | null> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.proposals.getFinalizedPdfRecord, {
      proposalId: args.proposalId,
    });
    if (!record) {
      return null;
    }

    return await buildDownloadFile(ctx, {
      storageId: record.storageId,
      fileName: record.fileName,
      mimeType: "application/pdf",
    });
  },
});

export const getFinalizedPdfFile = action({
  args: {
    proposalId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string } | null> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    const canView =
      access?.allowed &&
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }

    const record = await ctx.runQuery(api.crm.proposals.getFinalizedPdfRecord, {
      proposalId: args.proposalId,
    });
    if (!record) {
      return null;
    }

    return await buildDownloadFile(ctx, {
      storageId: record.storageId,
      fileName: record.fileName,
      mimeType: "application/pdf",
    });
  },
});

export const removeFinalizedPdf = action({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canSendProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.runQuery(api.crm.proposalAttachments.verifyProposalAccess, {
      proposalId: args.proposalId,
    });

    const normalizedProposalId = await ctx.runMutation(
      internal.crm.proposalAttachments.resolveProposalId,
      { proposalId: args.proposalId },
    );

    const { previousStorageId } = await ctx.runMutation(internal.crm.proposals.clearFinalizedPdf, {
      proposalId: normalizedProposalId,
    });

    if (previousStorageId) {
      try {
        await ctx.storage.delete(previousStorageId);
      } catch (err) {
        console.error("Failed to delete finalized proposal PDF from storage:", err);
      }
    }

    return { success: true };
  },
});
