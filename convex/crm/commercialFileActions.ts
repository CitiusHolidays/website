"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import { action } from "../_generated/server";
import {
  COMMERCIAL_FILE_CATEGORIES,
  COMMERCIAL_FILE_SOURCE_TYPES,
  COMMERCIAL_FILE_TEAM_AREAS,
} from "./commercialFilePolicy";
import { enforcePortalFileDownloadLimit } from "./lib/portalFileDownloadLimit";
import { PERMISSIONS } from "./lib/rolePolicy";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const COMMERCIAL_FILE_WRITE_PERMISSIONS = [
  PERMISSIONS.MANAGE_QUERIES,
  PERMISSIONS.MANAGE_PROPOSALS,
  PERMISSIONS.MANAGE_CONTRACTING,
  PERMISSIONS.MANAGE_TICKETING,
  PERMISSIONS.MANAGE_JOB_CARDS,
  PERMISSIONS.MANAGE_OPERATIONS,
] as const;
const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/plain",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument.",
];

const sourceTypeValidator = v.union(
  v.literal(COMMERCIAL_FILE_SOURCE_TYPES[0]),
  v.literal(COMMERCIAL_FILE_SOURCE_TYPES[1]),
  v.literal(COMMERCIAL_FILE_SOURCE_TYPES[2])
);
const categoryValidator = v.union(
  v.literal(COMMERCIAL_FILE_CATEGORIES[0]),
  v.literal(COMMERCIAL_FILE_CATEGORIES[1])
);
const teamAreaValidator = v.union(
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[0]),
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[1]),
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[2]),
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[3]),
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[4]),
  v.literal(COMMERCIAL_FILE_TEAM_AREAS[5])
);
const uploadTicketResultValidator = v.object({
  uploadToken: v.string(),
  uploadUrl: v.string(),
});

interface WritableCommercialSource {
  id: string;
  sourceType: string;
  teamAreas: string[];
}

function isAllowedMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  return (
    Boolean(normalized) && ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function isPdfMimeType(mimeType: string) {
  return mimeType.trim().toLowerCase().startsWith("application/pdf");
}

function canUploadCommercialFiles(
  access: { allowed?: boolean; permissions?: string[]; roles?: string[] } | null
) {
  return Boolean(
    access?.allowed &&
      (COMMERCIAL_FILE_WRITE_PERMISSIONS.some((permission) =>
        access.permissions?.includes(permission)
      ) ||
        access.roles?.includes("Tour Manager"))
  );
}

async function cleanupUnreferencedUpload(ctx: any, storageId: string) {
  try {
    await ctx.runMutation(internal.crm.storageReferences.deleteIfUnreferenced, {
      storageId,
    });
  } catch (error) {
    console.error("Failed to clean up rejected commercial upload:", error);
  }
}

export const generateUploadUrl = action({
  args: {
    category: categoryValidator,
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    teamArea: teamAreaValidator,
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canUploadCommercialFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: args.sourceId,
      entryPoint: args.sourceType,
      limit: 1,
    });
    const writableSource = sourceResult.writableSources.find(
      (source: WritableCommercialSource) =>
        source.id === args.sourceId && source.sourceType === args.sourceType
    );
    if (!writableSource?.teamAreas.includes(args.teamArea)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.category === "proposalDoc" && args.teamArea !== "contracting") {
      throw new ConvexError(
        "Proposal Docs can only be uploaded to the Contracting Team File Area."
      );
    }
    const uploadToken = crypto.randomUUID();
    await ctx.runMutation(internal.crm.commercialFiles.createUploadSession, {
      authUserId: access.authUserId || access.email,
      category: args.category,
      sourceId: args.sourceId,
      sourceType: args.sourceType,
      teamArea: args.teamArea,
      token: uploadToken,
    });
    return {
      uploadToken,
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
  returns: uploadTicketResultValidator,
});

export const uploadFile = action({
  args: {
    category: categoryValidator,
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    note: v.optional(v.string()),
    sourceId: v.string(),
    sourceType: sourceTypeValidator,
    storageId: v.id("_storage"),
    teamArea: teamAreaValidator,
    uploadToken: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!canUploadCommercialFiles(access)) {
      throw new ConvexError("FORBIDDEN");
    }
    const sourceResult = await ctx.runQuery(api.crm.commercialFiles.listForEntryPoint, {
      entityId: args.sourceId,
      entryPoint: args.sourceType,
      limit: 1,
    });
    const writableSource = sourceResult.writableSources.find(
      (source: WritableCommercialSource) =>
        source.id === args.sourceId && source.sourceType === args.sourceType
    );
    if (!writableSource?.teamAreas.includes(args.teamArea)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!isAllowedMimeType(args.mimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError(
        "File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text."
      );
    }
    if (args.category === "proposalDoc" && args.teamArea !== "contracting") {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError(
        "Proposal Docs can only be uploaded to the Contracting Team File Area."
      );
    }
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new ConvexError("Uploaded file not found in storage");
    }
    const actualMimeType = blob.type?.trim() || args.mimeType.trim();
    if (!isAllowedMimeType(actualMimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError(
        "File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text."
      );
    }
    if (args.category === "proposalDoc" && !isPdfMimeType(actualMimeType)) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Proposal Docs must be PDF files.");
    }
    if (blob.size < 1 || blob.size > MAX_FILE_BYTES || blob.size !== args.fileSize) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw new ConvexError("Each file must be between 1 byte and 15 MB.");
    }
    try {
      await ctx.runMutation(internal.crm.commercialFiles.claimUploadSession, {
        accessAuthUserId: access.authUserId || access.email,
        category: args.category,
        sourceId: args.sourceId,
        sourceType: args.sourceType,
        storageId: args.storageId,
        teamArea: args.teamArea,
        token: args.uploadToken,
      });
      await ctx.runMutation(internal.crm.commercialFiles.createFile, {
        accessAuthUserId: access.authUserId || "unknown",
        accessEmail: access.email,
        accessName: access.name,
        accessPermissions: access.permissions,
        accessRoles: access.roles,
        accessStaffId: access.staffId ? String(access.staffId) : undefined,
        category: args.category,
        createdBy: access.authUserId || access.email || "unknown",
        fileName: args.fileName.trim() || "commercial file",
        fileSize: blob.size,
        mimeType: actualMimeType,
        note: args.note,
        sourceId: args.sourceId,
        sourceType: args.sourceType,
        storageId: args.storageId,
        teamArea: args.teamArea,
        uploaderTeam: access.roles.join(", ") || "Portal user",
      });
    } catch (error) {
      await cleanupUnreferencedUpload(ctx, args.storageId);
      throw error;
    }
    return { success: true };
  },
  returns: v.object({ success: v.boolean() }),
});

export const getDownloadFile = action({
  args: { fileId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access?.allowed) {
      throw new ConvexError("FORBIDDEN");
    }
    await enforcePortalFileDownloadLimit(ctx, access);
    const record: { fileName: string; mimeType: string; storageId: string } | null =
      await ctx.runQuery(api.crm.commercialFiles.getDownloadRecord, args);
    if (!record) {
      throw new ConvexError("Commercial file not found");
    }
    const blob: Blob | null = await ctx.storage.get(record.storageId);
    if (!blob) {
      throw new ConvexError("File is no longer available");
    }
    const bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
    return {
      bytes: bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer,
      fileName: record.fileName,
      mimeType: record.mimeType,
    };
  },
  returns: v.object({
    bytes: v.bytes(),
    fileName: v.string(),
    mimeType: v.string(),
  }),
});
