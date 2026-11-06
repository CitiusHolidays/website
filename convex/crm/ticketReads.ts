import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";
import { publicTicket } from "./ticketingPresentation";
import { createTravellerScopeReader } from "./tourManagerGroupScope";

export async function handleListTickets(
  ctx: QueryCtx,
  args: {
    jobCardId?: string;
    paginationOpts: Parameters<typeof boundedPaginationOptions>[0];
    ticketStatus?: Doc<"tickets">["ticketStatus"];
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const scopeReader = createTravellerScopeReader(ctx, access);
  const page = await applyCrmCursorFilters(
    ctx.db.query("tickets").withIndex("by_createdAt").order("desc"),
    { equals: { jobCardId: args.jobCardId, ticketStatus: args.ticketStatus } }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (ticket) => {
    const [traveller, pnr] = await Promise.all([
      ticket.travellerId ? ctx.db.get("travellers", ticket.travellerId) : null,
      ticket.pnrId ? ctx.db.get("pnrs", ticket.pnrId) : null,
    ]);
    const job = await scopeReader.jobForTraveller(ticket.jobCardId, traveller);
    const travelBatch = traveller?.travelBatchId
      ? await ctx.db.get("travelBatches", traveller.travelBatchId)
      : null;
    return job ? publicTicket(ticket, traveller, pnr, job, travelBatch) : null;
  });
  return { ...page, page: compactPageItems(rows) };
}

export async function handleGetTicketListRow(ctx: QueryCtx, args: { ticketId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
  const ticket = ticketId ? await ctx.db.get("tickets", ticketId) : null;
  if (!ticket) {
    return null;
  }
  const [traveller, pnr] = await Promise.all([
    ticket.travellerId ? ctx.db.get("travellers", ticket.travellerId) : null,
    ticket.pnrId ? ctx.db.get("pnrs", ticket.pnrId) : null,
  ]);
  const job = await createTravellerScopeReader(ctx, access).jobForTraveller(
    ticket.jobCardId,
    traveller
  );
  if (!job) {
    return null;
  }
  const travelBatch = traveller?.travelBatchId
    ? await ctx.db.get("travelBatches", traveller.travelBatchId)
    : null;
  return publicTicket(ticket, traveller, pnr, job, travelBatch);
}

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
