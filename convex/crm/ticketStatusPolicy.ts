import { scheduleCrmMetricSync } from "./financeMetricSync";
import { publishWorkflowNotification } from "./lib";

export const TICKET_ATTENTION_STATUSES = [
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
] as const;

type TicketStatus = Doc<"tickets">["ticketStatus"];

const TICKET_ACTION_NOTIFICATION_STATUSES = ["Name Change Required", "Reissue Required"] as const;

export function isTicketAttentionStatus(status: string) {
  return TICKET_ATTENTION_STATUSES.some((candidate) => candidate === status);
}

export async function notifyTicketAttentionIfNeeded(
  ctx: MutationCtx,
  ticketStatus: TicketStatus,
  jobCode: string,
  entityId: Id<"tickets">
) {
  if (TICKET_ACTION_NOTIFICATION_STATUSES.some((candidate) => candidate === ticketStatus)) {
    const recipientRoles = ["Operations", "Operations Head"];
    await publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: recipientRoles },
      content: {
        body: `A ticket in ${jobCode} needs ${ticketStatus.toLowerCase()}.`,
        entityId,
        entityType: "ticket",
        title: "Ticketing action needed",
      },
      emailTargets: { kind: "roles", roles: recipientRoles },
    });
  }
}

export async function adjustPnrIssuedSeatsOnStatusChange(
  ctx: MutationCtx,
  {
    effectivePnrId,
    now,
    previousPnrId,
    wasIssued,
    willBeIssued,
  }: {
    effectivePnrId?: Id<"pnrs">;
    now: number;
    previousPnrId?: Id<"pnrs">;
    wasIssued: boolean;
    willBeIssued: boolean;
  }
) {
  const adjustPnr = async (pnrId: Id<"pnrs">, delta: 1 | -1) => {
    const pnr = await ctx.db.get("pnrs", pnrId);
    if (pnr) {
      await ctx.db.patch("pnrs", pnrId, {
        issuedSeats: Math.max((pnr.issuedSeats ?? 0) + delta, 0),
        updatedAt: now,
      });
      await scheduleCrmMetricSync(ctx, "pnrs", String(pnrId));
    }
  };

  if (previousPnrId !== effectivePnrId) {
    if (previousPnrId && wasIssued) {
      await adjustPnr(previousPnrId, -1);
    }
    if (effectivePnrId && willBeIssued) {
      await adjustPnr(effectivePnrId, 1);
    }
    return;
  }

  if (effectivePnrId && wasIssued !== willBeIssued) {
    await adjustPnr(effectivePnrId, willBeIssued ? 1 : -1);
  }
}

export async function syncTravellerTicketStatus(
  ctx: MutationCtx,
  travellerId: Id<"travellers"> | undefined,
  ticketStatus: TicketStatus,
  now: number
) {
  if (travellerId) {
    await ctx.db.patch("travellers", travellerId, {
      ticketStatus,
      updatedAt: now,
    });
    await scheduleCrmMetricSync(ctx, "travellers", String(travellerId));
  }
}

export async function applyTicketStatusTransitionEffects(
  ctx: MutationCtx,
  {
    effectivePnrId,
    entityId,
    jobCode,
    nextStatus,
    now,
    previousPnrId,
    previousStatus,
    travellerId,
  }: {
    effectivePnrId?: Id<"pnrs">;
    entityId: Id<"tickets">;
    jobCode: string;
    nextStatus: TicketStatus;
    now: number;
    previousPnrId?: Id<"pnrs">;
    previousStatus?: TicketStatus;
    travellerId?: Id<"travellers">;
  }
) {
  await syncTravellerTicketStatus(ctx, travellerId, nextStatus, now);
  await adjustPnrIssuedSeatsOnStatusChange(ctx, {
    effectivePnrId,
    now,
    previousPnrId,
    wasIssued: previousStatus === "Issued",
    willBeIssued: nextStatus === "Issued",
  });
  if (previousStatus !== nextStatus) {
    await notifyTicketAttentionIfNeeded(ctx, nextStatus, jobCode, entityId);
  }
}

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
