import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import {
  assertCementQueryTypeAllowed,
  assertMaxWordCount,
  canSeeQueryRecord,
  contractingNotifyRolesForQueryType,
  createActivity,
  deleteEntityNotifications,
  deleteJobCardCascade,
  hasRole,
  isDirectorOrAdmin,
  MAX_QUERY_NOTES_WORDS,
  nextCode,
  notifyRoles,
  notifyStaffMatching,
  PERMISSIONS,
  publicQuery,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { publicQueryAttachment } from "./queryAttachments";

const queryTypeValidator = v.union(
  v.literal("MICE"),
  v.literal("MICE Bidding"),
  v.literal("Cement"),
  v.literal("Cement Bidding"),
  v.literal("FIT"),
  v.literal("Family Group"),
  v.literal("B2B"),
  v.literal("Spiritual"),
);

const travelTypeValidator = v.union(
  v.literal("Domestic Travel"),
  v.literal("International Travel"),
);

const salesStatusValidator = v.union(
  v.literal("Proposal in discussion"),
  v.literal("Change in destination"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const leadStageValidator = v.union(
  v.literal("Inquiry"),
  v.literal("Proposal"),
  v.literal("Negotiation"),
  v.literal("Confirmation"),
  v.literal("Lost"),
  v.literal("Closed"),
);

const querySourceValidator = v.union(
  v.literal("Website"),
  v.literal("WhatsApp"),
  v.literal("Email"),
  v.literal("Client"),
  v.literal("Referral"),
);

const contractingStatusValidator = v.union(
  v.literal("Query Received"),
  v.literal("Proposal in progress"),
  v.literal("Proposal sent"),
  v.literal("Change in destination"),
  v.literal("Order Confirmed"),
  v.literal("Order Lost"),
);

const lostReasonValidator = v.union(
  v.literal("Price"),
  v.literal("Competition"),
  v.literal("Not travelling"),
  v.literal("Other"),
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_QUERIES,
      PERMISSIONS.VIEW_CONTRACTING,
      PERMISSIONS.VIEW_JOB_CARDS,
    ]);
    const rows = await ctx.db.query("queries").collect();
    const attachments = await ctx.db.query("queryAttachments").collect();
    const attachmentsByQuery = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const key = attachment.queryId;
      const bucket = attachmentsByQuery.get(key) ?? [];
      bucket.push(attachment);
      attachmentsByQuery.set(key, bucket);
    }
    return rows
      .filter((row) => canSeeQueryRecord(access, row))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((row) => ({
        ...publicQuery(row),
        attachments: (attachmentsByQuery.get(row._id) ?? [])
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(publicQueryAttachment),
      }));
  },
});

export const create = mutation({
  args: {
    clientName: v.string(),
    contactPerson: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    paxCount: v.number(),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType: queryTypeValidator,
    travelType: travelTypeValidator,
    budgetAmount: v.optional(v.number()),
    source: v.optional(querySourceValidator),
    salesOwnerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    if (!args.clientName.trim()) {
      throw new ConvexError("Client name is required");
    }
    if (args.paxCount < 1) {
      throw new ConvexError("Pax count must be greater than zero");
    }
    assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
    assertCementQueryTypeAllowed(access, args.queryType);

    const now = Date.now();
    const queryCode = await nextCode(ctx, "queries", "Q");
    const clientId = await ctx.db.insert("clients", {
      name: args.clientName.trim(),
      contactPerson: args.contactPerson?.trim() || "",
      phone: args.contactMobile?.trim() || "",
      createdAt: now,
      updatedAt: now,
    });
    const id = await ctx.db.insert("queries", {
      queryCode,
      clientId,
      clientName: args.clientName.trim(),
      contactPerson: args.contactPerson?.trim() || "",
      contactMobile: args.contactMobile?.trim() || "",
      destination: args.destination?.trim() || "",
      paxCount: args.paxCount,
      travelStartDate: args.travelStartDate || "",
      travelEndDate: args.travelEndDate || "",
      queryType: args.queryType,
      travelType: args.travelType,
      salesStatus: "Proposal in discussion",
      leadStage: "Inquiry",
      contractingStatus: "Query Received",
      budgetAmount: Math.max(args.budgetAmount ?? 0, 0),
      source: args.source ?? "Client",
      salesOwnerId: access.authUserId,
      salesOwnerName: args.salesOwnerName?.trim() || access.name,
      notes: args.notes?.trim() || "",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });

    await createActivity(ctx, access, {
      entityType: "query",
      entityId: id,
      action: "created",
      message: `${queryCode} created for ${args.clientName.trim()}`,
    });
    await notifyRoles(ctx, contractingNotifyRolesForQueryType(args.queryType), {
      title: "New query received",
      body: `${queryCode} is ready for contracting review.`,
      entityType: "query",
      entityId: id,
    });

    return { id, queryCode };
  },
});

export const update = mutation({
  args: {
    queryId: v.string(),
    clientName: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactMobile: v.optional(v.string()),
    destination: v.optional(v.string()),
    paxCount: v.optional(v.number()),
    travelStartDate: v.optional(v.string()),
    travelEndDate: v.optional(v.string()),
    queryType: v.optional(queryTypeValidator),
    travelType: v.optional(travelTypeValidator),
    budgetAmount: v.optional(v.number()),
    source: v.optional(querySourceValidator),
    salesOwnerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    const current = await ctx.db.get(queryId);
    if (!current) {
      throw new ConvexError("Query not found");
    }
    if (!canSeeQueryRecord(access, current)) {
      throw new ConvexError("FORBIDDEN");
    }
    if (args.clientName !== undefined && !args.clientName.trim()) {
      throw new ConvexError("Client name is required");
    }
    if (args.paxCount !== undefined && args.paxCount < 1) {
      throw new ConvexError("Pax count must be greater than zero");
    }
    assertMaxWordCount(args.notes, MAX_QUERY_NOTES_WORDS, "Notes");
    if (args.queryType !== undefined) {
      assertCementQueryTypeAllowed(access, args.queryType);
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.clientName !== undefined) patch.clientName = args.clientName.trim();
    if (args.contactPerson !== undefined) patch.contactPerson = args.contactPerson.trim();
    if (args.contactMobile !== undefined) patch.contactMobile = args.contactMobile.trim();
    if (args.destination !== undefined) patch.destination = args.destination.trim();
    if (args.paxCount !== undefined) patch.paxCount = args.paxCount;
    if (args.travelStartDate !== undefined) patch.travelStartDate = args.travelStartDate;
    if (args.travelEndDate !== undefined) patch.travelEndDate = args.travelEndDate;
    if (args.queryType !== undefined) patch.queryType = args.queryType;
    if (args.travelType !== undefined) patch.travelType = args.travelType;
    if (args.budgetAmount !== undefined) patch.budgetAmount = Math.max(args.budgetAmount, 0);
    if (args.source !== undefined) patch.source = args.source;
    if (args.salesOwnerName !== undefined) patch.salesOwnerName = args.salesOwnerName.trim();
    if (args.notes !== undefined) patch.notes = args.notes.trim();

    await ctx.db.patch(queryId, patch);
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "updated",
      message: `${current.queryCode} updated`,
    });
    return { id: queryId };
  },
});

export const assignContracting = mutation({
  args: {
    queryId: v.string(),
    staffId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireHeadOrAdmin(ctx, ["Contracting Head", "Operations Head"]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
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
    const current = await ctx.db.get(queryId);
    if (!current) {
      throw new ConvexError("Query not found");
    }
    if (!canSeeQueryRecord(access, current)) {
      throw new ConvexError("FORBIDDEN");
    }
    const ownerName = staff.name.trim();
    const now = Date.now();
    await ctx.db.patch(queryId, {
      contractingOwnerId: staffId,
      contractingOwnerName: ownerName,
      contractingStatus: "Query Received",
      updatedAt: now,
    });
    const jobCards = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    for (const jobCard of jobCards) {
      await ctx.db.patch(jobCard._id, {
        contractingOwnerId: staffId,
        contractingOwnerName: ownerName,
        updatedAt: now,
      });
    }
    await ctx.db.insert("contractingAssignments", {
      queryId,
      ownerId: staffId,
      ownerName,
      status: "Query Received",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "assigned_contracting",
      message: `${current.queryCode} assigned to ${ownerName}`,
    });
    return { id: queryId };
  },
});

export const submitToContracting = mutation({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    const current = await ctx.db.get(queryId);
    if (!current) {
      throw new ConvexError("Query not found");
    }
    if (!canSeeQueryRecord(access, current)) {
      throw new ConvexError("FORBIDDEN");
    }
    const now = Date.now();
    await ctx.db.patch(queryId, {
      contractingStatus: "Query Received",
      leadStage: current.leadStage === "Inquiry" ? "Proposal" : current.leadStage,
      submittedToContractingAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "submitted_to_contracting",
      message: `${current.queryCode} submitted to Contracting`,
    });
    await notifyRoles(ctx, ["Contracting", "Contracting Head", "Operations Head", "Directors"], {
      title: "Query submitted to Contracting",
      body: `${current.queryCode} is ready for assignment and proposal work.`,
      entityType: "query",
      entityId: queryId,
    });
    return { id: queryId };
  },
});

export const updateStatus = mutation({
  args: {
    queryId: v.string(),
    salesStatus: v.optional(salesStatusValidator),
    leadStage: v.optional(leadStageValidator),
    contractingStatus: v.optional(contractingStatusValidator),
    lostReason: v.optional(lostReasonValidator),
    lostReasonOther: v.optional(v.string()),
    contractingLandCost: v.optional(v.number()),
    contractingAirlinesCost: v.optional(v.number()),
    contractingVisaCost: v.optional(v.number()),
    approxMargin: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.MANAGE_QUERIES,
      PERMISSIONS.MANAGE_CONTRACTING,
    ]);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    const current = await ctx.db.get(queryId);
    if (!current) {
      throw new ConvexError("Query not found");
    }
    if (!canSeeQueryRecord(access, current)) {
      throw new ConvexError("FORBIDDEN");
    }

    const canSetSalesOutcome =
      isDirectorOrAdmin(access) ||
      hasRole(access, "Sales") ||
      hasRole(access, "Sales Head") ||
      access.permissions.includes(PERMISSIONS.MANAGE_QUERIES);
    const salesOutcomeRequested =
      args.salesStatus !== undefined ||
      args.leadStage !== undefined ||
      args.lostReason !== undefined ||
      args.contractingStatus === "Order Confirmed" ||
      args.contractingStatus === "Order Lost";
    if (salesOutcomeRequested && !canSetSalesOutcome) {
      throw new ConvexError("Only Sales can confirm or lose an order");
    }

    if (args.contractingStatus === "Order Lost") {
      throw new ConvexError("Only Sales can mark an order as lost");
    }

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
    };
    if (args.salesStatus) {
      patch.salesStatus = args.salesStatus;
      if (args.salesStatus === "Order Confirmed") {
        patch.contractingStatus = "Order Confirmed";
        patch.leadStage = "Confirmation";
        patch.confirmedAt = Date.now();
      }
      if (args.salesStatus === "Order Lost") {
        patch.contractingStatus = "Order Lost";
        patch.leadStage = "Lost";
      }
    }
    if (args.leadStage) {
      patch.leadStage = args.leadStage;
    }
    if (args.contractingStatus) {
      patch.contractingStatus = args.contractingStatus;
      if (args.contractingStatus === "Order Confirmed") {
        patch.salesStatus = "Order Confirmed";
        patch.leadStage = "Confirmation";
        patch.confirmedAt = Date.now();
      }
    }
    if (args.lostReason) {
      patch.lostReason = args.lostReason;
      patch.lostReasonOther = args.lostReasonOther?.trim() || "";
    }
    if (args.contractingLandCost !== undefined) {
      patch.contractingLandCost = Math.max(args.contractingLandCost, 0);
    }
    if (args.contractingAirlinesCost !== undefined) {
      patch.contractingAirlinesCost = Math.max(args.contractingAirlinesCost, 0);
    }
    if (args.contractingVisaCost !== undefined) {
      patch.contractingVisaCost = Math.max(args.contractingVisaCost, 0);
    }

    const willBeConfirmed =
      args.salesStatus === "Order Confirmed" ||
      args.contractingStatus === "Order Confirmed" ||
      current.salesStatus === "Order Confirmed" ||
      current.contractingStatus === "Order Confirmed";

    if (args.approxMargin !== undefined) {
      if (!willBeConfirmed) {
        throw new ConvexError(
          "Approximate margin can only be entered after the query is confirmed",
        );
      }
      if (!access.permissions.includes(PERMISSIONS.MANAGE_QUERIES)) {
        throw new ConvexError("Only Sales can enter approximate margin");
      }
      patch.approxMargin = Math.max(args.approxMargin, 0);
    }

    await ctx.db.patch(queryId, patch);

    const wasConfirmed =
      current.salesStatus === "Order Confirmed" || current.contractingStatus === "Order Confirmed";
    const isNewlyConfirmed =
      !wasConfirmed &&
      (args.salesStatus === "Order Confirmed" || args.contractingStatus === "Order Confirmed");
    const isLost = args.salesStatus === "Order Lost";

    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: isNewlyConfirmed ? "confirmed" : isLost ? "lost" : "status_updated",
      message: `${current.queryCode} status updated`,
      metadata: patch,
    });

    if (isNewlyConfirmed) {
      await notifyStaffMatching(
        ctx,
        (staff) => staff.roles.includes("Accounts"),
        {
          title: "Order confirmed",
          body: `${current.queryCode} is confirmed. Open a Job Card in Accounts / JC.`,
          entityType: "query",
          entityId: queryId,
        },
        { fallbackRoles: ["Accounts"] },
      );
      await notifyStaffMatching(
        ctx,
        (staff) =>
          staff.roles.includes("Contracting Head") || staff.roles.includes("Operations Head"),
        {
          title: "Order confirmed — assign owners",
          body: `${current.queryCode} is confirmed. Assign contracting and operations owners once Accounts opens the Job Card.`,
          entityType: "query",
          entityId: queryId,
        },
        { fallbackRoles: ["Contracting Head", "Operations Head"] },
      );
      await notifyRoles(ctx, ["Finance"], {
        title: "Order confirmed",
        body: `${current.queryCode} has been confirmed by Sales.`,
        entityType: "query",
        entityId: queryId,
      });
    }

    return { id: queryId };
  },
});

export const remove = mutation({
  args: {
    queryId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.MANAGE_QUERIES);
    const queryId = ctx.db.normalizeId("queries", args.queryId);
    if (!queryId) {
      throw new ConvexError("Invalid query id");
    }
    const current = await ctx.db.get(queryId);
    if (!current) {
      throw new ConvexError("Query not found");
    }
    if (!canSeeQueryRecord(access, current)) {
      throw new ConvexError("FORBIDDEN");
    }

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    for (const proposal of proposals) {
      const { storageIds } = await ctx.runMutation(
        internal.crm.proposalAttachments.deleteAllForProposal,
        { proposalId: proposal._id },
      );
      for (const storageId of storageIds) {
        try {
          await ctx.storage.delete(storageId);
        } catch (err) {
          console.error("Failed to delete proposal attachment file:", err);
        }
      }
      await deleteEntityNotifications(ctx, "proposal", proposal._id);
      await ctx.db.delete(proposal._id);
    }

    const assignments = await ctx.db
      .query("contractingAssignments")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
    }

    const jobCards = await ctx.db
      .query("jobCards")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    for (const jobCard of jobCards) {
      await deleteJobCardCascade(ctx, jobCard._id);
    }

    const { storageIds } = await ctx.runMutation(internal.crm.queryAttachments.deleteAllForQuery, {
      queryId,
    });
    for (const storageId of storageIds) {
      try {
        await ctx.storage.delete(storageId);
      } catch (err) {
        console.error("Failed to delete query attachment file:", err);
      }
    }

    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "deleted",
      message: `${current.queryCode} deleted`,
    });
    await deleteEntityNotifications(ctx, "query", queryId);
    await ctx.db.delete(queryId);
    return { id: queryId };
  },
});
