import { query } from "../_generated/server";
import {
  applyCementPortalScope,
  canSeeQueryRecord,
  filterRecordsByDateRange,
  PERMISSIONS,
  type PortalDateRange,
  portalDateRangeValidator,
  requireStaff,
} from "./lib";

export const overview = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const [
      access,
      queryRows,
      invoiceRows,
      jobCardRows,
      travellerRows,
      ticketRows,
      visaRows,
      proposalRows,
      proposalQueryLinkRows,
    ] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_REPORTS),
      ctx.db.query("queries").collect(),
      ctx.db.query("invoices").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("travellers").collect(),
      ctx.db.query("tickets").collect(),
      ctx.db.query("visaRecords").collect(),
      ctx.db.query("proposals").collect(),
      ctx.db.query("proposalQueryLinks").collect(),
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
      ctx.db.query("staffUsers").collect(),
      ctx.db.query("offices").collect(),
    ]);
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));

    const revenueByType = new Map<string, { queryType: string; revenue: number; count: number }>();
    for (const query of queries) {
      const current = revenueByType.get(query.queryType) ?? {
        count: 0,
        queryType: query.queryType,
        revenue: 0,
      };
      current.count += 1;
      current.revenue += query.budgetAmount ?? 0;
      revenueByType.set(query.queryType, current);
    }

    const locationHeadcount = new Map<string, number>();
    for (const member of staff.filter((item) => item.active)) {
      const location =
        member.location ||
        (member.officeId ? officeNames.get(member.officeId) : "") ||
        "Unassigned";
      locationHeadcount.set(location, (locationHeadcount.get(location) ?? 0) + 1);
    }

    const confirmedRevenue = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    return {
      locationHeadcount: Array.from(locationHeadcount.entries())
        .map(([location, count]) => ({ count, id: location, location }))
        .sort((a, b) => b.count - a.count),
      revenueByType: Array.from(revenueByType.values()).sort((a, b) => b.revenue - a.revenue),
      summary: {
        confirmedQueries: queries.filter((query) => query.salesStatus === "Order Confirmed").length,
        confirmedRevenue,
        lostQueries: queries.filter((query) => query.salesStatus === "Order Lost").length,
        totalPipelineBudget: queries.reduce((sum, query) => sum + (query.budgetAmount ?? 0), 0),
      },
    };
  },
});
