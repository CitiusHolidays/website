import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

export async function handleListInvoices(
  ctx: QueryCtx,
  args: {
    createdAtFrom?: number;
    createdAtTo?: number;
    jobCardId?: string;
    overdueBefore?: string;
    paginationOpts: Parameters<typeof boundedPaginationOptions>[0];
    status?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const source = ctx.db.query("invoices").withIndex("by_createdAt").order("desc");
  const { overdueBefore } = args;
  const dueSource = overdueBefore
    ? source.filter((q) =>
        q.and(
          q.gt(q.field("balanceAmount"), 0),
          q.gt(q.field("dueDate"), ""),
          q.lt(q.field("dueDate"), overdueBefore)
        )
      )
    : source;
  const page = await applyCrmCursorFilters(dueSource, {
    createdAtFrom: args.createdAtFrom,
    createdAtTo: args.createdAtTo,
    equals: { jobCardId: args.jobCardId, status: args.status },
  }).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (invoice) => {
    const job = await getVisibleJob(ctx, access, invoice.jobCardId);
    if (!job) {
      return null;
    }
    return {
      balanceAmount: invoice.balanceAmount,
      clientName: job?.clientName ?? "",
      dueDate: invoice.dueDate ?? "",
      ...propertiesWhen(overdueBefore, () => ({ dueStatus: "Overdue" as const })),
      expectedAmount: invoice.expectedAmount,
      generatedAt: invoice.generatedAt ? new Date(invoice.generatedAt).toISOString() : null,
      id: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      jobCardId: invoice.jobCardId,
      jobCode: job?.jobCode ?? "",
      receivedAmount: invoice.receivedAmount,
      status: invoice.status,
    };
  });
  return { ...page, page: compactPageItems(rows) };
}

import type { QueryCtx } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
