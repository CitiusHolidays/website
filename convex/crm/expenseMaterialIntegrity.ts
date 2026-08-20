import type { RuntimeObject } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";

export const MATERIAL_EXPENSE_FIELDS = [
  "amount",
  "cardAmount",
  "cashAmount",
  "category",
  "currency",
  "epayAmount",
  "paidBy",
  "particulars",
] as const;

export function splitTotal(input: {
  cardAmount?: number;
  cashAmount?: number;
  epayAmount?: number;
}) {
  return (input.cardAmount ?? 0) + (input.cashAmount ?? 0) + (input.epayAmount ?? 0);
}

export function hasMaterialExpenseChange(expense: Doc<"expenseEntries">, patch: RuntimeObject) {
  return MATERIAL_EXPENSE_FIELDS.some(
    (field) => field in patch && !Object.is(expense[field], patch[field])
  );
}

export async function invalidatePendingExpenseApprovals(
  ctx: MutationCtx,
  expenseId: Id<"expenseEntries">,
  now: number
) {
  const approvalRows = await ctx.db
    .query("approvalRequests")
    .withIndex("by_entity", (q) => q.eq("entityType", "expense").eq("entityId", expenseId))
    .collect();
  await Promise.all(
    approvalRows.flatMap((approval) =>
      approval.status === "Pending"
        ? [
            (async () => {
              await ctx.db.patch("approvalRequests", approval._id, {
                decisionNote: "Invalidated by a material expense or proof change",
                status: "Needs Info",
                updatedAt: now,
              });
              await scheduleCrmMetricSync(ctx, "approvalRequests", String(approval._id));
            })(),
          ]
        : []
    )
  );
}

export function resetExpenseApprovalPatch(expense: Doc<"expenseEntries">, now: number) {
  return {
    approvalStatus: "Pending" as const,
    approvalVersion: (expense.approvalVersion ?? 1) + 1,
    financeReviewedAt: undefined,
    financeReviewedBy: undefined,
    financeReviewedByName: undefined,
    financeReviewStatus: "Pending" as const,
    managerApprovedProofDigest: undefined,
    managerApprovedVersion: undefined,
    managerApproverStaffId: undefined,
    managerReviewedAt: undefined,
    managerReviewedBy: undefined,
    managerReviewedByName: undefined,
    managerReviewStatus: "Pending" as const,
    reimbursementStatus: "Not Submitted" as const,
    submittedForApprovalAt: undefined,
    updatedAt: now,
  };
}

export function proofChangeResetPatch(
  expense: Doc<"expenseEntries">,
  proofDigest: string,
  now: number
) {
  return {
    ...resetExpenseApprovalPatch(expense, now),
    proofDigest,
  } as const;
}

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
