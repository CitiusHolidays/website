import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { publicTicket } from "./ticketingPresentation";

export async function handleListTickets(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const page = await applyCrmCursorFilters(
    ctx.db.query("tickets").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, ticketStatus: args.ticketStatus } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (ticket: any) => {
    const [traveller, pnr, job] = await Promise.all([
      ticket.travellerId ? ctx.db.get(ticket.travellerId) : null,
      ticket.pnrId ? ctx.db.get(ticket.pnrId) : null,
      getVisibleJob(ctx, access, ticket.jobCardId),
    ]);
    const travelBatch = traveller?.travelBatchId ? await ctx.db.get(traveller.travelBatchId) : null;
    return job ? publicTicket(ticket, traveller, pnr, job, travelBatch) : null;
  });
  return { ...page, page: compactPageItems(rows) };
}

export async function handleGetTicketListRow(ctx: any, args: { ticketId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
  const ticket = ticketId ? await ctx.db.get(ticketId) : null;
  if (!ticket) {
    return null;
  }
  const [traveller, pnr, job] = await Promise.all([
    ticket.travellerId ? ctx.db.get(ticket.travellerId) : null,
    ticket.pnrId ? ctx.db.get(ticket.pnrId) : null,
    getVisibleJob(ctx, access, ticket.jobCardId),
  ]);
  if (!job) {
    return null;
  }
  const travelBatch = traveller?.travelBatchId ? await ctx.db.get(traveller.travelBatchId) : null;
  return publicTicket(ticket, traveller, pnr, job, travelBatch);
}
