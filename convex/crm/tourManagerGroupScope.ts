import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD } from "./jobCardVisibility";
import {
  type JobCardRecordGrant,
  jobCardRecordGrant,
  ownsNamedRecord,
  type QueryVisibilityRecord,
} from "./lib/recordScope";
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
const NO_TRAVELLERS: TravellerGroupScope = { kind: "batches", travelBatchIds: new Set() };

type ScopeAssignment = Pick<
  Doc<"tourManagerAssignments">,
  "externalProfileId" | "name" | "staffId" | "status" | "travelBatchId"
>;
type ScopeBatch = Pick<Doc<"travelBatches">, "_id" | "tourManagerName">;

function scopeFromAssignments(own: readonly ScopeAssignment[]): TravellerGroupScope | null {
  if (own.length === 0) {
    return null;
  }
  if (own.some((assignment) => !assignment.travelBatchId)) {
    return WHOLE_JOB_CARD;
  }
  return {
    kind: "batches",
    travelBatchIds: new Set(own.map((assignment) => String(assignment.travelBatchId))),
  };
}

/**
 * Pure scope rule.
 *
 * 1. The caller's own active staff assignments: any without a batch opens the whole Job Card,
 *    otherwise the assigned batches.
 * 2. Only when `legacyNames` is allowed and no assignment on the Job Card has a staff identity:
 *    active name-only rows (no staff id, no external profile) that match the caller's name.
 * 3. Only when the Job Card has no assignment rows at all: the batch-level, then Job Card-level,
 *    `tourManagerName`.
 *
 * External profile names never match. Anything else is an empty group, never the whole roster.
 */
export function tourManagerGroupScopeFrom(input: {
  access: PortalAccess;
  assignments: readonly ScopeAssignment[];
  batches: readonly ScopeBatch[];
  job: { tourManagerName?: string | null };
  legacyNames?: boolean;
}): TravellerGroupScope {
  const { access, assignments } = input;
  const ownStaff = assignments.filter(
    (assignment) =>
      assignment.status === "Assigned" &&
      Boolean(assignment.staffId && access.staffId) &&
      String(assignment.staffId) === String(access.staffId)
  );
  const fromStaff = scopeFromAssignments(ownStaff);
  if (fromStaff) {
    return fromStaff;
  }
  if (
    input.legacyNames === false ||
    access.externalTourManager === true ||
    assignments.some((assignment) => assignment.staffId)
  ) {
    return NO_TRAVELLERS;
  }
  const ownNamed = assignments.filter(
    (assignment) =>
      assignment.status === "Assigned" &&
      !assignment.externalProfileId &&
      ownsNamedRecord(access, assignment.name)
  );
  const fromNames = scopeFromAssignments(ownNamed);
  if (fromNames) {
    return fromNames;
  }
  if (assignments.length > 0) {
    return NO_TRAVELLERS;
  }
  const namedBatches = input.batches.filter((batch) =>
    ownsNamedRecord(access, batch.tourManagerName)
  );
  if (namedBatches.length > 0) {
    return {
      kind: "batches",
      travelBatchIds: new Set(namedBatches.map((batch) => String(batch._id))),
    };
  }
  return ownsNamedRecord(access, input.job.tourManagerName) ? WHOLE_JOB_CARD : NO_TRAVELLERS;
}

export async function loadTourManagerGroupScope(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Pick<Doc<"jobCards">, "_id" | "tourManagerName">,
  options: { legacyNames?: boolean } = {}
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
  const batches =
    assignments.length > 0 || options.legacyNames === false
      ? []
      : await ctx.db
          .query("travelBatches")
          .withIndex("by_jobCardId", (q) => q.eq("jobCardId", job._id))
          .take(MAX_TOUR_MANAGER_ASSIGNMENTS_PER_JOB_CARD);
  return tourManagerGroupScopeFrom({ access, assignments, batches, job, ...options });
}

/**
 * The caller's grant on a Job Card and the traveller scope it allows, or null when the Job Card
 * is not visible. Office access keeps the whole roster; a Tour Manager-only grant is narrowed
 * to the actor's group.
 */
export async function resolveTravellerAccess(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards">,
  linkedQuery?: QueryVisibilityRecord | null
): Promise<{ grant: JobCardRecordGrant; scope: TravellerGroupScope } | null> {
  const grant = jobCardRecordGrant(access, job, linkedQuery);
  if (grant === null) {
    return null;
  }
  if (grant === "office") {
    return { grant, scope: WHOLE_JOB_CARD };
  }
  return { grant, scope: await loadTourManagerGroupScope(ctx, access, job) };
}

export async function resolveTravellerGroupScope(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  job: Doc<"jobCards">,
  linkedQuery?: QueryVisibilityRecord | null
): Promise<TravellerGroupScope | null> {
  return (await resolveTravellerAccess(ctx, access, job, linkedQuery))?.scope ?? null;
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

type ScopeReaderEntry = {
  grant: JobCardRecordGrant;
  job: Doc<"jobCards">;
  scope: TravellerGroupScope;
} | null;

/**
 * Per-request reader for lists whose rows name a traveller (visa, ticket, seat). Each Job Card's
 * grant and scope is resolved once. `jobForTraveller` returns the Job Card only when the row's
 * traveller is inside the caller's scope; a row without a traveller is visible only with
 * whole-Job Card scope. `knownJobs` lets a caller reuse Job Cards it already loaded.
 */
export function createTravellerScopeReader(
  ctx: QueryCtx | MutationCtx,
  access: PortalAccess,
  knownJobs?: ReadonlyMap<string, Doc<"jobCards">>
) {
  const entries = new Map<string, Promise<ScopeReaderEntry>>();
  const load = (jobCardId: Id<"jobCards">) => {
    const key = String(jobCardId);
    let entry = entries.get(key);
    if (!entry) {
      entry = (async () => {
        const job = knownJobs?.get(key) ?? (await ctx.db.get("jobCards", jobCardId));
        if (!job) {
          return null;
        }
        const linkedQuery = job.queryId ? await ctx.db.get("queries", job.queryId) : null;
        const resolved = await resolveTravellerAccess(ctx, access, job, linkedQuery);
        return resolved ? { ...resolved, job } : null;
      })();
      entries.set(key, entry);
    }
    return entry;
  };
  return {
    async jobForTraveller(
      jobCardId: Id<"jobCards">,
      traveller: { travelBatchId?: Id<"travelBatches"> | string | null } | null
    ) {
      const entry = await load(jobCardId);
      if (!entry) {
        return null;
      }
      if (entry.scope.kind === "jobCard") {
        return entry.job;
      }
      return traveller && travellerInGroupScope(entry.scope, traveller) ? entry.job : null;
    },
    load,
  };
}
