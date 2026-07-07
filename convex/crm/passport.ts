import { ConvexError, v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { canSeeJobCardRecord, PERMISSIONS, requireStaff } from "./lib";
import { normalizePassportExpiryDate } from "./passportExpiry";

export async function loadPassportMetadata(ctx: QueryCtx, travellerIdRaw: string) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_VISA);
  const travellerIdNormalized = ctx.db.normalizeId("travellers", travellerIdRaw);
  if (!travellerIdNormalized) {
    return null;
  }
  const traveller = await ctx.db.get(travellerIdNormalized);
  if (!traveller) {
    return null;
  }
  const job = await ctx.db.get(traveller.jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const row = await ctx.db
    .query("passportDetails")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
    .unique();
  if (!row) {
    return null;
  }
  return {
    createdAt: new Date(row.createdAt).toISOString(),
    expiryDate: row.expiryDate ?? "",
    fileName: row.fileName,
    id: row._id,
    lastFour: row.lastFour ?? "",
    mimeType: row.mimeType,
    status: row.status ?? "Received",
    storageId: row.storageId,
    travellerId: row.travellerId,
  };
}

export const getPassportMetadata = query({
  args: {
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_VISA);
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) {
      return null;
    }

    const row = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerIdNormalized))
      .unique();

    if (!row) {
      return null;
    }

    return {
      createdAt: new Date(row.createdAt).toISOString(),
      expiryDate: row.expiryDate ?? "",
      fileName: row.fileName,
      id: row._id,
      lastFour: row.lastFour ?? "",
      mimeType: row.mimeType,
      status: row.status ?? "Received",
      storageId: row.storageId,
      travellerId: row.travellerId,
    };
  },
});

export const savePassportMetadata = internalMutation({
  args: {
    createdBy: v.string(),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    fileName: v.string(),
    lastFour: v.optional(v.string()),
    mimeType: v.string(),
    passportNumberHash: v.optional(v.string()),
    storageId: v.id("_storage"),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }

    const now = Date.now();
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        fileName: args.fileName,
        lastFour: args.lastFour,
        mimeType: args.mimeType,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        storageId: args.storageId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("passportDetails", {
        createdAt: now,
        createdBy: args.createdBy,
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        fileName: args.fileName,
        lastFour: args.lastFour,
        mimeType: args.mimeType,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        storageId: args.storageId,
        travellerId,
        updatedAt: now,
      });
    }

    await ctx.db.patch(travellerId, {
      passportStatus: "Received",
      updatedAt: now,
    });
  },
});

export const savePassportDetailsOnly = internalMutation({
  args: {
    createdBy: v.string(),
    encryptedPayload: v.string(),
    expiryDate: v.optional(v.string()),
    lastFour: v.optional(v.string()),
    passportNumberHash: v.optional(v.string()),
    travellerId: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerId = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerId) {
      throw new ConvexError("Invalid traveller id");
    }

    const now = Date.now();
    const expiryDate = normalizePassportExpiryDate(args.expiryDate);
    const existing = await ctx.db
      .query("passportDetails")
      .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        lastFour: args.lastFour,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("passportDetails", {
        createdAt: now,
        createdBy: args.createdBy,
        encryptedPayload: args.encryptedPayload,
        expiryDate,
        lastFour: args.lastFour,
        passportNumberHash: args.passportNumberHash,
        status: "Received",
        travellerId,
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
    if (!travellerIdNormalized) {
      return;
    }

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

export const listPassportDetailsForBackfill = internalQuery({
  args: {
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("passportDetails").collect();
    return rows
      .filter((row) => !row.expiryDate && row.encryptedPayload)
      .slice(0, args.limit)
      .map((row) => ({
        encryptedPayload: row.encryptedPayload,
        id: row._id,
      }));
  },
});

export const backfillPassportExpiryDate = internalMutation({
  args: {
    expiryDate: v.optional(v.string()),
    passportId: v.id("passportDetails"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.passportId, {
      expiryDate: normalizePassportExpiryDate(args.expiryDate),
      updatedAt: Date.now(),
    });
  },
});

export const logViewActivity = internalMutation({
  args: {
    authUserId: v.string(),
    travellerId: v.string(),
    userName: v.string(),
  },
  handler: async (ctx, args) => {
    const travellerIdNormalized = ctx.db.normalizeId("travellers", args.travellerId);
    if (!travellerIdNormalized) {
      return;
    }
    const traveller = await ctx.db.get(travellerIdNormalized);
    if (!traveller) {
      return;
    }

    await ctx.db.insert("activityLogs", {
      action: "viewed",
      actorId: args.authUserId,
      actorName: args.userName,
      createdAt: Date.now(),
      entityId: args.travellerId,
      entityType: "passport",
      message: `Passport scanned document of ${traveller.fullName} viewed by ${args.userName}`,
    });
  },
});
