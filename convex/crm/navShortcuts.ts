import { query } from "../_generated/server";
import {
  canSeeJobCardRecord,
  canSeeProposalRecord,
  canSeeQueryRecord,
  PERMISSIONS,
  requireStaff,
} from "./lib";

const LIMIT = 12;

type Shortcut = {
  id: string;
  label: string;
  href: string;
  dateLabel: string;
};

function formatShortcutDate(timestamp?: number) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
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
      const rows = await ctx.db.query("queries").collect();
      result.queries = rows
        .filter((row) => canSeeQueryRecord(access, row))
        .sort((a, b) => b.createdAt - a.createdAt)
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
      const rows = await ctx.db.query("proposals").collect();
      const shortcuts: Shortcut[] = [];
      for (const proposal of rows.sort((a, b) => b.createdAt - a.createdAt)) {
        if (shortcuts.length >= LIMIT) break;
        const linkedQuery = proposal.queryId ? await ctx.db.get(proposal.queryId) : null;
        if (!canSeeProposalRecord(access, proposal, linkedQuery ?? undefined)) {
          continue;
        }
        const eventDate = proposal.sentAt ?? proposal.createdAt;
        const dateLabel = formatShortcutDate(eventDate);
        const prefix = proposal.sentAt ? "Sent " : "";
        shortcuts.push({
          id: proposal._id,
          label: `${proposal.proposalCode} · ${proposal.clientName}${dateLabel ? ` · ${prefix}${dateLabel}` : ""}`,
          href: proposalHref(proposal._id),
          dateLabel,
        });
      }
      result.proposals = shortcuts;
    }

    if (access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS)) {
      const rows = await ctx.db.query("jobCards").collect();
      const shortcuts: Shortcut[] = [];
      for (const job of rows.sort((a, b) => b.createdAt - a.createdAt)) {
        if (shortcuts.length >= LIMIT) break;
        const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
        if (!canSeeJobCardRecord(access, job, linkedQuery ?? undefined)) {
          continue;
        }
        const dateLabel = formatShortcutDate(job.createdAt);
        shortcuts.push({
          id: job._id,
          label: `${job.jobCode}${dateLabel ? ` · ${dateLabel}` : ""}`,
          href: jobCardHref(job._id),
          dateLabel,
        });
      }
      result.jobCards = shortcuts;
    }

    if (access.permissions.includes(PERMISSIONS.VIEW_TICKETING)) {
      const rows = await ctx.db.query("tickets").collect();
      const shortcuts: Shortcut[] = [];
      for (const ticket of rows.sort((a, b) => b.createdAt - a.createdAt)) {
        if (shortcuts.length >= LIMIT) break;
        const job = await ctx.db.get(ticket.jobCardId);
        const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
        if (!job || !canSeeJobCardRecord(access, job, linkedQuery ?? undefined)) {
          continue;
        }
        const dateLabel = formatShortcutDate(ticket.createdAt);
        const ticketLabel = ticket.ticketNumber?.trim() || "Ticket";
        shortcuts.push({
          id: ticket._id,
          label: `${ticketLabel} · ${job.jobCode}${dateLabel ? ` · ${dateLabel}` : ""}`,
          href: ticketHref(ticket._id),
          dateLabel,
        });
      }
      result.tickets = shortcuts;
    }

    return result;
  },
});
