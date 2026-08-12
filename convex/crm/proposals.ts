import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx, mutation, query } from "../_generated/server";
import { resolveCommandReceipt, storeCommandReceipt } from "./commandReceipts";
import { finalizedPdfRecordResultValidator } from "./fileReturnContracts";
import {
  canEditProposalRecord,
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  deleteEntityNotifications,
  editorPatch,
  nextCode,
  PERMISSIONS,
  publishWorkflowNotification,
  requestedProposalQueryIds,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { buildProposalListSearchText } from "./listSearch";
import { PROPOSAL_ATTACHMENT_SUMMARY_VERSION } from "./proposalAttachmentSummary";
import { notifyLinkedQuerySalesOwnersOfProposalDocument } from "./proposalDocument";
import {
  refreshProposalLinkProjections,
  storedProposalQueryProjection,
} from "./proposalLinkProjection";
import {
  handleProposalGetDetail,
  handleProposalListPage,
  projectProposalListRow as projectProposalListRowImpl,
} from "./proposalReads";
import {
  deleteProposalQueryLinks,
  linkedQueriesForProposal,
  mergeProposalLinkedQueriesForUpdate as mergeProposalLinkedQueriesForUpdateImpl,
  resolveLinkedQueries,
  syncProposalQueryLinks,
} from "./proposalRelations";
import {
  proposalCreateResultValidator,
  proposalIdResultValidator,
  proposalListPageResultValidator,
  proposalListRowResultValidator,
} from "./proposalReturnContracts";

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

export const mergeProposalLinkedQueriesForUpdate = mergeProposalLinkedQueriesForUpdateImpl;

function isProposalPricingComplete(proposal: any) {
  return (proposal.sellingPrice ?? 0) > 0 && (proposal.costPrice ?? 0) > 0;
}

function assertProposalPricingComplete(proposal: any, message: string) {
  if (!isProposalPricingComplete(proposal)) {
    throw new ConvexError(message);
  }
}

export const projectProposalListRow = projectProposalListRowImpl;

export const listPage = query({
  args: {
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: handleProposalListPage,
  returns: proposalListPageResultValidator,
});

export const getListRow = query({
  args: { proposalId: v.string() },
  handler: handleProposalGetDetail,
  returns: proposalListRowResultValidator,
});

export const getDetail = query({
  args: { proposalId: v.string() },
  handler: handleProposalGetDetail,
  returns: proposalListRowResultValidator,
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
    const id = await insertWithE2eOwnership(ctx, "proposals", {
      airfarePerPax,
      attachmentCount: 0,
      attachmentPreview: [],
      attachmentSummaryGeneration: 0,
      attachmentSummaryState: "ready",
      attachmentSummaryVersion: PROPOSAL_ATTACHMENT_SUMMARY_VERSION,
      clientName,
      collaboratorStaffIds: [],
      costPrice,
      itinerarySummary: args.itinerarySummary?.trim() || "",
      landCostPerPax,
      linkedQueryProjection: linkedQueries.map(storedProposalQueryProjection),
      listSearchText: buildProposalListSearchText({
        clientName,
        preparedBy: access.name,
        proposalCode,
      }),
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
      syncProposalQueryLinks(ctx, id, linkedQueries, access.authUserId ?? "unknown"),
      Promise.all(
        linkedQueries.flatMap((linkedQuery) =>
          linkedQuery.contractingStatus === "Query Received"
            ? [
                patchWithE2eOwnership(ctx, "queries", linkedQuery._id, {
                  contractingStatus: "Proposal in progress",
                  updatedAt: now,
                }),
              ]
            : []
        )
      ),
      createActivity(ctx, access, {
        action: "created",
        entityId: id,
        entityType: "proposal",
        message: `${proposalCode} created for ${clientName}`,
      }),
    ]);
    await Promise.all(
      linkedQueries.map((linkedQuery) => refreshProposalLinkProjections(ctx, linkedQuery._id))
    );

    return { id, proposalCode };
  },
  returns: proposalCreateResultValidator,
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
      const requestedLinkedQueries = await resolveLinkedQueries(ctx, access, requestedQueryIds);
      const inaccessibleLinkedQueries = currentLinkedQueries.filter(
        (linkedQuery) => !canSeeQueryRecord(access, linkedQuery)
      );
      nextLinkedQueries = mergeProposalLinkedQueriesForUpdate(
        access,
        currentLinkedQueries,
        requestedLinkedQueries
      );
      const inaccessiblePrimaryQuery = inaccessibleLinkedQueries.find(
        (linkedQuery) => String(linkedQuery._id) === String(proposal.queryId)
      );
      const primaryQuery = inaccessiblePrimaryQuery ?? requestedLinkedQueries[0] ?? null;
      patch.queryId = primaryQuery?._id;
      patch.linkedQueryProjection = nextLinkedQueries.map(storedProposalQueryProjection);
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
    patch.listSearchText = buildProposalListSearchText({ ...proposal, ...patch });

    await patchWithE2eOwnership(ctx, "proposals", proposalId, patch);
    if (nextLinkedQueries !== null) {
      await syncProposalQueryLinks(
        ctx,
        proposalId,
        nextLinkedQueries,
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
  returns: proposalIdResultValidator,
});

export const markSent = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: async () => {
    throw new ConvexError("Mark client sent is no longer available. Use Send to Sales.");
  },
  returns: proposalIdResultValidator,
});

export async function handleSendProposalToSales(
  ctx: MutationCtx,
  args: { commandId?: string; proposalId: string }
) {
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
  const receipt = args.commandId
    ? await resolveCommandReceipt(ctx, {
        access,
        commandId: args.commandId,
        operation: "proposal.send_to_sales",
        payload: { proposalId: String(proposalId) },
        targetId: String(proposalId),
      })
    : null;
  if (receipt?.replayedResultId) {
    const replayedId = ctx.db.normalizeId("proposals", receipt.replayedResultId);
    if (!replayedId) {
      throw new ConvexError("Stored command result is no longer valid");
    }
    return { id: replayedId };
  }
  if (proposal.status === "Sent") {
    throw new ConvexError("This proposal was already sent to Sales");
  }
  assertProposalPricingComplete(
    proposal,
    "Enter selling price and cost price on the proposal before sending it to Sales."
  );
  const now = Date.now();
  const queryCodes =
    linkedQueries.map((linkedQuery) => linkedQuery.queryCode).join(", ") || "linked query";
  const primaryQuery = linkedQueries[0] ?? null;
  await Promise.all([
    patchWithE2eOwnership(ctx, "proposals", proposalId, {
      sentToSalesAt: now,
      status: "Sent",
      ...editorPatch(access, now),
    }),
    Promise.all(
      linkedQueries.map((linkedQuery) =>
        patchWithE2eOwnership(ctx, "queries", linkedQuery._id, {
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
  await Promise.all(
    linkedQueries.map((linkedQuery) => refreshProposalLinkProjections(ctx, linkedQuery._id))
  );

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
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [salesStaffId] },
        content: {
          body: `${proposal.proposalCode} for ${linkedQuery.queryCode} is ready. Review costing and use Sales Decision on the query.`,
          entityId: linkedQuery._id,
          entityType: "query",
          title: "Proposal ready for review",
        },
        emailTargets: { kind: "staff", staffIds: [salesStaffId] },
      })
    );
  }

  await Promise.all([
    ...salesOwnerNotifications,
    ...(primaryQuery
      ? [
          publishWorkflowNotification(ctx, {
            bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
            content: {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open the linked query to review and decide.`,
              entityId: primaryQuery._id,
              entityType: "query",
              title: "Proposal ready for review",
            },
            emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
          }),
        ]
      : [
          publishWorkflowNotification(ctx, {
            bellTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
            content: {
              body: `${proposal.proposalCode} has been submitted by Contracting. Open Proposals or the linked query to review and decide.`,
              entityId: proposalId,
              entityType: "proposal",
              title: "Proposal ready for review",
            },
            emailTargets: { kind: "roles", roles: ["Sales", "Sales Head"] },
          }),
        ]),
  ]);
  if (receipt && args.commandId) {
    await storeCommandReceipt(ctx, {
      actorKey: receipt.actorKey,
      commandId: args.commandId,
      operation: "proposal.send_to_sales",
      payloadDigest: receipt.payloadDigest,
      resultId: String(proposalId),
      targetId: String(proposalId),
    });
  }
  return { id: proposalId };
}

export const sendToSales = mutation({
  args: {
    commandId: v.string(),
    proposalId: v.string(),
  },
  handler: handleSendProposalToSales,
  returns: proposalIdResultValidator,
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
    await patchWithE2eOwnership(ctx, "proposals", proposalId, {
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
  returns: proposalIdResultValidator,
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
    await ctx.runMutation(internal.crm.commercialFiles.markFilesDeletedForSource, {
      sourceId: String(proposalId),
      sourceType: "proposal",
    });
    const commercialFiles = await ctx.db
      .query("commercialFiles")
      .withIndex("by_source", (q) =>
        q.eq("sourceType", "proposal").eq("sourceId", String(proposalId))
      )
      .collect();
    const recoverableStorageIds = new Set(commercialFiles.map((file) => String(file.storageId)));
    const { storageIds } = await ctx.runMutation(
      internal.crm.proposalAttachments.deleteAllForProposal,
      { proposalId }
    );
    if (
      proposal.finalizedPdfStorageId &&
      !recoverableStorageIds.has(String(proposal.finalizedPdfStorageId))
    ) {
      storageIds.push(proposal.finalizedPdfStorageId);
    }
    await Promise.all(
      storageIds.map(async (storageId: Id<"_storage">) => {
        if (recoverableStorageIds.has(String(storageId))) {
          return;
        }
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
  returns: proposalIdResultValidator,
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
      patchWithE2eOwnership(ctx, "proposals", proposalId, {
        collaboratorStaffIds: Array.from(collaborators).map(
          (id) => ctx.db.normalizeId("staffUsers", id)!
        ),
        ...editorPatch(access),
      }),
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [staffId] },
        content: {
          body: `${proposal.proposalCode} was shared with you for collaboration.`,
          entityId: proposalId,
          entityType: "proposal",
          title: "Proposal access shared",
        },
        emailTargets: { kind: "staff", staffIds: [staffId] },
      }),
    ]);
    return { id: proposalId };
  },
  returns: proposalIdResultValidator,
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
    await patchWithE2eOwnership(ctx, "proposals", proposalId, {
      collaboratorStaffIds: (proposal.collaboratorStaffIds ?? []).filter(
        (id: any) => String(id) !== String(staffId)
      ),
      ...editorPatch(access),
    });
    return { id: proposalId };
  },
  returns: proposalIdResultValidator,
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
    await patchWithE2eOwnership(ctx, "proposals", args.proposalId, {
      finalizedPdfFileName: args.fileName.trim() || "proposal.pdf",
      finalizedPdfStorageId: args.storageId,
      finalizedPdfUploadedAt: now,
      finalizedPdfUploadedBy: args.uploadedBy,
      updatedAt: now,
    });
    await notifyLinkedQuerySalesOwnersOfProposalDocument(ctx, {
      isReplacement: Boolean(previousStorageId),
      proposalCode: proposal.proposalCode,
      proposalId: args.proposalId,
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
    await patchWithE2eOwnership(ctx, "proposals", args.proposalId, {
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
        const linkedQuery = linkedQueries.find(
          (candidateQuery) => candidateQuery._id === job.queryId
        );
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
  returns: finalizedPdfRecordResultValidator,
});
