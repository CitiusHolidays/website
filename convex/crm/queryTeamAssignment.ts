import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { RuntimeObject } from "../lib/runtimeValues";
import { scheduleCrmMetricSync } from "./financeMetricSync";
import {
  CONTRACTING_TEAM_ROLES,
  canSeeQueryRecord,
  createActivity,
  hasRole,
  isDirectorOrAdmin,
  type PortalAccess,
  publishWorkflowNotification,
  TICKETING_TEAM_ROLES,
} from "./lib";
import { insertWithE2eOwnership, patchWithE2eOwnership } from "./lib/e2eOwnership";
import { refreshProposalLinkProjections } from "./proposalLinkProjection";

const TICKETING_SCOPE_VALUES = ["Domestic", "International", "Both", "Not required"] as const;
type TicketingScope = (typeof TICKETING_SCOPE_VALUES)[number];

async function loadVisibleQueryForAssignment(
  ctx: MutationCtx,
  access: PortalAccess,
  queryIdRaw: string
) {
  const queryId = ctx.db.normalizeId("queries", queryIdRaw);
  if (!queryId) {
    throw new ConvexError("Invalid query id");
  }
  const query = await ctx.db.get("queries", queryId);
  if (!query) {
    throw new ConvexError("Query not found");
  }
  if (!canSeeQueryRecord(access, query)) {
    throw new ConvexError("FORBIDDEN");
  }
  return { query, queryId };
}

async function loadAssignableStaff(
  ctx: MutationCtx,
  staffIdRaw: string,
  team: "contracting" | "ticketing"
) {
  const staffId = ctx.db.normalizeId("staffUsers", staffIdRaw);
  if (!staffId) {
    throw new ConvexError("Invalid staff id");
  }
  const staff = await ctx.db.get("staffUsers", staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const allowedRoles = new Set<string>(
    team === "contracting" ? CONTRACTING_TEAM_ROLES : TICKETING_TEAM_ROLES
  );
  const onTeam = staff.roles.some((role) => allowedRoles.has(role));
  if (!onTeam) {
    throw new ConvexError(
      team === "contracting"
        ? "Selected staff member is not on the contracting team"
        : "Selected staff member is not on the ticketing team"
    );
  }
  return { staff, staffId };
}

export interface ApplyQueryTeamAssignmentsInput {
  contractingStaffId?: string;
  queryId: string;
  ticketingScope?: string;
  ticketingStaffId?: string;
}

function normalizedTicketingScope(scope: string | undefined): TicketingScope | undefined {
  const value = scope?.trim();
  if (!value) {
    return;
  }
  if (!TICKETING_SCOPE_VALUES.some((candidate) => candidate === value)) {
    throw new ConvexError("Select a valid Ticketing Scope.");
  }
  return TICKETING_SCOPE_VALUES.find((candidate) => candidate === value);
}

function isHeadAssignmentAccess(access: PortalAccess) {
  return (
    isDirectorOrAdmin(access) ||
    hasRole(access, "Contracting Head") ||
    hasRole(access, "Operations Head") ||
    hasRole(access, "Head of Ticketing")
  );
}

function isSalesAssignmentAccess(access: PortalAccess) {
  return (
    hasRole(access, "Sales") || hasRole(access, "Sales Head") || hasRole(access, "Sales Cement")
  );
}

function hasExistingAssignment(query: {
  contractingOwnerId?: string;
  ticketingOwnerId?: string;
  ticketingScope?: string;
}) {
  return Boolean(query.contractingOwnerId || query.ticketingOwnerId || query.ticketingScope);
}

function relevantAssignmentHeadRoles(args: {
  ticketingScope?: TicketingScope;
  ticketingAssigned: boolean;
}) {
  const roles = ["Contracting Head", "Operations Head"];
  if (
    args.ticketingAssigned ||
    (args.ticketingScope !== undefined && args.ticketingScope !== "Not required")
  ) {
    roles.push("Head of Ticketing");
  }
  return roles;
}

function assertAssignmentAccess(
  access: PortalAccess,
  current: Parameters<typeof hasExistingAssignment>[0],
  options: {
    contractingStaffId?: string;
    ticketingScope?: TicketingScope;
    ticketingStaffId?: string;
  }
) {
  if (isHeadAssignmentAccess(access)) {
    return;
  }
  if (!(isSalesAssignmentAccess(access) && access.permissions.includes("manage:queries"))) {
    throw new ConvexError("FORBIDDEN");
  }
  if (hasExistingAssignment(current)) {
    throw new ConvexError("Only heads can reassign query teams.");
  }
  if (options.ticketingStaffId) {
    throw new ConvexError("Only heads can assign ticketing SPOCs.");
  }
  if (!options.contractingStaffId) {
    throw new ConvexError("Select a Contracting SPOC.");
  }
  if (!options.ticketingScope) {
    throw new ConvexError("Select a Ticketing Scope.");
  }
}

type AssignableStaff = Awaited<ReturnType<typeof loadAssignableStaff>>;

async function notifyAssignedStaff(
  ctx: MutationCtx,
  access: PortalAccess,
  queryId: ReturnType<MutationCtx["db"]["normalizeId"]>,
  queryCode: string,
  assignment: AssignableStaff,
  team: "contracting" | "ticketing"
) {
  if (!queryId) {
    return;
  }
  const ownerName = assignment.staff.name.trim();
  const isContracting = team === "contracting";
  await createActivity(ctx, access, {
    action: isContracting ? "assigned_contracting" : "assigned_ticketing",
    entityId: queryId,
    entityType: "query",
    message: isContracting
      ? `${queryCode} assigned to ${ownerName}`
      : `${queryCode} ticketing assigned to ${ownerName}`,
  });
  await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "staff", staffIds: [assignment.staffId] },
    content: {
      body: `You were assigned as ${team} SPOC for ${queryCode}.`,
      entityId: queryId,
      entityType: "query",
      title: isContracting ? "Assign contracting owner" : "Assign ticketing owner",
    },
    emailTargets: { kind: "staff", staffIds: [assignment.staffId] },
  });
}

function applyAssignmentOwners(
  patch: RuntimeObject,
  contracting: AssignableStaff | null,
  ticketing: AssignableStaff | null
) {
  if (contracting) {
    patch.contractingOwnerId = contracting.staffId;
    patch.contractingOwnerName = contracting.staff.name.trim();
  }
  if (ticketing) {
    patch.ticketingOwnerId = ticketing.staffId;
    patch.ticketingOwnerName = ticketing.staff.name.trim();
  }
}

export async function applyQueryTeamAssignments(
  ctx: MutationCtx,
  access: PortalAccess,
  args: ApplyQueryTeamAssignmentsInput
) {
  const contractingStaffId = args.contractingStaffId?.trim() || undefined;
  const ticketingStaffId = args.ticketingStaffId?.trim() || undefined;
  const ticketingScope = normalizedTicketingScope(args.ticketingScope);
  if (!(contractingStaffId || ticketingStaffId || ticketingScope)) {
    throw new ConvexError("Select a contracting and/or ticketing SPOC.");
  }

  const { queryId, query: current } = await loadVisibleQueryForAssignment(
    ctx,
    access,
    args.queryId
  );

  assertAssignmentAccess(access, current, {
    contractingStaffId,
    ticketingScope,
    ticketingStaffId,
  });

  const contracting = contractingStaffId
    ? await loadAssignableStaff(ctx, contractingStaffId, "contracting")
    : null;
  const ticketing = ticketingStaffId
    ? await loadAssignableStaff(ctx, ticketingStaffId, "ticketing")
    : null;

  const now = Date.now();
  const jobCards = await ctx.db
    .query("jobCards")
    .withIndex("by_queryId", (q) => q.eq("queryId", queryId))
    .collect();

  const queryPatch: RuntimeObject = { updatedAt: now };
  applyAssignmentOwners(queryPatch, contracting, ticketing);
  if (contracting) {
    queryPatch.contractingStatus = "Query Received";
  }
  if (ticketingScope) {
    queryPatch.ticketingScope = ticketingScope;
  }

  const writes: Promise<unknown>[] = [patchWithE2eOwnership(ctx, "queries", queryId, queryPatch)];

  for (const jobCard of jobCards) {
    const jobPatch: RuntimeObject = { updatedAt: now };
    applyAssignmentOwners(jobPatch, contracting, ticketing);
    writes.push(patchWithE2eOwnership(ctx, "jobCards", jobCard._id, jobPatch));
  }

  if (contracting) {
    const ownerName = contracting.staff.name.trim();
    writes.push(
      insertWithE2eOwnership(ctx, "contractingAssignments", {
        createdAt: now,
        createdBy: access.authUserId ?? "unknown",
        ownerId: contracting.staffId,
        ownerName,
        queryId,
        status: "Query Received",
        updatedAt: now,
      })
    );
  }

  await Promise.all(writes);
  await scheduleCrmMetricSync(ctx, "queries", String(queryId));
  await Promise.all(
    jobCards.map((jobCard) => scheduleCrmMetricSync(ctx, "jobCards", String(jobCard._id)))
  );
  await refreshProposalLinkProjections(ctx, queryId);

  const directNotifications: Promise<void>[] = [];
  if (contracting) {
    directNotifications.push(
      notifyAssignedStaff(ctx, access, queryId, current.queryCode, contracting, "contracting")
    );
  }
  if (ticketing) {
    directNotifications.push(
      notifyAssignedStaff(ctx, access, queryId, current.queryCode, ticketing, "ticketing")
    );
  }
  await Promise.all(directNotifications);

  const headRoles = relevantAssignmentHeadRoles({
    ticketingAssigned: Boolean(ticketing),
    ticketingScope,
  });
  const ticketingAssignmentRequired =
    isSalesAssignmentAccess(access) &&
    !ticketing &&
    Boolean(ticketingScope && ticketingScope !== "Not required");
  let assignmentTitle = "Query team assignment updated";
  if (ticketingAssignmentRequired) {
    assignmentTitle = "Assign Ticketing SPOC";
  } else if (isSalesAssignmentAccess(access)) {
    assignmentTitle = "Query team assigned by Sales";
  }
  await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "roles", roles: headRoles },
    content: {
      body: `${current.queryCode} was assigned to ${contracting?.staff.name.trim() || current.contractingOwnerName || "a Contracting SPOC"}${
        ticketingScope ? ` with Ticketing Scope: ${ticketingScope}` : ""
      }.`,
      entityId: queryId,
      entityType: "query",
      title: assignmentTitle,
    },
    // One actionable Head of Ticketing email covers the initial unassigned intake.
    // Selected SPOCs continue to receive their direct assignment email above.
    emailTargets: ticketingAssignmentRequired
      ? { kind: "roles", roles: ["Head of Ticketing"] }
      : { kind: "none" },
  });

  return { id: queryId };
}
