import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type AppSurface, isAppPilotOn, requireAppPilotForSurface } from "./appPilot";
import { getVisibleJob } from "./jobCardVisibility";
import {
  canSeeJobCardRecord,
  PERMISSIONS,
  publicJobCard,
  publicTravelBatch,
  requireStaff,
} from "./lib";
import { getPortalAccess } from "./lib/staffAccess";
import { assertListSearchReady } from "./listSearch";
import {
  applyCrmCreatedAtIndexRange,
  applyCrmCursorFilters,
  boundedPaginationOptions,
  loadRowsByIdInBatches,
} from "./paginationPolicy";

export function projectJobCardListRow(
  job: Parameters<typeof publicJobCard>[0],
  linkedQuery?: Parameters<typeof publicJobCard>[1]
) {
  const {
    collaboratorStaffIds,
    paymentTerms: _paymentTerms,
    preDepartureChecklist: _checklist,
    ...listRow
  } = publicJobCard(job, linkedQuery);
  return { ...listRow, hasCollaborators: collaboratorStaffIds.length > 0 };
}

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
    : ctx.db
        .query("jobCards")
        .withIndex("by_createdAt", (q) => applyCrmCreatedAtIndexRange(q, args))
        .order("desc");
  const filteredSource = applyCrmCursorFilters(sourceQuery, {
    createdAtFrom: search ? args.createdAtFrom : undefined,
    createdAtTo: search ? args.createdAtTo : undefined,
    equals: { queryType: args.queryType, status: args.status },
  });
  const sourcePage = await filteredSource.paginate(boundedPaginationOptions(args.paginationOpts));
  const linkedQueries = await loadRowsByIdInBatches(
    ctx,
    "queries",
    sourcePage.page.flatMap((job) => (job.queryId ? [job.queryId] : [])),
    sourcePage.page.length
  );
  const queryById = new Map(linkedQueries.map((row) => [String(row._id), row]));
  const visibleRows = sourcePage.page.filter((job) =>
    canSeeJobCardRecord(access, job, job.queryId ? queryById.get(String(job.queryId)) : null)
  );
  const page = visibleRows.map((job) =>
    projectJobCardListRow(job, job.queryId ? queryById.get(String(job.queryId)) : null)
  );
  return { ...sourcePage, page };
}

/**
 * Citius Connect trip list: Job Cards where the caller holds an active ("Assigned") staff Tour
 * Manager assignment, newest Job Card id first within the caller's assignments. Pages walk the
 * caller's own assignments, so a Job Card with several batch assignments appears once: only
 * the first assignment row for a Job Card emits it. Rows are still checked against
 * `canSeeJobCardRecord`, and the optional status filter applies after pagination, so a page
 * can be shorter than requested while `isDone` is false.
 */
export async function handleMyAssignedJobCardsPage(
  ctx: QueryCtx,
  args: {
    paginationOpts: { numItems: number; cursor: string | null };
    status?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const { staffId } = access;
  if (!staffId) {
    return { continueCursor: "", isDone: true, page: [] };
  }
  const assignmentPage = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_staffId_and_status_and_jobCardId", (q) =>
      q.eq("staffId", staffId).eq("status", "Assigned")
    )
    .order("desc")
    .paginate(boundedPaginationOptions(args.paginationOpts));
  const firstAssignments = await Promise.all(
    assignmentPage.page.map(async (assignment) => {
      const { jobCardId } = assignment;
      if (!jobCardId) {
        return null;
      }
      const first = await ctx.db
        .query("tourManagerAssignments")
        .withIndex("by_staffId_and_status_and_jobCardId", (q) =>
          q.eq("staffId", staffId).eq("status", "Assigned").eq("jobCardId", jobCardId)
        )
        .order("desc")
        .first();
      return first && String(first._id) === String(assignment._id) ? jobCardId : null;
    })
  );
  const jobCardIds = firstAssignments.filter((id) => id !== null);
  // Rows for Job Cards whose app pilot is off are dropped below; the page cursor still walks
  // assignments, so a short or empty page does not mean the list is done.
  const jobs = await loadRowsByIdInBatches(ctx, "jobCards", jobCardIds, jobCardIds.length);
  const jobById = new Map(jobs.map((job) => [String(job._id), job]));
  const linkedQueries = await loadRowsByIdInBatches(
    ctx,
    "queries",
    jobs.flatMap((job) => (job.queryId ? [job.queryId] : [])),
    jobs.length
  );
  const queryById = new Map(linkedQueries.map((row) => [String(row._id), row]));
  const page = jobCardIds.flatMap((jobCardId) => {
    const job = jobById.get(String(jobCardId));
    if (!job || (args.status && job.status !== args.status) || !isAppPilotOn(job)) {
      return [];
    }
    const linkedQuery = job.queryId ? queryById.get(String(job.queryId)) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      return [];
    }
    return [projectJobCardListRow(job, linkedQuery)];
  });
  return { ...assignmentPage, page };
}

async function loadVisibleJobCardRow(
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
  let job: Doc<"jobCards"> | null = null;
  if (normalizedJobCardId) {
    job = await ctx.db.get("jobCards", normalizedJobCardId);
  } else if (normalizedQueryId) {
    job = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", normalizedQueryId))
      .unique();
  }
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return { job, linkedQuery };
}

export async function handleJobCardGetListRow(
  ctx: QueryCtx,
  args: {
    jobCardId?: string;
    queryId?: string;
  }
) {
  const visible = await loadVisibleJobCardRow(ctx, args);
  return visible ? publicJobCard(visible.job, visible.linkedQuery) : null;
}

/** `getDetail`: the list row; the tour manager app surface also needs the trip's pilot on. */
export async function handleJobCardGetDetail(
  ctx: QueryCtx,
  args: { jobCardId?: string; queryId?: string; surface?: AppSurface }
) {
  const visible = await loadVisibleJobCardRow(ctx, args);
  if (!visible) {
    return null;
  }
  requireAppPilotForSurface(visible.job, args.surface);
  return publicJobCard(visible.job, visible.linkedQuery);
}

/**
 * The Job Card behind a Tour Manager assignment, for the "Tour Manager allocated" notification
 * link. Null, never an error, when the id is malformed, the assignment is gone or has no Job
 * Card, or the caller may not see that Job Card, so a stale link cannot reveal that it exists.
 */
export async function handleJobCardIdForTourManagerAssignment(
  ctx: QueryCtx,
  args: { assignmentId: string }
) {
  const access = await getPortalAccess(ctx);
  if (!(access.allowed && access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS))) {
    return null;
  }
  const assignmentId = ctx.db.normalizeId("tourManagerAssignments", args.assignmentId);
  const assignment = assignmentId ? await ctx.db.get("tourManagerAssignments", assignmentId) : null;
  if (!assignment?.jobCardId) {
    return null;
  }
  const job = await getVisibleJob(ctx, access, assignment.jobCardId);
  return job?._id ?? null;
}

export async function handleListTravelBatches(
  ctx: QueryCtx,
  args: {
    jobCardId: string;
    paginationOpts: { numItems: number; cursor: string | null };
    surface?: AppSurface;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  requireAppPilotForSurface(job, args.surface);
  const page = await ctx.db
    .query("travelBatches")
    .withIndex("by_jobCardId_and_createdAt", (q) => q.eq("jobCardId", jobCardId))
    .order("asc")
    .paginate(boundedPaginationOptions(args.paginationOpts));
  return { ...page, page: page.page.map(publicTravelBatch) };
}
