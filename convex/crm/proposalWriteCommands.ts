import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { rekeyCommercialFilesForProposalRelationship } from "./commercialFileChainIdentity";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  canEditProposalRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  createActivity,
  editorPatch,
  nextCode,
  PERMISSIONS,
  requestedProposalQueryIds,
  requireStaff,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { buildProposalListSearchText, markListSearchDirty } from "./listSearch";
import { PROPOSAL_ATTACHMENT_SUMMARY_VERSION } from "./proposalAttachmentSummary";
import {
  proposalLinkedQuerySummary,
  refreshProposalLinkProjections,
} from "./proposalLinkProjection";
import {
  linkedQueriesForProposal,
  mergeProposalLinkedQueriesForUpdate,
  resolveLinkedQueries,
  syncProposalQueryLinks,
} from "./proposalRelations";
import { enqueueQueryCommercialProjections } from "./queryCommercialProjection";

interface CreateProposalArgs {
  airfarePerPax?: number;
  clientName?: string;
  itinerarySummary?: string;
  landCostPerPax?: number;
  queryId?: string;
  queryIds?: string[];
  sellingPrice?: number;
  taxRate?: number;
  visaCostPerPax?: number;
}

interface UpdateProposalArgs extends Omit<CreateProposalArgs, "taxRate"> {
  proposalId: string;
  taxRate?: number | null;
}

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

export async function handleCreateProposal(ctx: MutationCtx, args: CreateProposalArgs) {
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
    ...proposalLinkedQuerySummary(linkedQueries),
    listSearchText: buildProposalListSearchText({
      clientName,
      preparedBy: access.name,
      proposalCode,
    }),
    preparedBy: access.name,
    preparedByStaffId: access.staffId,
    pricingEnteredAt: hasPricing ? now : undefined,
    proposalCode,
    proposalRevision: 1,
    queryId: primaryQuery?._id,
    sellingPrice: Math.max(args.sellingPrice ?? 0, 0),
    status: "Draft",
    taxRate: args.taxRate === undefined ? undefined : normalizeTaxRate(args.taxRate),
    visaCostPerPax,
    ...editorPatch(access, now),
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
  });
  await markListSearchDirty(ctx, "proposals", String(id));
  await scheduleCrmMetricSync(ctx, "proposals", String(id));
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
    linkedQueries.flatMap((linkedQuery) =>
      linkedQuery.contractingStatus === "Query Received"
        ? [scheduleCrmMetricSync(ctx, "queries", String(linkedQuery._id))]
        : []
    )
  );
  await Promise.all(
    linkedQueries.map((linkedQuery) => refreshProposalLinkProjections(ctx, linkedQuery._id))
  );
  await enqueueQueryCommercialProjections(
    ctx,
    linkedQueries.map((linkedQuery) => linkedQuery._id)
  );

  return { id, proposalCode };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: updates preserve pricing, access, and normalized relation invariants in one transaction.
export async function handleUpdateProposal(ctx: MutationCtx, args: UpdateProposalArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_PROPOSALS);
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  if (!proposalId) {
    throw new ConvexError("Invalid proposal id");
  }
  const proposal = await ctx.db.get("proposals", proposalId);
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

  const patch: RuntimeObject = editorPatch(access);
  patch.proposalRevision = (proposal.proposalRevision ?? 1) + 1;
  if (proposal.status === "Sent") {
    patch.sentToSalesAt = undefined;
    patch.status = "Draft";
  }
  const requestedQueryIds = requestedProposalQueryIds(args);
  let nextLinkedQueries: typeof currentLinkedQueries | null = null;
  let nextPrimaryQueryId = proposal.queryId;
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
    nextPrimaryQueryId = primaryQuery?._id;
    patch.queryId = primaryQuery?._id;
    Object.assign(patch, proposalLinkedQuerySummary(nextLinkedQueries));
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

  // SAFETY: patch values are assigned from numeric mutation arguments above before pricing is recomputed.
  const landCostPerPax =
    (patch.landCostPerPax as number | undefined) ?? proposal.landCostPerPax ?? 0;
  // SAFETY: patch.airfarePerPax is assigned only from the numeric airfarePerPax argument above.
  const airfarePerPax = (patch.airfarePerPax as number | undefined) ?? proposal.airfarePerPax ?? 0;
  // SAFETY: patch.visaCostPerPax is assigned only from the numeric visaCostPerPax argument above.
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

  if (nextLinkedQueries !== null) {
    await rekeyCommercialFilesForProposalRelationship(
      ctx,
      proposalId,
      proposal.queryId,
      nextPrimaryQueryId
    );
  }
  await patchWithE2eOwnership(ctx, "proposals", proposalId, patch);
  await markListSearchDirty(ctx, "proposals", String(proposalId));
  await scheduleCrmMetricSync(ctx, "proposals", String(proposalId));
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
  await enqueueQueryCommercialProjections(
    ctx,
    [...currentLinkedQueries, ...(nextLinkedQueries ?? [])].map((linkedQuery) => linkedQuery._id)
  );
  return { id: proposalId };
}
