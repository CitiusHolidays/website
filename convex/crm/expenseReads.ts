import { hasExpenseApprovalHistory, isNeverSubmittedExpenseDraft } from "./expenseLifecycle";
import { canManageAllExpenses, canMutateUnlinkedExpense } from "./expensePolicy";
import { canApproveExpenseAsManager } from "./expenseScope";
import { getVisibleJob } from "./jobCardVisibility";
import { PERMISSIONS, requireStaff } from "./lib";
import {
  applyCrmCursorFilters,
  boundedPaginationOptions,
  compactPageItems,
  mapInBoundedBatches,
} from "./paginationPolicy";

function valueOr<Value>(value: Value | null | undefined, fallback: Value): Value {
  return value ?? fallback;
}

function optionalIso(value: number | null | undefined) {
  return value ? new Date(value).toISOString() : null;
}

function expensePermissions(access: any, expense: any, hasApprovalHistory: boolean) {
  const permissionSet = new Set(access.permissions);
  const canApproveFinancePermission =
    permissionSet.has(PERMISSIONS.APPROVE_EXPENSES) ||
    permissionSet.has(PERMISSIONS.MANAGE_FINANCE);
  return {
    canApproveFinance:
      valueOr(expense.managerReviewStatus, "Pending") === "Approved" &&
      valueOr(expense.financeReviewStatus, "Pending") === "Pending" &&
      canApproveFinancePermission,
    canApproveManager:
      Boolean(expense.submittedForApprovalAt) &&
      valueOr(expense.managerReviewStatus, "Pending") === "Pending" &&
      canApproveExpenseAsManager(access, expense),
    canDelete:
      canMutateUnlinkedExpense(access, expense) &&
      isNeverSubmittedExpenseDraft(expense, hasApprovalHistory),
  };
}

function presentProofAttachment(proofAttachment: any) {
  if (!proofAttachment) {
    return null;
  }
  return {
    createdAt: new Date(proofAttachment.createdAt).toISOString(),
    fileName: proofAttachment.fileName,
    id: proofAttachment._id,
    mimeType: valueOr(proofAttachment.mimeType, ""),
  };
}

export async function presentExpenseListRow(ctx: any, access: any, expense: any) {
  const canManageAll = canManageAllExpenses(access);
  const [job, proofAttachment, hasApprovalHistory] = await Promise.all([
    expense.jobCardId ? getVisibleJob(ctx, access, expense.jobCardId) : null,
    expense.proofAttachmentId ? ctx.db.get("expenseAttachments", expense.proofAttachmentId) : null,
    hasExpenseApprovalHistory(ctx, expense._id),
  ]);
  if (expense.jobCardId && !job) {
    return null;
  }
  if (
    !(expense.jobCardId || canManageAll) &&
    expense.createdBy !== access.authUserId &&
    String(expense.managerApproverStaffId ?? "") !== String(access.staffId ?? "")
  ) {
    return null;
  }
  const permissions = expensePermissions(access, expense, hasApprovalHistory);
  return {
    amount: expense.amount,
    approvalStatus: expense.approvalStatus,
    ...permissions,
    cardAmount: valueOr(expense.cardAmount, 0),
    cashAmount: valueOr(expense.cashAmount, 0),
    category: expense.category,
    clientName: valueOr(job?.clientName, ""),
    createdAt: new Date(expense.createdAt).toISOString(),
    currency: valueOr(expense.currency, "INR"),
    epayAmount: valueOr(expense.epayAmount, 0),
    expenseDate: valueOr(expense.expenseDate, ""),
    financeReviewedAt: optionalIso(expense.financeReviewedAt),
    financeReviewedByName: valueOr(expense.financeReviewedByName, ""),
    financeReviewStatus: valueOr(expense.financeReviewStatus, "Pending"),
    id: expense._id,
    jobCardId: valueOr(expense.jobCardId, null),
    jobCode: valueOr(job?.jobCode, "Office"),
    managerApproverStaffId: valueOr(expense.managerApproverStaffId, ""),
    managerReviewedAt: optionalIso(expense.managerReviewedAt),
    managerReviewedByName: valueOr(expense.managerReviewedByName, ""),
    managerReviewStatus: valueOr(expense.managerReviewStatus, "Pending"),
    notes: valueOr(expense.notes, ""),
    paidBy: expense.paidBy,
    particulars: valueOr(expense.particulars, ""),
    proofAttachment: presentProofAttachment(proofAttachment),
    reimbursementStatus: expense.reimbursementStatus,
    submittedForApprovalAt: optionalIso(expense.submittedForApprovalAt),
    tourManagerName: valueOr(expense.tourManagerName, ""),
  };
}

export async function handleListExpenses(ctx: any, args: any) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
  const page = await applyCrmCursorFilters(
    ctx.db.query("expenseEntries").withIndex("by_createdAt").order("desc"),
    {
      equals: {
        approvalStatus: args.approvalStatus,
        category: args.category,
        jobCardId: args.jobCardId,
        reimbursementStatus: args.reimbursementStatus,
      },
    }
  ).paginate(boundedPaginationOptions(args.paginationOpts));
  const rows = await mapInBoundedBatches(page.page, async (expense: any) =>
    presentExpenseListRow(ctx, access, expense)
  );
  return { ...page, page: compactPageItems(rows) };
}
