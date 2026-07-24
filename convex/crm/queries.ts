/**
 * Stable public API entry for CRM queries.
 * Canonical implementations live in focused query* modules.
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { handleMoveContractingPipelineStage } from "./contractingPipelineCommands";
import { requireHeadOrAdmin, requireStaff } from "./lib";
import {
  handleAssignJobCardCreator,
  handleQueryCreate,
  handleQueryUpdate,
  handleQueryUpdateStatus,
  handleSubmitToContracting,
} from "./queryCommands";
import { handleQueryRemove } from "./queryDeletion";
import { handleQueryGetListRow, handleQueryListPage } from "./queryReads";
import { applyQueryTeamAssignments } from "./queryTeamAssignment";
import {
  type ContractingStatus,
  contractingStatusValidator,
  type LeadStage,
  type LostReason,
  leadStageValidator,
  lostReasonValidator,
  type QueryStatusArgs,
  querySourceValidator,
  queryTypeValidator,
  type SalesStatus,
  salesStatusValidator,
  ticketingScopeValidator,
  travelTypeValidator,
} from "./queryValidators";
import {
  contractingPipelineMoveResultValidator,
  queryCreateResultValidator,
  queryGetListRowResultValidator,
  queryIdResultValidator,
  queryListPageResultValidator,
  salesPipelineMoveResultValidator,
} from "./returnContracts";
import { handleMoveSalesPipelineStage } from "./salesPipelineCommands";

export {
  assertContractingPipelineBoardMove,
  getAllowedContractingPipelineBoardTargets,
  isContractingPipelineBoardLocked,
  resolveContractingPipelineStage,
} from "./contractingPipelinePolicy";
export {
  isJobCardCreatorNotificationTarget,
  queryAssignmentHeadRoles,
} from "./queryNotifications";
export {
  assertConfirmedQueryIsTerminal,
  buildQueryStatusNotificationPlan,
  buildQueryStatusPatch,
} from "./queryStatusPolicy";
export {
  assertSalesPipelineBoardMove,
  getAllowedSalesPipelineBoardTargets,
  isSalesPipelineBoardLocked,
  resolveSalesPipelineStage,
} from "./salesPipelinePolicy";
export type { ContractingStatus, LeadStage, LostReason, QueryStatusArgs, SalesStatus };

export const listPage = query({
  args: {
    contractingStatus: v.optional(contractingStatusValidator),
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    leadStage: v.optional(leadStageValidator),
    paginationOpts: paginationOptsValidator,
    queryType: v.optional(queryTypeValidator),
    salesStatus: v.optional(salesStatusValidator),
    search: v.optional(v.string()),
  },
  handler: handleQueryListPage,
  returns: queryListPageResultValidator,
});

export const getListRow = query({
  args: {
    queryId: v.string(),
  },
  handler: handleQueryGetListRow,
  returns: queryGetListRowResultValidator,
});

export const moveContractingPipelineStage = mutation({
  args: {
    expectedContractingStatus: v.string(),
    queryId: v.string(),
    targetStage: v.literal("Proposal sent"),
  },
  handler: handleMoveContractingPipelineStage,
  returns: contractingPipelineMoveResultValidator,
});

export const create = mutation({
  args: {
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientName: v.string(),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contractingStaffId: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.number(),
    queryType: queryTypeValidator,
    salesOwnerName: v.optional(v.string()),
    salesOwnerStaffId: v.optional(v.string()),
    source: v.optional(querySourceValidator),
    ticketingScope: v.optional(ticketingScopeValidator),
    travelEndDate: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
    travelType: travelTypeValidator,
  },
  handler: handleQueryCreate,
  returns: queryCreateResultValidator,
});

export const update = mutation({
  args: {
    batchingNotes: v.optional(v.string()),
    budgetAmount: v.optional(v.number()),
    clientName: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    destination: v.optional(v.string()),
    notes: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    queryId: v.string(),
    queryType: v.optional(queryTypeValidator),
    salesOwnerName: v.optional(v.string()),
    salesOwnerStaffId: v.optional(v.string()),
    source: v.optional(querySourceValidator),
    travelEndDate: v.optional(v.string()),
    travelInBatches: v.optional(v.boolean()),
    travelStartDate: v.optional(v.string()),
    travelType: v.optional(travelTypeValidator),
  },
  handler: handleQueryUpdate,
  returns: queryIdResultValidator,
});

export const assignContracting = mutation({
  args: { queryId: v.string(), staffId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Contracting Head", "Operations Head"]);
    return await applyQueryTeamAssignments(ctx, access, {
      contractingStaffId: args.staffId,
      queryId: args.queryId,
    });
  },
  returns: queryIdResultValidator,
});

export const assignQueryTicketing = mutation({
  args: { queryId: v.string(), staffId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, [
      "Contracting Head",
      "Operations Head",
      "Head of Ticketing",
    ]);
    return await applyQueryTeamAssignments(ctx, access, {
      queryId: args.queryId,
      ticketingStaffId: args.staffId,
    });
  },
  returns: queryIdResultValidator,
});

export const assignQueryTeams = mutation({
  args: {
    contractingStaffId: v.optional(v.string()),
    queryId: v.string(),
    ticketingScope: v.optional(ticketingScopeValidator),
    ticketingStaffId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx);
    return await applyQueryTeamAssignments(ctx, access, args);
  },
  returns: queryIdResultValidator,
});

export const assignJobCardCreator = mutation({
  args: {
    queryId: v.string(),
    staffId: v.string(),
  },
  handler: handleAssignJobCardCreator,
  returns: queryIdResultValidator,
});

export const submitToContracting = mutation({
  args: {
    queryId: v.string(),
  },
  handler: handleSubmitToContracting,
  returns: queryIdResultValidator,
});

const salesPipelineBoardStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation")
);

export const moveSalesPipelineStage = mutation({
  args: {
    expectedLeadStage: leadStageValidator,
    queryId: v.string(),
    targetStage: salesPipelineBoardStageValidator,
  },
  handler: handleMoveSalesPipelineStage,
  returns: salesPipelineMoveResultValidator,
});

export const updateStatus = mutation({
  args: {
    airfarePerPax: v.optional(v.number()),
    approxMargin: v.optional(v.number()),
    confirmedPax: v.optional(v.number()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingLandCost: v.optional(v.number()),
    contractingStatus: v.optional(contractingStatusValidator),
    contractingVisaCost: v.optional(v.number()),
    destination: v.optional(v.string()),
    landCostPerPax: v.optional(v.number()),
    leadStage: v.optional(leadStageValidator),
    lostReason: v.optional(lostReasonValidator),
    lostReasonOther: v.optional(v.string()),
    proposalId: v.optional(v.string()),
    queryId: v.string(),
    salesStatus: v.optional(salesStatusValidator),
    sellingPricePerPax: v.optional(v.number()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
    visaCostPerPax: v.optional(v.number()),
  },
  handler: handleQueryUpdateStatus,
  returns: queryIdResultValidator,
});

export const remove = mutation({
  args: {
    queryId: v.string(),
  },
  handler: handleQueryRemove,
  returns: queryIdResultValidator,
});
