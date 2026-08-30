import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { type MutationCtx, mutation, query } from "../_generated/server";
import { matchesExpenseApprovalRequest, matchesManagerApprovedSnapshot } from "./expensePolicy";
import { scheduleCrmMetricSync, scheduleFinanceMetricSync } from "./financeMetricSync";
import {
  createActivity,
  PERMISSIONS,
  publishWorkflowNotification,
  requireAnyPermission,
} from "./lib";
import { applyCrmCursorFilters, boundedPaginationOptions } from "./paginationPolicy";
import {
  approvalIdResultValidator,
  approvalListPageResultValidator,
  approvalListRowResultValidator,
} from "./peopleWorkflowReturnContracts";

const decisionValidator = v.union(
  v.literal("Approved" as const),
  v.literal("Rejected" as const),
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
  const expense = await ctx.db.get("expenseEntries", expenseId);
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
    createdAtFrom: v.optional(v.number()),
    createdAtTo: v.optional(v.number()),
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
      {
        createdAtFrom: args.createdAtFrom,
        createdAtTo: args.createdAtTo,
        equals: { status: args.status, type: args.type },
      }
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
    const approval = approvalId ? await ctx.db.get("approvalRequests", approvalId) : null;
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
    const approval = await ctx.db.get("approvalRequests", approvalId);
    if (!approval) {
      throw new ConvexError("Approval request not found");
    }
    if (approval.status !== "Pending") {
      throw new ConvexError("Approval request is no longer pending");
    }
    const expenseContext = await requireCurrentExpenseApproval(ctx, approval);
    const now = Date.now();
    await ctx.db.patch("approvalRequests", approvalId, {
      decidedAt: now,
      decidedBy: access.authUserId ?? "unknown",
      decidedByName: access.name,
      decisionNote: args.decisionNote?.trim() || "",
      status: args.status,
      updatedAt: now,
    });
    await scheduleCrmMetricSync(ctx, "approvalRequests", String(approvalId));
    if (expenseContext) {
      await ctx.db.patch(
        "expenseEntries",
        expenseContext.expenseId,
        expenseDecisionPatch(args.status, access, now)
      );
      await scheduleFinanceMetricSync(ctx, "expenseEntries", expenseContext.expenseId);
    }
    await createActivity(ctx, access, {
      action: args.status.toLowerCase().replace(/\s+/g, "_"),
      entityId: approvalId,
      entityType: "approval",
      message: `${approval.requestCode} ${args.status.toLowerCase()}`,
    });
    if (approval.requestedBy) {
      const matchesRequester = (member: Doc<"staffUsers">) =>
        member.authUserId === approval.requestedBy;
      await publishWorkflowNotification(ctx, {
        bellTargets: { kind: "matching", matches: matchesRequester },
        content: {
          body: `${approval.requestCode}: ${approval.summary}`,
          entityId: approvalId,
          entityType: "approval",
          title: `Approval ${args.status}`,
        },
        emailTargets: { kind: "matching", matches: matchesRequester },
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
    const approval = await ctx.db.get("approvalRequests", approvalId);
    if (!approval) {
      throw new ConvexError("Approval request not found");
    }
    await ctx.db.delete("approvalRequests", approvalId);
    await scheduleCrmMetricSync(ctx, "approvalRequests", String(approvalId));
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
