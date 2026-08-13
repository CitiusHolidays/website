import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  type ExpenseApprovalStatus,
  type ExpenseReimbursementStatus,
  normalizeExpenseLifecycle,
} from "./expenseLifecycle";

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
        const normalized = normalizeExpenseLifecycle(
          expense.approvalStatus as ExpenseApprovalStatus,
          expense.reimbursementStatus as ExpenseReimbursementStatus
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
});
