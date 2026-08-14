import type { PaginationOptions } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  INVOICE_OUTSTANDING_PROJECTION_KEY,
  isInvoiceOutstandingProjectionReady,
} from "./invoiceOutstandingPolicy";
import { getVisibleJob } from "./jobCardVisibility";
import {
  PERMISSIONS,
  type PortalDateRange,
  requireStaff,
  resolvePortalDateRange,
  shouldApplyCementScope,
} from "./lib";
import { canSeeJobCardRecord } from "./lib/recordScope";
import { aggregateMetric, loadMetricTotals } from "./metricAggregates";
import type { MetricValues } from "./metricTypes";
import {
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { assertReferenceDate } from "./referenceTimePolicy";

function jobCardCreatedAtRangeQuery(ctx: QueryCtx, dateRange?: PortalDateRange) {
  const range = resolvePortalDateRange(dateRange);
  const query = range
    ? ctx.db
        .query("jobCards")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", range.sinceMs).lte("createdAt", range.untilMs)
        )
    : ctx.db.query("jobCards").withIndex("by_createdAt");
  return query.order("desc");
}

function legacyOutstandingInvoiceQuery(ctx: QueryCtx, dateRange?: PortalDateRange) {
  const range = resolvePortalDateRange(dateRange);
  const query = range
    ? ctx.db
        .query("invoices")
        .withIndex("by_createdAt", (q) =>
          q.gte("createdAt", range.sinceMs).lte("createdAt", range.untilMs)
        )
    : ctx.db.query("invoices").withIndex("by_createdAt");
  return query.filter((q) => q.gt(q.field("balanceAmount"), 0)).order("desc");
}

function indexedOutstandingInvoiceQuery(ctx: QueryCtx, dateRange?: PortalDateRange) {
  const range = resolvePortalDateRange(dateRange);
  const query = range
    ? ctx.db
        .query("invoices")
        .withIndex("by_hasOutstandingBalance_and_createdAt", (q) =>
          q
            .eq("hasOutstandingBalance", true)
            .gte("createdAt", range.sinceMs)
            .lte("createdAt", range.untilMs)
        )
    : ctx.db
        .query("invoices")
        .withIndex("by_hasOutstandingBalance_and_createdAt", (q) =>
          q.eq("hasOutstandingBalance", true)
        );
  return query.order("desc");
}

async function outstandingInvoiceQuery(ctx: QueryCtx, dateRange?: PortalDateRange) {
  const readiness = await ctx.db
    .query("invoiceOutstandingProjectionReadiness")
    .withIndex("by_key", (q) => q.eq("key", INVOICE_OUTSTANDING_PROJECTION_KEY))
    .unique();
  return isInvoiceOutstandingProjectionReady(readiness)
    ? indexedOutstandingInvoiceQuery(ctx, dateRange)
    : legacyOutstandingInvoiceQuery(ctx, dateRange);
}

export function buildFinanceOverviewFromMetrics(values: MetricValues) {
  const outstanding = aggregateMetric(values, "invoices.outstanding");
  return {
    fundProjections: {
      advancePipeline: Math.round(aggregateMetric(values, "invoices.advancePipeline")),
      expectedCollections: outstanding,
      pendingExpenseApprovals: aggregateMetric(values, "expenseEntries.pendingApproval"),
      pendingReimbursements: aggregateMetric(values, "expenseEntries.pendingReimbursement"),
    },
    summary: {
      approvedExpenses: aggregateMetric(values, "expenseEntries.approved"),
      clientOutstanding: outstanding,
      totalRevenue: aggregateMetric(values, "invoices.expected"),
    },
  };
}

function outstandingStatus(dueDate: string | undefined, today: string) {
  if (dueDate && dueDate < today) {
    return "Overdue" as const;
  }
  if (dueDate === today) {
    return "Upcoming" as const;
  }
  return "Future" as const;
}

export async function handleGetFinanceOverview(
  ctx: QueryCtx,
  args: { dateRange?: PortalDateRange }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
  const aggregate = await loadMetricTotals(
    ctx,
    shouldApplyCementScope(access) ? "cement" : "all",
    dateRange
  );
  const overview = buildFinanceOverviewFromMetrics(aggregate.complete ? aggregate.values : {});
  return {
    aggregateCoverage: {
      bucketCount: aggregate.bucketCount,
      complete: aggregate.complete,
      dirty: {
        hasPending: aggregate.readiness.dirty.hasPending,
        oldestUpdatedAt: aggregate.readiness.dirty.oldestUpdatedAt
          ? new Date(aggregate.readiness.dirty.oldestUpdatedAt).toISOString()
          : null,
      },
      updatedAt: aggregate.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
    },
    ...overview,
  };
}

export async function handleListFinancePnl(
  ctx: QueryCtx,
  args: { dateRange?: PortalDateRange; paginationOpts: PaginationOptions }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
  const page = await jobCardCreatedAtRangeQuery(ctx, dateRange).paginate(
    boundedPaginationOptions(args.paginationOpts)
  );
  const rows = await mapInBoundedBatches(page.page, async (job) => {
    const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      return null;
    }
    const aggregate = await loadMetricTotals(ctx, `job:${String(job._id)}`, dateRange);
    if (!aggregate.complete) {
      return null;
    }
    const revenue = aggregateMetric(aggregate.values, "invoices.expected");
    const expense = aggregateMetric(aggregate.values, "expenseEntries.approved");
    const profit = revenue - expense;
    return {
      clientName: job.clientName,
      expense,
      id: job._id,
      jobCode: job.jobCode,
      marginPercent: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
      profit,
      revenue,
    };
  });
  return { ...page, page: compactPageItems(rows) };
}

export async function handleListFinanceOutstanding(
  ctx: QueryCtx,
  args: { dateRange?: PortalDateRange; paginationOpts: PaginationOptions; referenceDate: string }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
  const page = await (await outstandingInvoiceQuery(ctx, dateRange)).paginate(
    boundedPaginationOptions(args.paginationOpts)
  );
  const referenceDate = assertReferenceDate(args.referenceDate);
  const rows = await mapInBoundedBatches(page.page, async (invoice: Doc<"invoices">) => {
    const job = await getVisibleJob(ctx, access, invoice.jobCardId);
    if (!job) {
      return null;
    }
    return {
      clientName: job.clientName ?? "",
      dueAmount: invoice.balanceAmount,
      dueDate: invoice.dueDate ?? "",
      id: invoice._id,
      jobCode: job.jobCode ?? "",
      status: outstandingStatus(invoice.dueDate, referenceDate),
    };
  });
  return { ...page, page: compactPageItems(rows) };
}
