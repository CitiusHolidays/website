import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { JOB_CARD_STATUS } from "./jobCardConstants";
import {
  assertDateRangeOrder,
  canEditContractingRecord,
  canEditOperationsRecord,
  canSeeJobCardRecord,
  createActivity,
  deleteJobCardCascade,
  editorPatch,
  notifyStaffMember,
  PERMISSIONS,
  requireAnyPermission,
  requireHeadOrAdmin,
  requireStaff,
} from "./lib";
import { buildJobCardListSearchText } from "./listSearch";

export async function handleJobCardUpdate(
  ctx: MutationCtx,
  args: {
    clientName?: string;
    confirmedPax?: number;
    destination?: string;
    jobCardId: string;
    roomCount?: number;
    tourManagerName?: string;
    travelEndDate?: string;
    travelStartDate?: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
  ]);
  const id = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!id) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await ctx.db.get(id);
  if (!job) {
    const existingOperation = await ctx.db
      .query("jobCardDeletionOperations")
      .withIndex("by_jobCardId", (q) => q.eq("jobCardId", args.jobCardId))
      .order("desc")
      .first();
    if (existingOperation) {
      return {
        id,
        operationId: existingOperation._id,
        status: existingOperation.status,
      };
    }
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError("Only assigned SPOCs, collaborators, and heads can edit this Job Card");
  }
  if (args.confirmedPax !== undefined && args.confirmedPax < 1) {
    throw new ConvexError("Confirmed pax must be greater than zero");
  }
  assertDateRangeOrder(
    args.travelStartDate ?? job.travelStartDate,
    args.travelEndDate ?? job.travelEndDate,
    "Travel start date",
    "Travel end date"
  );

  const patch: Record<string, unknown> = editorPatch(access);
  if (args.clientName !== undefined) {
    patch.clientName = args.clientName.trim();
  }
  if (args.destination !== undefined) {
    patch.destination = args.destination.trim();
  }
  if (args.confirmedPax !== undefined) {
    patch.confirmedPax = args.confirmedPax;
  }
  if (args.roomCount !== undefined) {
    patch.roomCount = args.roomCount;
  }
  if (args.travelStartDate !== undefined) {
    patch.travelStartDate = args.travelStartDate;
  }
  if (args.travelEndDate !== undefined) {
    patch.travelEndDate = args.travelEndDate;
  }
  if (args.tourManagerName !== undefined) {
    patch.tourManagerName = args.tourManagerName.trim();
  }
  patch.listSearchText = buildJobCardListSearchText({ ...job, ...patch });

  await ctx.db.patch(id, patch);
  await createActivity(ctx, access, {
    action: "updated",
    entityId: id,
    entityType: "jobCard",
    message: `${job.jobCode} updated`,
  });
  return { id };
}

export async function handleJobCardUpdateStatus(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    status: "Open" | "In Operations" | "Ready for Departure" | "On Tour" | "Closed";
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
  if (!canEditOperationsRecord(access, job)) {
    throw new ConvexError(
      "Only assigned Operations SPOC, collaborators, and heads can update status"
    );
  }
  await ctx.db.patch(id, { status: args.status, ...editorPatch(access) });
  await createActivity(ctx, access, {
    action: "status_updated",
    entityId: id,
    entityType: "jobCard",
    message: `${job.jobCode} moved to ${args.status}`,
  });
  return { id };
}

export async function handleAddCollaborator(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    staffId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_CONTRACTING,
  ]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const [job, staff] = await Promise.all([ctx.db.get(jobCardId), ctx.db.get(staffId)]);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  if (!(canEditOperationsRecord(access, job) || canEditContractingRecord(access, job))) {
    throw new ConvexError("Only assigned SPOCs and heads can add collaborators");
  }
  const collaborators = new Set((job.collaboratorStaffIds ?? []).map(String));
  collaborators.add(String(staffId));
  await Promise.all([
    ctx.db.patch(jobCardId, {
      collaboratorStaffIds: Array.from(collaborators).map(
        (id) => ctx.db.normalizeId("staffUsers", id)!
      ),
      ...editorPatch(access),
    }),
    notifyStaffMember(ctx, staffId, {
      body: `${job.jobCode} was shared with you for collaboration.`,
      entityId: jobCardId,
      entityType: "jobCard",
      title: "Job Card access shared",
    }),
  ]);
  return { id: jobCardId };
}

export async function handleRemoveCollaborator(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    staffId: string;
  }
) {
  const access = await requireAnyPermission(ctx, [
    PERMISSIONS.MANAGE_JOB_CARDS,
    PERMISSIONS.MANAGE_OPERATIONS,
    PERMISSIONS.MANAGE_CONTRACTING,
  ]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
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
    throw new ConvexError("Only assigned SPOCs and heads can remove collaborators");
  }
  await ctx.db.patch(jobCardId, {
    collaboratorStaffIds: (job.collaboratorStaffIds ?? []).filter(
      (id: any) => String(id) !== String(staffId)
    ),
    ...editorPatch(access),
  });
  return { id: jobCardId };
}

export async function handleAssignOperationsOwner(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    staffId: string;
  }
) {
  const access = await requireHeadOrAdmin(ctx, ["Operations Head"]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const isOpsTeam = staff.roles.some((role) => ["Operations", "Operations Head"].includes(role));
  if (!isOpsTeam) {
    throw new ConvexError("Selected staff member is not on the operations team");
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const ownerName = staff.name.trim();
  await Promise.all([
    ctx.db.patch(jobCardId, {
      operationsOwnerId: staffId,
      operationsOwnerName: ownerName,
      updatedAt: Date.now(),
    }),
    createActivity(ctx, access, {
      action: "assigned_operations",
      entityId: jobCardId,
      entityType: "jobCard",
      message: `${job.jobCode} assigned to ${ownerName} (Operations)`,
    }),
    notifyStaffMember(ctx, staffId, {
      body: `You were assigned as operations owner for ${job.jobCode}.`,
      entityId: jobCardId,
      entityType: "jobCard",
      title: "Assign operations owner",
    }),
  ]);
  return { id: jobCardId };
}

export async function handleAssignContractingOwner(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
    staffId: string;
  }
) {
  const access = await requireHeadOrAdmin(ctx, ["Contracting Head", "Operations Head"]);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const staffId = ctx.db.normalizeId("staffUsers", args.staffId);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const isContractingTeam = staff.roles.some((role) =>
    ["Contracting", "Contracting Head"].includes(role)
  );
  if (!isContractingTeam) {
    throw new ConvexError("Selected staff member is not on the contracting team");
  }
  const job = await ctx.db.get(jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found");
  }
  const linkedQuery = job.queryId ? await ctx.db.get(job.queryId) : null;
  if (!canSeeJobCardRecord(access, job, linkedQuery)) {
    throw new ConvexError("FORBIDDEN");
  }
  const ownerName = staff.name.trim();
  await Promise.all([
    ctx.db.patch(jobCardId, {
      contractingOwnerId: staffId,
      contractingOwnerName: ownerName,
      updatedAt: Date.now(),
    }),
    createActivity(ctx, access, {
      action: "assigned_contracting",
      entityId: jobCardId,
      entityType: "jobCard",
      message: `${job.jobCode} assigned to ${ownerName} (Contracting)`,
    }),
    notifyStaffMember(ctx, staffId, {
      body: `You were assigned as contracting SPOC for ${job.jobCode}.`,
      entityId: jobCardId,
      entityType: "jobCard",
      title: "Assign contracting owner",
    }),
  ]);
  return { id: jobCardId };
}

export async function handleJobCardRemove(
  ctx: MutationCtx,
  args: {
    jobCardId: string;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_JOB_CARDS);
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
  await createActivity(ctx, access, {
    action: "deleted",
    entityId: id,
    entityType: "jobCard",
    message: `${job.jobCode} deleted`,
  });
  const operationId = await deleteJobCardCascade(ctx, id, {
    initiatedBy: access.authUserId ?? access.email,
    initiatedByStaffId: access.staffId,
    jobCode: job.jobCode,
  });
  return { id, operationId, status: "running" as const };
}

export { JOB_CARD_STATUS };
