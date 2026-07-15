import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import { matchesExpenseApprovalRequest, matchesManagerApprovedSnapshot } from "./expensePolicy";
import {
  createActivity,
  notifyStaffMatching,
  PERMISSIONS,
  requireAnyPermission,
  requireStaff,
} from "./lib";
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import {
  approvalIdResultValidator,
  approvalListPageResultValidator,
  approvalListRowResultValidator,
  countResultValidator,
} from "./peopleWorkflowReturnContracts";

const decisionValidator = v.union(
  v.literal("Approved"),
  v.literal("Rejected"),
  v.literal("Needs Info")
);

function publicApproval(approval: Doc<"approvalRequests">) {
  return {
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
  };
}

async function requireCurrentExpenseApproval(ctx: MutationCtx, approval: Doc<"approvalRequests">) {
  if (approval.entityType !== "expense") {
    return null;
  }
  const expenseId = ctx.db.normalizeId("expenseEntries", approval.entityId);
  if (!expenseId) {
    throw new ConvexError("Expense not found");
  }
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if ((expense.managerReviewStatus ?? "Pending") !== "Approved") {
    throw new ConvexError("Manager approval is required before Finance approval");
  }
  if (!matchesManagerApprovedSnapshot(expense)) {
    throw new ConvexError(
      "Expense changed after manager approval; resubmit it for manager approval"
    );
  }
  if (!matchesExpenseApprovalRequest(expense, approval)) {
    throw new ConvexError("The Finance approval request is stale; resubmit the expense");
  }
  return { expense, expenseId };
}

function expenseDecisionPatch(
  status: "Approved" | "Needs Info" | "Rejected",
  access: { authUserId?: string; name: string },
  now: number
) {
  if (status === "Approved") {
    return {
      approvalStatus: "Approved" as const,
      financeReviewedAt: now,
      financeReviewedBy: access.authUserId ?? "unknown",
      financeReviewedByName: access.name,
      financeReviewStatus: "Approved" as const,
      reimbursementStatus: "Pending" as const,
      updatedAt: now,
    };
  }
  if (status === "Needs Info") {
    return {
      approvalStatus: "Pending" as const,
      financeReviewStatus: "Pending" as const,
      reimbursementStatus: "Not Submitted" as const,
      updatedAt: now,
    };
  }
  return {
    approvalStatus: "Rejected" as const,
    financeReviewedAt: now,
    financeReviewedBy: access.authUserId ?? "unknown",
    financeReviewedByName: access.name,
    financeReviewStatus: "Rejected" as const,
    reimbursementStatus: "Not Submitted" as const,
    updatedAt: now,
  };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const page = await applyCrmCursorFilters(
      ctx.db.query("approvalRequests").withIndex("by_createdAt").order("desc"),
      { equals: { status: args.status, type: args.type } }
    ).paginate(boundedPaginationOptions(args.paginationOpts));
    return {
      ...page,
      page: page.page.map(publicApproval),
    };
  },
  returns: approvalListPageResultValidator,
});

export const getListRow = query({
  args: { approvalId: v.string() },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, [
      PERMISSIONS.VIEW_APPROVALS,
      PERMISSIONS.APPROVE_EXPENSES,
      PERMISSIONS.MANAGE_FINANCE,
    ]);
    const approvalId = ctx.db.normalizeId("approvalRequests", args.approvalId);
    const approval = approvalId ? await ctx.db.get(approvalId) : null;
    return approval ? publicApproval(approval) : null;
  },
  returns: approvalListRowResultValidator,
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
    if (approval.status !== "Pending") {
      throw new ConvexError("Approval request is no longer pending");
    }
    const expenseContext = await requireCurrentExpenseApproval(ctx, approval);
    const now = Date.now();
    await ctx.db.patch(approvalId, {
      decidedAt: now,
      decidedBy: access.authUserId ?? "unknown",
      decidedByName: access.name,
      decisionNote: args.decisionNote?.trim() || "",
      status: args.status,
      updatedAt: now,
    });
    if (expenseContext) {
      await ctx.db.patch(
        expenseContext.expenseId as Id<"expenseEntries">,
        expenseDecisionPatch(args.status, access, now)
      );
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
  returns: approvalIdResultValidator,
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
  returns: approvalIdResultValidator,
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
  returns: countResultValidator,
});
