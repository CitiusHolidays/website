/**
 * Stable public API entry for CRM job cards.
 * Canonical implementations live in focused jobCard* and travelBatch* modules.
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  handleCreateChecklistTask,
  handleRemoveChecklistTask,
  handleUpdateChecklist,
  handleUpdateChecklistTask,
} from "./jobCardChecklistCommands";
import { handleGetCommandCenter } from "./jobCardCommandCenter";
import {
  handleAddCollaborator,
  handleAssignContractingOwner,
  handleAssignOperationsOwner,
  handleJobCardRemove,
  handleJobCardUpdate,
  handleJobCardUpdateStatus,
  handleRemoveCollaborator,
  JOB_CARD_STATUS,
} from "./jobCardCommands";
import { handleCreateFromQuery } from "./jobCardCreation";
import {
  handleJobCardGetListRow,
  handleJobCardListPage,
  handleListTravelBatches,
} from "./jobCardReads";
import { handleCreateTravelBatch, handleUpdateTravelBatch } from "./jobCardTravelBatchCommands";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  checklistTaskIdResultValidator,
  jobCardCommandCenterResultValidator,
  jobCardCreateResultValidator,
  jobCardDeletionOperationListValidator,
  jobCardDeletionResultValidator,
  jobCardGetListRowResultValidator,
  jobCardIdResultValidator,
  jobCardListPageResultValidator,
  travelBatchCreateResultValidator,
  travelBatchIdResultValidator,
  travelBatchListPageResultValidator,
} from "./returnContracts";

export {
  isFinanceHeadStaff,
  queryRequiresTicketingWork,
} from "./jobCardNotifications";
export {
  buildTravelBatchReference,
  formatTravelBatchCode,
  nextTravelBatchIdentity,
  parseTravelBatchSequence,
} from "./travelBatchPolicy";

export const listPage = query({
  args: {
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
    queryType: v.optional(v.string()),
    search: v.optional(v.string()),
    status: v.optional(JOB_CARD_STATUS),
  },
  handler: handleJobCardListPage,
  returns: jobCardListPageResultValidator,
});

export const getListRow = query({
  args: {
    jobCardId: v.optional(v.string()),
    queryId: v.optional(v.string()),
  },
  handler: handleJobCardGetListRow,
  returns: jobCardGetListRowResultValidator,
});

export const listTravelBatches = query({
  args: {
    jobCardId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: handleListTravelBatches,
  returns: travelBatchListPageResultValidator,
});

export const getCommandCenter = query({
  args: { jobCardId: v.string() },
  handler: handleGetCommandCenter,
  returns: jobCardCommandCenterResultValidator,
});

export const listMyDeletionOperations = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
    const initiatedBy = access.authUserId ?? access.email;
    const operations = await ctx.db
      .query("jobCardDeletionOperations")
      .withIndex("by_initiatedBy_startedAt", (q) => q.eq("initiatedBy", initiatedBy))
      .order("desc")
      .take(12);
    return operations.map((operation) => ({
      completedAt: operation.completedAt,
      deletedCount: operation.deletedCount,
      failedAt: operation.failedAt,
      failureSummary: operation.failureSummary,
      id: operation._id,
      jobCardId: operation.jobCardId,
      jobCode: operation.jobCode,
      lastProgressAt: operation.lastProgressAt,
      stage: operation.stage,
      stageCounts: operation.stageCounts,
      stalled: operation.status === "running" && Date.now() - operation.lastProgressAt > 120_000,
      startedAt: operation.startedAt,
      status: operation.status,
    }));
  },
  returns: jobCardDeletionOperationListValidator,
});

export const createFromQuery = mutation({
  args: {
    clientName: v.optional(v.string()),
    confirmedPax: v.number(),
    destination: v.optional(v.string()),
    proposalId: v.optional(v.string()),
    queryId: v.optional(v.string()),
    roomCount: v.optional(v.number()),
    tourManagerName: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
  },
  handler: handleCreateFromQuery,
  returns: jobCardCreateResultValidator,
});

export const update = mutation({
  args: {
    clientName: v.optional(v.string()),
    confirmedPax: v.optional(v.number()),
    destination: v.optional(v.string()),
    jobCardId: v.string(),
    roomCount: v.optional(v.number()),
    tourManagerName: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
  },
  handler: handleJobCardUpdate,
  returns: jobCardIdResultValidator,
});

export const createTravelBatch = mutation({
  args: {
    confirmedPax: v.optional(v.number()),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    destination: v.optional(v.string()),
    jobCardId: v.string(),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    roomCount: v.optional(v.number()),
    status: v.optional(JOB_CARD_STATUS),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
  },
  handler: handleCreateTravelBatch,
  returns: travelBatchCreateResultValidator,
});

export const updateTravelBatch = mutation({
  args: {
    confirmedPax: v.optional(v.number()),
    contractingOwnerId: v.optional(v.string()),
    contractingOwnerName: v.optional(v.string()),
    destination: v.optional(v.string()),
    operationsOwnerId: v.optional(v.string()),
    operationsOwnerName: v.optional(v.string()),
    roomCount: v.optional(v.number()),
    status: v.optional(JOB_CARD_STATUS),
    ticketingOwnerId: v.optional(v.string()),
    ticketingOwnerName: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
    travelBatchId: v.string(),
    travelEndDate: v.optional(v.string()),
    travelStartDate: v.optional(v.string()),
  },
  handler: handleUpdateTravelBatch,
  returns: travelBatchIdResultValidator,
});

export const updateChecklist = mutation({
  args: {
    checklist: v.any(),
    jobCardId: v.string(),
  },
  handler: handleUpdateChecklist,
  returns: jobCardIdResultValidator,
});

export const updateChecklistTask = mutation({
  args: {
    completed: v.boolean(),
    dueDate: v.optional(v.string()),
    ownerRole: v.optional(v.string()),
    taskId: v.string(),
  },
  handler: handleUpdateChecklistTask,
  returns: checklistTaskIdResultValidator,
});

export const createChecklistTask = mutation({
  args: {
    category: v.string(),
    dueDate: v.optional(v.string()),
    jobCardId: v.string(),
    ownerRole: v.optional(v.string()),
    title: v.string(),
  },
  handler: handleCreateChecklistTask,
  returns: checklistTaskIdResultValidator,
});

export const removeChecklistTask = mutation({
  args: { taskId: v.string() },
  handler: handleRemoveChecklistTask,
  returns: checklistTaskIdResultValidator,
});

export const updateStatus = mutation({
  args: {
    jobCardId: v.string(),
    status: JOB_CARD_STATUS,
  },
  handler: handleJobCardUpdateStatus,
  returns: jobCardIdResultValidator,
});

export const addCollaborator = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: handleAddCollaborator,
  returns: jobCardIdResultValidator,
});

export const removeCollaborator = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: handleRemoveCollaborator,
  returns: jobCardIdResultValidator,
});

export const assignOperationsOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: handleAssignOperationsOwner,
  returns: jobCardIdResultValidator,
});

export const assignContractingOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: handleAssignContractingOwner,
  returns: jobCardIdResultValidator,
});

export const remove = mutation({
  args: {
    jobCardId: v.string(),
  },
  handler: handleJobCardRemove,
  returns: jobCardDeletionResultValidator,
});
