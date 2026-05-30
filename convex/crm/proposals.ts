import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  deleteEntityNotifications,
  nextCode,
  notifyRoles,
  PERMISSIONS,
  publicQuery,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import { publicProposalAttachment } from "./proposalAttachments";

const publicFinalizedPdf = (proposal: any) =>
  proposal.finalizedPdfStorageId
    ? {
        fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
        uploadedAt: proposal.finalizedPdfUploadedAt
          ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
          : null,
      }
    : null;

function computeProposalCostPrice(landCostPerPax: number, airfarePerPax: number) {
  return Math.max(landCostPerPax, 0) + Math.max(airfarePerPax, 0);
}

function normalizeTaxRate(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ConvexError("Tax rate must be a non-negative number");
  }
  return value;
}

const publicProposal = (proposal: any, linkedQuery: any, attachments: any[] = []) => ({
  id: proposal._id,
  proposalCode: proposal.proposalCode,
  queryId: proposal.queryId ?? null,
  query: linkedQuery ? publicQuery(linkedQuery) : null,
  clientName: proposal.clientName,
  preparedBy: proposal.preparedBy,
  landCostPerPax: proposal.landCostPerPax ?? 0,
  airfarePerPax: proposal.airfarePerPax ?? 0,
  sellingPrice: proposal.sellingPrice ?? 0,
  costPrice: proposal.costPrice ?? 0,
  taxRate: proposal.taxRate ?? null,
  pricingEnteredAt: proposal.pricingEnteredAt
    ? new Date(proposal.pricingEnteredAt).toISOString()
    : null,
  itinerarySummary: proposal.itinerarySummary ?? "",
  status: proposal.status,
  attachments: attachments.sort((a, b) => b.createdAt - a.createdAt).map(publicProposalAttachment),
  finalizedPdf: publicFinalizedPdf(proposal),
  sentAt: proposal.sentAt ? new Date(proposal.sentAt).toISOString() : null,
  createdAt: new Date(proposal.createdAt).toISOString(),
  updatedAt: new Date(proposal.updatedAt).toISOString(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.MANAGE_JOB_CARDS,
    ]);
    const rows = await ctx.db.query("proposals").collect();
    const attachments = await ctx.db.query("proposalAttachments").collect();
    const attachmentsByProposal = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const key = attachment.proposalId;
      const bucket = attachmentsByProposal.get(key) ?? [];
      bucket.push(attachment);
      attachmentsByProposal.set(key, bucket);
    }
    const result = [];
    for (const proposal of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
      if (!canSeeProposalRecord(access, proposal, linkedQuery)) {
        continue;
      }
      result.push(
        publicProposal(proposal, linkedQuery, attachmentsByProposal.get(proposal._id) ?? []),
      );
    }
    return result;
  },
});

export const create = mutation({
  args: {
    queryId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    airfarePerPax: v.optional(v.number()),
    sellingPrice: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    itinerarySummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const queryId = args.queryId ? ctx.db.normalizeId("queries", args.queryId) : null;
    const linkedQuery = queryId ? await ctx.db.get(queryId) : null;
    if (args.queryId && !linkedQuery) {
      throw new ConvexError("Linked query not found");
    }
    if (linkedQuery && !canSeeQueryRecord(access, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }

    const now = Date.now();
    const landCostPerPax = args.landCostPerPax ?? 0;
    const airfarePerPax = args.airfarePerPax ?? 0;
    const costPrice = computeProposalCostPrice(landCostPerPax, airfarePerPax);
    const hasPricing = args.sellingPrice !== undefined || landCostPerPax > 0 || airfarePerPax > 0;
    const proposalCode = await nextCode(ctx, "proposals", "P");
    const clientName = linkedQuery?.clientName || args.clientName?.trim() || "Unlinked client";
    const id = await ctx.db.insert("proposals", {
      proposalCode,
      queryId: queryId ?? undefined,
      clientName,
      preparedBy: access.name,
      landCostPerPax,
      airfarePerPax,
      sellingPrice: Math.max(args.sellingPrice ?? 0, 0),
      costPrice,
      taxRate: args.taxRate !== undefined ? normalizeTaxRate(args.taxRate) : undefined,
      pricingEnteredAt: hasPricing ? now : undefined,
      itinerarySummary: args.itinerarySummary?.trim() || "",
      status: "Draft",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "proposal",
      entityId: id,
      action: "created",
      message: `${proposalCode} created for ${clientName}`,
    });

    return { id, proposalCode };
  },
});

export const update = mutation({
  args: {
    proposalId: v.string(),
    queryId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    airfarePerPax: v.optional(v.number()),
    sellingPrice: v.optional(v.number()),
    taxRate: v.optional(v.union(v.number(), v.null())),
    itinerarySummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const currentLinkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
    if (!canSeeProposalRecord(access, proposal, currentLinkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    let linkedQuery = currentLinkedQuery;
    if (args.queryId !== undefined) {
      const queryId = args.queryId ? ctx.db.normalizeId("queries", args.queryId) : null;
      if (args.queryId && !queryId) {
        throw new ConvexError("Invalid query id");
      }
      if (queryId) {
        linkedQuery = await ctx.db.get(queryId);
        if (!linkedQuery) {
          throw new ConvexError("Linked query not found");
        }
        if (!canSeeQueryRecord(access, linkedQuery)) {
          throw new ConvexError("FORBIDDEN");
        }
        patch.queryId = queryId;
        patch.clientName = linkedQuery.clientName;
      } else {
        patch.queryId = undefined;
        linkedQuery = null;
      }
    }
    if (args.clientName !== undefined) patch.clientName = args.clientName.trim();
    if (args.landCostPerPax !== undefined) patch.landCostPerPax = args.landCostPerPax;
    if (args.airfarePerPax !== undefined) patch.airfarePerPax = args.airfarePerPax;
    if (args.sellingPrice !== undefined) {
      patch.sellingPrice = Math.max(args.sellingPrice, 0);
      patch.pricingEnteredAt = Date.now();
    }
    if (args.itinerarySummary !== undefined) {
      patch.itinerarySummary = args.itinerarySummary.trim();
    }
    if (args.taxRate === null) {
      patch.taxRate = undefined;
    } else if (args.taxRate !== undefined) {
      patch.taxRate = normalizeTaxRate(args.taxRate);
    }

    const landCostPerPax =
      (patch.landCostPerPax as number | undefined) ?? proposal.landCostPerPax ?? 0;
    const airfarePerPax =
      (patch.airfarePerPax as number | undefined) ?? proposal.airfarePerPax ?? 0;
    if (args.landCostPerPax !== undefined || args.airfarePerPax !== undefined) {
      patch.costPrice = computeProposalCostPrice(landCostPerPax, airfarePerPax);
      patch.pricingEnteredAt = Date.now();
    }

    await ctx.db.patch(proposalId, patch);
    await createActivity(ctx, access, {
      entityType: "proposal",
      entityId: proposalId,
      action: "updated",
      message: `${proposal.proposalCode} updated`,
    });
    return { id: proposalId };
  },
});

export const markSent = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_PROPOSALS,
      PERMISSIONS.MANAGE_CONTRACTING,
      PERMISSIONS.SEND_PROPOSALS,
    ]);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
    if (!canSeeProposalRecord(access, proposal, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    const now = Date.now();
    await ctx.db.patch(proposalId, {
      status: "Sent",
      sentAt: now,
      updatedAt: now,
    });
    if (proposal.queryId) {
      await ctx.db.patch(proposal.queryId, {
        contractingStatus: "Proposal sent",
        updatedAt: now,
      });
    }
    await createActivity(ctx, access, {
      entityType: "proposal",
      entityId: proposalId,
      action: "sent",
      message: `${proposal.proposalCode} marked as sent`,
    });
    await notifyRoles(ctx, ["Sales", "Sales Head"], {
      title: "Proposal sent",
      body: `${proposal.proposalCode} has been sent to the client.`,
      entityType: "proposal",
      entityId: proposalId,
    });
    return { id: proposalId };
  },
});

export const remove = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
    if (!canSeeProposalRecord(access, proposal, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    const { storageIds } = await ctx.runMutation(
      internal.crm.proposalAttachments.deleteAllForProposal,
      { proposalId },
    );
    if (proposal.finalizedPdfStorageId) {
      storageIds.push(proposal.finalizedPdfStorageId);
    }
    for (const storageId of storageIds) {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete proposal attachment file:", err);
      }
    }
    await createActivity(ctx, access, {
      entityType: "proposal",
      entityId: proposalId,
      action: "deleted",
      message: `${proposal.proposalCode} deleted`,
    });
    await deleteEntityNotifications(ctx, "proposal", proposalId);
    await ctx.db.delete(proposalId);
    return { id: proposalId };
  },
});

export const saveFinalizedPdf = internalMutation({
  args: {
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    uploadedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const now = Date.now();
    const previousStorageId = proposal.finalizedPdfStorageId;
    await ctx.db.patch(args.proposalId, {
      finalizedPdfStorageId: args.storageId,
      finalizedPdfFileName: args.fileName.trim() || "proposal.pdf",
      finalizedPdfUploadedAt: now,
      finalizedPdfUploadedBy: args.uploadedBy,
      updatedAt: now,
    });
    return { previousStorageId: previousStorageId ?? null };
  },
});

export const clearFinalizedPdf = internalMutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const previousStorageId = proposal.finalizedPdfStorageId ?? null;
    await ctx.db.patch(args.proposalId, {
      finalizedPdfStorageId: undefined,
      finalizedPdfFileName: undefined,
      finalizedPdfUploadedAt: undefined,
      finalizedPdfUploadedBy: undefined,
      updatedAt: Date.now(),
    });
    return { previousStorageId };
  },
});

export const getFinalizedPdfRecord = query({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      return null;
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal || !proposal.finalizedPdfStorageId) {
      return null;
    }
    const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_PROPOSALS,
      PERMISSIONS.MANAGE_JOB_CARDS,
    ]);
    if (!canSeeProposalRecord(access, proposal, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    return {
      proposalId,
      storageId: proposal.finalizedPdfStorageId,
      fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
    };
  },
});
