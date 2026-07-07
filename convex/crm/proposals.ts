import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  canEditProposalRecord,
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  deleteEntityNotifications,
  editorPatch,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  publicQuery,
  requestedProposalQueryIds,
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

function computeProposalCostPrice(
  landCostPerPax: number,
  airfarePerPax: number,
  visaCostPerPax = 0
) {
  return Math.max(landCostPerPax, 0) + Math.max(airfarePerPax, 0) + Math.max(visaCostPerPax, 0);
}

function normalizeTaxRate(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new ConvexError("Tax rate must be a non-negative number");
  }
  return value;
}

async function resolveLinkedQueries(ctx: any, access: any, queryIdStrings: string[]) {
  const normalizedIds = [];
  const seen = new Set<string>();
  for (const value of queryIdStrings) {
    if (!value) {
      continue;
    }
    const queryId = ctx.db.normalizeId("queries", value);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    if (seen.has(queryId)) {
      continue;
    }
    seen.add(queryId);
    normalizedIds.push(queryId);
  }

  const linkedQueries = await Promise.all(
    normalizedIds.map(async (queryId) => {
      const linkedQuery = await ctx.db.get(queryId);
      if (!linkedQuery) {
        throw new ConvexError("Linked query not found");
      }
      if (!canSeeQueryRecord(access, linkedQuery)) {
        throw new ConvexError("FORBIDDEN");
      }
      return linkedQuery;
    })
  );
  return linkedQueries;
}

async function proposalQueryLinks(ctx: any, proposalId: any) {
  return await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (q: any) => q.eq("proposalId", proposalId))
    .collect();
}

async function linkedQueriesForProposal(ctx: any, proposal: any) {
  const links = await proposalQueryLinks(ctx, proposal._id);
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
  return linkedQueries;
}

async function syncProposalQueryLinks(
  ctx: any,
  proposalId: any,
  queryIds: string[],
  createdBy: string
) {
  const existingLinks = await proposalQueryLinks(ctx, proposalId);
  const target = new Set(queryIds);
  await Promise.all(
    existingLinks.map((link: any) =>
      target.has(link.queryId) ? Promise.resolve() : ctx.db.delete(link._id)
    )
  );

  const existing = new Set(existingLinks.map((link: any) => link.queryId));
  const now = Date.now();
  await Promise.all(
    queryIds.map(async (queryId) => {
      if (existing.has(queryId)) {
        return;
      }
      await ctx.db.insert("proposalQueryLinks", {
        createdAt: now,
        createdBy,
        proposalId,
        queryId,
      });
    })
  );
}

async function deleteProposalQueryLinks(ctx: any, proposalId: any) {
  const links = await proposalQueryLinks(ctx, proposalId);
  await Promise.all(links.map((link: any) => ctx.db.delete(link._id)));
}

const publicProposal = (proposal: any, linkedQueries: any[] = [], attachments: any[] = []) => {
  const primaryQuery =
    linkedQueries.find((query) => query._id === proposal.queryId) ?? linkedQueries[0] ?? null;
  const queryIds = linkedQueries.map((query) => query._id);
  return {
    airfarePerPax: proposal.airfarePerPax ?? 0,
    attachments: attachments
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(publicProposalAttachment),
    clientName: proposal.clientName,
    collaboratorStaffIds: proposal.collaboratorStaffIds ?? [],
    costPrice: proposal.costPrice ?? 0,
    createdAt: new Date(proposal.createdAt).toISOString(),
    finalizedPdf: publicFinalizedPdf(proposal),
    id: proposal._id,
    itinerarySummary: proposal.itinerarySummary ?? "",
    landCostPerPax: proposal.landCostPerPax ?? 0,
    lastEditedAt: proposal.lastEditedAt ? new Date(proposal.lastEditedAt).toISOString() : null,
    lastEditedByName: proposal.lastEditedByName ?? "",
    preparedBy: proposal.preparedBy,
    pricingEnteredAt: proposal.pricingEnteredAt
      ? new Date(proposal.pricingEnteredAt).toISOString()
      : null,
    proposalCode: proposal.proposalCode,
    queries: linkedQueries.map(publicQuery),
    query: primaryQuery ? publicQuery(primaryQuery) : null,
    queryId: primaryQuery?._id ?? proposal.queryId ?? null,
    queryIds,
    sellingPrice: proposal.sellingPrice ?? 0,
    sentAt: proposal.sentAt ? new Date(proposal.sentAt).toISOString() : null,
    status: proposal.status,
    taxRate: proposal.taxRate ?? null,
    updatedAt: new Date(proposal.updatedAt).toISOString(),
    visaCostPerPax: proposal.visaCostPerPax ?? 0,
  };
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows, attachments] = await Promise.all([
      requireAnyPermission(ctx, [PERMISSIONS.VIEW_PROPOSALS, PERMISSIONS.MANAGE_JOB_CARDS]),
      ctx.db.query("proposals").collect(),
      ctx.db.query("proposalAttachments").collect(),
    ]);
    const attachmentsByProposal = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const key = attachment.proposalId;
      const bucket = attachmentsByProposal.get(key) ?? [];
      bucket.push(attachment);
      attachmentsByProposal.set(key, bucket);
    }
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (proposal) => {
          const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
          if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
            return null;
          }
          return publicProposal(
            proposal,
            linkedQueries,
            attachmentsByProposal.get(proposal._id) ?? []
          );
        })
    );
    return result.filter(Boolean);
  },
});

export const create = mutation({
  args: {
    airfarePerPax: v.optional(v.number()),
    clientName: v.optional(v.string()),
    itinerarySummary: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    queryId: v.optional(v.string()),
    queryIds: v.optional(v.array(v.string())),
    sellingPrice: v.optional(v.number()),
    taxRate: v.optional(v.number()),
    visaCostPerPax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const linkedQueries = await resolveLinkedQueries(
      ctx,
      access,
      requestedProposalQueryIds(args) ?? []
    );
    const primaryQuery = linkedQueries[0] ?? null;
    if (linkedQueries.length > 0 && !canEditProposalRecord(access, {}, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can create proposals"
      );
    }

    const now = Date.now();
    const landCostPerPax = args.landCostPerPax ?? 0;
    const airfarePerPax = args.airfarePerPax ?? 0;
    const visaCostPerPax = args.visaCostPerPax ?? 0;
    const costPrice = computeProposalCostPrice(landCostPerPax, airfarePerPax, visaCostPerPax);
    const hasPricing =
      args.sellingPrice !== undefined ||
      landCostPerPax > 0 ||
      airfarePerPax > 0 ||
      visaCostPerPax > 0;
    const proposalCode = await nextCode(ctx, "proposals", "P");
    const clientName = primaryQuery?.clientName || args.clientName?.trim() || "Unlinked client";
    const id = await ctx.db.insert("proposals", {
      airfarePerPax,
      clientName,
      collaboratorStaffIds: [],
      costPrice,
      itinerarySummary: args.itinerarySummary?.trim() || "",
      landCostPerPax,
      preparedBy: access.name,
      pricingEnteredAt: hasPricing ? now : undefined,
      proposalCode,
      queryId: primaryQuery?._id,
      sellingPrice: Math.max(args.sellingPrice ?? 0, 0),
      status: "Draft",
      taxRate: args.taxRate === undefined ? undefined : normalizeTaxRate(args.taxRate),
      visaCostPerPax,
      ...editorPatch(access, now),
      createdAt: now,
      createdBy: access.authUserId ?? "unknown",
    });
    await Promise.all([
      syncProposalQueryLinks(
        ctx,
        id,
        linkedQueries.map((query) => query._id),
        access.authUserId ?? "unknown"
      ),
      createActivity(ctx, access, {
        action: "created",
        entityId: id,
        entityType: "proposal",
        message: `${proposalCode} created for ${clientName}`,
      }),
    ]);

    return { id, proposalCode };
  },
});

export const update = mutation({
  args: {
    airfarePerPax: v.optional(v.number()),
    clientName: v.optional(v.string()),
    itinerarySummary: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    proposalId: v.string(),
    queryId: v.optional(v.string()),
    queryIds: v.optional(v.array(v.string())),
    sellingPrice: v.optional(v.number()),
    taxRate: v.optional(v.union(v.number(), v.null())),
    visaCostPerPax: v.optional(v.number()),
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
    const currentLinkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, currentLinkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, currentLinkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can edit this proposal"
      );
    }

    const patch: Record<string, unknown> = editorPatch(access);
    const requestedQueryIds = requestedProposalQueryIds(args);
    let nextLinkedQueries: any[] | null = null;
    if (requestedQueryIds !== null) {
      nextLinkedQueries = await resolveLinkedQueries(ctx, access, requestedQueryIds);
      const primaryQuery = nextLinkedQueries[0] ?? null;
      patch.queryId = primaryQuery?._id;
      if (primaryQuery) {
        patch.clientName = primaryQuery.clientName;
      }
    }
    if (args.clientName !== undefined) {
      patch.clientName = args.clientName.trim();
    }
    if (args.landCostPerPax !== undefined) {
      patch.landCostPerPax = args.landCostPerPax;
    }
    if (args.airfarePerPax !== undefined) {
      patch.airfarePerPax = args.airfarePerPax;
    }
    if (args.visaCostPerPax !== undefined) {
      patch.visaCostPerPax = args.visaCostPerPax;
    }
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
    const visaCostPerPax =
      (patch.visaCostPerPax as number | undefined) ?? proposal.visaCostPerPax ?? 0;
    if (
      args.landCostPerPax !== undefined ||
      args.airfarePerPax !== undefined ||
      args.visaCostPerPax !== undefined
    ) {
      patch.costPrice = computeProposalCostPrice(landCostPerPax, airfarePerPax, visaCostPerPax);
      patch.pricingEnteredAt = Date.now();
    }

    await ctx.db.patch(proposalId, patch);
    if (nextLinkedQueries !== null) {
      await syncProposalQueryLinks(
        ctx,
        proposalId,
        nextLinkedQueries.map((query) => query._id),
        access.authUserId ?? "unknown"
      );
    }
    await createActivity(ctx, access, {
      action: "updated",
      entityId: proposalId,
      entityType: "proposal",
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
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (
      !(
        canEditProposalRecord(access, proposal, linkedQueries) ||
        access.permissions.includes(PERMISSIONS.SEND_PROPOSALS)
      )
    ) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can send this proposal"
      );
    }
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(proposalId, {
        sentAt: now,
        status: "Sent",
        ...editorPatch(access, now),
      }),
      Promise.all(
        linkedQueries.map((linkedQuery) =>
          ctx.db.patch(linkedQuery._id, {
            contractingStatus: "Proposal sent",
            updatedAt: now,
          })
        )
      ),
      createActivity(ctx, access, {
        action: "sent",
        entityId: proposalId,
        entityType: "proposal",
        message: `${proposal.proposalCode} marked as sent`,
      }),
      notifyRoles(ctx, ["Sales", "Sales Head"], {
        body: `${proposal.proposalCode} has been sent to the client.`,
        entityId: proposalId,
        entityType: "proposal",
        title: "Proposal sent",
      }),
    ]);
    return { id: proposalId };
  },
});

export const sendToSales = mutation({
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
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can send this proposal to Sales"
      );
    }
    if (proposal.status === "Sent") {
      throw new ConvexError("This proposal was already sent to Sales");
    }
    const now = Date.now();
    const queryCodes = linkedQueries.map((query) => query.queryCode).join(", ") || "linked query";
    const primaryQuery = linkedQueries[0] ?? null;
    await Promise.all([
      ctx.db.patch(proposalId, {
        sentAt: now,
        status: "Sent",
        ...editorPatch(access, now),
      }),
      Promise.all(
        linkedQueries.map((linkedQuery) =>
          ctx.db.patch(linkedQuery._id, {
            contractingStatus: "Proposal sent",
            updatedAt: now,
          })
        )
      ),
      createActivity(ctx, access, {
        action: "sent_to_sales",
        entityId: proposalId,
        entityType: "proposal",
        message: `${proposal.proposalCode} sent to Sales for review (${queryCodes})`,
      }),
    ]);

    const salesOwnerNotified = new Set<string>();
    const salesOwnerNotifications = [];
    for (const linkedQuery of linkedQueries) {
      if (!linkedQuery.salesOwnerId || salesOwnerNotified.has(linkedQuery.salesOwnerId)) {
        continue;
      }
      const salesStaffId = ctx.db.normalizeId("staffUsers", linkedQuery.salesOwnerId);
      if (!salesStaffId) {
        continue;
      }
      salesOwnerNotified.add(linkedQuery.salesOwnerId);
      salesOwnerNotifications.push(
        notifyStaffMember(ctx, salesStaffId, {
          body: `${proposal.proposalCode} for ${linkedQuery.queryCode} is ready. Review costing and use Sales Decision on the query.`,
          entityId: linkedQuery._id,
          entityType: "query",
          title: "Proposal ready for review",
        })
      );
    }

    await Promise.all([
      ...salesOwnerNotifications,
      ...(primaryQuery
        ? [
            notifyRoles(ctx, ["Sales", "Sales Head"], {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open the linked query to review and decide.`,
              entityId: primaryQuery._id,
              entityType: "query",
              title: "Proposal ready for review",
            }),
          ]
        : [
            notifyRoles(ctx, ["Sales", "Sales Head"], {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open Proposals or the linked query to review and decide.`,
              entityId: proposalId,
              entityType: "proposal",
              title: "Proposal ready for review",
            }),
          ]),
    ]);
    return { id: proposalId };
  },
});

export const markAccepted = mutation({
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
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can accept this proposal"
      );
    }
    const now = Date.now();
    await ctx.db.patch(proposalId, {
      status: "Accepted",
      ...editorPatch(access, now),
    });
    await createActivity(ctx, access, {
      action: "accepted",
      entityId: proposalId,
      entityType: "proposal",
      message: `${proposal.proposalCode} marked as accepted`,
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
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can delete this proposal"
      );
    }
    const { storageIds } = await ctx.runMutation(
      internal.crm.proposalAttachments.deleteAllForProposal,
      { proposalId }
    );
    if (proposal.finalizedPdfStorageId) {
      storageIds.push(proposal.finalizedPdfStorageId);
    }
    await Promise.all(
      storageIds.map(async (storageId: Id<"_storage">) => {
        try {
          await ctx.storage.delete(storageId);
        } catch (err) {
          console.error("Failed to delete proposal attachment file:", err);
        }
      })
    );
    await Promise.all([
      createActivity(ctx, access, {
        action: "deleted",
        entityId: proposalId,
        entityType: "proposal",
        message: `${proposal.proposalCode} deleted`,
      }),
      deleteEntityNotifications(ctx, "proposal", proposalId),
      deleteProposalQueryLinks(ctx, proposalId),
      ctx.db.delete(proposalId),
    ]);
    return { id: proposalId };
  },
});

export const addCollaborator = mutation({
  args: {
    proposalId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const [proposal, staff] = await Promise.all([ctx.db.get(proposalId), ctx.db.get(staffId)]);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    if (!staff?.active) {
      throw new ConvexError("Staff member not found");
    }
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can add collaborators"
      );
    }
    const collaborators = new Set((proposal.collaboratorStaffIds ?? []).map(String));
    collaborators.add(String(staffId));
    await Promise.all([
      ctx.db.patch(proposalId, {
        collaboratorStaffIds: Array.from(collaborators).map(
          (id) => ctx.db.normalizeId("staffUsers", id)!
        ),
        ...editorPatch(access),
      }),
      notifyStaffMember(ctx, staffId, {
        body: `${proposal.proposalCode} was shared with you for collaboration.`,
        entityId: proposalId,
        entityType: "proposal",
        title: "Proposal access shared",
      }),
    ]);
    return { id: proposalId };
  },
});

export const removeCollaborator = mutation({
  args: {
    proposalId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
    const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
    if (!proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const proposal = await ctx.db.get(proposalId);
    if (!proposal) {
      throw new ConvexError("Proposal not found");
    }
    const linkedQueries = await linkedQueriesForProposal(ctx, proposal);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditProposalRecord(access, proposal, linkedQueries)) {
      throw new ConvexError(
        "Only assigned Contracting or Ticketing SPOC, collaborators, and heads can remove collaborators"
      );
    }
    await ctx.db.patch(proposalId, {
      collaboratorStaffIds: (proposal.collaboratorStaffIds ?? []).filter(
        (id: any) => String(id) !== String(staffId)
      ),
      ...editorPatch(access),
    });
    return { id: proposalId };
  },
});

export const saveFinalizedPdf = internalMutation({
  args: {
    fileName: v.string(),
    proposalId: v.id("proposals"),
    storageId: v.id("_storage"),
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
      finalizedPdfFileName: args.fileName.trim() || "proposal.pdf",
      finalizedPdfStorageId: args.storageId,
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
      finalizedPdfFileName: undefined,
      finalizedPdfStorageId: undefined,
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
    if (!proposal?.finalizedPdfStorageId) {
      return null;
    }
    const [linkedQueries, access] = await Promise.all([
      linkedQueriesForProposal(ctx, proposal),
      requireAnyPermission(ctx, [
        PERMISSIONS.VIEW_PROPOSALS,
        PERMISSIONS.MANAGE_JOB_CARDS,
        PERMISSIONS.VIEW_JOB_CARDS,
      ]),
    ]);
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      const linkedJobs = await ctx.db
        .query("jobCards")
        .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
        .collect();
      const visibleJob = linkedJobs.some((job) => {
        const linkedQuery = linkedQueries.find((query) => query._id === job.queryId);
        return canSeeJobCardRecord(access, job, linkedQuery);
      });
      if (!visibleJob) {
        throw new ConvexError("FORBIDDEN");
      }
    }
    return {
      fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
      proposalId,
      storageId: proposal.finalizedPdfStorageId,
    };
  },
});
