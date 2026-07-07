import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import {
  CONTRACTING_TEAM_ROLES,
  canSeeQueryRecord,
  createActivity,
  hasRole,
  isDirectorOrAdmin,
  notifyRoles,
  notifyStaffMember,
  type PortalAccess,
  TICKETING_TEAM_ROLES,
} from "./lib";

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
  const query = await ctx.db.get(queryId);
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
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    throw new ConvexError("Staff member not found");
  }
  const allowedRoles = team === "contracting" ? CONTRACTING_TEAM_ROLES : TICKETING_TEAM_ROLES;
  const onTeam = staff.roles.some((role) => (allowedRoles as readonly string[]).includes(role));
  if (!onTeam) {
    throw new ConvexError(
      team === "contracting"
        ? "Selected staff member is not on the contracting team"
        : "Selected staff member is not on the ticketing team"
    );
  }
  return { staff, staffId };
}

export type ApplyQueryTeamAssignmentsInput = {
  queryId: string;
  contractingStaffId?: string;
  ticketingStaffId?: string;
  ticketingScope?: string;
};

function normalizedTicketingScope(scope: string | undefined): TicketingScope | undefined {
  const value = scope?.trim();
  if (!value) {
    return;
  }
  if (!(TICKETING_SCOPE_VALUES as readonly string[]).includes(value)) {
    throw new ConvexError("Select a valid Ticketing Scope.");
  }
  return value as TicketingScope;
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

  const hasHeadAccess = isHeadAssignmentAccess(access);
  if (!hasHeadAccess) {
    if (!(isSalesAssignmentAccess(access) && access.permissions.includes("manage:queries"))) {
      throw new ConvexError("FORBIDDEN");
    }
    if (hasExistingAssignment(current)) {
      throw new ConvexError("Only heads can reassign query teams.");
    }
    if (ticketingStaffId) {
      throw new ConvexError("Only heads can assign ticketing SPOCs.");
    }
    if (!contractingStaffId) {
      throw new ConvexError("Select a Contracting SPOC.");
    }
    if (!ticketingScope) {
      throw new ConvexError("Select a Ticketing Scope.");
    }
  }

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

  const queryPatch: Record<string, unknown> = { updatedAt: now };
  if (contracting) {
    const ownerName = contracting.staff.name.trim();
    queryPatch.contractingOwnerId = contracting.staffId;
    queryPatch.contractingOwnerName = ownerName;
    queryPatch.contractingStatus = "Query Received";
  }
  if (ticketing) {
    const ownerName = ticketing.staff.name.trim();
    queryPatch.ticketingOwnerId = ticketing.staffId;
    queryPatch.ticketingOwnerName = ownerName;
  }
  if (ticketingScope) {
    queryPatch.ticketingScope = ticketingScope;
  }

  const writes: Promise<unknown>[] = [ctx.db.patch(queryId, queryPatch)];

  for (const jobCard of jobCards) {
    const jobPatch: Record<string, unknown> = { updatedAt: now };
    if (contracting) {
      jobPatch.contractingOwnerId = contracting.staffId;
      jobPatch.contractingOwnerName = contracting.staff.name.trim();
    }
    if (ticketing) {
      jobPatch.ticketingOwnerId = ticketing.staffId;
      jobPatch.ticketingOwnerName = ticketing.staff.name.trim();
    }
    writes.push(ctx.db.patch(jobCard._id, jobPatch));
  }

  if (contracting) {
    const ownerName = contracting.staff.name.trim();
    writes.push(
      ctx.db.insert("contractingAssignments", {
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

  if (contracting) {
    const ownerName = contracting.staff.name.trim();
    await createActivity(ctx, access, {
      action: "assigned_contracting",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} assigned to ${ownerName}`,
    });
    await notifyStaffMember(ctx, contracting.staffId, {
      body: `You were assigned as contracting SPOC for ${current.queryCode}.`,
      entityId: queryId,
      entityType: "query",
      title: "Assign contracting owner",
    });
  }

  if (ticketing) {
    const ownerName = ticketing.staff.name.trim();
    await createActivity(ctx, access, {
      action: "assigned_ticketing",
      entityId: queryId,
      entityType: "query",
      message: `${current.queryCode} ticketing assigned to ${ownerName}`,
    });
    await notifyStaffMember(ctx, ticketing.staffId, {
      body: `You were assigned as ticketing SPOC for ${current.queryCode}.`,
      entityId: queryId,
      entityType: "query",
      title: "Assign ticketing owner",
    });
  }

  const headRoles = relevantAssignmentHeadRoles({
    ticketingAssigned: Boolean(ticketing),
    ticketingScope,
  });
  await notifyRoles(ctx, headRoles, {
    body: `${current.queryCode} was assigned to ${contracting?.staff.name.trim() || current.contractingOwnerName || "a Contracting SPOC"}${
      ticketingScope ? ` with Ticketing Scope: ${ticketingScope}` : ""
    }.`,
    entityId: queryId,
    entityType: "query",
    title: isSalesAssignmentAccess(access)
      ? "Query team assigned by Sales"
      : "Query team assignment updated",
  });

  return { id: queryId };
}
