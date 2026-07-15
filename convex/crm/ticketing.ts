/**
 * Stable public API entry for CRM ticketing.
 * Canonical implementations live in focused pnr*, ticket*, seat*, and ticketing* modules.
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import {
  deletedCountResultValidator,
  jobCardIdResultValidator,
  pnrIdResultValidator,
  pnrListPageResultValidator,
  seatAllocationIdResultValidator,
  seatAllocationListPageResultValidator,
  ticketIdResultValidator,
  ticketingDashboardResultValidator,
  ticketListPageResultValidator,
  ticketListRowResultValidator,
} from "./financeTicketingReturnContracts";
import { portalDateRangeValidator } from "./lib";
import { handleContinuePnrCleanup, pnrCleanupStageValidator } from "./pnrCleanup";
import {
  handleCreatePnr,
  handleRemoveManyPnrs,
  handleRemovePnr,
  handleUpdatePnr,
} from "./pnrCommands";
import { handleListPnrs } from "./pnrReads";
import {
  handleRemoveManySeatAllocations,
  handleRemoveSeatAllocation,
  handleSaveSeatAllocation,
  handleUpdateSeatAllocation,
} from "./seatCommands";
import { handleListSeatAllocations } from "./seatReads";
import {
  handleCreateTicket,
  handleRemoveManyTickets,
  handleRemoveTicket,
  handleUpdateTicket,
  handleUpdateTicketStatus,
} from "./ticketCommands";
import { handleAssignTicketingOwner } from "./ticketingAssignmentPolicy";
import { handleDashboard } from "./ticketingDashboardReads";
import {
  foodPreferenceValidator,
  paymentTypeValidator,
  seatStatusValidator,
  ticketStatusValidator,
  ticketTypeValidator,
} from "./ticketingValidators";
import { handleGetTicketListRow, handleListTickets } from "./ticketReads";

export { isTicketAttentionStatus, TICKET_ATTENTION_STATUSES } from "./ticketStatusPolicy";

export const dashboard = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: handleDashboard,
  returns: ticketingDashboardResultValidator,
});

export const listPnrs = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: handleListPnrs,
  returns: pnrListPageResultValidator,
});

export const createPnr = mutation({
  args: {
    airline: v.string(),
    fareType: v.optional(v.string()),
    jobCardId: v.string(),
    pnrCode: v.string(),
    route: v.string(),
    totalSeats: v.number(),
  },
  handler: handleCreatePnr,
  returns: pnrIdResultValidator,
});

export const updatePnr = mutation({
  args: {
    airline: v.optional(v.string()),
    fareType: v.optional(v.string()),
    pnrCode: v.optional(v.string()),
    pnrId: v.string(),
    route: v.optional(v.string()),
    status: v.optional(v.string()),
    totalSeats: v.optional(v.number()),
  },
  handler: handleUpdatePnr,
  returns: pnrIdResultValidator,
});

export const listTickets = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    ticketStatus: v.optional(ticketStatusValidator),
  },
  handler: handleListTickets,
  returns: ticketListPageResultValidator,
});

export const getTicketListRow = query({
  args: { ticketId: v.string() },
  handler: handleGetTicketListRow,
  returns: ticketListRowResultValidator,
});

export const createTicket = mutation({
  args: {
    cabinClass: v.optional(v.string()),
    jobCardId: v.string(),
    mealPreference: v.optional(foodPreferenceValidator),
    paymentType: paymentTypeValidator,
    pnrId: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
    seatPreference: v.optional(v.string()),
    ticketNumber: v.optional(v.string()),
    ticketStatus: ticketStatusValidator,
    ticketType: v.optional(ticketTypeValidator),
    travellerId: v.optional(v.string()),
  },
  handler: handleCreateTicket,
  returns: ticketIdResultValidator,
});

export const updateTicket = mutation({
  args: {
    cabinClass: v.optional(v.string()),
    mealPreference: v.optional(foodPreferenceValidator),
    paymentType: v.optional(paymentTypeValidator),
    pnrId: v.optional(v.string()),
    seatNumber: v.optional(v.string()),
    seatPreference: v.optional(v.string()),
    ticketId: v.string(),
    ticketNumber: v.optional(v.string()),
    ticketStatus: v.optional(ticketStatusValidator),
    ticketType: v.optional(ticketTypeValidator),
    travellerId: v.optional(v.string()),
  },
  handler: handleUpdateTicket,
  returns: ticketIdResultValidator,
});

export const updateTicketStatus = mutation({
  args: {
    ticketId: v.string(),
    ticketStatus: ticketStatusValidator,
  },
  handler: handleUpdateTicketStatus,
  returns: ticketIdResultValidator,
});

export const removeTicket = mutation({
  args: {
    ticketId: v.string(),
  },
  handler: handleRemoveTicket,
  returns: ticketIdResultValidator,
});

export const removeManyTickets = mutation({
  args: {
    ticketIds: v.array(v.string()),
  },
  handler: handleRemoveManyTickets,
  returns: deletedCountResultValidator,
});

export const listSeatAllocations = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(seatStatusValidator),
  },
  handler: handleListSeatAllocations,
  returns: seatAllocationListPageResultValidator,
});

export const saveSeatAllocation = mutation({
  args: {
    jobCardId: v.string(),
    notes: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    seatNumber: v.string(),
    status: seatStatusValidator,
    travellerId: v.optional(v.string()),
  },
  handler: handleSaveSeatAllocation,
  returns: seatAllocationIdResultValidator,
});

export const updateSeatAllocation = mutation({
  args: {
    notes: v.optional(v.string()),
    pnrId: v.optional(v.string()),
    seatAllocationId: v.string(),
    seatNumber: v.optional(v.string()),
    status: v.optional(seatStatusValidator),
    travellerId: v.optional(v.string()),
  },
  handler: handleUpdateSeatAllocation,
  returns: seatAllocationIdResultValidator,
});

export const continuePnrCleanup = internalMutation({
  args: {
    pnrId: v.string(),
    stage: pnrCleanupStageValidator,
  },
  handler: handleContinuePnrCleanup,
});

export const removePnr = mutation({
  args: {
    pnrId: v.string(),
  },
  handler: handleRemovePnr,
  returns: pnrIdResultValidator,
});

export const removeManyPnrs = mutation({
  args: {
    pnrIds: v.array(v.string()),
  },
  handler: handleRemoveManyPnrs,
  returns: deletedCountResultValidator,
});

export const assignTicketingOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: handleAssignTicketingOwner,
  returns: jobCardIdResultValidator,
});

export const removeSeatAllocation = mutation({
  args: {
    seatAllocationId: v.string(),
  },
  handler: handleRemoveSeatAllocation,
  returns: seatAllocationIdResultValidator,
});

export const removeManySeatAllocations = mutation({
  args: {
    seatAllocationIds: v.array(v.string()),
  },
  handler: handleRemoveManySeatAllocations,
  returns: deletedCountResultValidator,
});
