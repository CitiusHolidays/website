import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  assertTargetBoundMigration,
  migrationTargetFingerprint,
  migrationTargetResultFields,
  targetBoundMigrationArgs,
  targetBoundMigrationRegistryKey,
} from "../migrationAuth";
import { CONTRACTING_TEAM_ROLES, SALES_REP_ROLES, TICKETING_TEAM_ROLES } from "./lib/rolePolicy";

export const STAFF_ASSIGNMENT_IDENTITY_MIGRATION_KEY = "staff-assignment-identity-v1";
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 25;
const MAX_NAME_CANDIDATES = 20;

const sourceValidator = v.union(
  v.literal("queries"),
  v.literal("proposals"),
  v.literal("proposalQueryLinks"),
  v.literal("jobCards"),
  v.literal("travelBatches")
);

export type StaffAssignmentSource =
  | "queries"
  | "proposals"
  | "proposalQueryLinks"
  | "jobCards"
  | "travelBatches";

export type StaffAssignmentDisposition = "canonical" | "resolvable" | "ambiguous" | "unresolved";

interface AssignmentDescriptor {
  allowLegacyAuthId?: boolean;
  eligibleRoles: readonly string[];
  field: string;
  legacyName: string;
  recordId: string;
  recordLabel: string;
  relatedTourManagerId?: string;
  source: StaffAssignmentSource;
  stableOwnerId?: string;
}

export interface StaffAssignmentClassification {
  candidateStaffIds: Id<"staffUsers">[];
  disposition: StaffAssignmentDisposition;
  field: string;
  legacyName: string;
  reason: string;
  recordId: string;
  recordLabel: string;
  residual: boolean;
  source: StaffAssignmentSource;
  stableOwnerId?: string;
}

interface AssignmentPage {
  assignments: AssignmentDescriptor[];
  continueCursor: string;
  isDone: boolean;
  processedRecords: number;
}

const OPERATIONS_TEAM_ROLES = ["Operations", "Operations Head", "Operations Cement"] as const;
const TOUR_MANAGER_ROLES = ["Tour Manager"] as const;

function boundedLimit(limit?: number) {
  return Math.min(Math.max(Math.trunc(limit ?? DEFAULT_PAGE_SIZE), 1), MAX_PAGE_SIZE);
}

function descriptor(
  value: Omit<AssignmentDescriptor, "legacyName" | "stableOwnerId"> & {
    legacyName?: string | null;
    stableOwnerId?: string | null;
  }
) {
  const stableOwnerId = value.stableOwnerId?.trim() || undefined;
  const legacyName = value.legacyName?.trim() || "";
  if (!(stableOwnerId || legacyName || value.relatedTourManagerId)) {
    return null;
  }
  return { ...value, legacyName, stableOwnerId } satisfies AssignmentDescriptor;
}

function compactDescriptors(values: Array<AssignmentDescriptor | null>) {
  return values.filter((value): value is AssignmentDescriptor => value !== null);
}

function queryAssignments(query: Doc<"queries">): AssignmentDescriptor[] {
  const common = {
    recordId: String(query._id),
    recordLabel: query.queryCode,
    source: "queries" as const,
  };
  return compactDescriptors([
    descriptor({
      ...common,
      allowLegacyAuthId: true,
      eligibleRoles: SALES_REP_ROLES,
      field: "salesOwner",
      legacyName: query.salesOwnerName,
      stableOwnerId: query.salesOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: CONTRACTING_TEAM_ROLES,
      field: "contractingOwner",
      legacyName: query.contractingOwnerName,
      stableOwnerId: query.contractingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TICKETING_TEAM_ROLES,
      field: "ticketingOwner",
      legacyName: query.ticketingOwnerName,
      stableOwnerId: query.ticketingOwnerId,
    }),
  ]);
}

function proposalAssignments(proposal: Doc<"proposals">): AssignmentDescriptor[] {
  return compactDescriptors([
    descriptor({
      eligibleRoles: [],
      field: "preparedBy",
      legacyName: proposal.preparedBy,
      recordId: String(proposal._id),
      recordLabel: proposal.proposalCode,
      source: "proposals",
      stableOwnerId: proposal.preparedByStaffId,
    }),
  ]);
}

function proposalQueryLinkAssignments(link: Doc<"proposalQueryLinks">): AssignmentDescriptor[] {
  const common = {
    recordId: String(link._id),
    recordLabel: `${String(link.proposalId)}:${String(link.queryId)}`,
    source: "proposalQueryLinks" as const,
  };
  return compactDescriptors([
    descriptor({
      ...common,
      allowLegacyAuthId: true,
      eligibleRoles: SALES_REP_ROLES,
      field: "salesOwner",
      legacyName: link.salesOwnerName,
      stableOwnerId: link.salesOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: CONTRACTING_TEAM_ROLES,
      field: "contractingOwner",
      legacyName: link.contractingOwnerName,
      stableOwnerId: link.contractingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TICKETING_TEAM_ROLES,
      field: "ticketingOwner",
      legacyName: link.ticketingOwnerName,
      stableOwnerId: link.ticketingOwnerId,
    }),
  ]);
}

function jobAssignments(job: Doc<"jobCards">): AssignmentDescriptor[] {
  const common = {
    recordId: String(job._id),
    recordLabel: job.jobCode,
    source: "jobCards" as const,
  };
  return compactDescriptors([
    descriptor({
      ...common,
      eligibleRoles: CONTRACTING_TEAM_ROLES,
      field: "contractingOwner",
      legacyName: job.contractingOwnerName,
      stableOwnerId: job.contractingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: OPERATIONS_TEAM_ROLES,
      field: "operationsOwner",
      legacyName: job.operationsOwnerName,
      stableOwnerId: job.operationsOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TICKETING_TEAM_ROLES,
      field: "ticketingOwner",
      legacyName: job.ticketingOwnerName,
      stableOwnerId: job.ticketingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TOUR_MANAGER_ROLES,
      field: "tourManager",
      legacyName: job.tourManagerName,
      relatedTourManagerId: job.tourManagerId ? String(job.tourManagerId) : undefined,
      stableOwnerId: job.tourManagerStaffId,
    }),
  ]);
}

function travelBatchAssignments(batch: Doc<"travelBatches">): AssignmentDescriptor[] {
  const common = {
    recordId: String(batch._id),
    recordLabel: batch.batchReference,
    source: "travelBatches" as const,
  };
  return compactDescriptors([
    descriptor({
      ...common,
      eligibleRoles: CONTRACTING_TEAM_ROLES,
      field: "contractingOwner",
      legacyName: batch.contractingOwnerName,
      stableOwnerId: batch.contractingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: OPERATIONS_TEAM_ROLES,
      field: "operationsOwner",
      legacyName: batch.operationsOwnerName,
      stableOwnerId: batch.operationsOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TICKETING_TEAM_ROLES,
      field: "ticketingOwner",
      legacyName: batch.ticketingOwnerName,
      stableOwnerId: batch.ticketingOwnerId,
    }),
    descriptor({
      ...common,
      eligibleRoles: TOUR_MANAGER_ROLES,
      field: "tourManager",
      legacyName: batch.tourManagerName,
      relatedTourManagerId: batch.tourManagerId ? String(batch.tourManagerId) : undefined,
      stableOwnerId: batch.tourManagerStaffId,
    }),
  ]);
}

async function loadAssignmentPage(
  ctx: MutationCtx,
  source: StaffAssignmentSource,
  cursor: string | null,
  limit: number
): Promise<AssignmentPage> {
  if (source === "queries") {
    const page = await ctx.db.query("queries").order("asc").paginate({ cursor, numItems: limit });
    return {
      assignments: page.page.flatMap(queryAssignments),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedRecords: page.page.length,
    };
  }
  if (source === "proposals") {
    const page = await ctx.db.query("proposals").order("asc").paginate({ cursor, numItems: limit });
    return {
      assignments: page.page.flatMap(proposalAssignments),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedRecords: page.page.length,
    };
  }
  if (source === "proposalQueryLinks") {
    const page = await ctx.db
      .query("proposalQueryLinks")
      .order("asc")
      .paginate({ cursor, numItems: limit });
    return {
      assignments: page.page.flatMap(proposalQueryLinkAssignments),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedRecords: page.page.length,
    };
  }
  if (source === "jobCards") {
    const page = await ctx.db.query("jobCards").order("asc").paginate({ cursor, numItems: limit });
    return {
      assignments: page.page.flatMap(jobAssignments),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedRecords: page.page.length,
    };
  }
  const page = await ctx.db
    .query("travelBatches")
    .order("asc")
    .paginate({ cursor, numItems: limit });
  return {
    assignments: page.page.flatMap(travelBatchAssignments),
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    processedRecords: page.page.length,
  };
}

function isEligibleStaff(staff: Doc<"staffUsers">, eligibleRoles: readonly string[]) {
  return (
    staff.active &&
    (eligibleRoles.length === 0 || staff.roles.some((role) => eligibleRoles.includes(role)))
  );
}

function classification(
  assignment: AssignmentDescriptor,
  disposition: StaffAssignmentDisposition,
  reason: string,
  candidates: Doc<"staffUsers">[] = []
): StaffAssignmentClassification {
  return {
    candidateStaffIds: candidates.map((candidate) => candidate._id),
    disposition,
    field: assignment.field,
    legacyName: assignment.legacyName,
    reason,
    recordId: assignment.recordId,
    recordLabel: assignment.recordLabel,
    residual: disposition !== "canonical",
    source: assignment.source,
    stableOwnerId: assignment.stableOwnerId,
  };
}

async function classifyLegacyAuthId(ctx: MutationCtx, assignment: AssignmentDescriptor) {
  const candidates = await ctx.db
    .query("staffUsers")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", assignment.stableOwnerId))
    .take(MAX_NAME_CANDIDATES + 1);
  if (candidates.length > 1) {
    return classification(
      assignment,
      "ambiguous",
      "legacy_auth_id_matches_multiple_staff",
      candidates.filter((staff) => isEligibleStaff(staff, assignment.eligibleRoles))
    );
  }
  const [candidate] = candidates;
  if (candidate && isEligibleStaff(candidate, assignment.eligibleRoles)) {
    return classification(assignment, "resolvable", "legacy_auth_id_has_one_staff", [candidate]);
  }
  return classification(assignment, "unresolved", "legacy_auth_id_has_no_active_staff");
}

async function classifyByName(ctx: MutationCtx, assignment: AssignmentDescriptor) {
  const candidates = await ctx.db
    .query("staffUsers")
    .withIndex("by_name", (q) => q.eq("name", assignment.legacyName))
    .take(MAX_NAME_CANDIDATES + 1);
  if (candidates.length > MAX_NAME_CANDIDATES) {
    return classification(
      assignment,
      "ambiguous",
      "legacy_name_candidate_limit_exceeded",
      candidates
        .filter((candidate) => isEligibleStaff(candidate, assignment.eligibleRoles))
        .slice(0, MAX_NAME_CANDIDATES)
    );
  }
  const eligible = candidates.filter((candidate) =>
    isEligibleStaff(candidate, assignment.eligibleRoles)
  );
  if (eligible.length === 1) {
    return classification(assignment, "resolvable", "legacy_name_has_one_active_staff", eligible);
  }
  if (eligible.length > 1) {
    return classification(assignment, "ambiguous", "legacy_name_matches_multiple_staff", eligible);
  }
  return classification(assignment, "unresolved", "legacy_name_has_no_active_staff");
}

export async function classifyStaffAssignmentIdentity(
  ctx: MutationCtx,
  assignment: AssignmentDescriptor
): Promise<StaffAssignmentClassification> {
  if (assignment.stableOwnerId) {
    const staffId = ctx.db.normalizeId("staffUsers", assignment.stableOwnerId);
    const staff = staffId ? await ctx.db.get("staffUsers", staffId) : null;
    if (staff && isEligibleStaff(staff, assignment.eligibleRoles)) {
      return classification(assignment, "canonical", "stable_staff_id", [staff]);
    }
    if (assignment.allowLegacyAuthId && !staffId) {
      return await classifyLegacyAuthId(ctx, assignment);
    }
    return classification(assignment, "unresolved", "stable_staff_id_is_invalid_or_inactive");
  }

  if (assignment.relatedTourManagerId) {
    const relatedId = ctx.db.normalizeId("tourManagerAssignments", assignment.relatedTourManagerId);
    const related = relatedId ? await ctx.db.get("tourManagerAssignments", relatedId) : null;
    if (related?.staffId) {
      const staff = await ctx.db.get("staffUsers", related.staffId);
      if (staff && isEligibleStaff(staff, assignment.eligibleRoles)) {
        return classification(
          assignment,
          "resolvable",
          "tour_manager_assignment_has_stable_staff",
          [staff]
        );
      }
      return classification(
        assignment,
        "unresolved",
        "tour_manager_assignment_staff_is_invalid_or_inactive"
      );
    }
  }

  return await classifyByName(ctx, assignment);
}

function summarize(classifications: StaffAssignmentClassification[]) {
  return {
    ambiguous: classifications.filter((row) => row.disposition === "ambiguous").length,
    canonical: classifications.filter((row) => row.disposition === "canonical").length,
    residuals: classifications.filter((row) => row.residual).length,
    resolvable: classifications.filter((row) => row.disposition === "resolvable").length,
    unresolved: classifications.filter((row) => row.disposition === "unresolved").length,
  };
}

function completionStatus(isDone: boolean, legacyRemaining: number) {
  if (!isDone) {
    return "running" as const;
  }
  return legacyRemaining === 0 ? ("verified" as const) : ("failed" as const);
}

async function loadRegistry(ctx: MutationCtx | QueryCtx, key: string) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

function migrationKey(source: StaffAssignmentSource, lane: "apply" | "dry-run" | "verify") {
  return `${STAFF_ASSIGNMENT_IDENTITY_MIGRATION_KEY}:${lane}:${source}`;
}

async function startRegistry(
  ctx: MutationCtx,
  key: string,
  stage: "apply" | "dry-run" | "queue-reset" | "verify",
  restart: boolean
) {
  const now = Date.now();
  const existing = await loadRegistry(ctx, key);
  if (existing && restart) {
    await ctx.db.patch("dataMigrationRegistry", existing._id, {
      converted: 0,
      cursor: null,
      legacyRemaining: 0,
      processed: 0,
      quarantined: 0,
      stage,
      startedAt: now,
      status: "running",
      updatedAt: now,
      verifiedAt: undefined,
    });
    return await ctx.db.get("dataMigrationRegistry", existing._id);
  }
  if (existing) {
    return existing;
  }
  const id = await ctx.db.insert("dataMigrationRegistry", {
    converted: 0,
    cursor: null,
    key,
    legacyRemaining: 0,
    processed: 0,
    quarantined: 0,
    stage,
    startedAt: now,
    status: "running",
    updatedAt: now,
  });
  return await ctx.db.get("dataMigrationRegistry", id);
}

async function syncQuarantine(
  ctx: MutationCtx,
  row: StaffAssignmentClassification,
  now: number,
  targetKey: string
) {
  const existing = await ctx.db
    .query("staffAssignmentIdentityQuarantines")
    .withIndex("by_targetKey_source_record_field", (q) =>
      q
        .eq("targetKey", targetKey)
        .eq("source", row.source)
        .eq("recordId", row.recordId)
        .eq("field", row.field)
    )
    .unique();
  if (row.disposition !== "ambiguous" && row.disposition !== "unresolved") {
    if (existing) {
      await ctx.db.delete("staffAssignmentIdentityQuarantines", existing._id);
    }
    return;
  }
  const value = {
    candidateStaffIds: row.candidateStaffIds,
    disposition: row.disposition,
    field: row.field,
    legacyName: row.legacyName,
    reason: row.reason,
    recordId: row.recordId,
    recordLabel: row.recordLabel,
    source: row.source,
    stableOwnerId: row.stableOwnerId,
    targetKey,
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch("staffAssignmentIdentityQuarantines", existing._id, value);
  } else {
    await ctx.db.insert("staffAssignmentIdentityQuarantines", value);
  }
}

async function resetStaffAssignmentQuarantinePage(
  ctx: MutationCtx,
  source: StaffAssignmentSource,
  limit: number,
  targetKey: string
) {
  const staleRows = await ctx.db
    .query("staffAssignmentIdentityQuarantines")
    .withIndex("by_targetKey_source", (q) => q.eq("targetKey", targetKey).eq("source", source))
    .take(limit);
  await Promise.all(
    staleRows.map((row) => ctx.db.delete("staffAssignmentIdentityQuarantines", row._id))
  );
  return staleRows.length < limit;
}

const pageResultValidator = v.object({
  ambiguous: v.number(),
  applied: v.number(),
  canonical: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  ...migrationTargetResultFields,
  processed: v.number(),
  resolvable: v.number(),
  source: sourceValidator,
  stage: v.union(
    v.literal("apply"),
    v.literal("dry-run"),
    v.literal("queue-reset"),
    v.literal("verify"),
    v.literal("complete")
  ),
  status: v.union(v.literal("running"), v.literal("verified"), v.literal("failed")),
  unresolved: v.number(),
});

function requiredRecordId<TableName extends StaffAssignmentSource>(
  ctx: MutationCtx,
  table: TableName,
  recordId: string
) {
  const normalized = ctx.db.normalizeId(table, recordId);
  if (!normalized) {
    throw new ConvexError(`Invalid ${table} record ID in Staff assignment migration`);
  }
  return normalized;
}

function requiredCandidateStaffId(row: StaffAssignmentClassification) {
  const [staffId] = row.candidateStaffIds;
  if (!staffId || row.candidateStaffIds.length !== 1) {
    throw new ConvexError("Resolvable Staff assignment must have exactly one candidate");
  }
  return staffId;
}

function queryAssignmentPatch(rows: StaffAssignmentClassification[]) {
  const patch: Partial<
    Pick<Doc<"queries">, "contractingOwnerId" | "salesOwnerId" | "ticketingOwnerId">
  > = {};
  for (const row of rows) {
    const staffId = requiredCandidateStaffId(row);
    if (row.field === "salesOwner") {
      patch.salesOwnerId = staffId;
    } else if (row.field === "contractingOwner") {
      patch.contractingOwnerId = staffId;
    } else if (row.field === "ticketingOwner") {
      patch.ticketingOwnerId = staffId;
    } else {
      throw new ConvexError(`Unsupported queries Staff assignment field: ${row.field}`);
    }
  }
  return patch;
}

function proposalAssignmentPatch(rows: StaffAssignmentClassification[]) {
  const [row] = rows;
  if (!row || rows.length !== 1) {
    throw new ConvexError("Proposal Staff assignment group must contain exactly one field");
  }
  if (row.field !== "preparedBy") {
    throw new ConvexError(`Unsupported proposals Staff assignment field: ${row.field}`);
  }
  return { preparedByStaffId: requiredCandidateStaffId(row) };
}

function proposalQueryLinkAssignmentPatch(rows: StaffAssignmentClassification[]) {
  const patch: Partial<
    Pick<Doc<"proposalQueryLinks">, "contractingOwnerId" | "salesOwnerId" | "ticketingOwnerId">
  > = {};
  for (const row of rows) {
    const staffId = requiredCandidateStaffId(row);
    if (row.field === "salesOwner") {
      patch.salesOwnerId = staffId;
    } else if (row.field === "contractingOwner") {
      patch.contractingOwnerId = staffId;
    } else if (row.field === "ticketingOwner") {
      patch.ticketingOwnerId = staffId;
    } else {
      throw new ConvexError(`Unsupported Proposal link Staff assignment field: ${row.field}`);
    }
  }
  return patch;
}

function jobCardAssignmentPatch(rows: StaffAssignmentClassification[]) {
  const patch: Partial<
    Pick<
      Doc<"jobCards">,
      "contractingOwnerId" | "operationsOwnerId" | "ticketingOwnerId" | "tourManagerStaffId"
    >
  > = {};
  for (const row of rows) {
    const staffId = requiredCandidateStaffId(row);
    if (row.field === "contractingOwner") {
      patch.contractingOwnerId = staffId;
    } else if (row.field === "operationsOwner") {
      patch.operationsOwnerId = staffId;
    } else if (row.field === "ticketingOwner") {
      patch.ticketingOwnerId = staffId;
    } else if (row.field === "tourManager") {
      patch.tourManagerStaffId = staffId;
    } else {
      throw new ConvexError(`Unsupported Job Card Staff assignment field: ${row.field}`);
    }
  }
  return patch;
}

function travelBatchAssignmentPatch(rows: StaffAssignmentClassification[]) {
  const patch: Partial<
    Pick<
      Doc<"travelBatches">,
      "contractingOwnerId" | "operationsOwnerId" | "ticketingOwnerId" | "tourManagerStaffId"
    >
  > = {};
  for (const row of rows) {
    const staffId = requiredCandidateStaffId(row);
    if (row.field === "contractingOwner") {
      patch.contractingOwnerId = staffId;
    } else if (row.field === "operationsOwner") {
      patch.operationsOwnerId = staffId;
    } else if (row.field === "ticketingOwner") {
      patch.ticketingOwnerId = staffId;
    } else if (row.field === "tourManager") {
      patch.tourManagerStaffId = staffId;
    } else {
      throw new ConvexError(`Unsupported Travel Batch Staff assignment field: ${row.field}`);
    }
  }
  return patch;
}

async function applyResolvedStaffAssignmentGroup(
  ctx: MutationCtx,
  rows: StaffAssignmentClassification[]
) {
  const [row] = rows;
  if (!row || rows.some((candidate) => candidate.source !== row.source)) {
    throw new ConvexError("Invalid Staff assignment apply group");
  }

  if (row.source === "queries") {
    const recordId = requiredRecordId(ctx, "queries", row.recordId);
    await ctx.db.patch("queries", recordId, queryAssignmentPatch(rows));
    return;
  }
  if (row.source === "proposals") {
    if (row.field !== "preparedBy") {
      throw new ConvexError(`Unsupported proposals Staff assignment field: ${row.field}`);
    }
    const recordId = requiredRecordId(ctx, "proposals", row.recordId);
    await ctx.db.patch("proposals", recordId, proposalAssignmentPatch(rows));
    return;
  }
  if (row.source === "proposalQueryLinks") {
    const recordId = requiredRecordId(ctx, "proposalQueryLinks", row.recordId);
    await ctx.db.patch("proposalQueryLinks", recordId, proposalQueryLinkAssignmentPatch(rows));
    return;
  }
  if (row.source === "jobCards") {
    const recordId = requiredRecordId(ctx, "jobCards", row.recordId);
    await ctx.db.patch("jobCards", recordId, jobCardAssignmentPatch(rows));
    return;
  }
  const recordId = requiredRecordId(ctx, "travelBatches", row.recordId);
  await ctx.db.patch("travelBatches", recordId, travelBatchAssignmentPatch(rows));
}

async function applyResolvedStaffAssignments(
  ctx: MutationCtx,
  classifications: StaffAssignmentClassification[]
) {
  const resolvable = classifications.filter((row) => row.disposition === "resolvable");
  const groups = new Map<string, StaffAssignmentClassification[]>();
  for (const row of resolvable) {
    const key = `${row.source}:${row.recordId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  await Promise.all(
    [...groups.values()].map((rows) => applyResolvedStaffAssignmentGroup(ctx, rows))
  );
  return resolvable.length;
}

export const applyStaffAssignmentIdentityPage = internalMutation({
  args: {
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    ...targetBoundMigrationArgs,
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const targetKey = migrationTargetFingerprint(target);
    const key = targetBoundMigrationRegistryKey(migrationKey(args.source, "apply"), target);
    const existing = await loadRegistry(ctx, key);
    const registry = await startRegistry(
      ctx,
      key,
      "queue-reset",
      Boolean(args.restart) || existing?.status === "failed"
    );
    if (!registry) {
      throw new ConvexError("Unable to initialize Staff assignment apply migration");
    }
    if (registry.status === "verified") {
      return {
        ambiguous: 0,
        applied: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: 0,
        ...target,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: "complete" as const,
        status: "verified" as const,
        unresolved: 0,
      };
    }
    if (registry.stage === "queue-reset") {
      const resetComplete = await resetStaffAssignmentQuarantinePage(
        ctx,
        args.source,
        boundedLimit(args.limit),
        targetKey
      );
      const now = Date.now();
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        stage: resetComplete ? "apply" : "queue-reset",
        updatedAt: now,
      });
      if (!resetComplete) {
        return {
          ambiguous: 0,
          applied: 0,
          canonical: 0,
          cursor: null,
          legacyRemaining: 0,
          ...target,
          processed: 0,
          resolvable: 0,
          source: args.source,
          stage: "queue-reset" as const,
          status: "running" as const,
          unresolved: 0,
        };
      }
    }

    const page = await loadAssignmentPage(
      ctx,
      args.source,
      registry.cursor,
      boundedLimit(args.limit)
    );
    const classifications = await Promise.all(
      page.assignments.map((assignment) => classifyStaffAssignmentIdentity(ctx, assignment))
    );
    const applied = await applyResolvedStaffAssignments(ctx, classifications);
    const pageSummary = summarize(classifications);
    const now = Date.now();
    await Promise.all(classifications.map((row) => syncQuarantine(ctx, row, now, targetKey)));
    const pageRemaining = pageSummary.ambiguous + pageSummary.unresolved;
    const legacyRemaining = registry.legacyRemaining + pageRemaining;
    const stage = page.isDone ? ("complete" as const) : ("apply" as const);
    const status = completionStatus(page.isDone, legacyRemaining);
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted: registry.converted + applied,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      processed: registry.processed + page.processedRecords,
      quarantined: (registry.quarantined ?? 0) + pageRemaining,
      stage,
      status,
      updatedAt: now,
      verifiedAt: status === "verified" ? now : undefined,
    });
    return {
      ambiguous: pageSummary.ambiguous,
      applied,
      canonical: pageSummary.canonical,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      ...target,
      processed: page.processedRecords,
      resolvable: pageSummary.resolvable,
      source: args.source,
      stage,
      status,
      unresolved: pageSummary.unresolved,
    };
  },
  returns: pageResultValidator,
});

export const runStaffAssignmentIdentityDryRunPage = internalMutation({
  args: {
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    ...targetBoundMigrationArgs,
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const targetKey = migrationTargetFingerprint(target);
    const key = targetBoundMigrationRegistryKey(migrationKey(args.source, "dry-run"), target);
    const registry = await startRegistry(ctx, key, "queue-reset", Boolean(args.restart));
    if (!registry) {
      throw new ConvexError("Unable to initialize Staff assignment dry run");
    }
    if (registry.status !== "running") {
      return {
        ambiguous: 0,
        applied: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: registry.legacyRemaining,
        ...target,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: "complete" as const,
        status: registry.status === "verified" ? ("verified" as const) : ("failed" as const),
        unresolved: 0,
      };
    }
    if (registry.stage === "queue-reset") {
      const resetComplete = await resetStaffAssignmentQuarantinePage(
        ctx,
        args.source,
        boundedLimit(args.limit),
        targetKey
      );
      const now = Date.now();
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        stage: resetComplete ? "dry-run" : "queue-reset",
        updatedAt: now,
      });
      if (!resetComplete) {
        return {
          ambiguous: 0,
          applied: 0,
          canonical: 0,
          cursor: null,
          legacyRemaining: 0,
          ...target,
          processed: 0,
          resolvable: 0,
          source: args.source,
          stage: "queue-reset" as const,
          status: "running" as const,
          unresolved: 0,
        };
      }
    }

    const page = await loadAssignmentPage(
      ctx,
      args.source,
      registry.cursor,
      boundedLimit(args.limit)
    );
    const classifications = await Promise.all(
      page.assignments.map((assignment) => classifyStaffAssignmentIdentity(ctx, assignment))
    );
    const pageSummary = summarize(classifications);
    const now = Date.now();
    await Promise.all(classifications.map((row) => syncQuarantine(ctx, row, now, targetKey)));
    const legacyRemaining = registry.legacyRemaining + pageSummary.residuals;
    const stage = page.isDone ? ("complete" as const) : ("dry-run" as const);
    const status = completionStatus(page.isDone, legacyRemaining);
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      processed: registry.processed + page.processedRecords,
      quarantined: (registry.quarantined ?? 0) + pageSummary.ambiguous + pageSummary.unresolved,
      stage,
      status,
      updatedAt: now,
      verifiedAt: status === "verified" ? now : undefined,
    });
    return {
      ambiguous: pageSummary.ambiguous,
      applied: 0,
      canonical: pageSummary.canonical,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      ...target,
      processed: page.processedRecords,
      resolvable: pageSummary.resolvable,
      source: args.source,
      stage,
      status,
      unresolved: pageSummary.unresolved,
    };
  },
  returns: pageResultValidator,
});

export const verifyStaffAssignmentIdentityResidualsPage = internalMutation({
  args: {
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    ...targetBoundMigrationArgs,
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const targetKey = migrationTargetFingerprint(target);
    const key = targetBoundMigrationRegistryKey(migrationKey(args.source, "verify"), target);
    const existing = await loadRegistry(ctx, key);
    const shouldRestart = Boolean(args.restart) || existing?.status === "failed";
    const registry = await startRegistry(ctx, key, "queue-reset", shouldRestart);
    if (!registry) {
      throw new ConvexError("Unable to initialize Staff assignment residual verifier");
    }
    if (registry.status === "verified") {
      return {
        ambiguous: 0,
        applied: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: 0,
        ...target,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: "complete" as const,
        status: "verified" as const,
        unresolved: 0,
      };
    }
    if (registry.stage === "queue-reset") {
      const limit = boundedLimit(args.limit);
      const resetComplete = await resetStaffAssignmentQuarantinePage(
        ctx,
        args.source,
        limit,
        targetKey
      );
      const now = Date.now();
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        stage: resetComplete ? "verify" : "queue-reset",
        updatedAt: now,
      });
      return {
        ambiguous: 0,
        applied: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: 0,
        ...target,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: resetComplete ? ("verify" as const) : ("queue-reset" as const),
        status: "running" as const,
        unresolved: 0,
      };
    }
    const page = await loadAssignmentPage(
      ctx,
      args.source,
      registry.cursor,
      boundedLimit(args.limit)
    );
    const classifications = await Promise.all(
      page.assignments.map((assignment) => classifyStaffAssignmentIdentity(ctx, assignment))
    );
    const pageSummary = summarize(classifications);
    const now = Date.now();
    await Promise.all(classifications.map((row) => syncQuarantine(ctx, row, now, targetKey)));
    const legacyRemaining = registry.legacyRemaining + pageSummary.residuals;
    const stage = page.isDone ? ("complete" as const) : ("verify" as const);
    const status = completionStatus(page.isDone, legacyRemaining);
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      processed: registry.processed + page.processedRecords,
      quarantined: (registry.quarantined ?? 0) + pageSummary.ambiguous + pageSummary.unresolved,
      stage,
      status,
      updatedAt: now,
      verifiedAt: status === "verified" ? now : undefined,
    });
    return {
      ambiguous: pageSummary.ambiguous,
      applied: 0,
      canonical: pageSummary.canonical,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      ...target,
      processed: page.processedRecords,
      resolvable: pageSummary.resolvable,
      source: args.source,
      stage,
      status,
      unresolved: pageSummary.unresolved,
    };
  },
  returns: pageResultValidator,
});

const quarantineValidator = v.object({
  candidateStaffIds: v.array(v.id("staffUsers")),
  disposition: v.union(v.literal("ambiguous"), v.literal("unresolved")),
  field: v.string(),
  legacyName: v.string(),
  reason: v.string(),
  recordId: v.string(),
  recordLabel: v.string(),
  stableOwnerId: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export const listStaffAssignmentIdentityAmbiguities = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.optional(v.number()),
    ...targetBoundMigrationArgs,
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const targetKey = migrationTargetFingerprint(target);
    const page = await ctx.db
      .query("staffAssignmentIdentityQuarantines")
      .withIndex("by_targetKey_source", (q) =>
        q.eq("targetKey", targetKey).eq("source", args.source)
      )
      .paginate({ cursor: args.cursor, numItems: boundedLimit(args.limit) });
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      page: page.page.map((row) => ({
        candidateStaffIds: row.candidateStaffIds,
        disposition: row.disposition,
        field: row.field,
        legacyName: row.legacyName,
        reason: row.reason,
        recordId: row.recordId,
        recordLabel: row.recordLabel,
        stableOwnerId: row.stableOwnerId ?? null,
        updatedAt: row.updatedAt,
      })),
      ...target,
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    page: v.array(quarantineValidator),
    ...migrationTargetResultFields,
  }),
});
