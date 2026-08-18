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
import { mapInBoundedBatches } from "./paginationPolicy";

export const MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION = 64;

export async function updateTravellerTicketSeats(
  ctx: MutationCtx,
  args: {
    jobCardId: Id<"jobCards">;
    seatNumber: string;
    travellerId: Id<"travellers">;
    updatedAt: number;
  }
) {
  const tickets = await ctx.db
    .query("tickets")
    .withIndex("by_travellerId", (q) => q.eq("travellerId", args.travellerId))
    .take(MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION + 1);
  if (tickets.length > MAX_TICKETS_PER_TRAVELLER_SEAT_PROPAGATION) {
    throw new ConvexError("Traveller has too many tickets for immediate seat propagation");
  }
  if (tickets.some((ticket) => ticket.jobCardId !== args.jobCardId)) {
    throw new ConvexError("Traveller ticket relation crosses the selected Job Card");
  }
  await Promise.all(
    tickets.map(async (ticket) => {
      await ctx.db.patch("tickets", ticket._id, {
        seatNumber: args.seatNumber,
        updatedAt: args.updatedAt,
      });
      await scheduleCrmMetricSync(ctx, "tickets", String(ticket._id));
    })
  );
  return tickets.length;
}

export async function handleSaveSeatAllocation(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    notes?: string;
    pnrId?: string;
    seatNumber: string;
    status: "Available" | "Held" | "Assigned" | "Blocked";
    travellerId?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
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
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  await assertJobCardChildRelations(ctx, jobCardId, { pnrId, travellerId });
  const now = Date.now();
  const id = await ctx.db.insert("seatAllocations", {
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    jobCardId,
    notes: args.notes?.trim() || "",
    pnrId: pnrId ?? undefined,
    seatNumber: args.seatNumber.trim().toUpperCase(),
    status: args.status,
    travellerId: travellerId ?? undefined,
    updatedAt: now,
  });
  if (travellerId && args.status === "Assigned") {
    await updateTravellerTicketSeats(ctx, {
      jobCardId,
      seatNumber: args.seatNumber.trim().toUpperCase(),
      travellerId,
      updatedAt: now,
    });
  }
  await createActivity(ctx, access, {
    action: "saved",
    entityId: id,
    entityType: "seatAllocation",
    message: `Seat ${args.seatNumber.trim().toUpperCase()} saved`,
  });
  return { id };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: relation validation and the atomic seat/ticket update remain one transaction.
export async function handleUpdateSeatAllocation(
  ctx: MutationCtx,
  args: {
    notes?: string;
    pnrId?: string;
    seatAllocationId: string;
    seatNumber?: string;
    status?: "Available" | "Held" | "Assigned" | "Blocked";
    travellerId?: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const id = ctx.db.normalizeId("seatAllocations", args.seatAllocationId);
  if (!id) {
    throw new ConvexError("Invalid seat allocation id");
  }
  const seat = await ctx.db.get("seatAllocations", id);
  if (!seat) {
    throw new ConvexError("Seat allocation not found");
  }
  const job = await getVisibleJob(ctx, access, seat.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  if (args.seatNumber !== undefined && !args.seatNumber.trim()) {
    throw new ConvexError("Seat number is required");
  }

  const travellerId = normalizeOptionalChildId(ctx, "travellers", args.travellerId);
  if (args.travellerId && !travellerId) {
    throw new ConvexError("Invalid traveller id");
  }
  const pnrId = normalizeOptionalChildId(ctx, "pnrs", args.pnrId);
  if (args.pnrId && !pnrId) {
    throw new ConvexError("Invalid PNR id");
  }

  await assertJobCardChildRelations(ctx, seat.jobCardId, {
    pnrId: pnrId === undefined ? seat.pnrId : pnrId,
    travellerId: travellerId === undefined ? seat.travellerId : travellerId,
  });

  const now = Date.now();
  const nextSeatNumber = args.seatNumber?.trim().toUpperCase() ?? seat.seatNumber;
  const nextStatus = args.status ?? seat.status;
  const patch: RuntimeObject = { updatedAt: now };
  if (travellerId !== undefined) {
    patch.travellerId = travellerId ?? undefined;
  }
  if (pnrId !== undefined) {
    patch.pnrId = pnrId ?? undefined;
  }
  if (args.seatNumber !== undefined) {
    patch.seatNumber = nextSeatNumber;
  }
  if (args.status !== undefined) {
    patch.status = args.status;
  }
  if (args.notes !== undefined) {
    patch.notes = args.notes.trim();
  }

  await ctx.db.patch("seatAllocations", id, patch);

  const linkedTravellerId = travellerId === undefined ? seat.travellerId : travellerId;
  if (linkedTravellerId && nextStatus === "Assigned") {
    await updateTravellerTicketSeats(ctx, {
      jobCardId: seat.jobCardId,
      seatNumber: nextSeatNumber,
      travellerId: linkedTravellerId,
      updatedAt: now,
    });
  }

  await createActivity(ctx, access, {
    action: "updated",
    entityId: id,
    entityType: "seatAllocation",
    message: `Seat ${nextSeatNumber} updated`,
  });
  return { id };
}

export async function deleteSeatAllocationRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  id: Id<"seatAllocations">,
  deferredNotifications?: NotificationEntityIdentity[]
) {
  const seat = await ctx.db.get("seatAllocations", id);
  if (!seat) {
    throw new ConvexError("Seat allocation not found");
  }
  const job = await getVisibleJob(ctx, access, seat.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: id,
      entityType: "seatAllocation",
      message: `Seat ${seat.seatNumber} deleted`,
    }),
    deleteEntityNotifications(ctx, "seatAllocation", id, deferredNotifications),
    ctx.db.delete("seatAllocations", id),
  ]);
}

export async function handleRemoveSeatAllocation(
  ctx: MutationCtx,
  args: { seatAllocationId: string }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const id = ctx.db.normalizeId("seatAllocations", args.seatAllocationId);
  if (!id) {
    throw new ConvexError("Invalid seat allocation id");
  }
  await deleteSeatAllocationRecord(ctx, access, id);
  return { id };
}

export async function handleRemoveManySeatAllocations(
  ctx: MutationCtx,
  args: { seatAllocationIds: string[] }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  assertBulkDeleteMutationBatch(args.seatAllocationIds.length);
  const ids: Id<"seatAllocations">[] = [];
  for (const raw of args.seatAllocationIds) {
    const id = ctx.db.normalizeId("seatAllocations", raw);
    if (!id) {
      throw new ConvexError("Invalid seat allocation id");
    }
    ids.push(id);
  }
  const notifications: NotificationEntityIdentity[] = [];
  await mapInBoundedBatches(
    ids,
    async (id) => await deleteSeatAllocationRecord(ctx, access, id, notifications),
    4
  );
  await flushDeferredNotificationCleanup(ctx, notifications);
  return { deletedCount: ids.length };
}
