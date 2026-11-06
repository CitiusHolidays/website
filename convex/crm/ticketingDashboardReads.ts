import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getVisibleJob } from "./jobCardVisibility";
import {
  canSeeAllCementRecords,
  canSeeDepartmentRecords,
  hasRole,
  PERMISSIONS,
  type PortalAccess,
  type PortalDateRange,
  requireStaff,
  resolvePortalDateRange,
  shouldApplyCementScope,
} from "./lib";
import { aggregateMetric, loadMetricTotals } from "./metricAggregates";
import type { MetricValues } from "./metricTypes";
import { assertReferenceNow } from "./referenceTimePolicy";
import { publicTicket } from "./ticketingPresentation";
import { createTravellerScopeReader } from "./tourManagerGroupScope";

const DEFAULT_WORK_WINDOW_DAYS = 120;
const SOURCE_ROW_LIMIT = 120;
const PREVIEW_LIMIT = 8;

interface DashboardArgs {
  dateRange?: PortalDateRange;
  referenceNow: number;
}

function ticketingMetricScope(access: PortalAccess) {
  if (shouldApplyCementScope(access)) {
    if (canSeeAllCementRecords(access)) {
      return "cement";
    }
    return access.staffId ? `ticketing-cement:${String(access.staffId)}` : null;
  }
  if (
    canSeeDepartmentRecords(access, ["Head of Ticketing"]) ||
    hasRole(access, "Accounts") ||
    hasRole(access, "Accounts Head") ||
    hasRole(access, "Finance")
  ) {
    return "all";
  }
  return access.staffId ? `ticketing:${String(access.staffId)}` : null;
}

function dashboardWorkRange(dateRange: PortalDateRange | undefined, referenceNow: number) {
  return (
    resolvePortalDateRange(dateRange) ?? {
      sinceMs: referenceNow - DEFAULT_WORK_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      untilMs: referenceNow,
    }
  );
}

function dashboardTotals(values: MetricValues) {
  return {
    attention: aggregateMetric(values, "tickets.attention"),
    cancelled: aggregateMetric(values, "tickets.status.Cancelled"),
    fitTickets: aggregateMetric(values, "tickets.type.FIT Ticket"),
    groupTickets: aggregateMetric(values, "tickets.type.Group Ticket"),
    issued: aggregateMetric(values, "tickets.issued"),
    issuedSeats: aggregateMetric(values, "pnrs.issuedSeats"),
    pending: aggregateMetric(values, "tickets.pending"),
    pnrCount: aggregateMetric(values, "pnrs.count"),
    refunded: aggregateMetric(values, "tickets.status.Refunded"),
    totalSeats: aggregateMetric(values, "pnrs.totalSeats"),
  };
}

async function boundedTicketRowsByCreatedAt(
  ctx: Pick<QueryCtx, "db">,
  range: { sinceMs: number; untilMs: number }
) {
  return await ctx.db
    .query("tickets")
    .withIndex("by_createdAt", (q) =>
      q.gte("createdAt", range.sinceMs).lte("createdAt", range.untilMs)
    )
    .order("desc")
    .take(SOURCE_ROW_LIMIT + 1);
}

async function boundedPnrRowsByCreatedAt(
  ctx: Pick<QueryCtx, "db">,
  range: { sinceMs: number; untilMs: number }
) {
  return await ctx.db
    .query("pnrs")
    .withIndex("by_createdAt", (q) =>
      q.gte("createdAt", range.sinceMs).lte("createdAt", range.untilMs)
    )
    .order("desc")
    .take(SOURCE_ROW_LIMIT + 1);
}

export async function collectTicketingDashboardRows(
  ctx: Pick<QueryCtx, "db">,
  range: { sinceMs: number; untilMs: number }
) {
  const [ticketRows, pnrRows] = await Promise.all([
    boundedTicketRowsByCreatedAt(ctx, range),
    boundedPnrRowsByCreatedAt(ctx, range),
  ]);
  return {
    pnrs: pnrRows.slice(0, SOURCE_ROW_LIMIT),
    tickets: ticketRows.slice(0, SOURCE_ROW_LIMIT),
    truncated: pnrRows.length > SOURCE_ROW_LIMIT || ticketRows.length > SOURCE_ROW_LIMIT,
  };
}

async function visibleDashboardRows(
  ctx: QueryCtx,
  access: PortalAccess,
  tickets: Doc<"tickets">[],
  pnrs: Doc<"pnrs">[]
) {
  const jobIds = [...new Set([...tickets, ...pnrs].map((row) => row.jobCardId))];
  const visibleJobs = new Map<string, Doc<"jobCards">>();
  await Promise.all(
    jobIds.map(async (jobCardId) => {
      const job = await getVisibleJob(ctx, access, jobCardId);
      if (job) {
        visibleJobs.set(String(jobCardId), job);
      }
    })
  );
  return {
    distinctJobCount: jobIds.length,
    pnrs: pnrs.filter((pnr) => visibleJobs.has(String(pnr.jobCardId))),
    tickets: tickets.filter((ticket) => visibleJobs.has(String(ticket.jobCardId))),
    visibleJobs,
  };
}

/**
 * Preview rows name travellers, so a Tour Manager-only grant shows only its own group; the
 * counts above stay Job Card-level.
 */
async function buildTicketPreview(
  ctx: QueryCtx,
  access: PortalAccess,
  tickets: Doc<"tickets">[],
  visibleJobs: Map<string, Doc<"jobCards">>
) {
  const scopeReader = createTravellerScopeReader(ctx, access, visibleJobs);
  const candidates = await Promise.all(
    tickets.map(async (ticket) => {
      const traveller = ticket.travellerId
        ? await ctx.db.get("travellers", ticket.travellerId)
        : null;
      const job = await scopeReader.jobForTraveller(ticket.jobCardId, traveller);
      return job ? { job, ticket, traveller } : null;
    })
  );
  const inScope = candidates.filter((candidate) => candidate !== null).slice(0, PREVIEW_LIMIT);
  return await Promise.all(
    inScope.map(async ({ job, ticket, traveller }) => {
      const pnr = ticket.pnrId ? await ctx.db.get("pnrs", ticket.pnrId) : null;
      const travelBatch = traveller?.travelBatchId
        ? await ctx.db.get("travelBatches", traveller.travelBatchId)
        : null;
      return publicTicket(ticket, traveller, pnr, job, travelBatch);
    })
  );
}

export async function handleDashboard(ctx: QueryCtx, args: DashboardArgs) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const referenceNow = assertReferenceNow(args.referenceNow);
  const workRange = dashboardWorkRange(args.dateRange, referenceNow);
  const scope = ticketingMetricScope(access);
  const [aggregate, rows] = await Promise.all([
    scope ? loadMetricTotals(ctx, scope, args.dateRange, referenceNow) : null,
    collectTicketingDashboardRows(ctx, workRange),
  ]);
  const visible = await visibleDashboardRows(ctx, access, rows.tickets, rows.pnrs);
  const preview = await buildTicketPreview(ctx, access, visible.tickets, visible.visibleJobs);
  const totals = dashboardTotals(aggregate?.values ?? {});

  return {
    ...totals,
    aggregateCoverage: {
      bucketCount: aggregate?.bucketCount ?? 0,
      complete: aggregate?.complete ?? false,
      dirty: {
        hasPending: aggregate?.readiness.dirty.hasPending ?? false,
        oldestUpdatedAt: aggregate?.readiness.dirty.oldestUpdatedAt
          ? new Date(aggregate.readiness.dirty.oldestUpdatedAt).toISOString()
          : null,
      },
      scope: scope ?? "unavailable",
      updatedAt: aggregate?.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
    },
    preview,
    workCoverage: {
      distinctJobCount: visible.distinctJobCount,
      from: new Date(workRange.sinceMs).toISOString(),
      pnrRowsRead: rows.pnrs.length,
      ticketRowsRead: rows.tickets.length,
      to: new Date(workRange.untilMs).toISOString(),
      truncated: rows.truncated,
    },
  };
}
