import { ConvexError } from "convex/values";

export type ExpenseApprovalStatus = "Pending" | "Approved" | "Rejected";
export type ExpenseReimbursementStatus = "Not Submitted" | "Pending" | "Reimbursed";

const ALLOWED_REIMBURSEMENT_STATUS = {
  Approved: ["Pending", "Reimbursed"],
  Pending: ["Not Submitted", "Pending"],
  Rejected: ["Not Submitted"],
} satisfies Record<ExpenseApprovalStatus, readonly ExpenseReimbursementStatus[]>;

export function assertValidExpenseLifecycle(
  approvalStatus: ExpenseApprovalStatus,
  reimbursementStatus: ExpenseReimbursementStatus
) {
  if (
    !ALLOWED_REIMBURSEMENT_STATUS[approvalStatus].some(
      (candidate) => candidate === reimbursementStatus
    )
  ) {
    throw new ConvexError(
      `Invalid expense lifecycle: ${approvalStatus} expenses cannot be ${reimbursementStatus}`
    );
  }
}

export function normalizeExpenseLifecycle(
  approvalStatus: ExpenseApprovalStatus,
  reimbursementStatus: ExpenseReimbursementStatus
) {
  if (approvalStatus === "Rejected") {
    return { approvalStatus, reimbursementStatus: "Not Submitted" as const };
  }
  if (approvalStatus === "Approved") {
    return {
      approvalStatus,
      reimbursementStatus:
        reimbursementStatus === "Reimbursed" ? reimbursementStatus : ("Pending" as const),
    };
  }
  return {
    approvalStatus,
    reimbursementStatus:
      reimbursementStatus === "Reimbursed" ? ("Pending" as const) : reimbursementStatus,
  };
}

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
