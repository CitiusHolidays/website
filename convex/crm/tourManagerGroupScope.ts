import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD } from "./jobCardVisibility";
import { jobCardRecordGrant, ownsNamedRecord, type QueryVisibilityRecord } from "./lib/recordScope";
import type { PortalAccess } from "./lib/staffAccess";

/**
 * Which travellers on one Job Card the actor may see. Office access is the whole Job Card.
 * A Tour Manager whose only route to the Job Card is their assignment sees the travel batches
 * they are assigned to, or the whole Job Card when an assignment names no batch.
 */
export type TravellerGroupScope =
  | { kind: "jobCard" }
  | { kind: "batches"; travelBatchIds: ReadonlySet<string> };

const WHOLE_JOB_CARD: TravellerGroupScope = { kind: "jobCard" };

type ScopeAssignment = Pick<
  Doc<"tourManagerAssignments">,
  "externalProfileId" | "name" | "staffId" | "status" | "travelBatchId"
>;
type ScopeBatch = Pick<Doc<"travelBatches">, "_id" | "tourManagerName">;

function isOwnAssignment(access: PortalAccess, assignment: ScopeAssignment) {
  if (assignment.status !== "Assigned") {
    return false;
  }
  if (assignment.staffId) {
    return Boolean(access.staffId) && String(assignment.staffId) === String(access.staffId);
  }
  // Legacy name-only rows predate staff identities. External profiles never match by name.
  return !assignment.externalProfileId && ownsNamedRecord(access, assignment.name);
}

/**
 * Pure scope rule. Own active assignments decide first: any assignment without a batch opens
 * the whole Job Card, otherwise the assigned batches. Without an own assignment, the legacy
 * batch-level and then Job Card-level `tourManagerName` match applies. Anything else is an
 * empty group, so a Tour Manager never falls back to the whole roster.
 */
export function tourManagerGroupScopeFrom(input: {
  access: PortalAccess;
  assignments: readonly ScopeAssignment[];
  batches: readonly ScopeBatch[];
  job: { tourManagerName?: string | null };
}): TravellerGroupScope {
  const own = input.assignments.filter((assignment) => isOwnAssignment(input.access, assignment));
  if (own.some((assignment) => !assignment.travelBatchId)) {
    return WHOLE_JOB_CARD;
  }
  if (own.length > 0) {
    return {
      kind: "batches",
      travelBatchIds: new Set(own.map((assignment) => String(assignment.travelBatchId))),
    };
  }
  const namedBatches = input.batches.filter((batch) =>
    ownsNamedRecord(input.access, batch.tourManagerName)
  );
  if (namedBatches.length > 0) {
    return {
      kind: "batches",
      travelBatchIds: new Set(namedBatches.map((batch) => String(batch._id))),
    };
  }
  if (ownsNamedRecord(input.access, input.job.tourManagerName)) {
    return WHOLE_JOB_CARD;
  }
  return { kind: "batches", travelBatchIds: new Set() };
}

export async function loadTourManagerGroupScope(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Pick<Doc<"jobCards">, "_id" | "tourManagerName">
): Promise<TravellerGroupScope> {
  const assignments = await ctx.db
    .query("tourManagerAssignments")
    .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
    .take(MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD + 1);
  if (assignments.length > MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD) {
    throw new ConvexError(
      "This Job Card has too many tour manager assignments. Remove unused assignments first."
    );
  }
  const hasOwn = assignments.some((assignment) => isOwnAssignment(access, assignment));
  const batches = hasOwn
    ? []
    : await ctx.db
        .query("travelBatches")
        .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
        .take(MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD);
  return tourManagerGroupScopeFrom({ access, assignments, batches, job });
}

/**
 * Traveller scope on a Job Card, or null when the Job Card is not visible. Office access keeps
 * the whole roster; a Tour Manager-only grant is narrowed to the actor's group.
 */
export async function resolveTravellerGroupScope(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards">,
  linkedQuery?: QueryVisibilityRecord | null
): Promise<TravellerGroupScope | null> {
  const grant = jobCardRecordGrant(access, job, linkedQuery);
  if (grant === null) {
    return null;
  }
  if (grant === "office") {
    return WHOLE_JOB_CARD;
  }
  return await loadTourManagerGroupScope(ctx, access, job);
}

export function travellerInGroupScope(
  scope: TravellerGroupScope,
  traveller: { travelBatchId?: Id<"travelBatches"> | string | null }
) {
  if (scope.kind === "jobCard") {
    return true;
  }
  return (
    Boolean(traveller.travelBatchId) && scope.travelBatchIds.has(String(traveller.travelBatchId))
  );
}
