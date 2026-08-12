import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  publicQuery,
  requireAnyPermission,
} from "./lib";
import { assertListSearchReady } from "./listSearch";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { compareProposalAttachmentsDescending } from "./proposalAttachmentSummary";
import { publicProposalAttachment } from "./proposalAttachments";
import { queryVisibilityFromProposalLink } from "./proposalLinkProjection";

type ProposalListLinkedQuery = ReturnType<typeof queryVisibilityFromProposalLink>;

export const publicFinalizedPdf = (proposal: Doc<"proposals">) =>
  proposal.finalizedPdfStorageId
    ? {
        fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
        uploadedAt: proposal.finalizedPdfUploadedAt
          ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
          : null,
      }
    : null;

async function boundedProposalRelations(ctx: QueryCtx, proposal: Doc<"proposals">) {
  const links = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposal._id))
    .collect();
  const queryIds = new Set<Id<"queries">>();
  if (proposal.queryId) {
    queryIds.add(proposal.queryId);
  }
  for (const link of links) {
    queryIds.add(link.queryId);
  }
  const linkedQueries = compactPageItems(
    await mapInBoundedBatches(Array.from(queryIds), async (queryId) => await ctx.db.get(queryId))
  );
  const attachments = await ctx.db
    .query("proposalAttachments")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposal._id))
    .collect();
  return { attachments, linkedQueries };
}

function projectedProposalListRelations(proposals: Doc<"proposals">[]) {
  return new Map<string, ProposalListLinkedQuery[]>(
    proposals.map((proposal) => [
      String(proposal._id),
      (proposal.linkedQueryProjection ?? []).map((projection) =>
        queryVisibilityFromProposalLink(projection)
      ),
    ])
  );
}

export function publicProposal(
  proposal: Doc<"proposals">,
  linkedQueries: Doc<"queries">[] = [],
  attachments: Doc<"proposalAttachments">[] = []
) {
  const primaryQuery =
    linkedQueries.find((linkedQuery) => linkedQuery._id === proposal.queryId) ??
    linkedQueries[0] ??
    null;
  const queryIds = linkedQueries.map((linkedQuery) => linkedQuery._id);
  const { sentToClientAt } = proposal;
  const sentToSalesAt =
    proposal.sentToSalesAt ??
    (proposal.status === "Sent" && !sentToClientAt ? proposal.sentAt : undefined);
  return {
    airfarePerPax: proposal.airfarePerPax ?? 0,
    attachmentCount: attachments.length,
    attachments: [...attachments]
      .sort(compareProposalAttachmentsDescending)
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
    queryId: primaryQuery?._id ?? null,
    queryIds,
    sellingPrice: proposal.sellingPrice ?? 0,
    sentAt: sentToClientAt ? new Date(sentToClientAt).toISOString() : null,
    sentToClientAt: sentToClientAt ? new Date(sentToClientAt).toISOString() : null,
    sentToSalesAt: sentToSalesAt ? new Date(sentToSalesAt).toISOString() : null,
    status: proposal.status,
    taxRate: proposal.taxRate ?? null,
    updatedAt: new Date(proposal.updatedAt).toISOString(),
    visaCostPerPax: proposal.visaCostPerPax ?? 0,
  };
}

export function projectProposalListRow(
  proposal: Doc<"proposals">,
  linkedQueries: ProposalListLinkedQuery[] = [],
  attachments: Doc<"proposalAttachments">[] = []
) {
  const detail = publicProposal(proposal, [], attachments);
  const attachmentPreview = proposal.attachmentPreview
    ? proposal.attachmentPreview.map((attachment) =>
        publicProposalAttachment({ ...attachment, _id: attachment.id })
      )
    : detail.attachments.slice(0, 3);
  const visibleLinkedQueryCount = linkedQueries.length;
  const queryPreview = linkedQueries.slice(0, 3).map((linkedQuery) => ({
    clientName: linkedQuery.clientName,
    contractingOwnerId: linkedQuery.contractingOwnerId ?? "",
    id: linkedQuery._id,
    paxCount: linkedQuery.paxCount,
    queryCode: linkedQuery.queryCode,
  }));
  const primaryQuery =
    queryPreview.find((linkedQuery) => String(linkedQuery.id) === String(proposal.queryId)) ??
    queryPreview[0] ??
    null;
  return {
    airfarePerPax: detail.airfarePerPax,
    attachmentCount: proposal.attachmentCount ?? detail.attachmentCount,
    attachments: attachmentPreview,
    clientName: detail.clientName,
    costPrice: detail.costPrice,
    createdAt: detail.createdAt,
    finalizedPdf: detail.finalizedPdf,
    hasCollaborators: detail.collaboratorStaffIds.length > 0,
    id: detail.id,
    itinerarySummary: detail.itinerarySummary,
    landCostPerPax: detail.landCostPerPax,
    lastEditedAt: detail.lastEditedAt,
    lastEditedByName: detail.lastEditedByName,
    linkedQueryCount: visibleLinkedQueryCount,
    preparedBy: detail.preparedBy,
    pricingEnteredAt: detail.pricingEnteredAt,
    proposalCode: detail.proposalCode,
    queries: queryPreview,
    query: primaryQuery,
    queryId: primaryQuery?.id ?? detail.queryId,
    queryIds: queryPreview.map((linkedQuery) => linkedQuery.id),
    sellingPrice: detail.sellingPrice,
    sentAt: detail.sentAt,
    sentToClientAt: detail.sentToClientAt,
    sentToSalesAt: detail.sentToSalesAt,
    status: detail.status,
    taxRate: detail.taxRate,
    updatedAt: detail.updatedAt,
    visaCostPerPax: detail.visaCostPerPax,
  };
}

export async function handleProposalListPage(
  ctx: QueryCtx,
  args: {
    createdAtFrom?: number;
    createdAtTo?: number;
    paginationOpts: { cursor: string | null; numItems: number };
    search?: string;
    status?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_PROPOSALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
  ]);
  const search = args.search?.trim() ?? "";
  await assertListSearchReady(ctx, "proposals", search);
  const source = search
    ? ctx.db
        .query("proposals")
        .withSearchIndex("search_list", (query) => query.search("listSearchText", search))
    : ctx.db.query("proposals").withIndex("by_createdAt").order("desc");
  const page = await applyCrmCursorFilters(source, {
    createdAtFrom: args.createdAtFrom,
    createdAtTo: args.createdAtTo,
    equals: { status: args.status },
  }).paginate(boundedPaginationOptions(args.paginationOpts));
  const relationsByProposal = projectedProposalListRelations(page.page);
  const hydrated = page.page.map((proposal) => {
    const linkedQueries = relationsByProposal.get(String(proposal._id)) ?? [];
    if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
      return null;
    }
    return projectProposalListRow(
      proposal,
      linkedQueries.filter((linkedQuery) => canSeeQueryRecord(access, linkedQuery))
    );
  });
  return { ...page, page: compactPageItems(hydrated) };
}

export async function handleProposalGetDetail(ctx: QueryCtx, args: { proposalId: string }) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_PROPOSALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
  ]);
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  const proposal = proposalId ? await ctx.db.get(proposalId) : null;
  if (!proposal) {
    return null;
  }
  const { attachments, linkedQueries } = await boundedProposalRelations(ctx, proposal);
  if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
    return null;
  }
  const visibleLinkedQueries = linkedQueries.filter((linkedQuery) =>
    canSeeQueryRecord(access, linkedQuery)
  );
  return publicProposal(proposal, visibleLinkedQueries, attachments);
}
