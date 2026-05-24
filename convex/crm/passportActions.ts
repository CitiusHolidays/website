"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { PERMISSIONS } from "./lib";
import { encryptBuffer, decryptBuffer, encryptPassportDetails } from "../lib/encryption";

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

    if (!isAllowedPassportMimeType(args.mimeType)) {
      await cleanupTempUpload();
      throw new ConvexError("Passport scans must be PDF, JPEG, PNG, or WebP files.");
    }

    const actualSize = fileBlob.size ?? args.fileSize ?? 0;
    if (actualSize < 1 || actualSize > MAX_PASSPORT_FILE_BYTES) {
      await cleanupTempUpload();
      throw new ConvexError("Passport scans must be between 1 byte and 15 MB.");
    }

    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    const encryptedBuffer = encryptBuffer(Buffer.from(fileBytes));
    const encryptedStorageId = await ctx.storage.store(
      new Blob([new Uint8Array(encryptedBuffer)]),
    );

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
      fileName: args.fileName,
      mimeType: args.mimeType,
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

  const existing: PassportMetadata = await ctx.runQuery(
    api.crm.passport.getPassportMetadata,
    {
      travellerId,
    },
  );

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
