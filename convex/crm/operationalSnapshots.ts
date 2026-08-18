import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  applyCementPortalScope,
  applyPortalRecordScope,
  canSeeQueryRecord,
  filterRecordsByDateRange,
  PERMISSIONS,
  type PortalAccess,
  type PortalDateRange,
  resolvePortalDateRange,
  shouldApplyCementScope,
} from "./lib";

export const OPERATIONAL_DETAIL_LIMIT = 240;
export const OPERATIONAL_RELATION_LIMIT = 480;
export const RECENT_OPERATIONAL_ACTIVITY_LIMIT = 8;

type CreatedAtSnapshotTable =
  | "activityLogs"
  | "approvalRequests"
  | "invoices"
  | "jobCards"
  | "proposals"
  | "queries"
  | "tickets"
  | "travellers"
  | "visaRecords";

export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "activityLogs",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"activityLogs">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "approvalRequests",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"approvalRequests">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "invoices",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"invoices">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "jobCards",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"jobCards">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "proposals",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"proposals">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "queries",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"queries">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "tickets",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"tickets">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "travellers",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"travellers">[]>;
export function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: "visaRecords",
  dateRange?: PortalDateRange | null,
  limit?: number
): Promise<Doc<"visaRecords">[]>;
export async function loadCreatedAtSnapshotRows(
  ctx: QueryCtx,
  tableName: CreatedAtSnapshotTable,
  dateRange?: PortalDateRange | null,
  limit = OPERATIONAL_DETAIL_LIMIT
): Promise<Doc<CreatedAtSnapshotTable>[]> {
  const resolved = resolvePortalDateRange(dateRange);
  switch (tableName) {
    case "activityLogs":
      return await (resolved
        ? ctx.db
            .query("activityLogs")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("activityLogs").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "approvalRequests":
      return await (resolved
        ? ctx.db
            .query("approvalRequests")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("approvalRequests").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "invoices":
      return await (resolved
        ? ctx.db
            .query("invoices")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("invoices").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "jobCards":
      return await (resolved
        ? ctx.db
            .query("jobCards")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("jobCards").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "proposals":
      return await (resolved
        ? ctx.db
            .query("proposals")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("proposals").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "queries":
      return await (resolved
        ? ctx.db
            .query("queries")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("queries").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "tickets":
      return await (resolved
        ? ctx.db
            .query("tickets")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("tickets").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "travellers":
      return await (resolved
        ? ctx.db
            .query("travellers")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("travellers").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    case "visaRecords":
      return await (resolved
        ? ctx.db
            .query("visaRecords")
            .withIndex("by_createdAt", (q) =>
              q.gte("createdAt", resolved.sinceMs).lte("createdAt", resolved.untilMs)
            )
        : ctx.db.query("visaRecords").withIndex("by_createdAt")
      )
        .order("desc")
        .take(limit);
    default: {
      const unsupportedTable: never = tableName;
      throw new Error(`Unsupported operational snapshot table: ${unsupportedTable}`);
    }
  }
}

export async function loadDashboardCapacitySnapshot(
  ctx: QueryCtx,
  access: PortalAccess,
  dateRange?: PortalDateRange
) {
  if (!access.permissions.includes(PERMISSIONS.VIEW_TEAM)) {
    return { jobCards: [], queries: [], staff: [] };
  }
  const [queryRows, jobCardRows, staff] = await Promise.all([
    access.permissions.includes(PERMISSIONS.VIEW_QUERIES)
      ? loadCreatedAtSnapshotRows(ctx, "queries", dateRange)
      : Promise.resolve([]),
    access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)
      ? loadCreatedAtSnapshotRows(ctx, "jobCards", dateRange)
      : Promise.resolve([]),
    ctx.db.query("staffUsers").take(OPERATIONAL_DETAIL_LIMIT),
  ]);
  const scoped = applyPortalRecordScope(access, {
    invoices: [],
    jobCards: filterRecordsByDateRange(jobCardRows, dateRange),
    proposals: [],
    queries: filterRecordsByDateRange(queryRows, dateRange),
    tickets: [],
    travellers: [],
    visas: [],
  });
  return { jobCards: scoped.jobCards, queries: scoped.queries, staff };
}

export async function loadDashboardActivitySnapshot(
  ctx: QueryCtx,
  access: PortalAccess,
  dateRange?: PortalDateRange
) {
  if (!access.permissions.includes(PERMISSIONS.VIEW_ACTIVITY)) {
    return [];
  }
  return await loadCreatedAtSnapshotRows(
    ctx,
    "activityLogs",
    dateRange,
    RECENT_OPERATIONAL_ACTIVITY_LIMIT
  );
}

export async function loadDashboardSummarySnapshot(
  ctx: QueryCtx,
  access: PortalAccess,
  dateRange: PortalDateRange | undefined,
  needsFallbackRows: boolean
) {
  const canViewApprovals = access.permissions.includes(PERMISSIONS.VIEW_APPROVALS);
  const canViewFinance = access.permissions.includes(PERMISSIONS.VIEW_FINANCE);
  const canViewJobCards = access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS);
  const canViewProposals = access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS);
  const canViewQueries = access.permissions.includes(PERMISSIONS.VIEW_QUERIES);
  const canViewTickets = access.permissions.includes(PERMISSIONS.VIEW_TICKETING);
  const canViewTravellers = access.permissions.includes(PERMISSIONS.VIEW_TRAVELLERS);
  const canViewVisa = access.permissions.includes(PERMISSIONS.VIEW_VISA);
  const [
    queryRows,
    proposalRows,
    jobCardRows,
    ticketRows,
    travellerRows,
    visaRows,
    invoiceRows,
    approvalRows,
    proposalQueryLinks,
  ] = await Promise.all([
    canViewQueries ? loadCreatedAtSnapshotRows(ctx, "queries", dateRange) : Promise.resolve([]),
    needsFallbackRows && canViewProposals
      ? loadCreatedAtSnapshotRows(ctx, "proposals", dateRange)
      : Promise.resolve([]),
    canViewJobCards ? loadCreatedAtSnapshotRows(ctx, "jobCards", dateRange) : Promise.resolve([]),
    canViewTickets ? loadCreatedAtSnapshotRows(ctx, "tickets", dateRange) : Promise.resolve([]),
    needsFallbackRows && canViewTravellers
      ? loadCreatedAtSnapshotRows(ctx, "travellers", dateRange)
      : Promise.resolve([]),
    needsFallbackRows && canViewVisa
      ? loadCreatedAtSnapshotRows(ctx, "visaRecords", dateRange)
      : Promise.resolve([]),
    canViewFinance ? loadCreatedAtSnapshotRows(ctx, "invoices", dateRange) : Promise.resolve([]),
    canViewApprovals
      ? loadCreatedAtSnapshotRows(ctx, "approvalRequests", dateRange)
      : Promise.resolve([]),
    needsFallbackRows && canViewProposals && canViewQueries
      ? ctx.db.query("proposalQueryLinks").take(OPERATIONAL_RELATION_LIMIT)
      : Promise.resolve([]),
  ]);
  const records = applyPortalRecordScope(access, {
    invoices: filterRecordsByDateRange(invoiceRows, dateRange),
    jobCards: filterRecordsByDateRange(jobCardRows, dateRange),
    proposalQueryLinks,
    proposals: filterRecordsByDateRange(proposalRows, dateRange),
    queries: filterRecordsByDateRange(queryRows, dateRange),
    tickets: filterRecordsByDateRange(ticketRows, dateRange),
    travellers: filterRecordsByDateRange(travellerRows, dateRange),
    visas: filterRecordsByDateRange(visaRows, dateRange),
  });
  const allRecords = applyPortalRecordScope(access, {
    invoices: [],
    jobCards: jobCardRows,
    proposalQueryLinks,
    proposals: proposalRows,
    queries: queryRows,
    tickets: ticketRows,
    travellers: [],
    visas: [],
  });
  return {
    allJobCards: allRecords.jobCards,
    allProposals: allRecords.proposals,
    allQueries: allRecords.queries,
    allTickets: allRecords.tickets,
    approvals: canViewApprovals ? filterRecordsByDateRange(approvalRows, dateRange) : [],
    ...records,
  };
}

export async function loadReportsSnapshot(
  ctx: QueryCtx,
  access: PortalAccess,
  dateRange?: PortalDateRange
) {
  const needsCementRelations = shouldApplyCementScope(access);
  const [
    queryRows,
    invoiceRows,
    jobCardRows,
    travellerRows,
    ticketRows,
    visaRows,
    proposalRows,
    proposalQueryLinks,
    staff,
    offices,
  ] = await Promise.all([
    loadCreatedAtSnapshotRows(ctx, "queries", dateRange),
    loadCreatedAtSnapshotRows(ctx, "invoices", dateRange),
    needsCementRelations
      ? loadCreatedAtSnapshotRows(ctx, "jobCards", dateRange)
      : Promise.resolve([]),
    needsCementRelations
      ? loadCreatedAtSnapshotRows(ctx, "travellers", dateRange)
      : Promise.resolve([]),
    needsCementRelations
      ? loadCreatedAtSnapshotRows(ctx, "tickets", dateRange)
      : Promise.resolve([]),
    needsCementRelations
      ? loadCreatedAtSnapshotRows(ctx, "visaRecords", dateRange)
      : Promise.resolve([]),
    needsCementRelations
      ? loadCreatedAtSnapshotRows(ctx, "proposals", dateRange)
      : Promise.resolve([]),
    needsCementRelations
      ? ctx.db.query("proposalQueryLinks").take(OPERATIONAL_RELATION_LIMIT)
      : Promise.resolve([]),
    ctx.db.query("staffUsers").take(OPERATIONAL_DETAIL_LIMIT),
    ctx.db.query("offices").take(OPERATIONAL_DETAIL_LIMIT),
  ]);
  const scoped = applyCementPortalScope(access, {
    invoices: filterRecordsByDateRange(invoiceRows, dateRange),
    jobCards: filterRecordsByDateRange(jobCardRows, dateRange),
    proposalQueryLinks,
    proposals: filterRecordsByDateRange(proposalRows, dateRange),
    queries: filterRecordsByDateRange(queryRows, dateRange),
    tickets: filterRecordsByDateRange(ticketRows, dateRange),
    travellers: filterRecordsByDateRange(travellerRows, dateRange),
    visas: filterRecordsByDateRange(visaRows, dateRange),
  });
  return {
    invoices: scoped.invoices,
    offices,
    queries: scoped.queries.filter((row) => canSeeQueryRecord(access, row)),
    staff,
  };
}
