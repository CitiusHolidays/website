"use node";

import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";
import {
  decryptBuffer,
  decryptPassportDetails,
  encryptBuffer,
  encryptPassportDetails,
} from "../lib/encryption";
import { PERMISSIONS } from "./lib";
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
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
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
        "Encryption is not configured. Ask an admin to set ENCRYPTION_KEY in the Convex deployment.",
      );
    }
    throw new ConvexError(`Failed to encrypt passport scan: ${message}`);
  }
}

export const generateUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access || !access.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_VISA)) {
      throw new ConvexError("FORBIDDEN");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const encryptAndStorePassport = action({
  args: {
    travellerId: v.string(),
    tempStorageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.optional(v.number()),
    number: v.optional(v.string()),
    expiryDate: v.optional(v.string()),
    nationality: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access || !access.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_VISA)) {
      throw new ConvexError("FORBIDDEN");
    }

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
        number: args.number,
        expiryDate: args.expiryDate,
        nationality: args.nationality,
        dateOfBirth: args.dateOfBirth,
      });
      lastFour = args.number.trim().slice(-4);
    } else {
      encryptedPayload = encryptPassportDetails({
        number: "UNKNOWN",
        expiryDate: "UNKNOWN",
        nationality: "UNKNOWN",
        dateOfBirth: "UNKNOWN",
      });
    }

    const existing = await ctx.runQuery(api.crm.passport.getPassportMetadata, {
      travellerId: args.travellerId,
    });

    if (existing && existing.storageId) {
      try {
        await ctx.storage.delete(existing.storageId);
      } catch (err) {
        console.error("Failed to delete old passport storage file:", err);
      }
    }

    try {
      await ctx.storage.delete(args.tempStorageId);
    } catch (err) {
      console.error("Failed to delete temporary unencrypted file:", err);
    }

    await ctx.runMutation(internal.crm.passport.savePassportMetadata, {
      travellerId: args.travellerId,
      storageId: encryptedStorageId,
      encryptedPayload,
      lastFour: lastFour || undefined,
      expiryDate: normalizePassportExpiryDate(args.expiryDate),
      fileName: args.fileName,
      mimeType: resolvedMimeType,
      createdBy: access.authUserId || "unknown",
    });

    return { success: true };
  },
});

type PassportMetadata = {
  storageId?: Id<"_storage">;
  mimeType?: string;
  fileName?: string;
} | null;

async function readPassportFile(ctx: any, travellerId: string) {
  const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
  if (!access || !access.allowed || !access.permissions.includes(PERMISSIONS.VIEW_VISA)) {
    throw new ConvexError("FORBIDDEN");
  }

  const existing: PassportMetadata = await ctx.runQuery(api.crm.passport.getPassportMetadata, {
    travellerId,
  });

  if (!existing || !existing.storageId) {
    throw new ConvexError("Passport document not found for this traveller");
  }

  const encryptedBlob = await ctx.storage.get(existing.storageId);
  if (!encryptedBlob) {
    throw new ConvexError("Encrypted passport file not found in storage");
  }

  const encryptedBytes = new Uint8Array(await encryptedBlob.arrayBuffer());
  const decryptedBuffer = decryptBuffer(Buffer.from(encryptedBytes));

  await ctx.runMutation(internal.crm.passport.logViewActivity, {
    travellerId,
    authUserId: access.authUserId || "unknown",
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
    args,
  ): Promise<{ success: true; bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    const file = await readPassportFile(ctx, args.travellerId);
    return {
      success: true,
      ...file,
    };
  },
});

export const getPassportFile = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; fileName: string; mimeType: string }> => {
    return await readPassportFile(ctx, args.travellerId);
  },
});

export const removePassport = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access || !access.allowed || !access.permissions.includes(PERMISSIONS.MANAGE_VISA)) {
      throw new ConvexError("FORBIDDEN");
    }

    const existing = await ctx.runQuery(api.crm.passport.getPassportMetadata, {
      travellerId: args.travellerId,
    });

    if (existing && existing.storageId) {
      try {
        await ctx.storage.delete(existing.storageId);
      } catch (err) {
        console.error("Failed to delete passport storage file:", err);
      }
    }

    await ctx.runMutation(internal.crm.passport.deletePassportMetadata, {
      travellerId: args.travellerId,
    });

    return { success: true };
  },
});

export const backfillPassportExpiryDates = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ processed: number; updated: number; skipped: number }> => {
    const rows: Array<{ id: Id<"passportDetails">; encryptedPayload: string }> = await ctx.runQuery(
      internal.crm.passport.listPassportDetailsForBackfill,
      {
        limit: args.limit ?? 100,
      },
    );
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const decrypted = decryptPassportDetails(row.encryptedPayload);
        const expiryDate = normalizePassportExpiryDate(decrypted.expiryDate);
        if (!expiryDate) {
          skipped += 1;
          continue;
        }
        await ctx.runMutation(internal.crm.passport.backfillPassportExpiryDate, {
          passportId: row.id,
          expiryDate,
        });
        updated += 1;
      } catch {
        skipped += 1;
      }
    }

    return { processed: rows.length, updated, skipped };
  },
});
