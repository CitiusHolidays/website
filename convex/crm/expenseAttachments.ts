import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import {
  invalidatePendingExpenseApprovals,
  proofChangeResetPatch,
} from "./expenseMaterialIntegrity";
import { requireMutableExpenseProof, requireVisibleExpense } from "./expenseScope";
import {
  expenseAttachmentRecordResultValidator,
  expenseIdResultValidator,
} from "./miscReturnContracts";

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
  returns: expenseIdResultValidator,
});

export const verifyExpenseProofMutationAccess = query({
  args: {
    expenseId: v.string(),
  },
  handler: async (ctx, args) => {
    const expenseId = ctx.db.normalizeId("expenseEntries", args.expenseId);
    if (!expenseId) {
      throw new ConvexError("Invalid expense id");
    }
    await requireMutableExpenseProof(ctx, expenseId);
    return { id: expenseId };
  },
  returns: expenseIdResultValidator,
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
    if (row?.entityType !== "expense") {
      return null;
    }
    const expenseId = ctx.db.normalizeId("expenseEntries", row.entityId);
    if (!expenseId) {
      return null;
    }
    await requireVisibleExpense(ctx, expenseId);
    return {
      expenseId,
      fileName: row.fileName,
      id: row._id,
      mimeType: row.mimeType ?? "application/octet-stream",
      storageId: row.storageId ?? "",
    };
  },
  returns: expenseAttachmentRecordResultValidator,
});

export const saveExpenseProof = internalMutation({
  args: {
    contentDigest: v.string(),
    createdBy: v.string(),
    expenseId: v.id("expenseEntries"),
    fileName: v.string(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const { access, expense } = await requireMutableExpenseProof(ctx, args.expenseId);
    let previousStorageId: string | null = null;
    if (expense.proofAttachmentId) {
      const previous = await ctx.db.get(expense.proofAttachmentId as Id<"attachments">);
      previousStorageId = previous?.storageId ?? null;
      if (previous) {
        await ctx.db.delete(previous._id);
      }
    }
    const attachmentId = await ctx.db.insert("attachments", {
      contentDigest: args.contentDigest,
      createdAt: Date.now(),
      createdBy: access.authUserId ?? args.createdBy,
      entityId: args.expenseId,
      entityType: "expense",
      fileName: args.fileName,
      mimeType: args.mimeType,
      storageId: args.storageId,
    });
    const now = Date.now();
    const proofChanged = (expense.proofDigest ?? "") !== args.contentDigest;
    if (proofChanged) {
      await invalidatePendingExpenseApprovals(ctx, args.expenseId, now);
    }
    await ctx.db.patch(args.expenseId, {
      ...(proofChanged ? proofChangeResetPatch(expense, args.contentDigest, now) : {}),
      proofAttachmentId: attachmentId,
      proofDigest: args.contentDigest,
      updatedAt: now,
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
    if (row?.entityType !== "expense") {
      return { storageId: null as string | null };
    }
    const expenseId = ctx.db.normalizeId("expenseEntries", row.entityId);
    if (expenseId) {
      const { expense } = await requireMutableExpenseProof(ctx, expenseId);
      if (expense?.proofAttachmentId === args.attachmentId) {
        const now = Date.now();
        const proofChanged = Boolean(expense.proofDigest || row.storageId);
        if (proofChanged) {
          await invalidatePendingExpenseApprovals(ctx, expenseId, now);
        }
        await ctx.db.patch(expenseId, {
          ...(proofChanged ? proofChangeResetPatch(expense, "", now) : {}),
          proofAttachmentId: undefined,
          proofDigest: "",
          updatedAt: now,
        });
      }
    }
    await ctx.db.delete(args.attachmentId);
    return { storageId: row.storageId ?? null };
  },
});
