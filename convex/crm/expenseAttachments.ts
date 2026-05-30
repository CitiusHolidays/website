import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { canSeeJobCardRecord, PERMISSIONS, requireAnyPermission } from "./lib";

async function requireVisibleExpense(ctx: any, expenseId: Id<"expenseEntries">) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.VIEW_EXPENSES,
    PERMISSIONS.MANAGE_EXPENSES,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const expense = await ctx.db.get(expenseId);
  if (!expense) {
    throw new ConvexError("Expense not found");
  }
  if (expense.jobCardId) {
    const job = await ctx.db.get(expense.jobCardId);
    const linkedQuery = job?.queryId ? await ctx.db.get(job.queryId) : null;
    if (!job || !canSeeJobCardRecord(access, job, linkedQuery)) {
      throw new ConvexError("FORBIDDEN");
    }
    return { expense, job };
  }
  return { expense, job: null };
}

export const verifyExpenseAccess = query({
  args: {
    expenseId: v.string(),
  },
  handler: async (ctx, args) => {
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!expenseId) {
      throw new ConvexError("Invalid expense id");
    }
    await requireVisibleExpense(ctx, expenseId);
    return { id: expenseId };
  },
});

export const getAttachmentRecord = query({
  args: {
    attachmentId: v.string(),
  },
  handler: async (ctx, args) => {
    const attachmentId = ctx.db.normalizeId("attachments", args.attachmentId);
    if (!attachmentId) {
      return null;
    }
    const row = await ctx.db.get(attachmentId);
    if (!row || row.entityType !== "expense") {
      return null;
    }
    const expenseId = ctx.db.normalizeId("expenseEntries", row.entityId);
    if (!expenseId) {
      return null;
    }
    await requireVisibleExpense(ctx, expenseId);
    return {
      id: row._id,
      expenseId,
      storageId: row.storageId ?? "",
      fileName: row.fileName,
      mimeType: row.mimeType ?? "application/octet-stream",
    };
  },
});

export const saveExpenseProof = internalMutation({
  args: {
    expenseId: v.id("expenseEntries"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new ConvexError("Expense not found");
    }
    let previousStorageId: string | null = null;
    if (expense.proofAttachmentId) {
      const previous = await ctx.db.get(expense.proofAttachmentId);
      previousStorageId = previous?.storageId ?? null;
      if (previous) {
        await ctx.db.delete(previous._id);
      }
    }
    const attachmentId = await ctx.db.insert("attachments", {
      entityType: "expense",
      entityId: args.expenseId,
      fileName: args.fileName,
      storageId: args.storageId,
      mimeType: args.mimeType,
      createdBy: args.createdBy,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.expenseId, {
      proofAttachmentId: attachmentId,
      updatedAt: Date.now(),
    });
    return { attachmentId, previousStorageId };
  },
});

export const deleteExpenseProof = internalMutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.attachmentId);
    if (!row || row.entityType !== "expense") {
      return { storageId: null as string | null };
    }
    const expenseId = ctx.db.normalizeId("expenseEntries", row.entityId);
    if (expenseId) {
      const expense = await ctx.db.get(expenseId);
      if (expense?.proofAttachmentId === args.attachmentId) {
        await ctx.db.patch(expenseId, {
          proofAttachmentId: undefined,
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.delete(args.attachmentId);
    return { storageId: row.storageId ?? null };
  },
});
