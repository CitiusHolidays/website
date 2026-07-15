import { query } from "../_generated/server";
import { boundedDashboardRows } from "./dashboard";
import {
  applyCementPortalScope,
  canSeeQueryRecord,
  filterRecordsByDateRange,
  hasRole,
  isDirectorOrAdmin,
  PERMISSIONS,
  type PortalDateRange,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import type { MetricValues } from "./metricAggregates";
import { aggregateMetric, loadMetricTotals } from "./metricAggregates";
import { reportsOverviewResultValidator } from "./miscReturnContracts";

const REPORT_DETAIL_LIMIT = 240;
const REPORT_RELATION_LIMIT = 480;
const REPORT_QUERY_TYPES = [
  "MICE",
  "MICE Bidding",
  "Cement",
  "Cement Bidding",
  "FIT",
  "Family Group",
  "B2B",
  "Spiritual",
] as const;

export function buildAggregateReport(values: MetricValues, confirmedOnly: boolean) {
  const revenueByType = REPORT_QUERY_TYPES.flatMap((queryType) => {
    const row = {
      count: aggregateMetric(
        values,
        `queries.type.${queryType}.${confirmedOnly ? "confirmed" : "count"}`
      ),
      queryType,
      revenue: aggregateMetric(
        values,
        `queries.type.${queryType}.${confirmedOnly ? "confirmedBudget" : "budget"}`
      ),
    };
    return row.count > 0 || row.revenue > 0 ? [row] : [];
  });
  return {
    confirmedQueries: aggregateMetric(values, "queries.confirmed"),
    lostQueries: confirmedOnly ? 0 : aggregateMetric(values, "queries.lost"),
    revenueByType,
    totalPipelineBudget: revenueByType.reduce((sum, row) => sum + row.revenue, 0),
  };
}

export const overview = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_REPORTS);
    const [
      aggregate,
      queryRows,
      invoiceRows,
      jobCardRows,
      travellerRows,
      ticketRows,
      visaRows,
      proposalRows,
      proposalQueryLinkRows,
    ] = await Promise.all([
      loadMetricTotals(ctx, shouldApplyCementScope(access) ? "cement" : "all", dateRange),
      boundedDashboardRows(ctx, "queries", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "invoices", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "jobCards", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "travellers", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "tickets", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "visaRecords", dateRange, REPORT_DETAIL_LIMIT),
      boundedDashboardRows(ctx, "proposals", dateRange, REPORT_DETAIL_LIMIT),
      ctx.db.query("proposalQueryLinks").take(REPORT_RELATION_LIMIT),
    ]);
    let queries = filterRecordsByDateRange(queryRows, dateRange);
    let invoices = filterRecordsByDateRange(invoiceRows, dateRange);
    const jobCards = filterRecordsByDateRange(jobCardRows, dateRange);
    const travellers = filterRecordsByDateRange(travellerRows, dateRange);
    const tickets = filterRecordsByDateRange(ticketRows, dateRange);
    const visas = filterRecordsByDateRange(visaRows, dateRange);
    const proposals = filterRecordsByDateRange(proposalRows, dateRange);

    const scopedRecords = applyCementPortalScope(access, {
      invoices,
      jobCards,
      proposalQueryLinks: proposalQueryLinkRows,
      proposals,
      queries,
      tickets,
      travellers,
      visas,
    });
    queries = scopedRecords.queries;
    invoices = scopedRecords.invoices;

    queries = queries.filter((row) => canSeeQueryRecord(access, row));
    const [staff, offices] = await Promise.all([
      ctx.db.query("staffUsers").take(REPORT_DETAIL_LIMIT),
      ctx.db.query("offices").take(REPORT_DETAIL_LIMIT),
    ]);
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));

    const revenueByType = new Map<string, { queryType: string; revenue: number; count: number }>();
    for (const queryRow of queries) {
      const current = revenueByType.get(queryRow.queryType) ?? {
        count: 0,
        queryType: queryRow.queryType,
        revenue: 0,
      };
      current.count += 1;
      current.revenue += queryRow.budgetAmount ?? 0;
      revenueByType.set(queryRow.queryType, current);
    }

    const locationHeadcount = new Map<string, number>();
    for (const member of staff.filter((item) => item.active)) {
      const location =
        member.location ||
        (member.officeId ? officeNames.get(member.officeId) : "") ||
        "Unassigned";
      locationHeadcount.set(location, (locationHeadcount.get(location) ?? 0) + 1);
    }

    const confirmedRevenue = aggregate.complete
      ? aggregateMetric(aggregate.values, "invoices.expected")
      : invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const confirmedOnly =
      !(isDirectorOrAdmin(access) || hasRole(access, "Accounts Head")) &&
      (hasRole(access, "Accounts") || hasRole(access, "Finance"));
    const aggregateReport = buildAggregateReport(aggregate.values, confirmedOnly);
    return {
      aggregateCoverage: {
        bucketCount: aggregate.bucketCount,
        complete: aggregate.complete,
        detailRowLimit: REPORT_DETAIL_LIMIT,
        freshnessMinutes: 15,
        updatedAt: aggregate.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
      },
      locationHeadcount: Array.from(locationHeadcount.entries())
        .map(([location, count]) => ({ count, id: location, location }))
        .sort((a, b) => b.count - a.count),
      revenueByType: (aggregate.complete
        ? aggregateReport.revenueByType
        : Array.from(revenueByType.values())
      ).sort((a, b) => b.revenue - a.revenue),
      summary: {
        confirmedQueries: aggregate.complete
          ? aggregateReport.confirmedQueries
          : queries.filter((queryRow) => queryRow.salesStatus === "Order Confirmed").length,
        confirmedRevenue,
        lostQueries: aggregate.complete
          ? aggregateReport.lostQueries
          : queries.filter((queryRow) => queryRow.salesStatus === "Order Lost").length,
        totalPipelineBudget: aggregate.complete
          ? aggregateReport.totalPipelineBudget
          : queries.reduce((sum, queryRow) => sum + (queryRow.budgetAmount ?? 0), 0),
      },
    };
  },
  returns: reportsOverviewResultValidator,
});
