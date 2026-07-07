import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";

export function publicProposalAttachment(row: {
  _id: Id<"proposalAttachments">;
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

async function requireVisibleProposal(ctx: any, proposalId: Id<"proposals">) {
  const [access, proposal] = await Promise.all([
    requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]),
    ctx.db.get(proposalId),
  ]);
  if (!proposal) {
    throw new ConvexError("Proposal not found");
  }
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q: any) => q.eq("proposalId", proposalId))
    .collect();
  const queryIds = new Set<string>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  for (const link of links) {
    queryIds.add(link.queryId);
  }
  const linkedQueries = (
    await Promise.all(Array.from(queryIds, (queryId) => ctx.db.get(queryId)))
  ).filter((linkedQuery): linkedQuery is NonNullable<typeof linkedQuery> => linkedQuery != null);
  const canSeeProposal = canSeeProposalRecord(access, proposal, linkedQueries);
  if (!canSeeProposal) {
    const jobs = await ctx.db
      .query("jobCards")
      .withIndex("by_proposalId", (q: any) => q.eq("proposalId", proposalId))
      .collect();
    const visibleJob = jobs.some((job: any) => {
      const linkedQuery = linkedQueries.find((query) => query._id === job.queryId);
      return canSeeJobCardRecord(access, job, linkedQuery);
    });
    if (visibleJob) {
      return { linkedQueries, proposal };
    }
    throw new ConvexError("FORBIDDEN");
  }
  return { linkedQueries, proposal };
}

export const listForProposal = query({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      return [];
    }
    await requireVisibleProposal(ctx, proposalId);
    const rows = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
      .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt).map(publicProposalAttachment);
  },
});

export const verifyProposalAccess = query({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    await requireVisibleProposal(ctx, proposalId);
    return { id: proposalId };
  },
});

export const getAttachmentRecord = query({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const attachmentId = ctx.db.normalizeId("proposalAttachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }
    const row = await ctx.db.get(attachmentId);
    if (!row) {
      return null;
    }
    await requireVisibleProposal(ctx, row.proposalId);
    return {
      fileName: row.fileName,
      id: row._id,
      mimeType: row.mimeType,
      proposalId: row.proposalId,
      storageId: row.storageId,
    };
  },
});

export const resolveProposalId = internalMutation({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    return proposalId;
  },
});

export const saveAttachment = internalMutation({
  args: {
    createdBy: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    await ctx.db.insert("proposalAttachments", {
      createdAt: Date.now(),
      createdBy: args.createdBy,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      proposalId: args.proposalId,
      storageId: args.storageId,
    });
  },
});

export const deleteAttachmentRecord = internalMutation({
  args: {
    attachmentId: v.id("proposalAttachments"),
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

export const deleteAllForProposal = internalMutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("proposalAttachments")
      .withIndex("by_proposalId", (q) => q.eq("proposalId", args.proposalId))
      .collect();
    const storageIds = rows.map((row) => row.storageId);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { storageIds };
  },
});
