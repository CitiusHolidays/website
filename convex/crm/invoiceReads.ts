import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

export async function handleListInvoices(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_FINANCE);
  const page = await applyCrmCursorFilters(
    ctx.db.query("invoices").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, status: args.status } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (invoice: any) => {
    const job = await getVisibleJob(ctx, access, invoice.jobCardId);
    if (!job) {
      return null;
    }
    return {
      balanceAmount: invoice.balanceAmount,
      clientName: job?.clientName ?? "",
      dueDate: invoice.dueDate ?? "",
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
