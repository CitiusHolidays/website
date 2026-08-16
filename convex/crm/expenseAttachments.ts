import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, query } from "../_generated/server";
import { propertiesWhen } from "../lib/runtimeValues";
import {
  invalidatePendingExpenseApprovals,
  proofChangeResetPatch,
} from "./expenseMaterialIntegrity";
import { requireMutableExpenseProof, requireVisibleExpense } from "./expenseScope";
import { scheduleFinanceMetricSync } from "./financeMetricSync";
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
    const row = await ctx.db.get("attachments", attachmentId);
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
    let previousStorageId: Id<"_storage"> | null = null;
    if (expense.proofAttachmentId) {
      // SAFETY: proofAttachmentId is a legacy string field populated only from attachments IDs.
      const previous = await ctx.db.get(
        "attachments",
        expense.proofAttachmentId as Id<"attachments">
      );
      // SAFETY: attachment storageId values are written exclusively from Convex _storage IDs.
      previousStorageId = (previous?.storageId as Id<"_storage"> | undefined) ?? null;
      if (previous) {
        await ctx.db.delete("attachments", previous._id);
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
    await ctx.db.patch("expenseEntries", args.expenseId, {
      ...propertiesWhen(proofChanged, () =>
        proofChangeResetPatch(expense, args.contentDigest, now)
      ),
      proofAttachmentId: attachmentId,
      proofDigest: args.contentDigest,
      updatedAt: now,
    });
    await scheduleFinanceMetricSync(ctx, "expenseEntries", args.expenseId);
    if (previousStorageId) {
      await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: previousStorageId,
      });
    }
    return { attachmentId, previousStorageId };
  },
  returns: v.object({
    attachmentId: v.id("attachments"),
    previousStorageId: v.union(v.id("_storage"), v.null()),
  }),
});

export const deleteExpenseProof = internalMutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get("attachments", args.attachmentId);
    if (row?.entityType !== "expense") {
      return { storageId: null };
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
        await ctx.db.patch("expenseEntries", expenseId, {
          ...propertiesWhen(proofChanged, () => proofChangeResetPatch(expense, "", now)),
          proofAttachmentId: undefined,
          proofDigest: "",
          updatedAt: now,
        });
        await scheduleFinanceMetricSync(ctx, "expenseEntries", expenseId);
      }
    }
    await ctx.db.delete("attachments", args.attachmentId);
    if (row.storageId) {
      // SAFETY: attachment storageId values are written exclusively from Convex _storage IDs.
      await ctx.scheduler.runAfter(0, internal.crm.storageReferences.deleteIfUnreferenced, {
        storageId: row.storageId as Id<"_storage">,
      });
    }
    return { storageId: row.storageId ?? null };
  },
  returns: v.object({ storageId: v.union(v.string(), v.null()) }),
});
