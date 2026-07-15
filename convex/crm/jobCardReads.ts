import { ConvexError } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import {
  canSeeJobCardRecord,
  PERMISSIONS,
  publicJobCard,
  publicTravelBatch,
  requireStaff,
} from "./lib";
import { assertListSearchReady } from "./listSearch";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  loadRowsByIdInBatches,
} from "./paginationPolicy";

export async function handleJobCardListPage(
  ctx: QueryCtx,
  args: {
    createdAtFrom?: number;
    createdAtTo?: number;
    paginationOpts: { numItems: number; cursor: string | null };
    queryType?: string;
    search?: string;
    status?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const search = args.search?.trim();
  await assertListSearchReady(ctx, "jobCards", search);
  const sourceQuery = search
    ? ctx.db
        .query("jobCards")
        .withSearchIndex("search_list", (q) => q.search("listSearchText", search))
    : ctx.db.query("jobCards").withIndex("by_createdAt").order("desc");
  const filteredSource = applyCrmCursorFilters(sourceQuery, {
    createdAtFrom: args.createdAtFrom,
    createdAtTo: args.createdAtTo,
    equals: { queryType: args.queryType, status: args.status },
  });
  const sourcePage = await filteredSource.paginate(boundedPaginationOptions(args.paginationOpts));
  const linkedQueries = await loadRowsByIdInBatches<any>(
    ctx,
    sourcePage.page.flatMap((job) => (job.queryId ? [job.queryId] : [])),
    sourcePage.page.length
  );
  const queryById = new Map(linkedQueries.map((row) => [String(row._id), row]));
  const visibleRows = sourcePage.page.filter((job) =>
    canSeeJobCardRecord(access, job, job.queryId ? queryById.get(String(job.queryId)) : null)
  );
  const page = visibleRows.map((job) =>
    publicJobCard(job, job.queryId ? queryById.get(String(job.queryId)) : null)
  );
  return { ...sourcePage, page };
}

export async function handleJobCardGetListRow(
  ctx: QueryCtx,
  args: {
    jobCardId?: string;
    queryId?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const normalizedJobCardId = args.jobCardId
    ? ctx.db.normalizeId("jobCards", args.jobCardId)
    : null;
  const normalizedQueryId = args.queryId ? ctx.db.normalizeId("queries", args.queryId) : null;
  let job = null;
  if (normalizedJobCardId) {
    job = await ctx.db.get(normalizedJobCardId);
  } else if (normalizedQueryId) {
    job = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", normalizedQueryId))
      .unique();
  }
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return publicJobCard(job, linkedQuery);
}

export async function handleListTravelBatches(
  ctx: QueryCtx,
  args: {
    jobCardId: string;
    paginationOpts: { numItems: number; cursor: string | null };
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const page = await ctx.db
    .query("travelBatches")
    .withIndex("by_jobCardId_and_createdAt", (q) => q.eq("jobCardId", jobCardId))
    .order("asc")
    .paginate(boundedPaginationOptions(args.paginationOpts));
  return { ...page, page: page.page.map(publicTravelBatch) };
}
