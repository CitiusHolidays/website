import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { getVisibleJob } from "./jobCardVisibility";
import {
  assertBulkDeleteMutationBatch,
  createActivity,
  deleteEntityNotifications,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import { mapInBoundedBatches } from "./paginationPolicy";

export async function handleCreatePnr(
  ctx: any,
  args: {
    airline: string;
    fareType?: string;
    jobCardId: string;
    pnrCode: string;
    route: string;
    totalSeats: number;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const jobCardId = ctx.db.normalizeId("jobCards", args.jobCardId);
  if (!jobCardId) {
    throw new ConvexError("Invalid Job Card id");
  }
  const job = await getVisibleJob(ctx, access, jobCardId);
  if (!job) {
    throw new ConvexError("Job Card not found or not assigned to you");
  }
  const now = Date.now();
  const id = await ctx.db.insert("pnrs", {
    airline: args.airline.trim(),
    createdAt: now,
    createdBy: access.authUserId ?? "unknown",
    fareType: args.fareType?.trim() || "",
    issuedSeats: 0,
    jobCardId,
    pnrCode: args.pnrCode.trim().toUpperCase(),
    route: args.route.trim(),
    status: "Active",
    totalSeats: args.totalSeats,
    updatedAt: now,
  });
  await createActivity(ctx, access, {
    action: "created",
    entityId: id,
    entityType: "pnr",
    message: `${args.pnrCode.trim().toUpperCase()} added to ${job.jobCode}`,
  });
  return { id };
}

export async function handleUpdatePnr(
  ctx: any,
  args: {
    airline?: string;
    fareType?: string;
    pnrCode?: string;
    pnrId: string;
    route?: string;
    status?: string;
    totalSeats?: number;
  }
) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const pnrId = ctx.db.normalizeId("pnrs", args.pnrId);
  if (!pnrId) {
    throw new ConvexError("Invalid PNR id");
  }
  const pnr = await ctx.db.get(pnrId);
  if (!pnr) {
    throw new ConvexError("PNR not found");
  }
  const job = await getVisibleJob(ctx, access, pnr.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  if (args.pnrCode !== undefined && !args.pnrCode.trim()) {
    throw new ConvexError("PNR code is required");
  }
  if (args.totalSeats !== undefined && args.totalSeats < 0) {
    throw new ConvexError("Total seats cannot be negative");
  }

  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (args.pnrCode !== undefined) {
    patch.pnrCode = args.pnrCode.trim().toUpperCase();
  }
  if (args.airline !== undefined) {
    patch.airline = args.airline.trim();
  }
  if (args.route !== undefined) {
    patch.route = args.route.trim();
  }
  if (args.fareType !== undefined) {
    patch.fareType = args.fareType.trim();
  }
  if (args.totalSeats !== undefined) {
    patch.totalSeats = args.totalSeats;
  }
  if (args.status !== undefined) {
    patch.status = args.status.trim();
  }

  await ctx.db.patch(pnrId, patch);
  await createActivity(ctx, access, {
    action: "updated",
    entityId: pnrId,
    entityType: "pnr",
    message: `${(args.pnrCode ?? pnr.pnrCode).trim().toUpperCase()} updated`,
  });
  return { id: pnrId };
}

export async function deletePnrRecord(ctx: MutationCtx, access: PortalAccess, pnrId: Id<"pnrs">) {
  const pnr = await ctx.db.get(pnrId);
  if (!pnr) {
    throw new ConvexError("PNR not found");
  }
  const job = await getVisibleJob(ctx, access, pnr.jobCardId);
  if (!job) {
    throw new ConvexError("FORBIDDEN");
  }
  await Promise.all([
    createActivity(ctx, access, {
      action: "deleted",
      entityId: pnrId,
      entityType: "pnr",
      message: `${pnr.pnrCode} deleted`,
    }),
    deleteEntityNotifications(ctx, "pnr", pnrId),
    ctx.db.delete(pnrId),
    ctx.scheduler.runAfter(0, internal.crm.ticketing.continuePnrCleanup, {
      pnrId: String(pnrId),
      stage: "tickets",
    }),
  ]);
}

export async function handleRemovePnr(ctx: any, args: { pnrId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  const pnrId = ctx.db.normalizeId("pnrs", args.pnrId);
  if (!pnrId) {
    throw new ConvexError("Invalid PNR id");
  }
  await deletePnrRecord(ctx, access, pnrId);
  return { id: pnrId };
}

export async function handleRemoveManyPnrs(ctx: any, args: { pnrIds: string[] }) {
  const access = await requireStaff(ctx, PERMISSIONS.MANAGE_TICKETING);
  assertBulkDeleteMutationBatch(args.pnrIds.length);
  const ids: Id<"pnrs">[] = [];
  for (const raw of args.pnrIds) {
    const pnrId = ctx.db.normalizeId("pnrs", raw);
    if (!pnrId) {
      throw new ConvexError("Invalid PNR id");
    }
    ids.push(pnrId);
  }
  await mapInBoundedBatches(ids, async (pnrId) => await deletePnrRecord(ctx, access, pnrId), 4);
  return { deletedCount: ids.length };
}
