import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { canSeeQueryRecord, PERMISSIONS, requireAnyPermission } from "./lib";

export function publicQueryAttachment(row: {
  _id: Id<"queryAttachments">;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: number;
}) {
  return {
    createdAt: new Date(row.createdAt).toISOString(),
    fileName: row.fileName,
    fileSize: row.fileSize,
    id: row._id,
    mimeType: row.mimeType,
  };
}

export const listForQuery = query({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
    ]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      return [];
    }
    const query = await ctx.db.get(queryId);
    if (!(query && canSeeQueryRecord(access, query))) {
      return [];
    }
    const rows = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map(publicQueryAttachment);
  },
});

export const getAttachmentRecord = query({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
    ]);
    const attachmentId = ctx.db.normalizeId("queryAttachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }
    const row = await ctx.db.get(attachmentId);
    if (!row) {
      return null;
    }
    const query = await ctx.db.get(row.queryId);
    if (!(query && canSeeQueryRecord(access, query))) {
      return null;
    }
    return {
      fileName: row.fileName,
      id: row._id,
      mimeType: row.mimeType,
      queryId: row.queryId,
      storageId: row.storageId,
    };
  },
});

export const resolveQueryId = internalMutation({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    const query = await ctx.db.get(queryId);
    if (!query) {
      throw new ConvexError("Query not found");
    }
    return queryId;
  },
});

export const saveAttachment = internalMutation({
  args: {
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const query = await ctx.db.get(args.queryId);
    if (!query) {
      throw new ConvexError("Query not found");
    }
    await ctx.db.insert("queryAttachments", {
      createdAt: Date.now(),
      createdBy: args.createdBy,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      queryId: args.queryId,
      storageId: args.storageId,
    });
  },
});

export const deleteAttachmentRecord = internalMutation({
  args: {
    attachmentId: v.id("queryAttachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attachmentId);
    if (!row) {
      return { storageId: null as Id<"_storage"> | null };
    }
    await ctx.db.delete(args.attachmentId);
    return { storageId: row.storageId };
  },
});

export const deleteAllForQuery = internalMutation({
  args: {
    queryId: v.id("queries"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId", (q) => q.eq("queryId", args.queryId))
      .collect();
    const storageIds = rows.map((row) => row.storageId);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { storageIds };
  },
});
