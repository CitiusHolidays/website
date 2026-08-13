import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canSeeQueryRecord, PERMISSIONS, publicQuery, requireAnyPermission } from "./lib";
import { assertListSearchReady } from "./listSearch";
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import { QUERY_COMMERCIAL_PROJECTION_VERSION } from "./queryCommercialProjection";

function queryCommercialProjection(
  row: Parameters<typeof publicQuery>[0] &
    Pick<
      Doc<"queries">,
      | "acceptedProposalId"
      | "commercialProjectionState"
      | "commercialProjectionVersion"
      | "jobCardPreview"
      | "proposalDocumentPreview"
      | "proposalPreview"
    >
) {
  const ready =
    row.commercialProjectionState === "ready" &&
    row.commercialProjectionVersion === QUERY_COMMERCIAL_PROJECTION_VERSION;
  return {
    acceptedProposalId: ready ? (row.acceptedProposalId ?? null) : null,
    commercialProjectionState: ready ? ("ready" as const) : ("preparing" as const),
    jobCardCode: ready ? (row.jobCardPreview?.jobCardCode ?? null) : null,
    jobCardId: ready ? (row.jobCardPreview?.jobCardId ?? null) : null,
    proposalDocument:
      ready && row.proposalDocumentPreview
        ? {
            fileName: row.proposalDocumentPreview.fileName,
            proposalId: row.proposalDocumentPreview.proposalId,
            uploadedAt: row.proposalDocumentPreview.uploadedAt
              ? new Date(row.proposalDocumentPreview.uploadedAt).toISOString()
              : null,
          }
        : null,
    proposalPreview:
      ready && row.proposalPreview
        ? {
            ...row.proposalPreview,
            handedOffRevision: row.proposalPreview.handedOffRevision ?? null,
            proposalRevision: row.proposalPreview.proposalRevision ?? 1,
          }
        : null,
  };
}

export function projectQueryListRow(row: Parameters<typeof publicQuery>[0]) {
  const query = publicQuery(row);
  return {
    approxMargin: query.approxMargin,
    batchingNotes: query.batchingNotes,
    budgetAmount: query.budgetAmount,
    clientName: query.clientName,
    confirmedAt: query.confirmedAt,
    contractingAirlinesCost: query.contractingAirlinesCost,
    contractingLandCost: query.contractingLandCost,
    contractingOwnerId: query.contractingOwnerId,
    contractingOwnerName: query.contractingOwnerName,
    contractingStatus: query.contractingStatus,
    contractingVisaCost: query.contractingVisaCost,
    createdAt: query.createdAt,
    destination: query.destination,
    id: query.id,
    leadStage: query.leadStage,
    lostReason: query.lostReason,
    notes: query.notes,
    paxCount: query.paxCount,
    queryCode: query.queryCode,
    queryType: query.queryType,
    salesOwnerName: query.salesOwnerName,
    salesStatus: query.salesStatus,
    submittedToContractingAt: query.submittedToContractingAt,
    ticketingOwnerId: query.ticketingOwnerId,
    ticketingOwnerName: query.ticketingOwnerName,
    ticketingScope: query.ticketingScope,
    travelEndDate: query.travelEndDate,
    travelInBatches: query.travelInBatches,
    travelStartDate: query.travelStartDate,
    travelType: query.travelType,
  };
}

export async function handleQueryListPage(
  ctx: QueryCtx,
  args: {
    contractingStatus?: string;
    createdAtFrom?: number;
    createdAtTo?: number;
    leadStage?: string;
    paginationOpts: { numItems: number; cursor: string | null };
    queryType?: string;
    salesStatus?: string;
    search?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_QUERIES,
    PERMISSIONS.VIEW_CONTRACTING,
    PERMISSIONS.VIEW_JOB_CARDS,
  ]);
  const search = args.search?.trim();
  await assertListSearchReady(ctx, "queries", search);
  const sourceQuery = search
    ? ctx.db
        .query("queries")
        .withSearchIndex("search_list", (q) => q.search("listSearchText", search))
    : ctx.db.query("queries").withIndex("by_createdAt").order("desc");
  const filteredSource = applyCrmCursorFilters(sourceQuery, {
    createdAtFrom: args.createdAtFrom,
    createdAtTo: args.createdAtTo,
    equals: {
      contractingStatus: args.contractingStatus,
      leadStage: args.leadStage,
      queryType: args.queryType,
      salesStatus: args.salesStatus,
    },
  });
  const sourcePage = await filteredSource.paginate(boundedPaginationOptions(args.paginationOpts));
  const visibleRows = sourcePage.page.filter((row) => canSeeQueryRecord(access, row));
  const page = visibleRows.map((row) => ({
    ...projectQueryListRow(row),
    attachmentCount: row.attachmentCount ?? row.attachmentPreview?.length ?? 0,
    attachments: (row.attachmentPreview ?? []).map((attachment) => ({
      ...attachment,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    ...queryCommercialProjection(row),
  }));
  return { ...sourcePage, page };
}

export async function handleQueryGetListRow(
  ctx: QueryCtx,
  args: {
    queryId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_QUERIES,
    PERMISSIONS.VIEW_CONTRACTING,
    PERMISSIONS.VIEW_JOB_CARDS,
  ]);
  const queryId = ctx.db.normalizeId("queries", args.queryId);
  if (!queryId) {
    return null;
  }
  const row = await ctx.db.get("queries", queryId);
  if (!(row && canSeeQueryRecord(access, row))) {
    return null;
  }
  const confirmedOffer = row.confirmedOfferId
    ? await ctx.db.get("confirmedOffers", row.confirmedOfferId)
    : null;
  return {
    ...publicQuery(row),
    attachmentCount: row.attachmentCount ?? row.attachmentPreview?.length ?? 0,
    attachments: (row.attachmentPreview ?? []).map((attachment) => ({
      ...attachment,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    confirmedOffer: confirmedOffer
      ? {
          airfarePerPax: confirmedOffer.airfarePerPax,
          confirmedPax: confirmedOffer.confirmedPax,
          destination: confirmedOffer.destination ?? "",
          landCostPerPax: confirmedOffer.landCostPerPax,
          profitPerPax: confirmedOffer.profitPerPax,
          proposalId: confirmedOffer.proposalId,
          sellingPricePerPax: confirmedOffer.sellingPricePerPax,
          travelEndDate: confirmedOffer.travelEndDate ?? "",
          travelStartDate: confirmedOffer.travelStartDate,
          visaCostPerPax: confirmedOffer.visaCostPerPax,
        }
      : null,
    ...queryCommercialProjection(row),
  };
}
