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
  v.literal("Needs Info"),
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
        id: approval._id,
        requestCode: approval.requestCode,
        type: approval.type,
        entityType: approval.entityType,
        entityId: approval.entityId,
        requestedByName: approval.requestedByName ?? approval.requestedBy,
        summary: approval.summary,
        amount: approval.amount ?? 0,
        status: approval.status,
        decidedByName: approval.decidedByName ?? "",
        decisionNote: approval.decisionNote ?? "",
        decidedAt: approval.decidedAt ? new Date(approval.decidedAt).toISOString() : null,
        createdAt: new Date(approval.createdAt).toISOString(),
      }));
  },
});

export const decide = mutation({
  args: {
    approvalId: v.string(),
    status: decisionValidator,
    decisionNote: v.optional(v.string()),
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
      status: args.status,
      decidedBy: access.authUserId ?? "unknown",
      decidedByName: access.name,
      decidedAt: now,
      decisionNote: args.decisionNote?.trim() || "",
      updatedAt: now,
    });
    if (approval.entityType === "expense") {
      const expenseId = ctx.db.normalizeId("expenseEntries", approval.entityId);
      if (expenseId) {
        await ctx.db.patch(expenseId, {
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
      entityType: "approval",
      entityId: approvalId,
      action: args.status.toLowerCase().replace(/\s+/g, "_"),
      message: `${approval.requestCode} ${args.status.toLowerCase()}`,
    });
    if (approval.requestedBy) {
      await notifyStaffMatching(ctx, (member) => member.authUserId === approval.requestedBy, {
        title: `Approval ${args.status}`,
        body: `${approval.requestCode}: ${approval.summary}`,
        entityType: "approval",
        entityId: approvalId,
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
      entityType: "approval",
      entityId: approvalId,
      action: "deleted",
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
