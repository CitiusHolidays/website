import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { assertMigrationSecret } from "../migrationAuth";
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

function migrationKey(source: StaffAssignmentSource, lane: "dry-run" | "verify") {
  return `${STAFF_ASSIGNMENT_IDENTITY_MIGRATION_KEY}:${lane}:${source}`;
}

async function startRegistry(
  ctx: MutationCtx,
  key: string,
  stage: "dry-run" | "verify",
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

async function syncQuarantine(ctx: MutationCtx, row: StaffAssignmentClassification, now: number) {
  const existing = await ctx.db
    .query("staffAssignmentIdentityQuarantines")
    .withIndex("by_source_record_field", (q) =>
      q.eq("source", row.source).eq("recordId", row.recordId).eq("field", row.field)
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
    updatedAt: now,
  };
  if (existing) {
    await ctx.db.patch("staffAssignmentIdentityQuarantines", existing._id, value);
  } else {
    await ctx.db.insert("staffAssignmentIdentityQuarantines", value);
  }
}

const pageResultValidator = v.object({
  ambiguous: v.number(),
  canonical: v.number(),
  cursor: v.union(v.string(), v.null()),
  legacyRemaining: v.number(),
  processed: v.number(),
  resolvable: v.number(),
  source: sourceValidator,
  stage: v.union(v.literal("dry-run"), v.literal("verify"), v.literal("complete")),
  status: v.union(v.literal("running"), v.literal("verified"), v.literal("failed")),
  unresolved: v.number(),
});

export const runStaffAssignmentIdentityDryRunPage = internalMutation({
  args: {
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    secret: v.string(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const registry = await startRegistry(
      ctx,
      migrationKey(args.source, "dry-run"),
      "dry-run",
      Boolean(args.restart)
    );
    if (!registry) {
      throw new ConvexError("Unable to initialize Staff assignment dry run");
    }
    if (registry.status !== "running") {
      return {
        ambiguous: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: registry.legacyRemaining,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: "complete" as const,
        status: registry.status === "verified" ? ("verified" as const) : ("failed" as const),
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
    await Promise.all(classifications.map((row) => syncQuarantine(ctx, row, now)));
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
      canonical: pageSummary.canonical,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
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
    secret: v.string(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const key = migrationKey(args.source, "verify");
    const existing = await loadRegistry(ctx, key);
    const shouldRestart = Boolean(args.restart) || existing?.status === "failed";
    const registry = await startRegistry(ctx, key, "verify", shouldRestart);
    if (!registry) {
      throw new ConvexError("Unable to initialize Staff assignment residual verifier");
    }
    if (registry.status === "verified") {
      return {
        ambiguous: 0,
        canonical: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        resolvable: 0,
        source: args.source,
        stage: "complete" as const,
        status: "verified" as const,
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
    const legacyRemaining = registry.legacyRemaining + pageSummary.residuals;
    const stage = page.isDone ? ("complete" as const) : ("verify" as const);
    const status = completionStatus(page.isDone, legacyRemaining);
    const now = Date.now();
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
      processed: registry.processed + page.processedRecords,
      stage,
      status,
      updatedAt: now,
      verifiedAt: status === "verified" ? now : undefined,
    });
    return {
      ambiguous: pageSummary.ambiguous,
      canonical: pageSummary.canonical,
      cursor: page.isDone ? null : page.continueCursor,
      legacyRemaining,
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
    secret: v.string(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    assertMigrationSecret(args.secret);
    const page = await ctx.db
      .query("staffAssignmentIdentityQuarantines")
      .withIndex("by_source", (q) => q.eq("source", args.source))
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
    };
  },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    page: v.array(quarantineValidator),
  }),
});
