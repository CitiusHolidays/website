import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  PERMISSIONS,
  filterRecordsByCreatedAt,
  portalPeriodValidator,
  requireStaff,
  type PortalPeriod,
} from "./lib";

export const overview = query({
  args: {
    period: v.optional(portalPeriodValidator),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_REPORTS);
    const period = (args.period ?? "all") as PortalPeriod;
    const queries = filterRecordsByCreatedAt(await ctx.db.query("queries").collect(), period);
    const invoices = filterRecordsByCreatedAt(await ctx.db.query("invoices").collect(), period);
    const staff = await ctx.db.query("staffUsers").collect();
    const offices = await ctx.db.query("offices").collect();
    const officeNames = new Map(offices.map((office) => [office._id, office.name]));

    const revenueByType = new Map<string, { queryType: string; revenue: number; count: number }>();
    for (const query of queries) {
      const current = revenueByType.get(query.queryType) ?? {
        queryType: query.queryType,
        revenue: 0,
        count: 0,
      };
      current.count += 1;
      current.revenue += query.budgetAmount ?? 0;
      revenueByType.set(query.queryType, current);
    }

    const locationHeadcount = new Map<string, number>();
    for (const member of staff.filter((item) => item.active)) {
      const location =
        member.location || (member.officeId ? officeNames.get(member.officeId) : "") || "Unassigned";
      locationHeadcount.set(location, (locationHeadcount.get(location) ?? 0) + 1);
    }

    const confirmedRevenue = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    return {
      revenueByType: Array.from(revenueByType.values()).sort((a, b) => b.revenue - a.revenue),
      locationHeadcount: Array.from(locationHeadcount.entries())
        .map(([location, count]) => ({ id: location, location, count }))
        .sort((a, b) => b.count - a.count),
      summary: {
        totalPipelineBudget: queries.reduce((sum, query) => sum + (query.budgetAmount ?? 0), 0),
        confirmedRevenue,
        confirmedQueries: queries.filter((query) => query.salesStatus === "Order Confirmed").length,
        lostQueries: queries.filter((query) => query.salesStatus === "Order Lost").length,
      },
    };
  },
});
