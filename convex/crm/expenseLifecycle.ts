interface ExpenseLifecycleRecord {
  approvalStatus?: string;
  approvalVersion?: number;
  financeReviewedAt?: number;
  financeReviewedBy?: string;
  financeReviewStatus?: string;
  managerApprovedVersion?: number;
  managerApproverStaffId?: string;
  managerReviewedAt?: number;
  managerReviewedBy?: string;
  managerReviewStatus?: string;
  reimbursementStatus?: string;
  submittedForApprovalAt?: number;
}

export function isNeverSubmittedExpenseDraft(
  expense: ExpenseLifecycleRecord,
  hasApprovalHistory = false
) {
  return (
    !hasApprovalHistory &&
    expense.approvalStatus === "Pending" &&
    (expense.approvalVersion ?? 1) <= 1 &&
    expense.reimbursementStatus === "Not Submitted" &&
    expense.submittedForApprovalAt === undefined &&
    expense.managerReviewStatus === undefined &&
    expense.financeReviewStatus === undefined &&
    expense.managerApproverStaffId === undefined &&
    expense.managerApprovedVersion === undefined &&
    expense.managerReviewedAt === undefined &&
    expense.managerReviewedBy === undefined &&
    expense.financeReviewedAt === undefined &&
    expense.financeReviewedBy === undefined
  );
}

export async function hasExpenseApprovalHistory(ctx: any, expenseId: string) {
  const approval = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q: any) => q.eq("entityType", "expense").eq("entityId", expenseId))
    .first();
  return Boolean(approval);
}
