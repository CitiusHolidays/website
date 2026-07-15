import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import {
  queryAttachmentListPageResultValidator,
  queryAttachmentRecordResultValidator,
} from "./fileReturnContracts";
import { canSeeQueryRecord, PERMISSIONS, requireAnyPermission } from "./lib";
import { boundedPaginationOptions } from "./paginationPolicy";

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
    paginationOpts: paginationOptsValidator,
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
    ]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const query = await ctx.db.get(queryId);
    if (!(query && canSeeQueryRecord(access, query))) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const page = await ctx.db
      .query("queryAttachments")
      .withIndex("by_queryId_createdAt", (q) => q.eq("queryId", queryId))
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    return { ...page, page: page.page.map(publicQueryAttachment) };
  },
  returns: queryAttachmentListPageResultValidator,
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
  returns: queryAttachmentRecordResultValidator,
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
    const createdAt = Date.now();
    const legacyRows =
      query.attachmentCount === undefined
        ? await ctx.db
            .query("queryAttachments")
            .withIndex("by_queryId", (q) => q.eq("queryId", args.queryId))
            .collect()
        : null;
    const id = await ctx.db.insert("queryAttachments", {
      createdAt,
      createdBy: args.createdBy,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      queryId: args.queryId,
      storageId: args.storageId,
    });
    await ctx.db.patch(args.queryId, {
      attachmentCount: (legacyRows?.length ?? query.attachmentCount ?? 0) + 1,
      attachmentPreview: [
        {
          createdAt,
          fileName: args.fileName,
          fileSize: args.fileSize,
          id,
          mimeType: args.mimeType,
        },
        ...(query.attachmentPreview ?? []),
      ].slice(0, 2),
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
    const query = await ctx.db.get(row.queryId);
    await ctx.db.delete(args.attachmentId);
    if (query) {
      const remaining = await ctx.db
        .query("queryAttachments")
        .withIndex("by_queryId_createdAt", (q) => q.eq("queryId", row.queryId))
        .order("desc")
        .take(2);
      const attachmentCount =
        query.attachmentCount === undefined
          ? (
              await ctx.db
                .query("queryAttachments")
                .withIndex("by_queryId", (q) => q.eq("queryId", row.queryId))
                .collect()
            ).length
          : Math.max(0, query.attachmentCount - 1);
      await ctx.db.patch(row.queryId, {
        attachmentCount,
        attachmentPreview: remaining.map((entry) => ({
          createdAt: entry.createdAt,
          fileName: entry.fileName,
          fileSize: entry.fileSize,
          id: entry._id,
          mimeType: entry.mimeType,
        })),
      });
    }
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
