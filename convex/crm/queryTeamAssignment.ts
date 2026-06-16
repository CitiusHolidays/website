import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { canSeeQueryRecord, createActivity, notifyStaffMember, type PortalAccess } from "./lib";

const CONTRACTING_TEAM_ROLES = ["Contracting", "Contracting Head"] as const;
const TICKETING_TEAM_ROLES = ["Ticketing", "Head of Ticketing"] as const;

async function loadVisibleQueryForAssignment(
  ctx: MutationCtx,
  access: PortalAccess,
  queryIdRaw: string,
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
  return { queryId, query };
}

async function loadAssignableStaff(
  ctx: MutationCtx,
  staffIdRaw: string,
  team: "contracting" | "ticketing",
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
        : "Selected staff member is not on the ticketing team",
    );
  }
  return { staffId, staff };
}

export type ApplyQueryTeamAssignmentsInput = {
  queryId: string;
  contractingStaffId?: string;
  ticketingStaffId?: string;
};

export async function applyQueryTeamAssignments(
  ctx: MutationCtx,
  access: PortalAccess,
  args: ApplyQueryTeamAssignmentsInput,
) {
  const contractingStaffId = args.contractingStaffId?.trim() || undefined;
  const ticketingStaffId = args.ticketingStaffId?.trim() || undefined;
  if (!contractingStaffId && !ticketingStaffId) {
    throw new ConvexError("Select a contracting and/or ticketing SPOC.");
  }

  const { queryId, query: current } = await loadVisibleQueryForAssignment(
    ctx,
    access,
    args.queryId,
  );

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
        queryId,
        ownerId: contracting.staffId,
        ownerName,
        status: "Query Received",
        createdBy: access.authUserId ?? "unknown",
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  await Promise.all(writes);

  if (contracting) {
    const ownerName = contracting.staff.name.trim();
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "assigned_contracting",
      message: `${current.queryCode} assigned to ${ownerName}`,
    });
    await notifyStaffMember(ctx, contracting.staffId, {
      title: "Assign contracting owner",
      body: `You were assigned as contracting SPOC for ${current.queryCode}.`,
      entityType: "query",
      entityId: queryId,
    });
  }

  if (ticketing) {
    const ownerName = ticketing.staff.name.trim();
    await createActivity(ctx, access, {
      entityType: "query",
      entityId: queryId,
      action: "assigned_ticketing",
      message: `${current.queryCode} ticketing assigned to ${ownerName}`,
    });
    await notifyStaffMember(ctx, ticketing.staffId, {
      title: "Assign ticketing owner",
      body: `You were assigned as ticketing SPOC for ${current.queryCode}.`,
      entityType: "query",
      entityId: queryId,
    });
  }

  return { id: queryId };
}
