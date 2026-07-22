import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canSeeQueryRecord, PERMISSIONS, publicQuery, requireAnyPermission } from "./lib";
import { assertListSearchReady } from "./listSearch";
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import { resolveProposalDocumentsByQueryId } from "./proposalDocument";

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
  const proposalDocuments = await resolveProposalDocumentsByQueryId(
    ctx,
    visibleRows.map((row) => row._id)
  );
  const page = visibleRows.map((row) => ({
    ...publicQuery(row),
    attachmentCount: row.attachmentCount ?? row.attachmentPreview?.length ?? 0,
    attachments: (row.attachmentPreview ?? []).map((attachment) => ({
      ...attachment,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    proposalDocument: proposalDocuments.get(String(row._id)) ?? null,
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
  const row = await ctx.db.get(queryId);
  if (!(row && canSeeQueryRecord(access, row))) {
    return null;
  }
  const proposalDocuments = await resolveProposalDocumentsByQueryId(ctx, [
    row._id as Id<"queries">,
  ]);
  return {
    ...publicQuery(row),
    attachmentCount: row.attachmentCount ?? row.attachmentPreview?.length ?? 0,
    attachments: (row.attachmentPreview ?? []).map((attachment) => ({
      ...attachment,
      createdAt: new Date(attachment.createdAt).toISOString(),
    })),
    proposalDocument: proposalDocuments.get(String(row._id)) ?? null,
  };
}
