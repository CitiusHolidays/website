import type { DataModel } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { query } from "../_generated/server";
import { formatDisplayDate } from "../lib/formatDate";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  requireStaff,
} from "./lib";

async function takeNewestByCreatedAt<TableName extends keyof DataModel>(
  ctx: QueryCtx,
  table: TableName,
  take: number,
) {
  return ctx.db
    .query(table)
    .withIndex("by_createdAt" as never)
    .order("desc")
    .take(take);
}

const LIMIT = 12;

type Shortcut = {
  id: string;
  label: string;
  href: string;
  dateLabel: string;
};

function formatShortcutDate(timestamp?: number) {
  if (!timestamp) return "";
  return formatDisplayDate(timestamp);
}

function queryHref(id: string) {
  return `/portal/queries?open=query&id=${encodeURIComponent(id)}`;
}

function proposalHref(id: string) {
  return `/portal/proposals?open=proposal&id=${encodeURIComponent(id)}`;
}

function jobCardHref(id: string) {
  return `/portal/job-cards?open=jobCard&id=${encodeURIComponent(id)}`;
}

function ticketHref(id: string) {
  return `/portal/tickets?open=ticket&id=${encodeURIComponent(id)}`;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx);
    const result: {
      queries: Shortcut[];
      proposals: Shortcut[];
      jobCards: Shortcut[];
      tickets: Shortcut[];
    } = {
      queries: [],
      proposals: [],
      jobCards: [],
      tickets: [],
    };

    if (access.permissions.includes(PERMISSIONS.VIEW_QUERIES)) {
      const rows = await takeNewestByCreatedAt(ctx, "queries", LIMIT * 3);
      result.queries = rows
        .filter((row) => canSeeQueryRecord(access, row))
        .slice(0, LIMIT)
        .map((row) => {
          const dateLabel = formatShortcutDate(row.createdAt);
          return {
            id: row._id,
            label: `${row.queryCode} · ${row.clientName}${dateLabel ? ` · ${dateLabel}` : ""}`,
            href: queryHref(row._id),
            dateLabel,
          };
        });
    }

    if (access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS)) {
      const rows = await takeNewestByCreatedAt(ctx, "proposals", LIMIT * 3);
      const shortcuts = await Promise.all(
        rows.map(async (proposal) => {
          const links = await ctx.db
            .query("proposalQueryLinks")
            .withIndex("by_proposalId", (q) => q.eq("proposalId", proposal._id))
            .collect();
          const queryIds = new Set<NonNullable<typeof proposal.queryId>>();
          if (proposal.queryId) {
            queryIds.add(proposal.queryId);
          }
          for (const link of links) {
            queryIds.add(link.queryId);
          }
          const linkedQueries = (
            await Promise.all(Array.from(queryIds, (queryId) => ctx.db.get(queryId)))
          ).filter(
            (linkedQuery): linkedQuery is NonNullable<typeof linkedQuery> => linkedQuery != null,
          );
          if (!canSeeProposalRecord(access, proposal, linkedQueries)) {
            return null;
          }
          const eventDate = proposal.sentAt ?? proposal.createdAt;
          const dateLabel = formatShortcutDate(eventDate);
          const prefix = proposal.sentAt ? "Sent " : "";
          return {
            id: proposal._id,
            label: `${proposal.proposalCode} · ${proposal.clientName}${dateLabel ? ` · ${prefix}${dateLabel}` : ""}`,
            href: proposalHref(proposal._id),
            dateLabel,
          };
        }),
      );
      result.proposals = shortcuts.filter(Boolean).slice(0, LIMIT) as Shortcut[];
    }

    if (access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)) {
      const rows = await takeNewestByCreatedAt(ctx, "jobCards", LIMIT * 3);
      const shortcuts = await Promise.all(
        rows.map(async (job) => {
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery ?? undefined)) {
            return null;
          }
          const dateLabel = formatShortcutDate(job.createdAt);
          return {
            id: job._id,
            label: `${job.jobCode}${dateLabel ? ` · ${dateLabel}` : ""}`,
            href: jobCardHref(job._id),
            dateLabel,
          };
        }),
      );
      result.jobCards = shortcuts.filter(Boolean).slice(0, LIMIT) as Shortcut[];
    }

    if (access.permissions.includes(PERMISSIONS.VIEW_TICKETING)) {
      const rows = await takeNewestByCreatedAt(ctx, "tickets", LIMIT * 3);
      const shortcuts = await Promise.all(
        rows.map(async (ticket) => {
          const job = await ctx.db.get(ticket.jobCardId);
          if (!job) {
            return null;
          }
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery ?? undefined)) {
            return null;
          }
          const dateLabel = formatShortcutDate(ticket.createdAt);
          const ticketLabel = ticket.ticketNumber?.trim() || "Ticket";
          return {
            id: ticket._id,
            label: `${ticketLabel} · ${job.jobCode}${dateLabel ? ` · ${dateLabel}` : ""}`,
            href: ticketHref(ticket._id),
            dateLabel,
          };
        }),
      );
      result.tickets = shortcuts.filter(Boolean).slice(0, LIMIT) as Shortcut[];
    }

    return result;
  },
});
