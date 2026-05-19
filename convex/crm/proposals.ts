import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  nextCode,
  notifyRoles,
  publicQuery,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const publicProposal = (proposal: any, linkedQuery: any) => ({
  id: proposal._id,
  proposalCode: proposal.proposalCode,
  queryId: proposal.queryId ?? null,
  query: linkedQuery ? publicQuery(linkedQuery) : null,
  clientName: proposal.clientName,
  preparedBy: proposal.preparedBy,
  landCostPerPax: proposal.landCostPerPax ?? 0,
  airfarePerPax: proposal.airfarePerPax ?? 0,
  itinerarySummary: proposal.itinerarySummary ?? "",
  status: proposal.status,
  sentAt: proposal.sentAt ? new Date(proposal.sentAt).toISOString() : null,
  createdAt: new Date(proposal.createdAt).toISOString(),
  updatedAt: new Date(proposal.updatedAt).toISOString(),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_PROPOSALS);
    const rows = await ctx.db.query("proposals").collect();
    const result = [];
    for (const proposal of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
      result.push(publicProposal(proposal, linkedQuery));
    }
    return result;
  },
});

export const create = mutation({
  args: {
    queryId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    preparedBy: v.string(),
    landCostPerPax: v.optional(v.number()),
    airfarePerPax: v.optional(v.number()),
    itinerarySummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const queryId = args.queryId ? ctx.db.normalizeId("queries", args.queryId) : null;
    const linkedQuery = queryId ? await ctx.db.get(queryId) : null;
    if (args.queryId && !linkedQuery) {
      throw new ConvexError("Linked query not found");
    }

    const now = Date.now();
    const proposalCode = await nextCode(ctx, "proposals", "P");
    const clientName = linkedQuery?.clientName || args.clientName?.trim() || "Unlinked client";
    const id = await ctx.db.insert("proposals", {
      proposalCode,
      queryId: queryId ?? undefined,
      clientName,
      preparedBy: args.preparedBy.trim() || access.name,
      landCostPerPax: args.landCostPerPax ?? 0,
      airfarePerPax: args.airfarePerPax ?? 0,
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

export const markSent = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_PROPOSALS,
      PERMISSIONS.MANAGE_CONTRACTING,
    ]);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
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
