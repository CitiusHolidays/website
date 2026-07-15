import { ConvexError } from "convex/values";
import {
  getExpenseApprovalSnapshot,
  matchesExpenseApprovalRequest,
  matchesManagerApprovedSnapshot,
} from "./expensePolicy";
import { assertExpenseAccess, canApproveExpenseAsManager } from "./expenseScope";
import {
  createActivity,
  isDirectorOrAdmin,
  nextCode,
  notifyRoles,
  notifyStaffMember,
  PERMISSIONS,
  requireAnyPermission,
  requireStaff,
} from "./lib";

async function staffByAuthUserId(ctx: any, authUserId?: string) {
  if (!authUserId) {
    return null;
  }
  return await ctx.db
    .query("staffUsers")
    .withIndex("by_authUserId", (q: any) => q.eq("authUserId", authUserId))
    .unique();
}

async function resolveExpenseSubmitterAndManager(ctx: any, access: any, expense: any) {
  const submitter =
    (await staffByAuthUserId(ctx, expense.createdBy)) ??
    (access.staffId ? await ctx.db.get(access.staffId) : null);
  const managerId = submitter?.reportingManagerStaffId ?? null;
  const manager = managerId ? await ctx.db.get(managerId) : null;
  if (!submitter) {
    throw new ConvexError("Expense submitter staff record not found");
  }
  if (!manager?.active) {
    if (isDirectorOrAdmin(access)) {
      return { manager: null, submitter };
    }
    throw new ConvexError("Reporting manager is not configured for this expense submitter");
  }
  return { manager, submitter };
}

async function notifyExpenseSubmitter(
  ctx: any,
  expense: any,
  input: Parameters<typeof notifyRoles>[2]
) {
  const submitter = await staffByAuthUserId(ctx, expense.createdBy);
  if (submitter?._id) {
    await notifyStaffMember(ctx, submitter._id, input);
  }
}

async function createFinanceExpenseApproval(ctx: any, access: any, expenseId: any, expense: any) {
  const snapshot = getExpenseApprovalSnapshot(expense);
  const existing = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q: any) => q.eq("entityType", "expense").eq("entityId", expenseId))
    .collect();
  const pending = existing.find(
    (approval: any) =>
      approval.status === "Pending" && matchesExpenseApprovalRequest(expense, approval)
  );
  if (pending) {
    return { id: pending._id };
  }
  const now = Date.now();
  const requestCode = await nextCode(ctx, "approvalRequests", "APR");
  const approvalId = await ctx.db.insert("approvalRequests", {
    amount: expense.amount ?? 0,
    createdAt: now,
    entityId: expenseId,
    entityType: "expense",
    expenseVersion: snapshot.version,
    proofDigest: snapshot.proofDigest,
    requestCode,
    requestedBy: expense.createdBy ?? access.authUserId ?? "unknown",
    requestedByName: expense.tourManagerName || access.name,
    status: "Pending",
    summary: `${expense.category} expense for ${(expense.amount ?? 0).toLocaleString("en-IN")}`,
    type: "Expense",
    updatedAt: now,
  });
  await notifyRoles(ctx, ["Finance", "Directors"], {
    body: `${requestCode}: ${expense.category} expense is manager-approved and needs Finance approval.`,
    entityId: approvalId,
    entityType: "approval",
    title: "Expense finance approval requested",
  });
  return { id: approvalId };
}

async function requireCurrentExpenseApprovalRequest(ctx: any, expenseId: any, expense: any) {
  if (!matchesManagerApprovedSnapshot(expense)) {
    throw new ConvexError(
      "Expense changed after manager approval; resubmit it for manager approval"
    );
  }
  const approvalRows = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q: any) => q.eq("entityType", "expense").eq("entityId", expenseId))
    .collect();
  if (
    !approvalRows.some(
      (approval: any) =>
        approval.status === "Pending" && matchesExpenseApprovalRequest(expense, approval)
    )
  ) {
    throw new ConvexError("The Finance approval request is stale; resubmit the expense");
  }
  return approvalRows;
}

export async function handleSubmitExpenseForApproval(ctx: any, args: { expenseId: string }) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.CREATE_EXPENSES,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_ALL_EXPENSES,
  ]);
  const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!expenseId) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  const alreadyPendingSubmission =
    Boolean(expense.submittedForApprovalAt) &&
    (expense.managerReviewStatus ?? "Pending") === "Pending";
  await assertExpenseAccess(ctx, access, expense, "mutate");
  if (alreadyPendingSubmission) {
    return { id: expenseId };
  }
  const { manager } = await resolveExpenseSubmitterAndManager(ctx, access, expense);
  const now = Date.now();
  const submitPatch: Record<string, unknown> = {
    approvalStatus: "Pending",
    financeReviewStatus: "Pending",
    managerApprovedProofDigest: manager ? undefined : (expense.proofDigest ?? ""),
    managerApprovedVersion: manager ? undefined : (expense.approvalVersion ?? 1),
    managerReviewStatus: manager ? "Pending" : "Approved",
    reimbursementStatus: "Pending",
    submittedForApprovalAt: now,
    updatedAt: now,
  };
  const activityMessage = `${expense.category} expense submitted for manager approval`;
  if (manager?._id) {
    submitPatch.managerApproverStaffId = manager._id;
    await ctx.db.patch(expenseId, submitPatch);
    await Promise.all([
      createActivity(ctx, access, {
        action: "submitted_for_approval",
        entityId: expenseId,
        entityType: "expense",
        message: activityMessage,
      }),
      notifyStaffMember(ctx, manager._id, {
        body: `${expense.category} expense for ${(expense.amount ?? 0).toLocaleString("en-IN")} needs your approval.`,
        entityId: expenseId,
        entityType: "expense",
        title: "Expense manager approval requested",
      }),
    ]);
    return { id: expenseId };
  }
  submitPatch.managerReviewedBy = access.authUserId;
  submitPatch.managerReviewedByName = access.name;
  submitPatch.managerReviewedAt = now;
  await ctx.db.patch(expenseId, submitPatch);
  await createActivity(ctx, access, {
    action: "submitted_for_approval",
    entityId: expenseId,
    entityType: "expense",
    message: activityMessage,
  });
  return await createFinanceExpenseApproval(ctx, access, expenseId, {
    ...expense,
    ...submitPatch,
  });
}

export async function handleDecideExpenseManager(
  ctx: any,
  args: { decisionNote?: string; expenseId: string; status: "Approved" | "Rejected" }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
  const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!expenseId) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if ((expense.managerReviewStatus ?? "Pending") !== "Pending") {
    throw new ConvexError("Manager review is already complete");
  }
  if (!canApproveExpenseAsManager(access, expense)) {
    throw new ConvexError("Only the reporting manager can approve this expense stage");
  }
  await assertExpenseAccess(ctx, access, expense);
  const now = Date.now();
  const patch: Record<string, unknown> = {
    managerReviewedAt: now,
    managerReviewedBy: access.authUserId ?? "unknown",
    managerReviewedByName: access.name,
    managerReviewStatus: args.status,
    updatedAt: now,
  };
  if (args.status === "Approved") {
    const snapshot = getExpenseApprovalSnapshot(expense);
    patch.managerApprovedProofDigest = snapshot.proofDigest;
    patch.managerApprovedVersion = snapshot.version;
  }
  if (args.status === "Rejected") {
    patch.approvalStatus = "Rejected";
    patch.reimbursementStatus = "Not Submitted";
  }
  await ctx.db.patch(expenseId, patch);
  await createActivity(ctx, access, {
    action: `manager_${args.status.toLowerCase()}`,
    entityId: expenseId,
    entityType: "expense",
    message: `Expense manager review ${args.status.toLowerCase()}`,
    metadata: { decisionNote: args.decisionNote?.trim() || "" },
  });
  if (args.status === "Approved") {
    await createFinanceExpenseApproval(ctx, access, expenseId, { ...expense, ...patch });
  } else {
    await notifyExpenseSubmitter(ctx, expense, {
      body: `${expense.category} expense was rejected by your reporting manager.`,
      entityId: expenseId,
      entityType: "expense",
      title: "Expense rejected by manager",
    });
  }
  return { id: expenseId };
}

export async function handleDecideExpenseFinance(
  ctx: any,
  args: {
    decisionNote?: string;
    expenseId: string;
    reimbursementStatus?: "Not Submitted" | "Pending" | "Reimbursed";
    status: "Approved" | "Rejected";
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!expenseId) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if ((expense.managerReviewStatus ?? "Pending") !== "Approved") {
    throw new ConvexError("Manager approval is required before Finance approval");
  }
  await assertExpenseAccess(ctx, access, expense);
  const approvalRows = await requireCurrentExpenseApprovalRequest(ctx, expenseId, expense);
  const now = Date.now();
  await ctx.db.patch(expenseId, {
    approvalStatus: args.status,
    financeReviewedAt: now,
    financeReviewedBy: access.authUserId ?? "unknown",
    financeReviewedByName: access.name,
    financeReviewStatus: args.status,
    reimbursementStatus:
      args.reimbursementStatus ?? (args.status === "Approved" ? "Pending" : "Not Submitted"),
    updatedAt: now,
  });
  await Promise.all(
    approvalRows.flatMap((approval: any) =>
      approval.status === "Pending"
        ? [
            ctx.db.patch(approval._id, {
              decidedAt: now,
              decidedBy: access.authUserId ?? "unknown",
              decidedByName: access.name,
              decisionNote: args.decisionNote?.trim() || "",
              status: args.status,
              updatedAt: now,
            }),
          ]
        : []
    )
  );
  await createActivity(ctx, access, {
    action: `finance_${args.status.toLowerCase()}`,
    entityId: expenseId,
    entityType: "expense",
    message: `Expense finance review ${args.status.toLowerCase()}`,
  });
  await notifyExpenseSubmitter(ctx, expense, {
    body: `${expense.category} expense was ${args.status.toLowerCase()} by Finance.`,
    entityId: expenseId,
    entityType: "expense",
    title: `Expense ${args.status}`,
  });
  return { id: expenseId };
}

export async function handleUpdateExpenseStatus(
  ctx: any,
  args: {
    approvalStatus: "Pending" | "Approved" | "Rejected";
    expenseId: string;
    reimbursementStatus: "Not Submitted" | "Pending" | "Reimbursed";
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.APPROVE_EXPENSES,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const id = ctx.db.normalizeId("expenseEntries", args.expenseId);
  if (!id) {
    throw new ConvexError("Invalid expense id");
  }
  const expense = await ctx.db.get(id);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if ((expense.managerReviewStatus ?? "Pending") !== "Approved") {
    throw new ConvexError("Manager approval is required before Finance approval");
  }
  await assertExpenseAccess(ctx, access, expense);
  const approvalRows = await requireCurrentExpenseApprovalRequest(ctx, id, expense);
  const now = Date.now();
  const expensePatch: Record<string, unknown> = {
    approvalStatus: args.approvalStatus,
    financeReviewStatus: args.approvalStatus === "Pending" ? "Pending" : args.approvalStatus,
    reimbursementStatus: args.reimbursementStatus,
    updatedAt: now,
  };
  if (args.approvalStatus !== "Pending") {
    expensePatch.financeReviewedBy = access.authUserId;
    expensePatch.financeReviewedByName = access.name;
    expensePatch.financeReviewedAt = now;
  }
  await ctx.db.patch(id, expensePatch);
  await Promise.all(
    approvalRows.flatMap((approval: any) => {
      if (approval.status !== "Pending") {
        return [];
      }
      const approvalPatch: Record<string, unknown> = {
        status: args.approvalStatus === "Pending" ? "Pending" : args.approvalStatus,
        updatedAt: now,
      };
      if (args.approvalStatus !== "Pending") {
        approvalPatch.decidedBy = access.authUserId;
        approvalPatch.decidedByName = access.name;
        approvalPatch.decidedAt = now;
      }
      return [ctx.db.patch(approval._id, approvalPatch)];
    })
  );
  await createActivity(ctx, access, {
    action: "status_updated",
    entityId: id,
    entityType: "expense",
    message: `Expense ${args.approvalStatus.toLowerCase()}`,
  });
  return { id };
}
