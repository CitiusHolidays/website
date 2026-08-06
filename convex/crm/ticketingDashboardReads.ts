import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getVisibleJob } from "./jobCardVisibility";
import {
  filterRecordsByDateRange,
  isDefined,
  PERMISSIONS,
  type PortalDateRange,
  requireStaff,
} from "./lib";
import { isTicketAttentionStatus } from "./ticketStatusPolicy";

export async function collectTicketingDashboardRows(ctx: Pick<QueryCtx, "db">) {
  const tickets: Doc<"tickets">[] = [];
  for await (const ticket of ctx.db.query("tickets").withIndex("by_createdAt").order("desc")) {
    tickets.push(ticket);
  }

  const pnrs: Doc<"pnrs">[] = [];
  for await (const pnr of ctx.db.query("pnrs").withIndex("by_createdAt").order("desc")) {
    pnrs.push(pnr);
  }

  return { pnrs, tickets };
}

export async function handleDashboard(ctx: QueryCtx, args: { dateRange?: PortalDateRange }) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
  const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
  const { pnrs: pnrRows, tickets: ticketRows } = await collectTicketingDashboardRows(ctx);
  const tickets = filterRecordsByDateRange(ticketRows, dateRange);
  const pnrs = filterRecordsByDateRange(pnrRows, dateRange);
  const visibleTickets = (
    await Promise.all(
      tickets.map(async (ticket: any) =>
        (await getVisibleJob(ctx, access, ticket.jobCardId)) ? ticket : null
      )
    )
  ).filter(isDefined);
  const visiblePnrs = (
    await Promise.all(
      pnrs.map(async (pnr: any) => ((await getVisibleJob(ctx, access, pnr.jobCardId)) ? pnr : null))
    )
  ).filter(isDefined);
  const issued = visibleTickets.filter((ticket: any) => ticket.ticketStatus === "Issued").length;
  const pending = visibleTickets.filter(
    (ticket: any) => ticket.ticketStatus === "Pending Issue"
  ).length;
  const attention = visibleTickets.filter((ticket: any) =>
    isTicketAttentionStatus(ticket.ticketStatus)
  ).length;

  return {
    attention,
    cancelled: visibleTickets.filter((ticket: any) => ticket.ticketStatus === "Cancelled").length,
    fitTickets: visibleTickets.filter((ticket: any) => ticket.ticketType === "FIT Ticket").length,
    groupTickets: visibleTickets.filter((ticket: any) => ticket.ticketType === "Group Ticket")
      .length,
    issued,
    issuedSeats: visiblePnrs.reduce((sum: number, pnr: any) => sum + pnr.issuedSeats, 0),
    pending,
    pnrCount: visiblePnrs.length,
    refunded: visibleTickets.filter((ticket: any) => ticket.ticketStatus === "Refunded").length,
    totalSeats: visiblePnrs.reduce((sum: number, pnr: any) => sum + pnr.totalSeats, 0),
  };
}
