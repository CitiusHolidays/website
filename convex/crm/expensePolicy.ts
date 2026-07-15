import { PERMISSIONS } from "./lib/rolePolicy";

interface ExpenseAccess {
  authUserId?: string;
  permissions: string[];
  staffId?: string;
}

interface ExpenseRecord {
  approvalVersion?: number;
  createdBy?: string;
  managerApprovedProofDigest?: string;
  managerApprovedVersion?: number;
  managerApproverStaffId?: string;
  proofDigest?: string;
}

interface ExpenseApprovalRecord {
  expenseVersion?: number;
  proofDigest?: string;
}

export function canManageAllExpenses(access: ExpenseAccess) {
  return access.permissions.includes(PERMISSIONS.MANAGE_ALL_EXPENSES);
}

export function isExpenseCreator(access: ExpenseAccess, expense: ExpenseRecord) {
  return Boolean(access.authUserId && expense.createdBy && access.authUserId === expense.createdBy);
}

export function isExpenseManager(access: ExpenseAccess, expense: ExpenseRecord) {
  return Boolean(
    access.staffId &&
      expense.managerApproverStaffId &&
      String(access.staffId) === String(expense.managerApproverStaffId)
  );
}

export function canViewUnlinkedExpense(access: ExpenseAccess, expense: ExpenseRecord) {
  return (
    canManageAllExpenses(access) ||
    isExpenseCreator(access, expense) ||
    isExpenseManager(access, expense)
  );
}

export function canMutateUnlinkedExpense(access: ExpenseAccess, expense: ExpenseRecord) {
  return canManageAllExpenses(access) || isExpenseCreator(access, expense);
}

export function getExpenseApprovalSnapshot(expense: ExpenseRecord) {
  return {
    proofDigest: expense.proofDigest ?? "",
    version: expense.approvalVersion ?? 1,
  };
}

export function matchesManagerApprovedSnapshot(expense: ExpenseRecord) {
  const snapshot = getExpenseApprovalSnapshot(expense);
  return (
    expense.managerApprovedVersion === snapshot.version &&
    expense.managerApprovedProofDigest === snapshot.proofDigest
  );
}

export function matchesExpenseApprovalRequest(
  expense: ExpenseRecord,
  approval: ExpenseApprovalRecord
) {
  const snapshot = getExpenseApprovalSnapshot(expense);
  return (
    approval.expenseVersion === snapshot.version && approval.proofDigest === snapshot.proofDigest
  );
}
