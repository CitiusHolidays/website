import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import { assertJobCardChildRelations, normalizeOptionalChildId } from "./jobCardRelations";
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
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { mapInBoundedBatches } from "./paginationPolicy";
import {
  adjustPnrIssuedSeatsOnStatusChange,
  applyTicketStatusTransitionEffects,
} from "./ticketStatusPolicy";

function updatedRelation<Value>(next: Value | null | undefined, current: Value | undefined) {
  return next === undefined ? current : next;
}

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
  if (args.travellerId && !travellerId) {
    throw new ConvexError("Invalid traveller id");
  }
  if (args.pnrId && !pnrId) {
    throw new ConvexError("Invalid PNR id");
  }
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  await assertJobCardChildRelations(ctx, jobCardId, { pnrId, travellerId });
  const now = Date.now();
  const id = await insertWithE2eOwnership(ctx, "tickets", {
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

  await applyTicketStatusTransitionEffects(ctx, {
    effectivePnrId: pnrId,
    entityId: id,
    jobCode: job.jobCode,
    nextStatus: args.ticketStatus,
    now,
    travellerId,
  });
  await scheduleCrmMetricSync(ctx, "tickets", String(id));

  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "ticket",
    message: `Ticket ${args.ticketNumber?.trim() || id} added to ${job.jobCode}`,
  });
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
  const ticket = await ctx.db.get("tickets", ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }

  const travellerId = normalizeOptionalChildId(ctx, "travellers", args.travellerId);
  const pnrId = normalizeOptionalChildId(ctx, "pnrs", args.pnrId);
  const invalidRelation = [
    { label: "traveller", normalized: travellerId, raw: args.travellerId },
    { label: "PNR", normalized: pnrId, raw: args.pnrId },
  ].find(({ normalized, raw }) => raw && !normalized);
  if (invalidRelation) {
    throw new ConvexError(`Invalid ${invalidRelation.label} id`);
  }

  await assertJobCardChildRelations(ctx, ticket.jobCardId, {
    pnrId: updatedRelation(pnrId, ticket.pnrId),
    travellerId: updatedRelation(travellerId, ticket.travellerId),
  });

  const now = Date.now();
  const nextStatus = args.ticketStatus ?? ticket.ticketStatus;
  const patch: RuntimeObject = { updatedAt: now };
  for (const [field, value] of Object.entries({ pnrId, travellerId })) {
    if (value !== undefined) {
      patch[field] = value ?? undefined;
    }
  }
  const trimmedFields = {
    cabinClass: args.cabinClass,
    seatNumber: args.seatNumber,
    seatPreference: args.seatPreference,
    ticketNumber: args.ticketNumber,
  };
  for (const [field, value] of Object.entries(trimmedFields)) {
    if (value !== undefined) {
      patch[field] = value.trim();
    }
  }
  const directFields = {
    mealPreference: args.mealPreference,
    paymentType: args.paymentType,
    ticketStatus: args.ticketStatus,
    ticketType: args.ticketType,
  };
  for (const [field, value] of Object.entries(directFields)) {
    if (value !== undefined) {
      patch[field] = value;
    }
  }

  const effectivePnrId = updatedRelation(pnrId, ticket.pnrId) ?? null;
  await patchWithE2eOwnership(ctx, "tickets", ticketId, patch);

  const linkedTravellerId = updatedRelation(travellerId, ticket.travellerId);
  await applyTicketStatusTransitionEffects(ctx, {
    effectivePnrId,
    entityId: ticketId,
    jobCode: job.jobCode,
    nextStatus,
    now,
    previousPnrId: ticket.pnrId,
    previousStatus: ticket.ticketStatus,
    travellerId: linkedTravellerId,
  });
  await scheduleCrmMetricSync(ctx, "tickets", String(ticketId));

  await createActivity(ctx, access, {
    action: "updated",
    entityId: ticketId,
    entityType: "ticket",
    message: `Ticket ${ticket.ticketNumber || ticketId} updated`,
  });
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
  const ticket = await ctx.db.get("tickets", ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await assertJobCardChildRelations(ctx, ticket.jobCardId, {
    pnrId: ticket.pnrId,
    travellerId: ticket.travellerId,
  });
  const now = Date.now();
  await patchWithE2eOwnership(ctx, "tickets", ticketId, {
    ticketStatus: args.ticketStatus,
    updatedAt: now,
  });
  await applyTicketStatusTransitionEffects(ctx, {
    effectivePnrId: ticket.pnrId,
    entityId: ticketId,
    jobCode: job.jobCode,
    nextStatus: args.ticketStatus,
    now,
    previousPnrId: ticket.pnrId,
    previousStatus: ticket.ticketStatus,
    travellerId: ticket.travellerId,
  });
  await scheduleCrmMetricSync(ctx, "tickets", String(ticketId));
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
  const ticket = await ctx.db.get("tickets", ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await assertJobCardChildRelations(ctx, ticket.jobCardId, {
    pnrId: ticket.pnrId,
    travellerId: ticket.travellerId,
  });
  const now = Date.now();
  await adjustPnrIssuedSeatsOnStatusChange(ctx, {
    effectivePnrId: ticket.pnrId,
    now,
    wasIssued: ticket.ticketStatus === "Issued",
    willBeIssued: false,
  });
  if (ticket.travellerId) {
    await patchWithE2eOwnership(ctx, "travellers", ticket.travellerId, {
      ticketStatus: "Pending Issue",
      updatedAt: now,
    });
    await scheduleCrmMetricSync(ctx, "travellers", String(ticket.travellerId));
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: ticketId,
      entityType: "ticket",
      message: `Ticket ${ticket.ticketNumber || ticketId} deleted`,
    }),
    deleteEntityNotifications(ctx, "ticket", ticketId, deferredNotifications),
    ctx.db.delete("tickets", ticketId),
    scheduleCrmMetricSync(ctx, "tickets", String(ticketId)),
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
