import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { type ExpenseApprovalStatus, normalizeExpenseLifecycle } from "./expenseLifecycle";
import { scheduleCrmMetricSync } from "./financeMetricSync";

const PAGE_SIZE = 100;

export const repairExpenseLifecycle = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    dryRun: v.boolean(),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("expenseEntries")
      .withIndex("by_createdAt")
      .paginate({ cursor: args.cursor ?? null, numItems: PAGE_SIZE });
    const repairs = await Promise.all(
      page.page.map(async (expense) => {
        // SAFETY: expense approvalStatus is constrained by the expenseEntries storage validator.
        const normalized = normalizeExpenseLifecycle(
          expense.approvalStatus as ExpenseApprovalStatus,
          expense.reimbursementStatus
        );
        if (
          normalized.approvalStatus === expense.approvalStatus &&
          normalized.reimbursementStatus === expense.reimbursementStatus
        ) {
          return 0;
        }
        if (!args.dryRun) {
          await ctx.db.patch("expenseEntries", expense._id, {
            ...normalized,
            updatedAt: Date.now(),
          });
          await scheduleCrmMetricSync(ctx, "expenseEntries", String(expense._id));
        }
        return 1;
      })
    );
    const inconsistent = repairs.reduce<number>((total, value) => total + value, 0);
    return {
      continueCursor: page.continueCursor,
      inconsistent,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    inconsistent: v.number(),
    isDone: v.boolean(),
    scanned: v.number(),
  }),
});
