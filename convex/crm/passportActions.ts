"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import {
  decryptBuffer,
  decryptPassportDetails,
  encryptBuffer,
  encryptPassportDetails,
} from "../lib/encryption";
import {
  downloadFileResultValidator,
  fileOperationSuccessValidator,
  uploadUrlResultValidator,
} from "./fileReturnContracts";
import { PERMISSIONS } from "./lib/rolePolicy";
import { passportDocumentResultValidator } from "./operationsReturnContracts";
import { normalizePassportExpiryDate } from "./passportExpiry";

const MAX_PASSPORT_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_PASSPORT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isAllowedPassportMimeType(mimeType: string) {
  return ALLOWED_PASSPORT_MIME_TYPES.has(mimeType.trim().toLowerCase());
}

function inferPassportMimeType(fileName: string, mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized) {
    return normalized;
  }
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const byExtension: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    webp: "image/webp",
  };
  return byExtension[extension] ?? "";
}

function encryptPassportPayload(buffer: Buffer) {
  try {
    return encryptBuffer(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Encryption failed";
    if (message.includes("ENCRYPTION_KEY")) {
      throw new ConvexError(
        "Encryption is not configured. Ask an admin to set ENCRYPTION_KEY in the Convex deployment."
      );
    }
    throw new ConvexError(`Failed to encrypt passport scan: ${message}`);
  }
}

export const generateUploadUrl = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access && access.allowed && access.permissions.includes(PERMISSIONS.MANAGE_VISA))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.runQuery(api.crm.passport.getPassportMetadata, {
      travellerId: args.travellerId,
    });

    return await ctx.storage.generateUploadUrl();
  },
  returns: uploadUrlResultValidator,
});

export const encryptAndStorePassport = action({
  args: {
    dateOfBirth: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    mimeType: v.string(),
    nationality: v.optional(v.string()),
    number: v.optional(v.string()),
    tempStorageId: v.id("_storage"),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access && access.allowed && access.permissions.includes(PERMISSIONS.MANAGE_VISA))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.runQuery(api.crm.passport.getPassportMetadata, {
      travellerId: args.travellerId,
    });

    const fileBlob = await ctx.storage.get(args.tempStorageId);
    if (!fileBlob) {
      throw new ConvexError("Uploaded passport file not found");
    }

    const cleanupTempUpload = async () => {
      try {
        await ctx.storage.delete(args.tempStorageId);
      } catch {
        // ignore cleanup errors
      }
    };

    const resolvedMimeType = inferPassportMimeType(args.fileName, args.mimeType);
    if (!isAllowedPassportMimeType(resolvedMimeType)) {
      await cleanupTempUpload();
      throw new ConvexError("Passport scans must be PDF, JPEG, PNG, or WebP files.");
    }

    const actualSize = fileBlob.size ?? args.fileSize ?? 0;
    if (actualSize < 1 || actualSize > MAX_PASSPORT_FILE_BYTES) {
      await cleanupTempUpload();
      throw new ConvexError("Passport scans must be between 1 byte and 15 MB.");
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    const encryptedBuffer = encryptPassportPayload(Buffer.from(fileBytes));
    const encryptedStorageId = await ctx.storage.store(new Blob([new Uint8Array(encryptedBuffer)]));

    let encryptedPayload = "";
    let lastFour = "";
    if (args.number && args.expiryDate && args.nationality && args.dateOfBirth) {
      encryptedPayload = encryptPassportDetails({
        dateOfBirth: args.dateOfBirth,
        expiryDate: args.expiryDate,
        nationality: args.nationality,
        number: args.number,
      });
      lastFour = args.number.trim().slice(-4);
    } else {
      encryptedPayload = encryptPassportDetails({
        dateOfBirth: "UNKNOWN",
        expiryDate: "UNKNOWN",
        nationality: "UNKNOWN",
        number: "UNKNOWN",
      });
    }

    try {
      await ctx.storage.delete(args.tempStorageId);
    } catch (err) {
      console.error("Failed to delete temporary unencrypted file:", err);
    }

    let displacedStorageId: Id<"_storage"> | null = null;
    try {
      displacedStorageId = await ctx.runMutation(internal.crm.passport.savePassportMetadata, {
        createdBy: access.authUserId || "unknown",
        encryptedPayload,
        expiryDate: normalizePassportExpiryDate(args.expiryDate),
        fileName: args.fileName,
        lastFour: lastFour || undefined,
        mimeType: resolvedMimeType,
        storageId: encryptedStorageId,
        travellerId: args.travellerId,
      });
    } catch (error) {
      try {
        await ctx.storage.delete(encryptedStorageId);
      } catch (cleanupError) {
        console.error("Failed to clean up rejected encrypted passport file:", cleanupError);
      }
      throw error;
    }

    if (displacedStorageId) {
      try {
        await ctx.storage.delete(displacedStorageId);
      } catch (err) {
        console.error("Failed to delete old passport storage file:", err);
      }
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

type PassportMetadata = {
  storageId?: Id<"_storage">;
  mimeType?: string;
  fileName?: string;
} | null;

async function readPassportFile(ctx: ActionCtx, travellerId: string) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!(access && access.allowed && access.permissions.includes(PERMISSIONS.VIEW_VISA))) {
    throw new ConvexError("FORBIDDEN");
  }

  const existing: PassportMetadata = await ctx.runQuery(api.crm.passport.getPassportMetadata, {
    travellerId,
  });

  if (!(existing && existing.storageId)) {
    throw new ConvexError("Passport document not found for this traveller");
  }

  const encryptedBlob = await ctx.storage.get(existing.storageId);
  if (!encryptedBlob) {
    throw new ConvexError("Encrypted passport file not found in storage");
  }

  const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
  const decryptedBuffer = decryptBuffer(Buffer.from(encryptedBytes));

  await ctx.runMutation(internal.crm.passport.logViewActivity, {
    authUserId: access.authUserId || "unknown",
    travellerId,
    userName: access.name || "Unknown",
  });

  const decryptedBytes = new Uint8Array(decryptedBuffer);
  const responseBytes = new Uint8Array(decryptedBytes.byteLength);
  responseBytes.set(decryptedBytes);

  return {
    bytes: responseBytes.buffer,
    fileName: existing.fileName || "passport.pdf",
    mimeType: existing.mimeType || "application/pdf",
  };
}

export const getPassportDocument = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: true; bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const file = await readPassportFile(ctx, args.travellerId);
    return {
      success: true,
      ...file,
    };
  },
  returns: passportDocumentResultValidator,
});

export const getPassportFile = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> =>
    await readPassportFile(ctx, args.travellerId),
  returns: downloadFileResultValidator,
});

export const removePassport = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!(access && access.allowed && access.permissions.includes(PERMISSIONS.MANAGE_VISA))) {
      throw new ConvexError("FORBIDDEN");
    }

    await ctx.runQuery(api.crm.passport.getPassportMetadata, {
      travellerId: args.travellerId,
    });

    const deletedStorageId: Id<"_storage"> | null = await ctx.runMutation(
      internal.crm.passport.deletePassportMetadata,
      {
        travellerId: args.travellerId,
      }
    );

    if (deletedStorageId) {
      try {
        await ctx.storage.delete(deletedStorageId);
      } catch (err) {
        console.error("Failed to delete passport storage file:", err);
      }
    }

    return { success: true };
  },
  returns: fileOperationSuccessValidator,
});

export const backfillPassportExpiryDates = internalAction({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    limit: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    continueCursor: string;
    isDone: boolean;
    processed: number;
    scanned: number;
    skipped: number;
    updated: number;
  }> => {
    const result: {
      continueCursor: string;
      isDone: boolean;
      page: Array<{ id: Id<"passportDetails">; encryptedPayload: string }>;
      scanned: number;
    } = await ctx.runQuery(internal.crm.passport.listPassportDetailsForBackfill, {
      cursor: args.cursor ?? null,
      limit: args.limit ?? 100,
    });
    const rows = result.page;
    const outcomes = await Promise.all(
      rows.map(async (row) => {
        try {
          const decrypted = decryptPassportDetails(row.encryptedPayload);
          const expiryDate = normalizePassportExpiryDate(decrypted.expiryDate);
          if (!expiryDate) {
            return "skipped" as const;
          }
          await ctx.runMutation(internal.crm.passport.backfillPassportExpiryDate, {
            expiryDate,
            passportId: row.id,
          });
          return "updated" as const;
        } catch {
          return "skipped" as const;
        }
      })
    );
    const updated = outcomes.filter((outcome) => outcome === "updated").length;
    const skipped = outcomes.filter((outcome) => outcome === "skipped").length;

    return {
      continueCursor: result.continueCursor,
      isDone: result.isDone,
      processed: rows.length,
      scanned: result.scanned,
      skipped,
      updated,
    };
  },
});
