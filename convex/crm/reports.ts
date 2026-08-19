import { query } from "../_generated/server";
import {
  hasRole,
  isDirectorOrAdmin,
  PERMISSIONS,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import { aggregateMetric, loadMetricTotals } from "./metricAggregates";
import type { MetricValues } from "./metricTypes";
import { reportsOverviewResultValidator } from "./miscReturnContracts";
import { loadReportsSnapshot, OPERATIONAL_DETAIL_LIMIT } from "./operationalSnapshots";

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

function buildFallbackReport(queries: any[]) {
  const revenueByType = new Map<string, { queryType: string; revenue: number; count: number }>();
  for (const queryRow of queries) {
    const current = revenueByType.get(queryRow.queryType) ?? {
      count: 0,
      queryType: queryRow.queryType,
      revenue: 0,
    };
    current.count += 1;
    current.revenue += (queryRow.budgetAmount ?? 0) * Math.max(queryRow.paxCount ?? 1, 1);
    revenueByType.set(queryRow.queryType, current);
  }
  return {
    confirmedQueries: queries.filter((row) => row.salesStatus === "Order Confirmed").length,
    lostQueries: queries.filter((row) => row.salesStatus === "Order Lost").length,
    revenueByType: Array.from(revenueByType.values()),
    totalPipelineBudget: queries.reduce(
      (sum, row) => sum + (row.budgetAmount ?? 0) * Math.max(row.paxCount ?? 1, 1),
      0
    ),
  };
}

function buildLocationHeadcount(offices: any[], staff: any[]) {
  const officeNames = new Map(offices.map((office) => [office._id, office.name]));
  const locationHeadcount = new Map<string, number>();
  for (const member of staff.filter((item) => item.active)) {
    const location =
      member.location || (member.officeId ? officeNames.get(member.officeId) : "") || "Unassigned";
    locationHeadcount.set(location, (locationHeadcount.get(location) ?? 0) + 1);
  }
  return Array.from(locationHeadcount.entries())
    .map(([location, count]) => ({ count, id: location, location }))
    .sort((left, right) => right.count - left.count);
}

export const overview = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const dateRange = args.dateRange ?? undefined;
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_REPORTS);
    const [aggregate, snapshot] = await Promise.all([
      loadMetricTotals(ctx, shouldApplyCementScope(access) ? "cement" : "all", dateRange),
      loadReportsSnapshot(ctx, access, dateRange),
    ]);
    const { invoices, offices, queries, staff } = snapshot;
    const fallbackReport = buildFallbackReport(queries);

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
        detailRowLimit: OPERATIONAL_DETAIL_LIMIT,
        dirty: {
          hasPending: aggregate.readiness.dirty.hasPending,
          oldestUpdatedAt: aggregate.readiness.dirty.oldestUpdatedAt
            ? new Date(aggregate.readiness.dirty.oldestUpdatedAt).toISOString()
            : null,
        },
        freshnessMinutes: 15,
        updatedAt: aggregate.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
      },
      locationHeadcount: buildLocationHeadcount(offices, staff),
      revenueByType: (aggregate.complete
        ? aggregateReport.revenueByType
        : fallbackReport.revenueByType
      ).sort((a, b) => b.revenue - a.revenue),
      summary: {
        confirmedQueries: aggregate.complete
          ? aggregateReport.confirmedQueries
          : fallbackReport.confirmedQueries,
        confirmedRevenue,
        lostQueries: aggregate.complete ? aggregateReport.lostQueries : fallbackReport.lostQueries,
        totalPipelineBudget: aggregate.complete
          ? aggregateReport.totalPipelineBudget
          : fallbackReport.totalPipelineBudget,
      },
    };
  },
  returns: reportsOverviewResultValidator,
});
