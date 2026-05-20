"use node";

import { v } from "convex/values";
import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { PERMISSIONS } from "./lib";
import { encryptBuffer, decryptBuffer, encryptPassportDetails } from "../lib/encryption";

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

export const getPassportDocument = action({
  args: {
    travellerId: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true; dataUrl: string; fileName: string }> => {
    const access = await ctx.runQuery(api.crm.staff.getMyPortalAccess);
    if (!access || !access.allowed || !access.permissions.includes(PERMISSIONS.VIEW_VISA)) {
      throw new ConvexError("FORBIDDEN");
    }

    const existing: PassportMetadata = await ctx.runQuery(
      api.crm.passport.getPassportMetadata,
      {
        travellerId: args.travellerId,
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
      travellerId: args.travellerId,
      authUserId: access.authUserId || "unknown",
      userName: access.name || "Unknown",
    });

    const mime = existing.mimeType || "application/pdf";
    const base64 = decryptedBuffer.toString("base64");
    return {
      success: true,
      dataUrl: `data:${mime};base64,${base64}`,
      fileName: existing.fileName || "passport.pdf",
    };
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
