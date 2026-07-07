import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  createActivity,
  notifyStaffMatching,
  PERMISSIONS,
  requireAnyPermission,
  requireStaff,
} from "./lib";

const decisionValidator = v.union(
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Needs Info")
);

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const rows = await ctx.db.query("approvalRequests").collect();
    return rows
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((approval) => ({
        amount: approval.amount ?? 0,
        createdAt: new Date(approval.createdAt).toISOString(),
        decidedAt: approval.decidedAt ? new Date(approval.decidedAt).toISOString() : null,
        decidedByName: approval.decidedByName ?? "",
        decisionNote: approval.decisionNote ?? "",
        entityId: approval.entityId,
        entityType: approval.entityType,
        id: approval._id,
        requestCode: approval.requestCode,
        requestedByName: approval.requestedByName ?? approval.requestedBy,
        status: approval.status,
        summary: approval.summary,
        type: approval.type,
      }));
  },
});

export const decide = mutation({
  args: {
    approvalId: v.string(),
    decisionNote: v.optional(v.string()),
    status: decisionValidator,
  },
  handler: async (ctx, args) => {
    if (
      (args.status === "Rejected" || args.status === "Needs Info") &&
      !args.decisionNote?.trim()
    ) {
      throw new ConvexError("A decision note is required when rejecting or requesting details");
    }
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const approvalId = ctx.db.normalizeId("approvalRequests", args.approvalId);
    if (!approvalId) {
      throw new ConvexError("Invalid approval id");
    }
    const approval = await ctx.db.get(approvalId);
    if (!approval) {
      throw new ConvexError("Approval request not found");
    }
    const now = Date.now();
    await ctx.db.patch(approvalId, {
      decidedAt: now,
      decidedBy: access.authUserId ?? "unknown",
      decidedByName: access.name,
      decisionNote: args.decisionNote?.trim() || "",
      status: args.status,
      updatedAt: now,
    });
    if (approval.entityType === "expense") {
      const expenseId = ctx.db.normalizeId("expenseEntries", approval.entityId);
      if (expenseId) {
        const expense = await ctx.db.get(expenseId);
        if (expense && (expense.managerReviewStatus ?? "Pending") !== "Approved") {
          throw new ConvexError("Manager approval is required before Finance approval");
        }
        await ctx.db.patch(expenseId, {
          financeReviewStatus:
            args.status === "Approved"
              ? "Approved"
              : args.status === "Needs Info"
                ? "Pending"
                : "Rejected",
          ...(args.status === "Needs Info"
            ? {}
            : {
                financeReviewedAt: now,
                financeReviewedBy: access.authUserId ?? "unknown",
                financeReviewedByName: access.name,
              }),
          approvalStatus:
            args.status === "Approved"
              ? "Approved"
              : args.status === "Needs Info"
                ? "Pending"
                : "Rejected",
          reimbursementStatus: args.status === "Approved" ? "Pending" : "Not Submitted",
          updatedAt: now,
        });
      }
    }
    await createActivity(ctx, access, {
      action: args.status.toLowerCase().replace(/\s+/g, "_"),
      entityId: approvalId,
      entityType: "approval",
      message: `${approval.requestCode} ${args.status.toLowerCase()}`,
    });
    if (approval.requestedBy) {
      await notifyStaffMatching(ctx, (member) => member.authUserId === approval.requestedBy, {
        body: `${approval.requestCode}: ${approval.summary}`,
        entityId: approvalId,
        entityType: "approval",
        title: `Approval ${args.status}`,
      });
    }
    return { id: approvalId };
  },
});

export const remove = mutation({
  args: {
    approvalId: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAnyPermission(ctx, [
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_STAFF,
    ]);
    const approvalId = ctx.db.normalizeId("approvalRequests", args.approvalId);
    if (!approvalId) {
      throw new ConvexError("Invalid approval id");
    }
    const approval = await ctx.db.get(approvalId);
    if (!approval) {
      throw new ConvexError("Approval request not found");
    }
    await ctx.db.delete(approvalId);
    await createActivity(ctx, access, {
      action: "deleted",
      entityId: approvalId,
      entityType: "approval",
      message: `${approval.requestCode} approval deleted`,
    });
    return { id: approvalId };
  },
});

export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db
      .query("approvalRequests")
      .withIndex("by_status", (q) => q.eq("status", "Pending"))
      .collect();
    return rows.length;
  },
});
