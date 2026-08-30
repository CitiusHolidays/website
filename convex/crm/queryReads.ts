import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canSeeQueryRecord, PERMISSIONS, publicQuery, requireAnyPermission } from "./lib";
import { assertListSearchReady } from "./listSearch";
import {
  applyCrmCreatedAtIndexRange,
  applyCrmCursorFilters,
  boundedPaginationOptions,
  mapInBoundedBatches,
} from "./paginationPolicy";
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

export function projectQueryListRow(
  row: Parameters<typeof publicQuery>[0] & Pick<Doc<"queries">, "confirmedOfferId">
) {
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
    hasConfirmedOffer: row.confirmedOfferId !== undefined,
    id: query.id,
    leadStage: query.leadStage,
    lostReason: query.lostReason,
    notes: query.notes,
    paxCount: query.paxCount,
    queryCode: query.queryCode,
    queryType: query.queryType,
    salesOwnerId: query.salesOwnerId,
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

export function buildQueryListSource(
  ctx: QueryCtx,
  args: { createdAtFrom?: number; createdAtTo?: number; queryType?: string },
  search?: string
) {
  if (search) {
    return ctx.db
      .query("queries")
      .withSearchIndex("search_list", (q) => q.search("listSearchText", search));
  }
  if (args.queryType) {
    return ctx.db
      .query("queries")
      .withIndex("by_queryType_createdAt", (q) =>
        applyCrmCreatedAtIndexRange(
          // SAFETY: queryType is validated by the public query validator before reaching this index builder.
          q.eq("queryType", args.queryType as Doc<"queries">["queryType"]),
          args
        )
      )
      .order("desc");
  }
  return ctx.db
    .query("queries")
    .withIndex("by_createdAt", (q) => applyCrmCreatedAtIndexRange(q, args))
    .order("desc");
}

export async function handleQueryListPage(
  ctx: QueryCtx,
  args: {
    contractingStatus?: string;
    contractingStatuses?: string[];
    createdAtFrom?: number;
    createdAtTo?: number;
    leadStage?: string;
    jobCardState?: "Not opened" | "Opened";
    paginationOpts: { numItems: number; cursor: string | null };
    queryType?: string;
    salesStatus?: string;
    salesStatuses?: string[];
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
  const sourceQuery = buildQueryListSource(ctx, args, search);
  const filteredSource = applyCrmCursorFilters(sourceQuery, {
    createdAtFrom: search ? args.createdAtFrom : undefined,
    createdAtTo: search ? args.createdAtTo : undefined,
    equals: {
      contractingStatus: args.contractingStatus,
      leadStage: args.leadStage,
      queryType: search ? args.queryType : undefined,
      salesStatus: args.salesStatus,
    },
    oneOf: {
      contractingStatus: args.contractingStatuses,
      salesStatus: args.salesStatuses,
    },
  });
  const jobCardSource = args.jobCardState
    ? filteredSource.filter((q) =>
        q.or(
          q.eq(q.field("salesStatus"), "Order Confirmed"),
          q.eq(q.field("contractingStatus"), "Order Confirmed")
        )
      )
    : filteredSource;
  // Keep the storage cursor on the confirmed-query source. The Job Card state is
  // an anti-join, so filtering it after each bounded page can yield a sparse page,
  // but every later match remains reachable through `continueCursor`.
  const sourcePage = await jobCardSource.paginate(boundedPaginationOptions(args.paginationOpts));
  const visibleRows = sourcePage.page.filter((row) => canSeeQueryRecord(access, row));
  const hydratedRows = await mapInBoundedBatches(visibleRows, async (row) => {
    const linkedJob = args.jobCardState
      ? await ctx.db
          .query("jobCards")
          .withIndex("by_queryId", (q) => q.eq("queryId", row._id))
          .first()
      : null;
    return { linkedJob, row };
  });
  const page = hydratedRows
    .filter(({ linkedJob }) => {
      if (!args.jobCardState) {
        return true;
      }
      return args.jobCardState === "Opened" ? Boolean(linkedJob) : !linkedJob;
    })
    .map(({ linkedJob, row }) => {
      const output = {
        ...projectQueryListRow(row),
        attachmentCount: row.attachmentCount ?? row.attachmentPreview?.length ?? 0,
        attachments: (row.attachmentPreview ?? []).map((attachment) => ({
          ...attachment,
          createdAt: new Date(attachment.createdAt).toISOString(),
        })),
        ...queryCommercialProjection(row),
      };
      if (!args.jobCardState) {
        return output;
      }
      return {
        ...output,
        jobCardState: linkedJob ? ("Opened" as const) : ("Not opened" as const),
      };
    });
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
          id: confirmedOffer._id,
          landCostPerPax: confirmedOffer.landCostPerPax,
          profitPerPax: confirmedOffer.profitPerPax,
          proposalId: confirmedOffer.proposalId,
          proposalQueryHandoffId: confirmedOffer.proposalQueryHandoffId ?? null,
          proposalRevision: confirmedOffer.proposalRevision ?? null,
          sellingPricePerPax: confirmedOffer.sellingPricePerPax,
          travelEndDate: confirmedOffer.travelEndDate ?? "",
          travelStartDate: confirmedOffer.travelStartDate,
          visaCostPerPax: confirmedOffer.visaCostPerPax,
        }
      : null,
    ...queryCommercialProjection(row),
  };
}
