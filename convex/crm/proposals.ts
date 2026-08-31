import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import { assertCommercialSourceHasNoFileCustody } from "./commercialSourceCustody";
import { finalizedPdfRecordResultValidator } from "./fileReturnContracts";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  createActivity,
  deleteEntityNotifications,
  editorPatch,
  PERMISSIONS,
  publishWorkflowNotification,
  requireStaff,
} from "./lib";
import { assertCrmCodeSourceMutationAllowed } from "./lib/codes";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";
import { markListSearchDirty } from "./listSearch";
import {
  handleClearFinalizedPdf,
  handleGetFinalizedPdfRecord,
  handleSaveFinalizedPdf,
} from "./proposalDocumentState";
import { handleSendProposalToSales } from "./proposalHandoffCommands";
import { handleProposalPairTimeline } from "./proposalLifecycle";
import {
  deleteMiceDocDraftsForProposal,
  handleApproveMiceDocDraftForManualSend,
  handleCreateMiceDocDraft,
  handleGetMiceDocDraft,
  handleMarkMiceDocDraftReviewed,
  miceDocForPairResultValidator,
  miceDocTransitionResultValidator,
} from "./proposalMiceDoc";
import {
  handleProposalGetDetail,
  handleProposalLinkedQueriesPage,
  handleProposalListPage,
  projectProposalListRow as projectProposalListRowImpl,
} from "./proposalReads";
import {
  deleteProposalQueryLinks,
  linkedQueriesForProposal,
  mergeProposalLinkedQueriesForUpdate as mergeProposalLinkedQueriesForUpdateImpl,
} from "./proposalRelations";
import {
  proposalCreateResultValidator,
  proposalIdResultValidator,
  proposalLinkedQueriesPageResultValidator,
  proposalListPageResultValidator,
  proposalListRowResultValidator,
  proposalPairTimelineResultValidator,
} from "./proposalReturnContracts";
import { handleCreateProposal, handleUpdateProposal } from "./proposalWriteCommands";
import { enqueueQueryCommercialProjections } from "./queryCommercialProjection";

export const mergeProposalLinkedQueriesForUpdate = mergeProposalLinkedQueriesForUpdateImpl;

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

export const listLinkedQueriesPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    proposalId: v.string(),
  },
  handler: handleProposalLinkedQueriesPage,
  returns: proposalLinkedQueriesPageResultValidator,
});

export const getPairTimeline = query({
  args: {
    proposalId: v.string(),
    queryId: v.string(),
    referenceNow: v.number(),
  },
  handler: handleProposalPairTimeline,
  returns: proposalPairTimelineResultValidator,
});

export const getMiceDocDraft = query({
  args: {
    proposalId: v.string(),
    proposalRevision: v.number(),
    queryId: v.string(),
  },
  handler: (ctx, args) => handleGetMiceDocDraft(ctx, args),
  returns: miceDocForPairResultValidator,
});

export const createMiceDocDraft = mutation({
  args: {
    proposalId: v.string(),
    proposalRevision: v.number(),
    queryId: v.string(),
  },
  handler: (ctx, args) => handleCreateMiceDocDraft(ctx, args),
  returns: miceDocTransitionResultValidator,
});

export const markMiceDocDraftReviewed = mutation({
  args: {
    proposalId: v.string(),
    proposalRevision: v.number(),
    queryId: v.string(),
  },
  handler: (ctx, args) => handleMarkMiceDocDraftReviewed(ctx, args),
  returns: miceDocTransitionResultValidator,
});

export const approveMiceDocDraftForManualSend = mutation({
  args: {
    proposalId: v.string(),
    proposalRevision: v.number(),
    queryId: v.string(),
  },
  handler: (ctx, args) => handleApproveMiceDocDraftForManualSend(ctx, args),
  returns: miceDocTransitionResultValidator,
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
  handler: (ctx, args) => handleCreateProposal(ctx, args),
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
  handler: (ctx, args) => handleUpdateProposal(ctx, args),
  returns: proposalIdResultValidator,
});

export const markSent = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: () =>
    Promise.reject(new ConvexError("Mark client sent is no longer available. Use Send to Sales.")),
  returns: proposalIdResultValidator,
});

export const sendToSales = mutation({
  args: {
    commandId: v.string(),
    proposalId: v.string(),
    proposalRevision: v.number(),
    queryId: v.string(),
  },
  handler: handleSendProposalToSales,
  returns: proposalIdResultValidator,
});

export const markAccepted = mutation({
  args: {
    proposalId: v.string(),
  },
  handler: () => {
    throw new ConvexError(
      "Proposal acceptance is retired. Sales must confirm the exact handed-off revision through Sales Decision."
    );
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
    const proposal = await ctx.db.get("proposals", proposalId);
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
    await assertCrmCodeSourceMutationAllowed(ctx, "proposals");
    await deleteProposalQueryLinks(ctx, proposal);
    await assertCommercialSourceHasNoFileCustody(ctx, "proposal", String(proposalId));
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
      deleteMiceDocDraftsForProposal(ctx, proposalId),
      ctx.db.delete("proposals", proposalId),
    ]);
    await markListSearchDirty(ctx, "proposals", String(proposalId));
    await scheduleCrmMetricSync(ctx, "proposals", String(proposalId));
    await enqueueQueryCommercialProjections(
      ctx,
      linkedQueries.map((linkedQuery) => linkedQuery._id)
    );
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
    const [proposal, staff] = await Promise.all([
      ctx.db.get("proposals", proposalId),
      ctx.db.get("staffUsers", staffId),
    ]);
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
        collaboratorStaffIds: Array.from(collaborators).flatMap((id) => {
          const normalizedId = ctx.db.normalizeId("staffUsers", id);
          return normalizedId ? [normalizedId] : [];
        }),
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
    await scheduleCrmMetricSync(ctx, "proposals", String(proposalId));
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
    const proposal = await ctx.db.get("proposals", proposalId);
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
        (id) => String(id) !== String(staffId)
      ),
      ...editorPatch(access),
    });
    await scheduleCrmMetricSync(ctx, "proposals", String(proposalId));
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
  handler: handleSaveFinalizedPdf,
  returns: v.object({ previousStorageId: v.union(v.id("_storage"), v.null()) }),
});

export const clearFinalizedPdf = internalMutation({
  args: {
    proposalId: v.id("proposals"),
  },
  handler: handleClearFinalizedPdf,
  returns: v.object({ previousStorageId: v.union(v.id("_storage"), v.null()) }),
});

export const getFinalizedPdfRecord = query({
  args: {
    proposalId: v.string(),
  },
  handler: handleGetFinalizedPdfRecord,
  returns: finalizedPdfRecordResultValidator,
});
