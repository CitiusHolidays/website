import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { PERMISSIONS, requireStaff } from "./lib";

export const getPassportMetadata = query({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_VISA);
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) return null;

    const row = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
      .unique();

    if (!row) return null;

    return {
      id: row._id,
      travellerId: row.travellerId,
      lastFour: row.lastFour ?? "",
      status: row.status ?? "Received",
      storageId: row.storageId,
      fileName: row.fileName,
      mimeType: row.mimeType,
      createdAt: new Date(row.createdAt).toISOString(),
    };
  },
});

export const savePassportMetadata = internalMutation({
  args: {
    travellerId: v.string(),
    storageId: v.id("_storage"),
    encryptedPayload: v.string(),
    lastFour: v.optional(v.string()),
    fileName: v.string(),
    mimeType: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new Error("Invalid traveller id");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        lastFour: args.lastFour,
        storageId: args.storageId,
        fileName: args.fileName,
        mimeType: args.mimeType,
        status: "Received",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("passportDetails", {
        travellerId,
        encryptedPayload: args.encryptedPayload,
        lastFour: args.lastFour,
        storageId: args.storageId,
        fileName: args.fileName,
        mimeType: args.mimeType,
        status: "Received",
        createdBy: args.createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(travellerId, {
      passportStatus: "Received",
      updatedAt: now,
    });
  },
});

export const deletePassportMetadata = internalMutation({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) return;

    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.patch(travellerIdNormalized, {
      passportStatus: "Pending",
      updatedAt: Date.now(),
    });
  },
});

export const logViewActivity = internalMutation({
  args: {
    travellerId: v.string(),
    authUserId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) return;
    const traveller = await ctx.db.get(travellerIdNormalized);
    if (!traveller) return;

    await ctx.db.insert("activityLogs", {
      entityType: "passport",
      entityId: args.travellerId,
      action: "viewed",
      message: `Passport scanned document of ${traveller.fullName} viewed by ${args.userName}`,
      actorId: args.authUserId,
      actorName: args.userName,
      createdAt: Date.now(),
    });
  },
});
