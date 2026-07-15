import { notifyRoles } from "./lib";

export const TICKET_ATTENTION_STATUSES = [
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
] as const;

const TICKET_ACTION_NOTIFICATION_STATUSES = ["Name Change Required", "Reissue Required"] as const;

export function isTicketAttentionStatus(status: string) {
  return (TICKET_ATTENTION_STATUSES as readonly string[]).includes(status);
}

export async function notifyTicketAttentionIfNeeded(
  ctx: any,
  ticketStatus: string,
  jobCode: string,
  entityId: any
) {
  if ((TICKET_ACTION_NOTIFICATION_STATUSES as readonly string[]).includes(ticketStatus)) {
    await notifyRoles(ctx, ["Operations", "Operations Head"], {
      body: `A ticket in ${jobCode} needs ${ticketStatus.toLowerCase()}.`,
      entityId,
      entityType: "ticket",
      title: "Ticketing action needed",
    });
  }
}

export async function adjustPnrIssuedSeatsOnStatusChange(
  ctx: any,
  {
    effectivePnrId,
    now,
    previousPnrId,
    wasIssued,
    willBeIssued,
  }: {
    effectivePnrId: any;
    now: number;
    previousPnrId?: any;
    wasIssued: boolean;
    willBeIssued: boolean;
  }
) {
  if (effectivePnrId && wasIssued !== willBeIssued) {
    const pnr = await ctx.db.get(effectivePnrId);
    if (pnr) {
      const delta = willBeIssued ? 1 : -1;
      await ctx.db.patch(effectivePnrId, {
        issuedSeats: Math.max((pnr.issuedSeats ?? 0) + delta, 0),
        updatedAt: now,
      });
    }
  }
  if (previousPnrId && previousPnrId !== effectivePnrId && wasIssued) {
    const oldPnr = await ctx.db.get(previousPnrId);
    if (oldPnr) {
      await ctx.db.patch(previousPnrId, {
        issuedSeats: Math.max((oldPnr.issuedSeats ?? 0) - 1, 0),
        updatedAt: now,
      });
    }
  }
}

export async function syncTravellerTicketStatus(
  ctx: any,
  travellerId: any,
  ticketStatus: string,
  now: number
) {
  if (travellerId) {
    await ctx.db.patch(travellerId, {
      ticketStatus,
      updatedAt: now,
    });
  }
}
