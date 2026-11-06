import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { canSeeJobCardRecord } from "./lib";
import { type E2eOwnershipActor, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { personNameKey } from "./lib/recordScope";
import type { PortalAccess } from "./lib/staffAccess";

export async function getVisibleJob(
  ctx: MutationCtx | QueryCtx,
  access: PortalAccess,
  jobCardId: Id<"jobCards">
) {
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    return null;
  }
  const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
  return canSeeJobCardRecord(access, job, linkedQuery) ? job : null;
}

/** Upper bound on assignment rows read when deriving one Job Card's Tour Manager set. */
export const MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD = 500;

type AssignmentIdentity = Pick<Doc<"tourManagerAssignments">, "staffId" | "status">;
type AssignmentName = Pick<
  Doc<"tourManagerAssignments">,
  "externalProfileId" | "name" | "staffId" | "status"
>;

/**
 * Normalized names of active name-only assignments: no staff identity and no external profile.
 * These are the only names the legacy Tour Manager name fallback may match.
 */
export function legacyTourManagerNamesFrom(assignments: readonly AssignmentName[]) {
  const names = new Set<string>();
  for (const assignment of assignments) {
    const key = personNameKey(assignment.name);
    if (
      assignment.status === "Assigned" &&
      !assignment.staffId &&
      !assignment.externalProfileId &&
      key
    ) {
      names.add(key);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

/**
 * Staff Tour Managers with an active assignment, deduplicated and sorted so the
 * stored array is deterministic. External (profile-only) and name-only
 * assignments carry no staff identity and grant nothing here.
 */
export function assignedTourManagerStaffIdsFrom(assignments: readonly AssignmentIdentity[]) {
  const ids = new Set<Id<"staffUsers">>();
  for (const assignment of assignments) {
    if (assignment.status === "Assigned" && assignment.staffId) {
      ids.add(assignment.staffId);
    }
  }
  return [...ids].sort((left, right) => String(left).localeCompare(String(right)));
}

export function sameTourManagerStaffIds(
  current: readonly Id<"staffUsers">[] | undefined,
  next: readonly Id<"staffUsers">[]
) {
  const sorted = (ids: readonly Id<"staffUsers">[]) =>
    ids.map(String).sort((left, right) => left.localeCompare(right));
  const stored = sorted(current ?? []);
  const derived = sorted(next);
  return stored.length === derived.length && stored.every((id, index) => id === derived[index]);
}

export async function expectedAssignedTourManagerStaffIds(
  ctx: MutationCtx | QueryCtx,
  jobCardId: Id<"jobCards">
) {
  const assignments = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .take(MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD + 1);
  if (assignments.length > MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD) {
    throw new ConvexError(
      "This Job Card has too many tour manager assignments. Remove unused assignments first."
    );
  }
  return assignedTourManagerStaffIdsFrom(assignments);
}

/**
 * Recomputes `jobCards.assignedTourManagerStaffIds` and `legacyTourManagerNames` from
 * `tourManagerAssignments`. Call it after every assignment write that can change a Job
 * Card's active set: create, update (including moving to another Job Card), and delete. Both
 * fields are written the first time even when empty, which ends the `tourManagerName`
 * fallback for that Job Card. A missing Job Card (deleted by the cascade) is a no-op. Only the
 * derived fields are patched, so list ordering by `updatedAt` is unaffected.
 */
export async function syncJobCardTourManagerVisibility(
  ctx: MutationCtx,
  jobCardId: Id<"jobCards">,
  actor?: E2eOwnershipActor
) {
  const job = await ctx.db.get("jobCards", jobCardId);
  if (!job) {
    return;
  }
  const assignments = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", jobCardId))
    .take(MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD + 1);
  if (assignments.length > MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD) {
    throw new ConvexError(
      "This Job Card has too many tour manager assignments. Remove unused assignments first."
    );
  }
  const next = assignedTourManagerStaffIdsFrom(assignments);
  const names = legacyTourManagerNamesFrom(assignments);
  const storedNames = job.legacyTourManagerNames;
  if (
    job.assignedTourManagerStaffIds !== undefined &&
    sameTourManagerStaffIds(job.assignedTourManagerStaffIds, next) &&
    storedNames !== undefined &&
    storedNames.length === names.length &&
    storedNames.every((name, index) => name === names[index])
  ) {
    return;
  }
  const patch = { assignedTourManagerStaffIds: next, legacyTourManagerNames: names };
  if (actor) {
    await patchWithE2eOwnership(ctx, "jobCards", jobCardId, patch, actor);
    return;
  }
  await ctx.db.patch("jobCards", jobCardId, patch);
}
