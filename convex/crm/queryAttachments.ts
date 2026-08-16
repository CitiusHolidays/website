import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation, type QueryCtx, query } from "../_generated/server";
import {
  queryAttachmentListPageResultValidator,
  queryAttachmentRecordResultValidator,
} from "./fileReturnContracts";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  type PortalAccess,
  requireAnyPermission,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
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

async function canSeeQueryCommercialFiles(
  ctx: QueryCtx,
  access: PortalAccess,
  query: Doc<"queries">
) {
  if (canSeeQueryRecord(access, query)) {
    return true;
  }
  const jobCard = await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", query._id))
    .first();
  if (jobCard && canSeeJobCardRecord(access, jobCard, query)) {
    return true;
  }
  const [directProposals, proposalLinks] = await Promise.all([
    ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", query._id))
      .collect(),
    ctx.db
      .query("proposalQueryLinks")
      .withIndex("by_queryId", (q) => q.eq("queryId", query._id))
      .collect(),
  ]);
  const linkedProposals = await Promise.all(
    proposalLinks.map((link) => ctx.db.get("proposals", link.proposalId))
  );
  return [...directProposals, ...linkedProposals].some(
    (proposal) => proposal && canSeeProposalRecord(access, proposal, [query])
  );
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
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      return { continueCursor: "", isDone: true, page: [] };
    }
    const query = await ctx.db.get("queries", queryId);
    if (!(query && (await canSeeQueryCommercialFiles(ctx, access, query)))) {
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
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const attachmentId = ctx.db.normalizeId("queryAttachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }
    const row = await ctx.db.get("queryAttachments", attachmentId);
    if (!row) {
      return null;
    }
    const query = await ctx.db.get("queries", row.queryId);
    if (!(query && (await canSeeQueryCommercialFiles(ctx, access, query)))) {
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
    const query = await ctx.db.get("queries", queryId);
    if (!query) {
      throw new ConvexError("Query not found");
    }
    return queryId;
  },
  returns: v.id("queries"),
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
    const query = await ctx.db.get("queries", args.queryId);
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
    const id = await insertWithE2eOwnership(ctx, "queryAttachments", {
      createdAt,
      createdBy: args.createdBy,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      queryId: args.queryId,
      storageId: args.storageId,
    });
    await patchWithE2eOwnership(ctx, "queries", args.queryId, {
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
    await scheduleCrmMetricSync(ctx, "queries", String(args.queryId));
    return null;
  },
  returns: v.null(),
});

export const deleteAttachmentRecord = internalMutation({
  args: {
    attachmentId: v.id("queryAttachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("queryAttachments", args.attachmentId);
    if (!row) {
      return { storageId: null };
    }
    const query = await ctx.db.get("queries", row.queryId);
    await ctx.db.delete("queryAttachments", args.attachmentId);
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
      await patchWithE2eOwnership(ctx, "queries", row.queryId, {
        attachmentCount,
        attachmentPreview: remaining.map((entry) => ({
          createdAt: entry.createdAt,
          fileName: entry.fileName,
          fileSize: entry.fileSize,
          id: entry._id,
          mimeType: entry.mimeType,
        })),
      });
      await scheduleCrmMetricSync(ctx, "queries", String(row.queryId));
    }
    return { storageId: row.storageId };
  },
  returns: v.object({ storageId: v.union(v.id("_storage"), v.null()) }),
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
    await Promise.all(rows.map((row) => ctx.db.delete("queryAttachments", row._id)));
    return { storageIds };
  },
  returns: v.object({ storageIds: v.array(v.id("_storage")) }),
});
