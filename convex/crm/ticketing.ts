import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import {
  assertBulkDeleteLimit,
  canSeeJobCardRecord,
  createActivity,
  deleteEntityNotifications,
  filterRecordsByDateRange,
  isDefined,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  type PortalAccess,
  type PortalDateRange,
  portalDateRangeValidator,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";

const ticketStatusValidator = v.union(
  v.literal("Pending Issue"),
  v.literal("Issued"),
  v.literal("Name Change Required"),
  v.literal("Reissue Required"),
  v.literal("Cancelled"),
  v.literal("Refund Pending"),
  v.literal("Refunded"),
);

const paymentTypeValidator = v.union(
  v.literal("Company Paid"),
  v.literal("Self Paid"),
  v.literal("Upgraded Self Paid"),
);

const foodPreferenceValidator = v.union(
  v.literal("Veg"),
  v.literal("Non-Veg"),
  v.literal("Jain"),
  v.literal("Vegan"),
);

const ticketTypeValidator = v.union(v.literal("FIT Ticket"), v.literal("Group Ticket"));

const publicPnr = (pnr: any, job: any) => ({
  id: pnr._id,
  jobCardId: pnr.jobCardId,
  jobCode: job?.jobCode ?? "",
  clientName: job?.clientName ?? "",
  flightGroupId: pnr.flightGroupId ?? null,
  pnrCode: pnr.pnrCode,
  airline: pnr.airline,
  route: pnr.route,
  fareType: pnr.fareType ?? "",
  status: pnr.status ?? "",
  totalSeats: pnr.totalSeats,
  issuedSeats: pnr.issuedSeats,
  createdAt: new Date(pnr.createdAt).toISOString(),
  updatedAt: new Date(pnr.updatedAt).toISOString(),
});

const publicTicket = (ticket: any, traveller: any, pnr: any, job: any) => ({
  id: ticket._id,
  jobCardId: ticket.jobCardId,
  jobCode: job?.jobCode ?? "",
  clientName: job?.clientName ?? "",
  travellerId: ticket.travellerId ?? null,
  travellerName: traveller?.fullName ?? "",
  pnrId: ticket.pnrId ?? null,
  pnrCode: pnr?.pnrCode ?? "",
  ticketNumber: ticket.ticketNumber ?? "",
  ticketType: ticket.ticketType ?? "",
  ticketStatus: ticket.ticketStatus,
  paymentType: ticket.paymentType,
  cabinClass: ticket.cabinClass ?? "",
  mealPreference: ticket.mealPreference ?? "",
  seatPreference: ticket.seatPreference ?? "",
  seatNumber: ticket.seatNumber ?? "",
  createdAt: new Date(ticket.createdAt).toISOString(),
  updatedAt: new Date(ticket.updatedAt).toISOString(),
});

async function getVisibleJob(ctx: any, access: any, jobCardId: any) {
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    return null;
  }
  let linkedQuery = null;
  if (job.queryId) {
    linkedQuery = await ctx.db.get(job.queryId);
  }
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    return null;
  }
  return job;
}

export const dashboard = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const [ticketRows, pnrRows] = await Promise.all([
      ctx.db.query("tickets").collect(),
      ctx.db.query("pnrs").collect(),
    ]);
    const tickets = filterRecordsByDateRange(ticketRows, dateRange);
    const pnrs = filterRecordsByDateRange(pnrRows, dateRange);
    const visibleTickets = (
      await Promise.all(
        tickets.map(async (ticket) =>
          (await getVisibleJob(ctx, access, ticket.jobCardId)) ? ticket : null,
        ),
      )
    ).filter(isDefined);
    const visiblePnrs = (
      await Promise.all(
        pnrs.map(async (pnr) => ((await getVisibleJob(ctx, access, pnr.jobCardId)) ? pnr : null)),
      )
    ).filter(isDefined);
    const issued = visibleTickets.filter((ticket) => ticket.ticketStatus === "Issued").length;
    const pending = visibleTickets.filter(
      (ticket) => ticket.ticketStatus === "Pending Issue",
    ).length;
    const attention = visibleTickets.filter((ticket) =>
      ["Name Change Required", "Reissue Required", "Refund Pending"].includes(ticket.ticketStatus),
    ).length;

    return {
      issued,
      pending,
      attention,
      cancelled: visibleTickets.filter((ticket) => ticket.ticketStatus === "Cancelled").length,
      refunded: visibleTickets.filter((ticket) => ticket.ticketStatus === "Refunded").length,
      fitTickets: visibleTickets.filter((ticket) => ticket.ticketType === "FIT Ticket").length,
      groupTickets: visibleTickets.filter((ticket) => ticket.ticketType === "Group Ticket").length,
      pnrCount: visiblePnrs.length,
      totalSeats: visiblePnrs.reduce((sum, pnr) => sum + pnr.totalSeats, 0),
      issuedSeats: visiblePnrs.reduce((sum, pnr) => sum + pnr.issuedSeats, 0),
    };
  },
});

export const listPnrs = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("pnrs").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (pnr) => {
          const job = await getVisibleJob(ctx, access, pnr.jobCardId);
          return job ? publicPnr(pnr, job) : null;
        }),
    );
    return result.filter(Boolean);
  },
});

export const createPnr = mutation({
  args: {
    jobCardId: v.string(),
    pnrCode: v.string(),
    airline: v.string(),
    route: v.string(),
    fareType: v.optional(v.string()),
    totalSeats: v.number(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, access, jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found or not assigned to you");
    }
    const now = Date.now();
    const id = await ctx.db.insert("pnrs", {
      jobCardId,
      pnrCode: args.pnrCode.trim().toUpperCase(),
      airline: args.airline.trim(),
      route: args.route.trim(),
      fareType: args.fareType?.trim() || "",
      status: "Active",
      totalSeats: args.totalSeats,
      issuedSeats: 0,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "pnr",
      entityId: id,
      action: "created",
      message: `${args.pnrCode.trim().toUpperCase()} added to ${job.jobCode}`,
    });
    return { id };
  },
});

export const updatePnr = mutation({
  args: {
    pnrId: v.string(),
    pnrCode: v.optional(v.string()),
    airline: v.optional(v.string()),
    route: v.optional(v.string()),
    fareType: v.optional(v.string()),
    totalSeats: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const pnrId = ctx.db.normalizeId("pnrs", args.pnrId);
    if (!pnrId) {
      throw new ConvexError("Invalid PNR id");
    }
    const pnr = await ctx.db.get(pnrId);
    if (!pnr) {
      throw new ConvexError("PNR not found");
    }
    const job = await getVisibleJob(ctx, access, pnr.jobCardId);
    if (!job) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.pnrCode !== undefined && !args.pnrCode.trim()) {
      throw new ConvexError("PNR code is required");
    }
    if (args.totalSeats !== undefined && args.totalSeats < 0) {
      throw new ConvexError("Total seats cannot be negative");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.pnrCode !== undefined) patch.pnrCode = args.pnrCode.trim().toUpperCase();
    if (args.airline !== undefined) patch.airline = args.airline.trim();
    if (args.route !== undefined) patch.route = args.route.trim();
    if (args.fareType !== undefined) patch.fareType = args.fareType.trim();
    if (args.totalSeats !== undefined) patch.totalSeats = args.totalSeats;
    if (args.status !== undefined) patch.status = args.status.trim();

    await ctx.db.patch(pnrId, patch);
    await createActivity(ctx, access, {
      entityType: "pnr",
      entityId: pnrId,
      action: "updated",
      message: `${(args.pnrCode ?? pnr.pnrCode).trim().toUpperCase()} updated`,
    });
    return { id: pnrId };
  },
});

export const listTickets = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("tickets").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (ticket) => {
          const [traveller, pnr, job] = await Promise.all([
            ticket.travellerId ? ctx.db.get(ticket.travellerId) : null,
            ticket.pnrId ? ctx.db.get(ticket.pnrId) : null,
            getVisibleJob(ctx, access, ticket.jobCardId),
          ]);
          return job ? publicTicket(ticket, traveller, pnr, job) : null;
        }),
    );
    return result.filter(Boolean);
  },
});

export const createTicket = mutation({
  args: {
    jobCardId: v.string(),
    travellerId: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    ticketNumber: v.optional(v.string()),
    ticketType: v.optional(ticketTypeValidator),
    ticketStatus: ticketStatusValidator,
    paymentType: paymentTypeValidator,
    cabinClass: v.optional(v.string()),
    mealPreference: v.optional(foodPreferenceValidator),
    seatPreference: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.jobCardId.trim()) {
      throw new ConvexError("Job card is required");
    }
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const travellerId = args.travellerId
      ? ctx.db.normalizeId("travellers", args.travellerId)
      : null;
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
      jobCardId,
      travellerId: travellerId ?? undefined,
      pnrId: pnrId ?? undefined,
      ticketNumber: args.ticketNumber?.trim() || "",
      ticketType: args.ticketType,
      ticketStatus: args.ticketStatus,
      paymentType: args.paymentType,
      cabinClass: args.cabinClass?.trim() || "Economy",
      mealPreference: args.mealPreference,
      seatPreference: args.seatPreference?.trim() || "",
      seatNumber: args.seatNumber?.trim() || "",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    if (travellerId) {
      await ctx.db.patch(travellerId, {
        ticketStatus: args.ticketStatus,
        updatedAt: now,
      });
    }
    if (pnrId && args.ticketStatus === "Issued") {
      const pnr = await ctx.db.get(pnrId);
      if (pnr) {
        await ctx.db.patch(pnrId, {
          issuedSeats: pnr.issuedSeats + 1,
          updatedAt: now,
        });
      }
    }

    await createActivity(ctx, access, {
      entityType: "ticket",
      entityId: id,
      action: "created",
      message: `Ticket ${args.ticketNumber?.trim() || id} added to ${job.jobCode}`,
    });
    if (["Name Change Required", "Reissue Required"].includes(args.ticketStatus)) {
      await notifyRoles(ctx, ["Operations", "Operations Head"], {
        title: "Ticketing action needed",
        body: `A ticket in ${job.jobCode} needs ${args.ticketStatus.toLowerCase()}.`,
        entityType: "ticket",
        entityId: id,
      });
    }
    return { id };
  },
});

export const updateTicket = mutation({
  args: {
    ticketId: v.string(),
    travellerId: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    ticketNumber: v.optional(v.string()),
    ticketType: v.optional(ticketTypeValidator),
    ticketStatus: v.optional(ticketStatusValidator),
    paymentType: v.optional(paymentTypeValidator),
    cabinClass: v.optional(v.string()),
    mealPreference: v.optional(foodPreferenceValidator),
    seatPreference: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
    if (travellerId !== undefined) patch.travellerId = travellerId ?? undefined;
    if (pnrId !== undefined) patch.pnrId = pnrId ?? undefined;
    if (args.ticketNumber !== undefined) patch.ticketNumber = args.ticketNumber.trim();
    if (args.ticketType !== undefined) patch.ticketType = args.ticketType;
    if (args.ticketStatus !== undefined) patch.ticketStatus = args.ticketStatus;
    if (args.paymentType !== undefined) patch.paymentType = args.paymentType;
    if (args.cabinClass !== undefined) patch.cabinClass = args.cabinClass.trim();
    if (args.mealPreference !== undefined) patch.mealPreference = args.mealPreference;
    if (args.seatPreference !== undefined) patch.seatPreference = args.seatPreference.trim();
    if (args.seatNumber !== undefined) patch.seatNumber = args.seatNumber.trim();

    const effectivePnrId = (pnrId !== undefined ? pnrId : ticket.pnrId) ?? null;
    const wasIssued = ticket.ticketStatus === "Issued";
    const willBeIssued = nextStatus === "Issued";

    await ctx.db.patch(ticketId, patch);

    const linkedTravellerId = travellerId !== undefined ? travellerId : ticket.travellerId;
    if (linkedTravellerId) {
      await ctx.db.patch(linkedTravellerId, {
        ticketStatus: nextStatus,
        updatedAt: now,
      });
    }

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
    if (ticket.pnrId && ticket.pnrId !== effectivePnrId && wasIssued) {
      const oldPnr = await ctx.db.get(ticket.pnrId);
      if (oldPnr) {
        await ctx.db.patch(ticket.pnrId, {
          issuedSeats: Math.max((oldPnr.issuedSeats ?? 0) - 1, 0),
          updatedAt: now,
        });
      }
    }

    await createActivity(ctx, access, {
      entityType: "ticket",
      entityId: ticketId,
      action: "updated",
      message: `Ticket ${ticket.ticketNumber || ticketId} updated`,
    });
    if (
      args.ticketStatus &&
      ["Name Change Required", "Reissue Required"].includes(args.ticketStatus)
    ) {
      const job = await ctx.db.get(ticket.jobCardId);
      if (job) {
        await notifyRoles(ctx, ["Operations", "Operations Head"], {
          title: "Ticketing action needed",
          body: `A ticket in ${job.jobCode} needs ${args.ticketStatus.toLowerCase()}.`,
          entityType: "ticket",
          entityId: ticketId,
        });
      }
    }
    return { id: ticketId };
  },
});

export const updateTicketStatus = mutation({
  args: {
    ticketId: v.string(),
    ticketStatus: ticketStatusValidator,
  },
  handler: async (ctx, args) => {
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
    if (ticket.travellerId) {
      await ctx.db.patch(ticket.travellerId, {
        ticketStatus: args.ticketStatus,
        updatedAt: now,
      });
    }
    await createActivity(ctx, access, {
      entityType: "ticket",
      entityId: ticketId,
      action: "status_updated",
      message: `Ticket status set to ${args.ticketStatus}`,
    });
    return { id: ticketId };
  },
});

async function deleteTicketRecord(ctx: MutationCtx, access: PortalAccess, ticketId: Id<"tickets">) {
  const ticket = await ctx.db.get(ticketId);
  if (!ticket) {
    throw new ConvexError("Ticket not found");
  }
  const job = await getVisibleJob(ctx, access, ticket.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  if (ticket.pnrId && ticket.ticketStatus === "Issued") {
    const pnr = await ctx.db.get(ticket.pnrId);
    if (pnr) {
      await ctx.db.patch(ticket.pnrId, {
        issuedSeats: Math.max((pnr.issuedSeats ?? 0) - 1, 0),
        updatedAt: Date.now(),
      });
    }
  }
  if (ticket.travellerId) {
    await ctx.db.patch(ticket.travellerId, {
      ticketStatus: "Pending Issue",
      updatedAt: Date.now(),
    });
  }
  await Promise.all([
    createActivity(ctx, access, {
      entityType: "ticket",
      entityId: ticketId,
      action: "deleted",
      message: `Ticket ${ticket.ticketNumber || ticketId} deleted`,
    }),
    deleteEntityNotifications(ctx, "ticket", ticketId),
    ctx.db.delete(ticketId),
  ]);
}

export const removeTicket = mutation({
  args: {
    ticketId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const ticketId = ctx.db.normalizeId("tickets", args.ticketId);
    if (!ticketId) {
      throw new ConvexError("Invalid ticket id");
    }
    await deleteTicketRecord(ctx, access, ticketId);
    return { id: ticketId };
  },
});

export const removeManyTickets = mutation({
  args: {
    ticketIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    assertBulkDeleteLimit(args.ticketIds.length);
    const ids: Id<"tickets">[] = [];
    for (const raw of args.ticketIds) {
      const ticketId = ctx.db.normalizeId("tickets", raw);
      if (!ticketId) {
        throw new ConvexError("Invalid ticket id");
      }
      ids.push(ticketId);
    }
    await Promise.all(ids.map((ticketId) => deleteTicketRecord(ctx, access, ticketId)));
    return { deletedCount: ids.length };
  },
});

export const listSeatAllocations = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_TICKETING),
      ctx.db.query("seatAllocations").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => a.seatNumber.localeCompare(b.seatNumber))
        .map(async (seat) => {
          const [traveller, job] = await Promise.all([
            seat.travellerId ? ctx.db.get(seat.travellerId) : null,
            getVisibleJob(ctx, access, seat.jobCardId),
          ]);
          if (!job) return null;
          return {
            id: seat._id,
            jobCardId: seat.jobCardId,
            jobCode: job?.jobCode ?? "",
            clientName: job?.clientName ?? "",
            travellerId: seat.travellerId ?? null,
            travellerName: traveller?.fullName ?? "",
            pnrId: seat.pnrId ?? null,
            seatNumber: seat.seatNumber,
            status: seat.status,
            notes: seat.notes ?? "",
            createdAt: new Date(seat.createdAt).toISOString(),
          };
        }),
    );
    return result.filter(Boolean);
  },
});

export const saveSeatAllocation = mutation({
  args: {
    jobCardId: v.string(),
    travellerId: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    seatNumber: v.string(),
    status: v.union(
      v.literal("Available"),
      v.literal("Held"),
      v.literal("Assigned"),
      v.literal("Blocked"),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const travellerId = args.travellerId
      ? ctx.db.normalizeId("travellers", args.travellerId)
      : null;
    const pnrId = args.pnrId ? ctx.db.normalizeId("pnrs", args.pnrId) : null;
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await getVisibleJob(ctx, access, jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found or not assigned to you");
    }
    const now = Date.now();
    const id = await ctx.db.insert("seatAllocations", {
      jobCardId,
      travellerId: travellerId ?? undefined,
      pnrId: pnrId ?? undefined,
      seatNumber: args.seatNumber.trim().toUpperCase(),
      status: args.status,
      notes: args.notes?.trim() || "",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    if (travellerId && args.status === "Assigned") {
      const tickets = await ctx.db
        .query("tickets")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", travellerId))
        .collect();
      await Promise.all(
        tickets.map((ticket) =>
          ctx.db.patch(ticket._id, {
            seatNumber: args.seatNumber.trim().toUpperCase(),
            updatedAt: now,
          }),
        ),
      );
    }
    await createActivity(ctx, access, {
      entityType: "seatAllocation",
      entityId: id,
      action: "saved",
      message: `Seat ${args.seatNumber.trim().toUpperCase()} saved`,
    });
    return { id };
  },
});

export const updateSeatAllocation = mutation({
  args: {
    seatAllocationId: v.string(),
    travellerId: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("Available"),
        v.literal("Held"),
        v.literal("Assigned"),
        v.literal("Blocked"),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const id = ctx.db.normalizeId("seatAllocations", args.seatAllocationId);
    if (!id) {
      throw new ConvexError("Invalid seat allocation id");
    }
    const seat = await ctx.db.get(id);
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
    const nextSeatNumber = args.seatNumber?.trim().toUpperCase() ?? seat.seatNumber;
    const nextStatus = args.status ?? seat.status;
    const patch: Record<string, unknown> = { updatedAt: now };
    if (travellerId !== undefined) patch.travellerId = travellerId ?? undefined;
    if (pnrId !== undefined) patch.pnrId = pnrId ?? undefined;
    if (args.seatNumber !== undefined) patch.seatNumber = nextSeatNumber;
    if (args.status !== undefined) patch.status = args.status;
    if (args.notes !== undefined) patch.notes = args.notes.trim();

    await ctx.db.patch(id, patch);

    const linkedTravellerId = travellerId !== undefined ? travellerId : seat.travellerId;
    if (linkedTravellerId && nextStatus === "Assigned") {
      const tickets = await ctx.db
        .query("tickets")
        .withIndex("by_travellerId", (q) => q.eq("travellerId", linkedTravellerId))
        .collect();
      await Promise.all(
        tickets.map((ticket) =>
          ctx.db.patch(ticket._id, {
            seatNumber: nextSeatNumber,
            updatedAt: now,
          }),
        ),
      );
    }

    await createActivity(ctx, access, {
      entityType: "seatAllocation",
      entityId: id,
      action: "updated",
      message: `Seat ${nextSeatNumber} updated`,
    });
    return { id };
  },
});

async function deletePnrRecord(ctx: MutationCtx, access: PortalAccess, pnrId: Id<"pnrs">) {
  const pnr = await ctx.db.get(pnrId);
  if (!pnr) {
    throw new ConvexError("PNR not found");
  }
  const job = await getVisibleJob(ctx, access, pnr.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  const [tickets, seats] = await Promise.all([
    ctx.db
      .query("tickets")
      .withIndex("by_pnrId", (q) => q.eq("pnrId", pnrId))
      .collect(),
    ctx.db
      .query("seatAllocations")
      .withIndex("by_pnrId", (q) => q.eq("pnrId", pnrId))
      .collect(),
  ]);
  await Promise.all([
    ...tickets.flatMap((ticket) =>
      [
        ticket.travellerId
          ? ctx.db.patch(ticket.travellerId, {
              ticketStatus: "Pending Issue",
              updatedAt: Date.now(),
            })
          : null,
        deleteEntityNotifications(ctx, "ticket", ticket._id),
        ctx.db.delete(ticket._id),
      ].filter(Boolean),
    ),
    ...seats.flatMap((seat) => [
      deleteEntityNotifications(ctx, "seatAllocation", seat._id),
      ctx.db.delete(seat._id),
    ]),
    createActivity(ctx, access, {
      entityType: "pnr",
      entityId: pnrId,
      action: "deleted",
      message: `${pnr.pnrCode} deleted`,
    }),
    deleteEntityNotifications(ctx, "pnr", pnrId),
    ctx.db.delete(pnrId),
  ]);
}

export const removePnr = mutation({
  args: {
    pnrId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const pnrId = ctx.db.normalizeId("pnrs", args.pnrId);
    if (!pnrId) {
      throw new ConvexError("Invalid PNR id");
    }
    await deletePnrRecord(ctx, access, pnrId);
    return { id: pnrId };
  },
});

export const removeManyPnrs = mutation({
  args: {
    pnrIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    assertBulkDeleteLimit(args.pnrIds.length);
    const ids: Id<"pnrs">[] = [];
    for (const raw of args.pnrIds) {
      const pnrId = ctx.db.normalizeId("pnrs", raw);
      if (!pnrId) {
        throw new ConvexError("Invalid PNR id");
      }
      ids.push(pnrId);
    }
    await Promise.all(ids.map((pnrId) => deletePnrRecord(ctx, access, pnrId)));
    return { deletedCount: ids.length };
  },
});

export const assignTicketingOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Head of Ticketing"]);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) {
      throw new ConvexError("Invalid staff id");
    }
    const staff = await ctx.db.get(staffId);
    if (!staff?.active) {
      throw new ConvexError("Staff member not found");
    }
    const isTicketingTeam = staff.roles.some((role) =>
      ["Ticketing", "Head of Ticketing"].includes(role),
    );
    if (!isTicketingTeam) {
      throw new ConvexError("Selected staff member is not on the ticketing team");
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    const ownerName = staff.name.trim();
    await Promise.all([
      ctx.db.patch(jobCardId, {
        ticketingOwnerId: staffId,
        ticketingOwnerName: ownerName,
        updatedAt: Date.now(),
      }),
      createActivity(ctx, access, {
        entityType: "jobCard",
        entityId: jobCardId,
        action: "assigned_ticketing",
        message: `${job.jobCode} assigned to ${ownerName} (Ticketing)`,
      }),
      notifyStaffMember(ctx, staffId, {
        title: "Assign ticketing owner",
        body: `You were assigned as ticketing owner for ${job.jobCode}.`,
        entityType: "jobCard",
        entityId: jobCardId,
      }),
    ]);
    return { id: jobCardId };
  },
});

async function deleteSeatAllocationRecord(
  ctx: MutationCtx,
  access: PortalAccess,
  id: Id<"seatAllocations">,
) {
  const seat = await ctx.db.get(id);
  if (!seat) {
    throw new ConvexError("Seat allocation not found");
  }
  const job = await getVisibleJob(ctx, access, seat.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await Promise.all([
    createActivity(ctx, access, {
      entityType: "seatAllocation",
      entityId: id,
      action: "deleted",
      message: `Seat ${seat.seatNumber} deleted`,
    }),
    deleteEntityNotifications(ctx, "seatAllocation", id),
    ctx.db.delete(id),
  ]);
}

export const removeSeatAllocation = mutation({
  args: {
    seatAllocationId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const id = ctx.db.normalizeId("seatAllocations", args.seatAllocationId);
    if (!id) {
      throw new ConvexError("Invalid seat allocation id");
    }
    await deleteSeatAllocationRecord(ctx, access, id);
    return { id };
  },
});

export const removeManySeatAllocations = mutation({
  args: {
    seatAllocationIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    assertBulkDeleteLimit(args.seatAllocationIds.length);
    const ids: Id<"seatAllocations">[] = [];
    for (const raw of args.seatAllocationIds) {
      const id = ctx.db.normalizeId("seatAllocations", raw);
      if (!id) {
        throw new ConvexError("Invalid seat allocation id");
      }
      ids.push(id);
    }
    await Promise.all(ids.map((id) => deleteSeatAllocationRecord(ctx, access, id)));
    return { deletedCount: ids.length };
  },
});
