import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  canSeeJobCardRecord,
  hasRole,
  isDirectorOrAdmin,
  isExternalTourManagerAccess,
  PERMISSIONS,
  type PortalAccess,
  requireStaff,
} from "./lib";
import { createActivity } from "./lib/activity";
import { patchWithE2eOwnership } from "./lib/e2eOwnership";

/**
 * Per-trip app pilot (owner decision, 7 Nov 2026). Citius pilots the apps trip by trip: nothing
 * about a Job Card reaches the tour manager app until someone starts its pilot, and stopping it
 * hides the trip again. `jobCards.appPilot` is generic so the customer app can use the same
 * switch later. A missing field means off.
 *
 * The switch gates app surfaces only. App-only functions (field sync pushes, field passports,
 * the assigned-trips list, expenses with a `clientRef`) check it on every call. Reads the app
 * shares with the Staff Workspace check it only when called with `surface: "connect"`, so the
 * CRM keeps today's access.
 */

/** The error data every gated app call returns for a trip whose pilot is off. */
export const APP_PILOT_OFF = "APP_PILOT_OFF";

/** Optional argument the tour manager app passes on reads it shares with the Staff Workspace. */
export const appSurfaceValidator = v.optional(v.literal("connect"));
export type AppSurface = "connect" | undefined;

export const appPilotStateValidator = v.object({
  canManage: v.boolean(),
  changedAt: v.union(v.number(), v.null()),
  changedByName: v.union(v.string(), v.null()),
  enabled: v.boolean(),
});

type PilotJob = Pick<Doc<"jobCards">, "appPilot">;

export function isAppPilotOn(job: PilotJob) {
  return job.appPilot?.enabled === true;
}

export function requireAppPilotOn(job: PilotJob) {
  if (!isAppPilotOn(job)) {
    throw new ConvexError(APP_PILOT_OFF);
  }
}

/** Gate for a shared read: only the app surface is held to the pilot. */
export function requireAppPilotForSurface(job: PilotJob, surface: AppSurface) {
  if (surface === "connect") {
    requireAppPilotOn(job);
  }
}

/**
 * For shared list reads called with `surface: "connect"`: the app always names one Job Card, the
 * caller must see it, and its pilot must be on. Visibility comes first, so the pilot state of a
 * Job Card the caller cannot see is never revealed.
 */
export async function requireConnectTrip(
  ctx: QueryCtx,
  access: PortalAccess,
  rawJobCardId: string | undefined
) {
  const jobCardId = rawJobCardId ? ctx.db.normalizeId("jobCards", rawJobCardId) : null;
  if (!jobCardId) {
    throw new ConvexError("Choose the Job Card to read");
  }
  const job = await ctx.db.get("jobCards", jobCardId);
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  if (!(job && canSeeJobCardRecord(access, job, linkedQuery))) {
    throw new ConvexError("FORBIDDEN");
  }
  requireAppPilotOn(job);
  return job;
}

/** The Operations Head, Directors, Director Cement, Admin and the Job Card's Operations owner. */
export function canManageAppPilot(
  access: PortalAccess,
  job: Pick<Doc<"jobCards">, "operationsOwnerId">
) {
  if (isExternalTourManagerAccess(access)) {
    return false;
  }
  if (isDirectorOrAdmin(access) || hasRole(access, "Operations Head")) {
    return true;
  }
  return Boolean(access.staffId && job.operationsOwnerId === String(access.staffId));
}

async function loadVisibleJobCard(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  rawJobCardId: string
) {
  const jobCardId = ctx.db.normalizeId("jobCards", rawJobCardId);
  const job = jobCardId ? await ctx.db.get("jobCards", jobCardId) : null;
  const linkedQuery = job?.queryId ? await ctx.db.get("queries", job.queryId) : null;
  return job && canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}

function pilotState(access: PortalAccess, job: Doc<"jobCards">) {
  return {
    canManage: canManageAppPilot(access, job),
    changedAt: job.appPilot?.changedAt ?? null,
    changedByName: job.appPilot?.changedByName ?? null,
    enabled: isAppPilotOn(job),
  };
}

/** The pilot state for a Job Card the caller can see in the Staff Workspace, else null. */
export async function handleGetAppPilot(ctx: QueryCtx, args: { jobCardId: string }) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const job = await loadVisibleJobCard(ctx, access, args.jobCardId);
  return job ? pilotState(access, job) : null;
}

/** Starts or stops the pilot. Repeating the current state changes and logs nothing. */
export async function handleSetAppPilot(
  ctx: MutationCtx,
  args: { enabled: boolean; jobCardId: string }
) {
  const access = await requireStaff(ctx, PERMISSIONS.VIEW_JOB_CARDS);
  const job = await loadVisibleJobCard(ctx, access, args.jobCardId);
  if (!(job && canManageAppPilot(access, job))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (isAppPilotOn(job) === args.enabled) {
    return pilotState(access, job);
  }
  const now = Date.now();
  const appPilot = {
    changedAt: now,
    changedBy: access.authUserId ?? access.email,
    changedByName: access.name,
    enabled: args.enabled,
  };
  await Promise.all([
    patchWithE2eOwnership(ctx, "jobCards", job._id, { appPilot, updatedAt: now }),
    createActivity(ctx, access, {
      action: args.enabled ? "app_pilot_started" : "app_pilot_stopped",
      entityId: job._id,
      entityType: "jobCard",
      message: args.enabled
        ? `${job.jobCode}: tour manager app pilot started`
        : `${job.jobCode}: tour manager app pilot stopped`,
    }),
  ]);
  return pilotState(access, { ...job, appPilot });
}
