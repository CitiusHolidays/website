import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  canSeeDepartmentRecords,
  canSeeQueryRecord,
  PERMISSIONS,
  publicQuery,
  requireAnyPermission,
  shouldApplyCementScope,
} from "./lib";
import { assertListSearchReady } from "./listSearch";
import {
  applyCrmCreatedAtIndexRange,
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { compareProposalAttachmentsDescending } from "./proposalAttachmentSummary";
import { publicProposalAttachment } from "./proposalAttachments";
import { deriveProposalPairState, type ProposalPairState } from "./proposalLifecycle";
import {
  PROPOSAL_LINKED_QUERY_SUMMARY_VERSION,
  queryVisibilityFromProposalLink,
} from "./proposalLinkProjection";
import { resolveProposalVisibility } from "./proposalVisibility";

type ProposalListLinkedQuery = Doc<"queries"> & {
  handedOffAt?: number;
  handedOffRevision?: number;
  pairState: ProposalPairState;
  revisionRequestedAt?: number;
};

function projectLinkedQuery(
  proposal: Doc<"proposals">,
  query: Doc<"queries">,
  link: Doc<"proposalQueryLinks">
): ProposalListLinkedQuery {
  return {
    ...query,
    handedOffAt: link.handedOffAt,
    handedOffRevision: link.handedOffRevision,
    pairState: deriveProposalPairState({
      currentProposalRevision: proposalRevision(proposal),
      decisionRevision: link.decisionRevision,
      decisionStatus: link.decisionStatus,
      handedOffAt: link.handedOffAt,
      handedOffRevision: link.handedOffRevision,
      revisionRequestedAt: link.revisionRequestedAt,
    }),
    revisionRequestedAt: link.revisionRequestedAt,
  };
}

export const publicFinalizedPdf = (proposal: Doc<"proposals">) =>
  proposal.finalizedPdfStorageId
    ? {
        fileName: proposal.finalizedPdfFileName ?? "proposal.pdf",
        uploadedAt: proposal.finalizedPdfUploadedAt
          ? new Date(proposal.finalizedPdfUploadedAt).toISOString()
          : null,
        version: String(proposal.finalizedPdfStorageId),
      }
    : null;

function proposalRevision(proposal: Doc<"proposals">) {
  return proposal.proposalRevision ?? 1;
}

async function proposalAttachments(ctx: QueryCtx, proposal: Doc<"proposals">) {
  const attachments = await ctx.db
    .query("proposalAttachments")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposal._id))
    .collect();
  return attachments;
}

async function projectedProposalListRelations(ctx: QueryCtx, proposals: Doc<"proposals">[]) {
  const previewIdsByProposal = new Map(
    proposals.map((proposal) => [
      String(proposal._id),
      (proposal.linkedQuerySummaryVersion === PROPOSAL_LINKED_QUERY_SUMMARY_VERSION
        ? proposal.linkedQueryPreview
        : (proposal.linkedQueryPreview ?? proposal.linkedQueryProjection)
      )?.map((projection) => projection.queryId) ?? [],
    ])
  );
  const queryIds = Array.from(
    new Set(Array.from(previewIdsByProposal.values()).flat().map(String))
  ).flatMap((value) => {
    const queryId = ctx.db.normalizeId("queries", value);
    return queryId ? [queryId] : [];
  });
  const currentQueries = compactPageItems(
    await mapInBoundedBatches(queryIds, async (queryId) => await ctx.db.get("queries", queryId))
  );
  const queryById = new Map(currentQueries.map((query) => [String(query._id), query]));
  const pairLinks = compactPageItems(
    await mapInBoundedBatches(
      proposals.flatMap((proposal) =>
        (previewIdsByProposal.get(String(proposal._id)) ?? []).map((queryId) => ({
          proposalId: proposal._id,
          queryId,
        }))
      ),
      async ({ proposalId, queryId }) =>
        await ctx.db
          .query("proposalQueryLinks")
          .withIndex("by_proposalId_and_queryId", (query) =>
            query.eq("proposalId", proposalId).eq("queryId", queryId)
          )
          .unique()
    )
  );
  const linkByPair = new Map(
    pairLinks.map((link) => [`${String(link.proposalId)}:${String(link.queryId)}`, link])
  );
  return new Map<string, ProposalListLinkedQuery[]>(
    proposals.map((proposal) => [
      String(proposal._id),
      (previewIdsByProposal.get(String(proposal._id)) ?? []).flatMap((queryId) => {
        const query = queryById.get(String(queryId));
        const link = linkByPair.get(`${String(proposal._id)}:${String(queryId)}`);
        return query && link ? [projectLinkedQuery(proposal, query, link)] : [];
      }),
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
    proposalRevision: proposalRevision(proposal),
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
  attachments: Doc<"proposalAttachments">[] = [],
  linkedQueryCount?: number
) {
  const detail = publicProposal(proposal, [], attachments);
  const attachmentPreview = proposal.attachmentPreview
    ? proposal.attachmentPreview.map((attachment) =>
        publicProposalAttachment({ ...attachment, _id: attachment.id })
      )
    : detail.attachments.slice(0, 3);
  const visibleLinkedQueryCount = linkedQueryCount ?? linkedQueries.length;
  const queryPreview = linkedQueries.slice(0, 3).map((linkedQuery) => ({
    clientName: linkedQuery.clientName,
    contractingOwnerId: linkedQuery.contractingOwnerId ?? "",
    handedOffAt: linkedQuery.handedOffAt ? new Date(linkedQuery.handedOffAt).toISOString() : null,
    handedOffRevision: linkedQuery.handedOffRevision ?? null,
    id: linkedQuery._id,
    pairState: linkedQuery.pairState,
    paxCount: linkedQuery.paxCount,
    queryCode: linkedQuery.queryCode,
    queryType: linkedQuery.queryType,
    revisionRequestedAt: linkedQuery.revisionRequestedAt
      ? new Date(linkedQuery.revisionRequestedAt).toISOString()
      : null,
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
    previewQueryIds: queryPreview.map((linkedQuery) => linkedQuery.id),
    pricingEnteredAt: detail.pricingEnteredAt,
    proposalCode: detail.proposalCode,
    proposalRevision: detail.proposalRevision,
    query: primaryQuery,
    queryId: primaryQuery?.id ?? detail.queryId,
    queryPreview,
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
    : ctx.db
        .query("proposals")
        .withIndex("by_createdAt", (query) => applyCrmCreatedAtIndexRange(query, args))
        .order("desc");
  const page = await applyCrmCursorFilters(source, {
    createdAtFrom: search ? args.createdAtFrom : undefined,
    createdAtTo: search ? args.createdAtTo : undefined,
    equals: { status: args.status },
  }).paginate(boundedPaginationOptions(args.paginationOpts));
  const relationsByProposal = await projectedProposalListRelations(ctx, page.page);
  const hydrated = await mapInBoundedBatches(page.page, async (proposal) => {
    const linkedQueries = relationsByProposal.get(String(proposal._id)) ?? [];
    const visibility = await resolveProposalVisibility(ctx, access, proposal);
    if (!visibility.visible) {
      return null;
    }
    const visiblePreview = linkedQueries.filter((linkedQuery) =>
      canSeeQueryRecord(access, linkedQuery)
    );
    const { visibleQuery } = visibility;
    if (
      visibleQuery &&
      !visiblePreview.some((linkedQuery) => String(linkedQuery._id) === String(visibleQuery._id))
    ) {
      const visibleLink = await ctx.db
        .query("proposalQueryLinks")
        .withIndex("by_proposalId_and_queryId", (query) =>
          query.eq("proposalId", proposal._id).eq("queryId", visibleQuery._id)
        )
        .unique();
      if (visibleLink) {
        visiblePreview.push(projectLinkedQuery(proposal, visibleQuery, visibleLink));
      }
    }
    const canSeeEveryLinkedQuery =
      !shouldApplyCementScope(access) &&
      canSeeDepartmentRecords(access, [
        "Sales Head",
        "Contracting Head",
        "Operations Head",
        "Head of Ticketing",
        "Accounts Head",
      ]);
    return projectProposalListRow(
      proposal,
      visiblePreview,
      [],
      canSeeEveryLinkedQuery ? proposal.linkedQueryCount : undefined
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
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  if (!proposal) {
    return null;
  }
  const visibility = await resolveProposalVisibility(ctx, access, proposal);
  if (!visibility.visible) {
    return null;
  }
  return publicProposal(proposal, [], await proposalAttachments(ctx, proposal));
}

export async function handleProposalLinkedQueriesPage(
  ctx: QueryCtx,
  args: {
    paginationOpts: { cursor: string | null; numItems: number };
    proposalId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_PROPOSALS,
    PERMISSIONS.MANAGE_JOB_CARDS,
  ]);
  const proposalId = ctx.db.normalizeId("proposals", args.proposalId);
  const proposal = proposalId ? await ctx.db.get("proposals", proposalId) : null;
  if (!proposal) {
    return { continueCursor: "", isDone: true, page: [] };
  }
  const visibility = await resolveProposalVisibility(ctx, access, proposal);
  if (!visibility.visible) {
    return { continueCursor: "", isDone: true, page: [] };
  }
  const page = await ctx.db
    .query("proposalQueryLinks")
    .withIndex("by_proposalId", (query) => query.eq("proposalId", proposal._id))
    .paginate(boundedPaginationOptions(args.paginationOpts));
  const visibleLinks = page.page.filter((link) =>
    canSeeQueryRecord(access, queryVisibilityFromProposalLink(link))
  );
  const queries = compactPageItems(
    await mapInBoundedBatches(
      visibleLinks,
      async (link) => await ctx.db.get("queries", link.queryId)
    )
  ).filter((linkedQuery) => canSeeQueryRecord(access, linkedQuery));
  return { ...page, page: queries.map(publicQuery) };
}
