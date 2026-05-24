import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  PERMISSIONS,
  canSeeJobCardRecord,
  createActivity,
  creatorInitials,
  deleteJobCardCascade,
  nextCode,
  notifyRoles,
  notifyStaffMatching,
  paymentTermsFor,
  publicJobCard,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";

const DEFAULT_CHECKLIST = [
  { key: "handover", label: "Sales/Contracting handover acknowledged", done: false },
  { key: "hotelConfirmation", label: "Hotel confirmation", owner: "Contracting", status: "Pending", done: false },
  { key: "dmc", label: "Destination management company", owner: "Contracting", status: "Pending", done: false },
  { key: "landArrangement", label: "Land arrangement", owner: "Contracting", status: "Pending", done: false },
  { key: "masterSheet", label: "Master sheet prepared", done: false },
  { key: "visaDocs", label: "Visa documents verified", done: false },
  { key: "flights", label: "Flights and tickets confirmed", done: false },
  { key: "roomingList", label: "Rooming list prepared", owner: "Operations", status: "Pending", done: false },
  { key: "foodMenu", label: "Food menu finalized", owner: "Operations", status: "Pending", done: false },
  { key: "updates", label: "Client and internal updates shared", owner: "Operations", status: "Pending", done: false },
  { key: "tmBriefing", label: "Tour manager briefing completed", done: false },
  { key: "finalKit", label: "Final travel kit shared", done: false },
  { key: "financeClosure", label: "Final invoice and balance closure", done: false },
];

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
    const rows = await ctx.db.query("jobCards").collect();
    const result = [];
    for (const job of rows.sort((a, b) => b.createdAt - a.createdAt)) {
      const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
      if (!canSeeJobCardRecord(access, job, linkedQuery)) {
        continue;
      }
      result.push(publicJobCard(job));
    }
    return result;
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
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
    if (args.confirmedPax < 1) {
      throw new ConvexError("Confirmed pax must be greater than zero");
    }

    if (!args.queryId) {
      throw new ConvexError("Select a confirmed query before opening a Job Card");
    }
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    const linkedQuery = queryId ? await ctx.db.get(queryId) : null;
    if (!queryId || !linkedQuery) {
      throw new ConvexError("Linked query not found");
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

    let proposalId = args.proposalId
      ? ctx.db.normalizeId("proposals", args.proposalId)
      : null;
    if (args.proposalId && !proposalId) {
      throw new ConvexError("Invalid proposal id");
    }
    const proposalRows = await ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    if (!proposalId) {
      const sortedProposals = proposalRows.sort((a, b) => b.updatedAt - a.updatedAt);
      proposalId =
        sortedProposals.find((proposal) =>
          ["Accepted", "Sent"].includes(proposal.status),
        )?._id ??
        sortedProposals[0]?._id ??
        null;
    }
    const proposal = proposalId ? await ctx.db.get(proposalId) : null;
    if (!proposal || proposal.queryId !== queryId) {
      throw new ConvexError("Link a proposal for this confirmed query before opening a Job Card");
    }
    if (!["Accepted", "Sent"].includes(proposal.status)) {
      throw new ConvexError("The linked proposal must be sent or accepted before opening a Job Card");
    }
    if ((proposal.sellingPrice ?? 0) <= 0 || (proposal.costPrice ?? 0) <= 0) {
      throw new ConvexError("Enter selling price and cost price on the proposal before opening a Job Card");
    }

    const now = Date.now();
    const jobCode = await nextCode(ctx, "jobCards", "JC", {
      suffix: creatorInitials(access.name),
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
      tourManagerName: args.tourManagerName?.trim() || "",
      status: "Open",
      preDepartureChecklist: DEFAULT_CHECKLIST,
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "created",
      message: `${jobCode} opened for ${linkedQuery?.clientName || args.clientName || "client"}`,
    });
    await notifyStaffMatching(
      ctx,
      (staff) => staff.roles.includes("Contracting Head"),
      {
        title: "Assign contracting owner",
        body: `${jobCode} has been created. Assign a contracting owner for this Job Card.`,
        entityType: "jobCard",
        entityId: id,
      },
      { fallbackRoles: ["Contracting Head"] },
    );
    await notifyStaffMatching(
      ctx,
      (staff) => staff.roles.includes("Operations Head"),
      {
        title: "Assign operations owner",
        body: `${jobCode} has been created. Assign an operations owner for this Job Card.`,
        entityType: "jobCard",
        entityId: id,
      },
      { fallbackRoles: ["Operations Head"] },
    );
    await notifyRoles(ctx, ["Sales", "Sales Head", "Finance"], {
      title: "Job Card opened",
      body: `${jobCode} has been created and is ready for operations.`,
      entityType: "jobCard",
      entityId: id,
    });

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
    if (args.confirmedPax !== undefined && args.confirmedPax < 1) {
      throw new ConvexError("Confirmed pax must be greater than zero");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
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
    await ctx.db.patch(id, {
      preDepartureChecklist: args.checklist,
      updatedAt: Date.now(),
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
    await ctx.db.patch(id, { status: args.status, updatedAt: Date.now() });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: id,
      action: "status_updated",
      message: `${job.jobCode} moved to ${args.status}`,
    });
    return { id };
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
    const isOpsTeam = staff.roles.some((role) =>
      ["Operations", "Operations Head"].includes(role),
    );
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
    await ctx.db.patch(jobCardId, {
      operationsOwnerId: staffId,
      operationsOwnerName: ownerName,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: jobCardId,
      action: "assigned_operations",
      message: `${job.jobCode} assigned to ${ownerName} (Operations)`,
    });
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
    await ctx.db.patch(jobCardId, {
      contractingOwnerId: staffId,
      contractingOwnerName: ownerName,
      updatedAt: Date.now(),
    });
    await createActivity(ctx, access, {
      entityType: "jobCard",
      entityId: jobCardId,
      action: "assigned_contracting",
      message: `${job.jobCode} assigned to ${ownerName} (Contracting)`,
    });
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
