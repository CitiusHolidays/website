import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  notifyRoles,
  requireAnyPermission,
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

const ticketTypeValidator = v.union(
  v.literal("FIT Ticket"),
  v.literal("Group Ticket"),
);

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

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const tickets = await ctx.db.query("tickets").collect();
    const pnrs = await ctx.db.query("pnrs").collect();
    const issued = tickets.filter((ticket) => ticket.ticketStatus === "Issued").length;
    const pending = tickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length;
    const attention = tickets.filter((ticket) =>
      ["Name Change Required", "Reissue Required", "Refund Pending"].includes(
        ticket.ticketStatus,
      ),
    ).length;

    return {
      issued,
      pending,
      attention,
      cancelled: tickets.filter((ticket) => ticket.ticketStatus === "Cancelled").length,
      refunded: tickets.filter((ticket) => ticket.ticketStatus === "Refunded").length,
      pnrCount: pnrs.length,
      totalSeats: pnrs.reduce((sum, pnr) => sum + pnr.totalSeats, 0),
      issuedSeats: pnrs.reduce((sum, pnr) => sum + pnr.issuedSeats, 0),
    };
  },
});

export const listPnrs = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const rows = await ctx.db.query("pnrs").collect();
    const result = [];
    for (const pnr of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const job = await ctx.db.get(pnr.jobCardId);
      result.push(publicPnr(pnr, job));
    }
    return result;
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
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
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

export const listTickets = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const rows = await ctx.db.query("tickets").collect();
    const result = [];
    for (const ticket of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const traveller = ticket.travellerId ? await ctx.db.get(ticket.travellerId) : null;
      const pnr = ticket.pnrId ? await ctx.db.get(ticket.pnrId) : null;
      const job = await ctx.db.get(ticket.jobCardId);
      result.push(publicTicket(ticket, traveller, pnr, job));
    }
    return result;
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
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    const travellerId = args.travellerId
      ? ctx.db.normalizeId("travellers", args.travellerId)
      : null;
    const pnrId = args.pnrId ? ctx.db.normalizeId("pnrs", args.pnrId) : null;
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
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
    const ticket = await ctx.db.get(ticketId);
    if (!ticket) {
      throw new ConvexError("Ticket not found");
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
    await createActivity(ctx, access, {
      entityType: "ticket",
      entityId: ticketId,
      action: "deleted",
      message: `Ticket ${ticket.ticketNumber || ticketId} deleted`,
    });
    await deleteEntityNotifications(ctx, "ticket", ticketId);
    await ctx.db.delete(ticketId);
    return { id: ticketId };
  },
});

export const listSeatAllocations = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_TICKETING);
    const rows = await ctx.db.query("seatAllocations").collect();
    const result = [];
    for (const seat of rows.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber))) {
      const traveller = seat.travellerId ? await ctx.db.get(seat.travellerId) : null;
      const job = await ctx.db.get(seat.jobCardId);
      result.push({
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
      });
    }
    return result;
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
      for (const ticket of tickets) {
        await ctx.db.patch(ticket._id, {
          seatNumber: args.seatNumber.trim().toUpperCase(),
          updatedAt: now,
        });
      }
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
    const pnr = await ctx.db.get(pnrId);
    if (!pnr) {
      throw new ConvexError("PNR not found");
    }
    const tickets = await ctx.db
      .query("tickets")
      .withIndex("by_pnrId", (q) => q.eq("pnrId", pnrId))
      .collect();
    for (const ticket of tickets) {
      if (ticket.travellerId) {
        await ctx.db.patch(ticket.travellerId, {
          ticketStatus: "Pending Issue",
          updatedAt: Date.now(),
        });
      }
      await deleteEntityNotifications(ctx, "ticket", ticket._id);
      await ctx.db.delete(ticket._id);
    }
    const seats = await ctx.db
      .query("seatAllocations")
      .withIndex("by_pnrId", (q) => q.eq("pnrId", pnrId))
      .collect();
    for (const seat of seats) {
      await deleteEntityNotifications(ctx, "seatAllocation", seat._id);
      await ctx.db.delete(seat._id);
    }
    await createActivity(ctx, access, {
      entityType: "pnr",
      entityId: pnrId,
      action: "deleted",
      message: `${pnr.pnrCode} deleted`,
    });
    await deleteEntityNotifications(ctx, "pnr", pnrId);
    await ctx.db.delete(pnrId);
    return { id: pnrId };
  },
});

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
    const seat = await ctx.db.get(id);
    if (!seat) {
      throw new ConvexError("Seat allocation not found");
    }
    await createActivity(ctx, access, {
      entityType: "seatAllocation",
      entityId: id,
      action: "deleted",
      message: `Seat ${seat.seatNumber} deleted`,
    });
    await deleteEntityNotifications(ctx, "seatAllocation", id);
    await ctx.db.delete(id);
    return { id };
  },
});
