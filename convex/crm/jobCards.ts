import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  assertDateRangeOrder,
  canEditContractingRecord,
  canEditOperationsRecord,
  canSeeJobCardRecord,
  canSeeQueryRecord,
  createActivity,
  creatorInitials,
  deleteJobCardCascade,
  editorPatch,
  isDirectorOrAdmin,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  paymentTermsFor,
  publicJobCard,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";

const DEFAULT_CHECKLIST = [
  { key: "handover", label: "Sales/Contracting handover acknowledged", done: false },
  {
    key: "hotelConfirmation",
    label: "Hotel confirmation",
    owner: "Contracting",
    status: "Pending",
    done: false,
  },
  {
    key: "dmc",
    label: "Destination management company",
    owner: "Contracting",
    status: "Pending",
    done: false,
  },
  {
    key: "landArrangement",
    label: "Land arrangement",
    owner: "Contracting",
    status: "Pending",
    done: false,
  },
  { key: "masterSheet", label: "Master sheet prepared", done: false },
  { key: "visaDocs", label: "Visa documents verified", done: false },
  { key: "flights", label: "Flights and tickets confirmed", done: false },
  {
    key: "roomingList",
    label: "Rooming list prepared",
    owner: "Operations",
    status: "Pending",
    done: false,
  },
  {
    key: "foodMenu",
    label: "Food menu finalized",
    owner: "Operations",
    status: "Pending",
    done: false,
  },
  {
    key: "updates",
    label: "Client and internal updates shared",
    owner: "Operations",
    status: "Pending",
    done: false,
  },
  { key: "tmBriefing", label: "Tour manager briefing completed", done: false },
  { key: "finalKit", label: "Final travel kit shared", done: false },
  { key: "financeClosure", label: "Final invoice and balance closure", done: false },
];

function checklistItemToTask(item: any, index: number, createdBy: string, timestamp: number) {
  return {
    category: item.category ?? item.owner ?? "Operations",
    title: item.label ?? item.title ?? `Checklist item ${index + 1}`,
    completed: Boolean(item.done ?? item.completed),
    dueDate: item.dueDate,
    ownerRole: item.owner,
    completedAt: item.done || item.completed ? timestamp : undefined,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function materializeDefaultChecklistTasks(
  ctx: any,
  jobCardId: any,
  checklist: any[],
  createdBy: string,
  timestamp = Date.now(),
) {
  await Promise.all(
    (checklist ?? DEFAULT_CHECKLIST).map((item, index) =>
      ctx.db.insert("checklistTasks", {
        jobCardId,
        ...checklistItemToTask(item, index, createdBy, timestamp),
      }),
    ),
  );
}

async function getChecklistTasksWithFallback(ctx: any, job: any) {
  const tasks = await ctx.db
    .query("checklistTasks")
    .withIndex("by_jobCardId", (q: any) => q.eq("jobCardId", job._id))
    .collect();
  if (tasks.length > 0) {
    return tasks.sort((a: any, b: any) => a.createdAt - b.createdAt);
  }
  return (job.preDepartureChecklist ?? DEFAULT_CHECKLIST).map((item: any, index: number) => ({
    _id: `legacy-${job._id}-${item.key ?? index}`,
    jobCardId: job._id,
    ...checklistItemToTask(item, index, job.createdBy, job.createdAt),
    legacy: true,
  }));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const [access, rows] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS),
      ctx.db.query("jobCards").collect(),
    ]);
    const result = await Promise.all(
      rows
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(async (job) => {
          const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
          if (!canSeeJobCardRecord(access, job, linkedQuery)) {
            return null;
          }
          return publicJobCard(job);
        }),
    );
    return result.filter(Boolean);
  },
});

export const getCommandCenter = query({
  args: { jobCardId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(jobCardId);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    const [
      proposal,
      travellers,
      visaRecords,
      tickets,
      pnrs,
      hotels,
      rooming,
      vendors,
      itineraries,
      eventFlows,
      invoices,
      expenses,
      activity,
      checklistTasks,
    ] = await Promise.all([
      job.proposalId ? ctx.db.get(job.proposalId) : null,
      ctx.db
        .query("travellers")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("visaRecords")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("tickets")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("pnrs")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("hotels")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("roomingListEntries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("vendors")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("itineraries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("eventFlows")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("invoices")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("expenseEntries")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
        .collect(),
      ctx.db
        .query("activityLogs")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "jobCard").eq("entityId", String(jobCardId)),
        )
        .collect(),
      getChecklistTasksWithFallback(ctx, job),
    ]);
    return {
      jobCard: publicJobCard(job),
      query: linkedQuery
        ? {
            id: linkedQuery._id,
            queryCode: linkedQuery.queryCode,
            clientName: linkedQuery.clientName,
            destination: linkedQuery.destination ?? "",
            salesStatus: linkedQuery.salesStatus,
            contractingStatus: linkedQuery.contractingStatus,
          }
        : null,
      proposal: proposal
        ? {
            id: proposal._id,
            proposalCode: proposal.proposalCode,
            status: proposal.status,
            sellingPrice: proposal.sellingPrice ?? 0,
            costPrice: proposal.costPrice ?? 0,
          }
        : null,
      travellers,
      visaRecords,
      tickets,
      pnrs,
      hotels,
      rooming,
      vendors,
      itineraries,
      eventFlows,
      invoices,
      expenses,
      checklistTasks,
      recentActivity: activity
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 12)
        .map((row) => ({
          id: row._id,
          action: row.action,
          message: row.message,
          actorName: row.actorName,
          createdAt: new Date(row.createdAt).toISOString(),
        })),
    };
  },
});

export const createFromQuery = mutation({
  args: {
    queryId: v.optional(v.string()),
    proposalId: v.optional(v.string()),
    clientName: v.optional(v.string()),
    destination: v.optional(v.string()),
    confirmedPax: v.number(),
    roomCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.confirmedPax < 1) {
      throw new ConvexError("Confirmed pax must be greater than zero");
    }
    assertDateRangeOrder(
      args.travelStartDate,
      args.travelEndDate,
      "Travel start date",
      "Travel end date",
    );

    if (!args.queryId) {
      throw new ConvexError("Select a confirmed query before opening a Job Card");
    }
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    const [access, linkedQuery] = await Promise.all([
      requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS),
      queryId ? ctx.db.get(queryId) : null,
    ]);
    if (!queryId || !linkedQuery) {
      throw new ConvexError("Linked query not found");
    }
    if (!canSeeQueryRecord(access, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!isDirectorOrAdmin(access)) {
      if (!linkedQuery.jobCardCreatorStaffId) {
        throw new ConvexError("Accounts Head must assign a Job Card creator first");
      }
      if (!access.staffId || linkedQuery.jobCardCreatorStaffId !== access.staffId) {
        throw new ConvexError("Only the assigned Accounts person can create this Job Card");
      }
    }
    if (
      linkedQuery &&
      linkedQuery.salesStatus !== "Order Confirmed" &&
      linkedQuery.contractingStatus !== "Order Confirmed"
    ) {
      throw new ConvexError("Accounts can open a Job Card only after order confirmation");
    }
    const existing = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .first();
    if (existing) {
      throw new ConvexError("This query already has a linked Job Card");
    }

    let proposalId = args.proposalId ? ctx.db.normalizeId("proposals", args.proposalId) : null;
    if (args.proposalId && !proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const [legacyProposalRows, proposalLinks] = await Promise.all([
      ctx.db
        .query("proposals")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
      ctx.db
        .query("proposalQueryLinks")
        .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
        .collect(),
    ]);
    const proposalRowsById = new Map(
      legacyProposalRows.map((proposal) => [proposal._id, proposal]),
    );
    const missingLinkProposalIds = proposalLinks.flatMap((link) =>
      proposalRowsById.has(link.proposalId) ? [] : [link.proposalId],
    );
    const missingLinkProposals = await Promise.all(
      missingLinkProposalIds.map((proposalId) => ctx.db.get(proposalId)),
    );
    for (const linkedProposal of missingLinkProposals) {
      if (linkedProposal) {
        proposalRowsById.set(linkedProposal._id, linkedProposal);
      }
    }
    const proposalRows = Array.from(proposalRowsById.values());
    if (!proposalId) {
      const sortedProposals = proposalRows.sort((a, b) => b.updatedAt - a.updatedAt);
      proposalId =
        sortedProposals.find((proposal) => ["Accepted", "Sent"].includes(proposal.status))?._id ??
        sortedProposals[0]?._id ??
        null;
    }
    const proposal = proposalId ? await ctx.db.get(proposalId) : null;
    const selectedProposalLink =
      proposalId &&
      (await ctx.db
        .query("proposalQueryLinks")
        .withIndex("by_proposalId_and_queryId", (q) =>
          q.eq("proposalId", proposalId).eq("queryId", queryId),
        )
        .first());
    if (!proposal || (proposal.queryId !== queryId && !selectedProposalLink)) {
      throw new ConvexError("Link a proposal for this confirmed query before opening a Job Card");
    }
    if (!["Accepted", "Sent"].includes(proposal.status)) {
      throw new ConvexError(
        "The linked proposal must be sent or accepted before opening a Job Card",
      );
    }
    if ((proposal.sellingPrice ?? 0) <= 0 || (proposal.costPrice ?? 0) <= 0) {
      throw new ConvexError(
        "Enter selling price and cost price on the proposal before opening a Job Card",
      );
    }

    const now = Date.now();
    const jobCode = await nextCode(ctx, "jobCards", "JC", {
      suffix: creatorInitials(linkedQuery.salesOwnerName || access.name),
    });
    const queryType = linkedQuery?.queryType;
    const id = await ctx.db.insert("jobCards", {
      jobCode,
      queryId,
      proposalId,
      clientName: linkedQuery.clientName || args.clientName?.trim() || "",
      destination: linkedQuery.destination || args.destination?.trim() || "",
      confirmedPax: args.confirmedPax,
      roomCount: args.roomCount ?? 0,
      travelStartDate: linkedQuery?.travelStartDate || args.travelStartDate || "",
      travelEndDate: linkedQuery?.travelEndDate || args.travelEndDate || "",
      queryType: queryType as any,
      paymentTerms: queryType ? paymentTermsFor(queryType) : null,
      contractingOwnerId: linkedQuery?.contractingOwnerId,
      contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
      ticketingOwnerId: linkedQuery?.ticketingOwnerId,
      ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
      collaboratorStaffIds: [],
      lastEditedBy: access.authUserId ?? access.email ?? "unknown",
      lastEditedByName: access.name,
      lastEditedAt: now,
      tourManagerName: args.tourManagerName?.trim() || "",
      status: "Open",
      preDepartureChecklist: DEFAULT_CHECKLIST,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await materializeDefaultChecklistTasks(
      ctx,
      id,
      DEFAULT_CHECKLIST,
      access.authUserId ?? "unknown",
      now,
    );

    const ownerNotifications = [];
    const contractingStaffId = linkedQuery?.contractingOwnerId
      ? ctx.db.normalizeId("staffUsers", linkedQuery.contractingOwnerId)
      : null;
    if (contractingStaffId) {
      ownerNotifications.push(
        notifyStaffMember(ctx, contractingStaffId, {
          title: "Job Card opened on your query",
          body: `${jobCode} is ready. Continue contracting and coordinate operations deliverables.`,
          entityType: "jobCard",
          entityId: id,
        }),
      );
    }
    const ticketingStaffId = linkedQuery?.ticketingOwnerId
      ? ctx.db.normalizeId("staffUsers", linkedQuery.ticketingOwnerId)
      : null;
    if (ticketingStaffId) {
      ownerNotifications.push(
        notifyStaffMember(ctx, ticketingStaffId, {
          title: "Job Card opened on your query",
          body: `${jobCode} is ready. Begin ticketing for this departure.`,
          entityType: "jobCard",
          entityId: id,
        }),
      );
    }

    await Promise.all([
      createActivity(ctx, access, {
        entityType: "jobCard",
        entityId: id,
        action: "created",
        message: `${jobCode} opened for ${linkedQuery?.clientName || args.clientName || "client"}`,
      }),
      notifyRoles(
        ctx,
        [
          "Contracting",
          "Contracting Head",
          "Operations",
          "Operations Head",
          "Ticketing",
          "Head of Ticketing",
        ],
        {
          title: "Job Card opened — start operations",
          body: `${jobCode} is live for ${linkedQuery?.queryCode || "the confirmed query"}. Begin traveller master, tickets, passport, visa, and tour manager work.`,
          entityType: "jobCard",
          entityId: id,
        },
      ),
      ...ownerNotifications,
      notifyRoles(ctx, ["Sales", "Sales Head", "Finance"], {
        title: "Job Card opened",
        body: `${jobCode} has been created and is ready for operations.`,
        entityType: "jobCard",
        entityId: id,
      }),
    ]);

    return { id, jobCode };
  },
});

export const update = mutation({
  args: {
    jobCardId: v.string(),
    clientName: v.optional(v.string()),
    destination: v.optional(v.string()),
    confirmedPax: v.optional(v.number()),
    roomCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
    ]);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs, collaborators, and heads can edit this Job Card");
    }
    if (args.confirmedPax !== undefined && args.confirmedPax < 1) {
      throw new ConvexError("Confirmed pax must be greater than zero");
    }
    assertDateRangeOrder(
      args.travelStartDate ?? job.travelStartDate,
      args.travelEndDate ?? job.travelEndDate,
      "Travel start date",
      "Travel end date",
    );

    const patch: Record<string, unknown> = editorPatch(access);
    if (args.clientName !== undefined) patch.clientName = args.clientName.trim();
    if (args.destination !== undefined) patch.destination = args.destination.trim();
    if (args.confirmedPax !== undefined) patch.confirmedPax = args.confirmedPax;
    if (args.roomCount !== undefined) patch.roomCount = args.roomCount;
    if (args.travelStartDate !== undefined) patch.travelStartDate = args.travelStartDate;
    if (args.travelEndDate !== undefined) patch.travelEndDate = args.travelEndDate;
    if (args.tourManagerName !== undefined) {
      patch.tourManagerName = args.tourManagerName.trim();
    }

    await ctx.db.patch(id, patch);
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "updated",
      message: `${job.jobCode} updated`,
    });
    return { id };
  },
});

export const updateChecklist = mutation({
  args: {
    jobCardId: v.string(),
    checklist: v.any(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError(
        "Only assigned SPOCs, collaborators, and heads can update this checklist",
      );
    }
    await ctx.db.patch(id, {
      preDepartureChecklist: args.checklist,
      ...editorPatch(access),
    });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "checklist_updated",
      message: `${job.jobCode} checklist updated`,
    });
    return { id };
  },
});

export const updateChecklistTask = mutation({
  args: {
    taskId: v.string(),
    completed: v.boolean(),
    dueDate: v.optional(v.string()),
    ownerRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const taskId = ctx.db.normalizeId("checklistTasks", args.taskId);
    if (!taskId) throw new ConvexError("Invalid checklist task id");
    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError("Checklist task not found");
    const job = await ctx.db.get(task.jobCardId);
    if (!job) throw new ConvexError("Job Card not found");
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) throw new ConvexError("FORBIDDEN");
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs, collaborators, and heads can update this task");
    }
    await ctx.db.patch(taskId, {
      completed: args.completed,
      completedAt: args.completed ? Date.now() : undefined,
      dueDate: args.dueDate,
      ownerRole: args.ownerRole as any,
      ...editorPatch(access),
    });
    return { id: taskId };
  },
});

export const createChecklistTask = mutation({
  args: {
    jobCardId: v.string(),
    category: v.string(),
    title: v.string(),
    dueDate: v.optional(v.string()),
    ownerRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const job = await ctx.db.get(jobCardId);
    if (!job) throw new ConvexError("Job Card not found");
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) throw new ConvexError("FORBIDDEN");
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs, collaborators, and heads can add tasks");
    }
    const now = Date.now();
    const id = await ctx.db.insert("checklistTasks", {
      jobCardId,
      category: args.category.trim() || "Operations",
      title: args.title.trim(),
      completed: false,
      dueDate: args.dueDate,
      ownerRole: args.ownerRole as any,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  },
});

export const removeChecklistTask = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const taskId = ctx.db.normalizeId("checklistTasks", args.taskId);
    if (!taskId) throw new ConvexError("Invalid checklist task id");
    const task = await ctx.db.get(taskId);
    if (!task) throw new ConvexError("Checklist task not found");
    const job = await ctx.db.get(task.jobCardId);
    if (!job) throw new ConvexError("Job Card not found");
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) throw new ConvexError("FORBIDDEN");
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs, collaborators, and heads can remove tasks");
    }
    await ctx.db.delete(taskId);
    return { id: taskId };
  },
});

export const updateStatus = mutation({
  args: {
    jobCardId: v.string(),
    status: v.union(
      v.literal("Open"),
      v.literal("In Operations"),
      v.literal("Ready for Departure"),
      v.literal("On Tour"),
      v.literal("Closed"),
    ),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (!canEditOperationsRecord(access, job)) {
      throw new ConvexError(
        "Only assigned Operations SPOC, collaborators, and heads can update status",
      );
    }
    await ctx.db.patch(id, { status: args.status, ...editorPatch(access) });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "status_updated",
      message: `${job.jobCode} moved to ${args.status}`,
    });
    return { id };
  },
});

export const addCollaborator = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_CONTRACTING,
    ]);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) throw new ConvexError("Invalid staff id");
    const [job, staff] = await Promise.all([ctx.db.get(jobCardId), ctx.db.get(staffId)]);
    if (!job) throw new ConvexError("Job Card not found");
    if (!staff?.active) throw new ConvexError("Staff member not found");
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) throw new ConvexError("FORBIDDEN");
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs and heads can add collaborators");
    }
    const collaborators = new Set((job.collaboratorStaffIds ?? []).map(String));
    collaborators.add(String(staffId));
    await Promise.all([
      ctx.db.patch(jobCardId, {
        collaboratorStaffIds: Array.from(collaborators).map(
          (id) => ctx.db.normalizeId("staffUsers", id)!,
        ),
        ...editorPatch(access),
      }),
      notifyStaffMember(ctx, staffId, {
        title: "Job Card access shared",
        body: `${job.jobCode} was shared with you for collaboration.`,
        entityType: "jobCard",
        entityId: jobCardId,
      }),
    ]);
    return { id: jobCardId };
  },
});

export const removeCollaborator = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_JOB_CARDS,
      PERMISSIONS.MANAGE_OPERATIONS,
      PERMISSIONS.MANAGE_CONTRACTING,
    ]);
    const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!jobCardId) throw new ConvexError("Invalid Job Card id");
    const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
    if (!staffId) throw new ConvexError("Invalid staff id");
    const job = await ctx.db.get(jobCardId);
    if (!job) throw new ConvexError("Job Card not found");
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) throw new ConvexError("FORBIDDEN");
    if (!canEditOperationsRecord(access, job) && !canEditContractingRecord(access, job)) {
      throw new ConvexError("Only assigned SPOCs and heads can remove collaborators");
    }
    await ctx.db.patch(jobCardId, {
      collaboratorStaffIds: (job.collaboratorStaffIds ?? []).filter(
        (id: any) => String(id) !== String(staffId),
      ),
      ...editorPatch(access),
    });
    return { id: jobCardId };
  },
});

export const assignOperationsOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
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
    const isOpsTeam = staff.roles.some((role) => ["Operations", "Operations Head"].includes(role));
    if (!isOpsTeam) {
      throw new ConvexError("Selected staff member is not on the operations team");
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
        operationsOwnerId: staffId,
        operationsOwnerName: ownerName,
        updatedAt: Date.now(),
      }),
      createActivity(ctx, access, {
        entityType: "jobCard",
        entityId: jobCardId,
        action: "assigned_operations",
        message: `${job.jobCode} assigned to ${ownerName} (Operations)`,
      }),
      notifyStaffMember(ctx, staffId, {
        title: "Assign operations owner",
        body: `You were assigned as operations owner for ${job.jobCode}.`,
        entityType: "jobCard",
        entityId: jobCardId,
      }),
    ]);
    return { id: jobCardId };
  },
});

export const assignContractingOwner = mutation({
  args: {
    jobCardId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Contracting Head", "Operations Head"]);
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
    const isContractingTeam = staff.roles.some((role) =>
      ["Contracting", "Contracting Head"].includes(role),
    );
    if (!isContractingTeam) {
      throw new ConvexError("Selected staff member is not on the contracting team");
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
        contractingOwnerId: staffId,
        contractingOwnerName: ownerName,
        updatedAt: Date.now(),
      }),
      createActivity(ctx, access, {
        entityType: "jobCard",
        entityId: jobCardId,
        action: "assigned_contracting",
        message: `${job.jobCode} assigned to ${ownerName} (Contracting)`,
      }),
      notifyStaffMember(ctx, staffId, {
        title: "Assign contracting owner",
        body: `You were assigned as contracting SPOC for ${job.jobCode}.`,
        entityType: "jobCard",
        entityId: jobCardId,
      }),
    ]);
    return { id: jobCardId };
  },
});

export const remove = mutation({
  args: {
    jobCardId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
    const id = ctx.db.normalizeId("jobCards", args.jobCardId);
    if (!id) {
      throw new ConvexError("Invalid Job Card id");
    }
    const job = await ctx.db.get(id);
    if (!job) {
      throw new ConvexError("Job Card not found");
    }
    const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
    if (!canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "deleted",
      message: `${job.jobCode} deleted`,
    });
    await deleteJobCardCascade(ctx, id);
    return { id };
  },
});
