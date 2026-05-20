import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  PERMISSIONS,
  createActivity,
  deleteEntityNotifications,
  deleteJobCardCascade,
  nextCode,
  notifyRoles,
  publicQuery,
  requireAnyPermission,
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
    await requireAnyPermission(ctx, [
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
    await notifyRoles(ctx, ["Contracting", "Contracting Head"], {
      title: "New query received",
      body: `${queryCode} is ready for contracting review.`,
      entityType: "query",
      entityId: id,
    });

    return { id, queryCode };
  },
});

export const assignContracting = mutation({
  args: {
    queryId: v.string(),
    ownerName: v.string(),
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
    const now = Date.now();
    await ctx.db.patch(queryId, {
      contractingOwnerName: args.ownerName.trim(),
      contractingStatus: "Query Received",
      updatedAt: now,
    });
    await ctx.db.insert("contractingAssignments", {
      queryId,
      ownerName: args.ownerName.trim(),
      status: "Query Received",
      createdBy: access.authUserId ?? "unknown",
      createdAt: now,
      updatedAt: now,
    });
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "assigned_contracting",
      message: `${current.queryCode} assigned to ${args.ownerName.trim()}`,
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
    await notifyRoles(ctx, [
      "Contracting",
      "Contracting Head",
      "Operations Head",
      "Directors",
    ], {
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
        patch.leadStage = "Closed";
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
      if (args.contractingStatus === "Order Lost") {
        patch.salesStatus = "Order Lost";
        patch.leadStage = "Closed";
      }
    }
    if (args.lostReason) {
      patch.lostReason = args.lostReason;
      patch.lostReasonOther = args.lostReasonOther?.trim() || "";
    }

    await ctx.db.patch(queryId, patch);

    const isConfirmed =
      args.salesStatus === "Order Confirmed" ||
      args.contractingStatus === "Order Confirmed";
    const isLost =
      args.salesStatus === "Order Lost" || args.contractingStatus === "Order Lost";

    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: isConfirmed ? "confirmed" : isLost ? "lost" : "status_updated",
      message: `${current.queryCode} status updated`,
      metadata: patch,
    });

    if (isConfirmed) {
      await notifyRoles(ctx, ["Accounts", "Operations Head", "Finance"], {
        title: "Order confirmed",
        body: `${current.queryCode} is confirmed. Accounts should open a Job Card.`,
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

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
      .collect();
    for (const proposal of proposals) {
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

    const { storageIds } = await ctx.runMutation(
      internal.crm.queryAttachments.deleteAllForQuery,
      { queryId },
    );
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
