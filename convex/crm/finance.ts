/**
 * Stable public API entry for CRM finance.
 * Canonical implementations live in focused invoice*, expense*, and finance* modules.
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  handleDecideExpenseFinance,
  handleDecideExpenseManager,
  handleSubmitExpenseForApproval,
  handleUpdateExpenseStatus,
} from "./expenseApprovalWorkflow";
import { handleCreateExpense, handleRemoveExpense, handleUpdateExpense } from "./expenseCommands";
import { handleListExpenses, presentExpenseListRow } from "./expenseReads";
import { handleGetFinanceOverview } from "./financeOverviewReads";
import {
  expenseIdResultValidator,
  expenseListPageResultValidator,
  expenseListRowResultValidator,
  financeOverviewResultValidator,
  invoiceIdResultValidator,
  invoiceListPageResultValidator,
} from "./financeTicketingReturnContracts";
import { expenseCurrencyValidator, expenseDecisionValidator } from "./financeValidators";
import { handleCreateInvoice, handleRemoveInvoice, handleUpdateInvoice } from "./invoiceCommands";
import { handleListInvoices } from "./invoiceReads";
import { PERMISSIONS, portalDateRangeValidator, requireStaff } from "./lib";

export {
  hasMaterialExpenseChange,
  MATERIAL_EXPENSE_FIELDS,
  splitTotal,
} from "./expenseMaterialIntegrity";
export { canApproveExpenseAsManager } from "./expenseScope";

export const listInvoices = query({
  args: {
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
  },
  handler: handleListInvoices,
  returns: invoiceListPageResultValidator,
});

export const createInvoice = mutation({
  args: {
    dueDate: v.optional(v.string()),
    expectedAmount: v.number(),
    invoiceNumber: v.string(),
    jobCardId: v.string(),
    receivedAmount: v.optional(v.number()),
  },
  handler: handleCreateInvoice,
  returns: invoiceIdResultValidator,
});

export const updateInvoice = mutation({
  args: {
    dueDate: v.optional(v.string()),
    expectedAmount: v.optional(v.number()),
    invoiceId: v.string(),
    invoiceNumber: v.optional(v.string()),
    receivedAmount: v.optional(v.number()),
  },
  handler: handleUpdateInvoice,
  returns: invoiceIdResultValidator,
});

export const removeInvoice = mutation({
  args: {
    invoiceId: v.string(),
  },
  handler: handleRemoveInvoice,
  returns: invoiceIdResultValidator,
});

export const listExpenses = query({
  args: {
    approvalStatus: v.optional(v.string()),
    category: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
    reimbursementStatus: v.optional(v.string()),
  },
  handler: handleListExpenses,
  returns: expenseListPageResultValidator,
});

export const getExpenseListRow = query({
  args: { expenseId: v.string() },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_EXPENSES);
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    const expense = expenseId ? await ctx.db.get(expenseId) : null;
    return expense ? await presentExpenseListRow(ctx, access, expense) : null;
  },
  returns: expenseListRowResultValidator,
});

export const createExpense = mutation({
  args: {
    amount: v.optional(v.number()),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    category: v.string(),
    currency: v.optional(expenseCurrencyValidator),
    epayAmount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    jobCardId: v.optional(v.string()),
    notes: v.optional(v.string()),
    paidBy: v.string(),
    particulars: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: handleCreateExpense,
  returns: expenseIdResultValidator,
});

export const updateExpense = mutation({
  args: {
    amount: v.optional(v.number()),
    cardAmount: v.optional(v.number()),
    cashAmount: v.optional(v.number()),
    category: v.optional(v.string()),
    currency: v.optional(expenseCurrencyValidator),
    epayAmount: v.optional(v.number()),
    expenseDate: v.optional(v.string()),
    expenseId: v.string(),
    notes: v.optional(v.string()),
    paidBy: v.optional(v.string()),
    particulars: v.optional(v.string()),
    tourManagerName: v.optional(v.string()),
  },
  handler: handleUpdateExpense,
  returns: expenseIdResultValidator,
});

export const getFinanceOverview = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: handleGetFinanceOverview,
  returns: financeOverviewResultValidator,
});

export const submitExpenseForApproval = mutation({
  args: {
    expenseId: v.string(),
  },
  handler: handleSubmitExpenseForApproval,
  returns: expenseIdResultValidator,
});

export const decideExpenseManager = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    expenseId: v.string(),
    status: expenseDecisionValidator,
  },
  handler: handleDecideExpenseManager,
  returns: expenseIdResultValidator,
});

export const decideExpenseFinance = mutation({
  args: {
    decisionNote: v.optional(v.string()),
    expenseId: v.string(),
    reimbursementStatus: v.optional(
      v.union(v.literal("Not Submitted"), v.literal("Pending"), v.literal("Reimbursed"))
    ),
    status: expenseDecisionValidator,
  },
  handler: handleDecideExpenseFinance,
  returns: expenseIdResultValidator,
});

export const updateExpenseStatus = mutation({
  args: {
    approvalStatus: v.union(v.literal("Pending"), v.literal("Approved"), v.literal("Rejected")),
    expenseId: v.string(),
    reimbursementStatus: v.union(
      v.literal("Not Submitted"),
      v.literal("Pending"),
      v.literal("Reimbursed")
    ),
  },
  handler: handleUpdateExpenseStatus,
  returns: expenseIdResultValidator,
});

export const removeExpense = mutation({
  args: {
    expenseId: v.string(),
  },
  handler: handleRemoveExpense,
  returns: expenseIdResultValidator,
});
