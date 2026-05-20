import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { PERMISSIONS, requireAnyPermission } from "./lib";

export function publicQueryAttachment(row: {
  _id: Id<"queryAttachments">;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: number;
}) {
  return {
    id: row._id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export const listForQuery = query({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
    ]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      return [];
    }
    const rows = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicQueryAttachment);
  },
});

export const getAttachmentRecord = query({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
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
    return {
      id: row._id,
      queryId: row.queryId,
      storageId: row.storageId,
      fileName: row.fileName,
      mimeType: row.mimeType,
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
    queryId: v.id("queries"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const query = await ctx.db.get(args.queryId);
    if (!query) {
      throw new ConvexError("Query not found");
    }
    await ctx.db.insert("queryAttachments", {
      queryId: args.queryId,
      storageId: args.storageId,
      fileName: args.fileName,
      mimeType: args.mimeType,
      fileSize: args.fileSize,
      createdBy: args.createdBy,
      createdAt: Date.now(),
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
    const storageIds: Id<"_storage">[] = [];
    for (const row of rows) {
      storageIds.push(row.storageId);
      await ctx.db.delete(row._id);
    }
    return { storageIds };
  },
});
