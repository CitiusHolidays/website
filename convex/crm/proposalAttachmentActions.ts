"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  downloadFileResultValidator,
  fileOperationSuccessValidator,
  nullableDownloadFileResultValidator,
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

function isAllowedMimeType(mimeType: string) {
  return isAllowedAttachmentMimeType(mimeType, ALLOWED_MIME_PREFIXES);
}

/**
 * Clean rejected uploads only when the blob is not referenced by any file
 * record.  This keeps the validation path fail-closed without allowing a
 * malformed retry to delete an existing proposal document.
 */
async function cleanupUnreferencedUpload(ctx: any, storageId: string) {
  try {
    await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  } catch (error) {
    console.error("Failed to clean up rejected proposal attachment upload:", error);
  }
}

function canManageProposalFiles(access: any) {
  return (
    access?.allowed &&
    (access.permissions.includes(PERMISSIONS.MANAGE_PROPOSALS) ||
      access.permissions.includes(PERMISSIONS.MANAGE_CONTRACTING))
  );
}

function canSendProposalFiles(access: any) {
  return canManageProposalFiles(access);
}

function isPdfMimeType(mimeType: string) {
  return normalizeMimeType(mimeType) === "application/pdf";
}

async function buildDownloadFile(
  ctx: any,
  record: {
    storageId: string;
    fileName: string;
    mimeType?: string;
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
    mimeType: record.mimeType ?? "application/octet-stream",
  };
}

export const generateUploadUrl = action({
  args: { proposalId: v.string() },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canManageProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedProposalId = await ctx.runMutation(
      internal.crm.proposalAttachments.resolveProposalId,
      { proposalId: args.proposalId }
    );
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedProposalId),
      entryPoint: "proposal",
      limit: 1,
    });
    const writableProposal = sourceResult.writableSources.find(
      (source) => source.sourceType === "proposal" && source.id === String(normalizedProposalId)
    );
    if (!writableProposal?.teamAreas.includes("contracting")) {
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
    proposalId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canManageProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedProposalId = await ctx.runMutation(
      internal.crm.proposalAttachments.resolveProposalId,
      { proposalId: args.proposalId }
    );
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedProposalId),
      entryPoint: "proposal",
      limit: 1,
    });
    const writableProposal = sourceResult.writableSources.find(
      (source) => source.sourceType === "proposal" && source.id === String(normalizedProposalId)
    );
    if (!writableProposal?.teamAreas.includes("contracting")) {
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
      await ctx.runMutation(internal.crm.commercialFiles.createFile, {
        accessAuthUserId: access.authUserId || "unknown",
        accessEmail: access.email,
        accessName: access.name,
        accessPermissions: access.permissions,
        accessRoles: access.roles,
        accessStaffId: access.staffId ? String(access.staffId) : undefined,
        category: "workingFile",
        createdBy: access.authUserId || access.email || "unknown",
        fileName: args.fileName.trim() || "proposal attachment",
        fileSize: blob.size,
        mimeType: normalizeMimeType(actualMimeType),
        proposalId: String(normalizedProposalId),
        sourceId: String(normalizedProposalId),
        sourceType: "proposal",
        storageId: args.storageId,
        teamArea: "contracting",
        uploaderTeam: access.roles.join(", ") || "Contracting",
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
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

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
      (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS) ||
        access.permissions.includes(PERMISSIONS.VIEW_CONTRACTING) ||
        access.permissions.includes(PERMISSIONS.VIEW_QUERIES) ||
        access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS));
    if (!canView) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);

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
  returns: downloadFileResultValidator,
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

    await ctx.runMutation(api.crm.commercialFiles.deleteFile, {
      fileId: `legacy-proposal:${String(record.id)}`,
    });

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const generateFinalizedPdfUploadUrl = action({
  args: { proposalId: v.string() },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canSendProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedProposalId = await ctx.runMutation(
      internal.crm.proposalAttachments.resolveProposalId,
      { proposalId: args.proposalId }
    );
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedProposalId),
      entryPoint: "proposal",
      limit: 1,
    });
    const writableProposal = sourceResult.writableSources.find(
      (source) => source.sourceType === "proposal" && source.id === String(normalizedProposalId)
    );
    if (!writableProposal?.teamAreas.includes("contracting")) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
  returns: uploadUrlResultValidator,
});

export const attachFinalizedPdf = action({
  args: {
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    proposalId: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canSendProposalFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const normalizedProposalId = await ctx.runMutation(
      internal.crm.proposalAttachments.resolveProposalId,
      { proposalId: args.proposalId }
    );
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: String(normalizedProposalId),
      entryPoint: "proposal",
      limit: 1,
    });
    const writableProposal = sourceResult.writableSources.find(
      (source) => source.sourceType === "proposal" && source.id === String(normalizedProposalId)
    );
    if (!writableProposal?.teamAreas.includes("contracting")) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!isPdfMimeType(args.mimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Only PDF files can be uploaded as the finalized proposal.");
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
    if (!isPdfMimeType(actualMimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Only PDF files can be uploaded as the finalized proposal.");
    }
    if (!isExactAttachmentSize(blob.size, args.fileSize)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("The PDF must be between 1 byte and 15 MB.");
    }

    try {
      await ctx.runMutation(internal.crm.commercialFiles.createFile, {
        accessAuthUserId: access.authUserId || "unknown",
        accessEmail: access.email,
        accessName: access.name,
        accessPermissions: access.permissions,
        accessRoles: access.roles,
        accessStaffId: access.staffId ? String(access.staffId) : undefined,
        category: "proposalDoc",
        createdBy: access.authUserId || "unknown",
        fileName: args.fileName.trim() || "proposal.pdf",
        fileSize: blob.size,
        mimeType: normalizeMimeType(actualMimeType),
        proposalId: String(normalizedProposalId),
        sourceId: String(normalizedProposalId),
        sourceType: "proposal",
        storageId: args.storageId,
        teamArea: "contracting",
        uploaderTeam: access.roles.join(", ") || "Contracting",
      });
    } catch (error) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw error;
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const getFinalizedPdfUrl = action({
  args: {
    proposalId: v.string(),
  },
  handler: async (
    ctx,
    args
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
    await enforcePortalFileDownloadLimit(ctx, access);

    const record = await ctx.runQuery(api.crm.proposals.getFinalizedPdfRecord, {
      proposalId: args.proposalId,
    });
    if (!record) {
      return null;
    }

    return await buildDownloadFile(ctx, {
      fileName: record.fileName,
      mimeType: "application/pdf",
      storageId: record.storageId,
    });
  },
  returns: nullableDownloadFileResultValidator,
});

export const getFinalizedPdfFile = action({
  args: {
    proposalId: v.string(),
  },
  handler: async (
    ctx,
    args
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
    await enforcePortalFileDownloadLimit(ctx, access);

    const record = await ctx.runQuery(api.crm.proposals.getFinalizedPdfRecord, {
      proposalId: args.proposalId,
    });
    if (!record) {
      return null;
    }

    return await buildDownloadFile(ctx, {
      fileName: record.fileName,
      mimeType: "application/pdf",
      storageId: record.storageId,
    });
  },
  returns: nullableDownloadFileResultValidator,
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
      { proposalId: args.proposalId }
    );

    await ctx.runMutation(api.crm.commercialFiles.deleteCurrentProposalDoc, {
      proposalId: String(normalizedProposalId),
    });

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});
