import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getVisibleJob } from "./jobCardVisibility";
import {
  assertBulkDeleteMutationBatch,
  createActivity,
  deleteEntityNotifications,
  flushDeferredNotificationCleanup,
  type NotificationEntityIdentity,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import { mapInBoundedBatches } from "./paginationPolicy";
import {
  adjustPnrIssuedSeatsOnStatusChange,
  notifyTicketAttentionIfNeeded,
  syncTravellerTicketStatus,
} from "./ticketStatusPolicy";

export async function handleCreateTicket(
  ctx: any,
  args: {
    cabinClass?: string;
    jobCardId: string;
    mealPreference?: "Veg" | "Non-Veg" | "Jain" | "Vegan";
    paymentType: "Company Paid" | "Self Paid" | "Upgraded Self Paid";
    pnrId?: string;
    seatNumber?: string;
    seatPreference?: string;
    ticketNumber?: string;
    ticketStatus:
      | "Pending Issue"
      | "Issued"
      | "Name Change Required"
      | "Reissue Required"
      | "Cancelled"
      | "Refund Pending"
      | "Refunded";
    ticketType?: "FIT Ticket" | "Group Ticket";
    travellerId?: string;
  }
) {
  if (!args.jobCardId.trim()) {
    throw new ConvexError("Job card is required");
  }
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  const travellerId = args.travellerId ? ctx.db.normalizeId("travellers", args.travellerId) : null;
  const pnrId = args.pnrId ? ctx.db.normalizeId("pnrs", args.pnrId) : null;
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  const now = Date.now();
  const id = await ctx.db.insert("tickets", {
    cabinClass: args.cabinClass?.trim() || "Economy",
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    jobCardId,
    mealPreference: args.mealPreference,
    paymentType: args.paymentType,
    pnrId: pnrId ?? undefined,
    seatNumber: args.seatNumber?.trim() || "",
    seatPreference: args.seatPreference?.trim() || "",
    ticketNumber: args.ticketNumber?.trim() || "",
    ticketStatus: args.ticketStatus,
    ticketType: args.ticketType,
    travellerId: travellerId ?? undefined,
    updatedAt: now,
  });

  await syncTravellerTicketStatus(ctx, travellerId, args.ticketStatus, now);
  await adjustPnrIssuedSeatsOnStatusChange(ctx, {
    effectivePnrId: pnrId,
    now,
    wasIssued: false,
    willBeIssued: args.ticketStatus === "Issued",
  });

  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "ticket",
    message: `Ticket ${args.ticketNumber?.trim() || id} added to ${job.jobCode}`,
  });
  await notifyTicketAttentionIfNeeded(ctx, args.ticketStatus, job.jobCode, id);
  return { id };
}

export async function handleUpdateTicket(
  ctx: any,
  args: {
    cabinClass?: string;
    mealPreference?: "Veg" | "Non-Veg" | "Jain" | "Vegan";
    paymentType?: "Company Paid" | "Self Paid" | "Upgraded Self Paid";
    pnrId?: string;
    seatNumber?: string;
    seatPreference?: string;
    ticketId: string;
    ticketNumber?: string;
    ticketStatus?:
      | "Pending Issue"
      | "Issued"
      | "Name Change Required"
      | "Reissue Required"
      | "Cancelled"
      | "Refund Pending"
      | "Refunded";
    ticketType?: "FIT Ticket" | "Group Ticket";
    travellerId?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
  if (!ticketId) {
    throw new ConvexError("Invalid ticket id");
  }
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }

  const travellerId = args.travellerId
    ? ctx.db.normalizeId("travellers", args.travellerId)
    : args.travellerId === ""
      ? null
      : undefined;
  if (args.travellerId && !travellerId) {
    throw new ConvexError("Invalid traveller id");
  }
  const pnrId = args.pnrId
    ? ctx.db.normalizeId("pnrs", args.pnrId)
    : args.pnrId === ""
      ? null
      : undefined;
  if (args.pnrId && !pnrId) {
    throw new ConvexError("Invalid PNR id");
  }

  const now = Date.now();
  const nextStatus = args.ticketStatus ?? ticket.ticketStatus;
  const patch: Record<string, unknown> = { updatedAt: now };
  if (travellerId !== undefined) {
    patch.travellerId = travellerId ?? undefined;
  }
  if (pnrId !== undefined) {
    patch.pnrId = pnrId ?? undefined;
  }
  if (args.ticketNumber !== undefined) {
    patch.ticketNumber = args.ticketNumber.trim();
  }
  if (args.ticketType !== undefined) {
    patch.ticketType = args.ticketType;
  }
  if (args.ticketStatus !== undefined) {
    patch.ticketStatus = args.ticketStatus;
  }
  if (args.paymentType !== undefined) {
    patch.paymentType = args.paymentType;
  }
  if (args.cabinClass !== undefined) {
    patch.cabinClass = args.cabinClass.trim();
  }
  if (args.mealPreference !== undefined) {
    patch.mealPreference = args.mealPreference;
  }
  if (args.seatPreference !== undefined) {
    patch.seatPreference = args.seatPreference.trim();
  }
  if (args.seatNumber !== undefined) {
    patch.seatNumber = args.seatNumber.trim();
  }

  const effectivePnrId = (pnrId === undefined ? ticket.pnrId : pnrId) ?? null;
  const wasIssued = ticket.ticketStatus === "Issued";
  const willBeIssued = nextStatus === "Issued";

  await ctx.db.patch(ticketId, patch);

  const linkedTravellerId = travellerId === undefined ? ticket.travellerId : travellerId;
  await syncTravellerTicketStatus(ctx, linkedTravellerId, nextStatus, now);

  await adjustPnrIssuedSeatsOnStatusChange(ctx, {
    effectivePnrId,
    now,
    previousPnrId: ticket.pnrId,
    wasIssued,
    willBeIssued,
  });

  await createActivity(ctx, access, {
    action: "updated",
    entityId: ticketId,
    entityType: "ticket",
    message: `Ticket ${ticket.ticketNumber || ticketId} updated`,
  });
  if (args.ticketStatus) {
    const notifyJob = await ctx.db.get(ticket.jobCardId);
    if (notifyJob) {
      await notifyTicketAttentionIfNeeded(ctx, args.ticketStatus, notifyJob.jobCode, ticketId);
    }
  }
  return { id: ticketId };
}

export async function handleUpdateTicketStatus(
  ctx: any,
  args: {
    ticketId: string;
    ticketStatus:
      | "Pending Issue"
      | "Issued"
      | "Name Change Required"
      | "Reissue Required"
      | "Cancelled"
      | "Refund Pending"
      | "Refunded";
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
  if (!ticketId) {
    throw new ConvexError("Invalid ticket id");
  }
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const now = Date.now();
  await ctx.db.patch(ticketId, {
    ticketStatus: args.ticketStatus,
    updatedAt: now,
  });
  await syncTravellerTicketStatus(ctx, ticket.travellerId, args.ticketStatus, now);
  await createActivity(ctx, access, {
    action: "status_updated",
    entityId: ticketId,
    entityType: "ticket",
    message: `Ticket status set to ${args.ticketStatus}`,
  });
  return { id: ticketId };
}

export async function deleteTicketRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  ticketId: Id<"tickets">,
  deferredNotifications?: NotificationEntityIdentity[]
) {
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const now = Date.now();
  await adjustPnrIssuedSeatsOnStatusChange(ctx, {
    effectivePnrId: ticket.pnrId,
    now,
    wasIssued: ticket.ticketStatus === "Issued",
    willBeIssued: false,
  });
  if (ticket.travellerId) {
    await ctx.db.patch(ticket.travellerId, {
      ticketStatus: "Pending Issue",
      updatedAt: now,
    });
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: ticketId,
      entityType: "ticket",
      message: `Ticket ${ticket.ticketNumber || ticketId} deleted`,
    }),
    deleteEntityNotifications(ctx, "ticket", ticketId, deferredNotifications),
    ctx.db.delete(ticketId),
  ]);
}

export async function handleRemoveTicket(ctx: any, args: { ticketId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
  if (!ticketId) {
    throw new ConvexError("Invalid ticket id");
  }
  await deleteTicketRecord(ctx, access, ticketId);
  return { id: ticketId };
}

export async function handleRemoveManyTickets(ctx: any, args: { ticketIds: string[] }) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  assertBulkDeleteMutationBatch(args.ticketIds.length);
  const ids: Id<"tickets">[] = [];
  for (const raw of args.ticketIds) {
    const ticketId = ctx.db.normalizeId("tickets", raw);
    if (!ticketId) {
      throw new ConvexError("Invalid ticket id");
    }
    ids.push(ticketId);
  }
  const notifications: NotificationEntityIdentity[] = [];
  await mapInBoundedBatches(
    ids,
    async (ticketId) => await deleteTicketRecord(ctx, access, ticketId, notifications),
    4
  );
  await flushDeferredNotificationCleanup(ctx, notifications);
  return { deletedCount: ids.length };
}
