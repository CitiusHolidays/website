import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import {
  canEditContractingRecord,
  canEditOperationsRecord,
  canSeeJobCardRecord,
  createActivity,
  editorPatch,
  PERMISSIONS,
  requireAnyPermission,
} from "./lib";

export async function handleUpdateChecklist(
  ctx: MutationCtx,
  args: {
    checklist: unknown;
    jobCardId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const id = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!id) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get(id);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError(
      "Only assigned SPOCs, collaborators, and heads can update this checklist"
    );
  }
  await ctx.db.patch(id, {
    preDepartureChecklist: args.checklist,
    ...editorPatch(access),
  });
  await createActivity(ctx, access, {
    action: "checklist_updated",
    entityId: id,
    entityType: "jobCard",
    message: `${job.jobCode} checklist updated`,
  });
  return { id };
}

export async function handleUpdateChecklistTask(
  ctx: MutationCtx,
  args: {
    completed: boolean;
    dueDate?: string;
    ownerRole?: string;
    taskId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const taskId = ctx.db.normalizeId("checklistTasks", args.taskId);
  if (!taskId) {
    throw new ConvexError("Invalid checklist task id");
  }
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new ConvexError("Checklist task not found");
  }
  const job = await ctx.db.get(task.jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError("Only assigned SPOCs, collaborators, and heads can update this task");
  }
  await ctx.db.patch(taskId, {
    completed: args.completed,
    completedAt: args.completed ? Date.now() : undefined,
    dueDate: args.dueDate,
    ownerRole: args.ownerRole as any,
    ...editorPatch(access),
  });
  return { id: taskId };
}

export async function handleCreateChecklistTask(
  ctx: MutationCtx,
  args: {
    category: string;
    dueDate?: string;
    jobCardId: string;
    ownerRole?: string;
    title: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError("Only assigned SPOCs, collaborators, and heads can add tasks");
  }
  const now = Date.now();
  const id = await ctx.db.insert("checklistTasks", {
    category: args.category.trim() || "Operations",
    completed: false,
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    dueDate: args.dueDate,
    jobCardId,
    ownerRole: args.ownerRole as any,
    title: args.title.trim(),
    updatedAt: now,
  });
  return { id };
}

export async function handleRemoveChecklistTask(
  ctx: MutationCtx,
  args: {
    taskId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_FINANCE,
  ]);
  const taskId = ctx.db.normalizeId("checklistTasks", args.taskId);
  if (!taskId) {
    throw new ConvexError("Invalid checklist task id");
  }
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new ConvexError("Checklist task not found");
  }
  const job = await ctx.db.get(task.jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError("Only assigned SPOCs, collaborators, and heads can remove tasks");
  }
  await ctx.db.delete(taskId);
  return { id: taskId };
}
