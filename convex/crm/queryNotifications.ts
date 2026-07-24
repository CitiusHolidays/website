import type { Id } from "../_generated/dataModel";
import { notifyRoles, notifyStaffMember } from "./lib";
import { requiresTicketingSpocAssignment } from "./ticketingIntakePolicy";

const OPS_START_ROLES = [
  "Contracting",
  "Contracting Head",
  "Operations",
  "Operations Head",
  "Ticketing",
  "Head of Ticketing",
] as const;

type NotificationCtx = Parameters<typeof notifyStaffMember>[0];

export function isJobCardCreatorNotificationTarget(staff: { active?: boolean; roles?: string[] }) {
  return Boolean(
    staff.active && staff.roles?.some((role) => ["Accounts", "Accounts Head"].includes(role))
  );
}

export function queryAssignmentHeadRoles(query: {
  ticketingOwnerId?: string;
  ticketingScope?: string;
}) {
  const roles = ["Contracting Head", "Operations Head"];
  if (query.ticketingOwnerId || (query.ticketingScope && query.ticketingScope !== "Not required")) {
    roles.push("Head of Ticketing");
  }
  return roles;
}

export async function notifyQueryOwner(
  ctx: NotificationCtx,
  ownerId: string | undefined,
  notification: Parameters<typeof notifyStaffMember>[2]
) {
  if (!ownerId) {
    return;
  }
  const staffId = ctx.db.normalizeId("staffUsers", ownerId);
  if (!staffId) {
    return;
  }
  await notifyStaffMember(ctx, staffId, notification);
}

export async function notifyOrderConfirmedWorkflow(
  ctx: Parameters<typeof notifyRoles>[0],
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">
) {
  const entity = { entityId: queryId, entityType: "query" as const };
  await Promise.all([
    notifyRoles(ctx, [...OPS_START_ROLES], {
      body: `${query.queryCode} was confirmed by Sales. Accounts will open a Job Card; contracting, operations, and ticketing can begin traveller master, tickets, passport, visa, and tour manager work.`,
      title: "Order confirmed — prepare operations",
      ...entity,
    }),
    notifyQueryOwner(ctx, query.contractingOwnerId, {
      body: `${query.queryCode} was confirmed. Prepare revised costing if needed and coordinate operations once the Job Card opens.`,
      title: "Order confirmed on your query",
      ...entity,
    }),
    notifyQueryOwner(ctx, query.ticketingOwnerId, {
      body: `${query.queryCode} was confirmed. Prepare ticketing once the Job Card opens.`,
      title: "Order confirmed on your query",
      ...entity,
    }),
  ]);
}

export async function notifyJobCardCreators(
  ctx: NotificationCtx,
  query: { queryCode: string },
  queryId: Id<"queries">
) {
  const staffRows = await ctx.db.query("staffUsers").collect();
  const notifications: Promise<unknown>[] = [];
  for (const staff of staffRows) {
    if (!isJobCardCreatorNotificationTarget(staff)) {
      continue;
    }
    notifications.push(
      notifyStaffMember(ctx, staff._id, {
        body: `${query.queryCode} is confirmed. Create the Job Card in Accounts.`,
        entityId: queryId,
        entityType: "query",
        title: "Order confirmed — open Job Card",
      })
    );
  }
  await Promise.all(notifications);
}

export async function notifyQueryAssignmentHeads(
  ctx: Parameters<typeof notifyRoles>[0],
  query: { ticketingOwnerId?: string; ticketingScope?: string },
  notification: Parameters<typeof notifyRoles>[2]
) {
  const roles = queryAssignmentHeadRoles(query);
  await notifyRoles(ctx, roles, notification, { emailRoles: roles });
}

export async function notifyTicketingHeadOnQueryIntake(
  ctx: Parameters<typeof notifyRoles>[0],
  query: {
    queryCode: string;
    ticketingScope?: string;
  },
  queryId: Id<"queries">
) {
  if (!requiresTicketingSpocAssignment(query.ticketingScope)) {
    return;
  }
  await notifyRoles(
    ctx,
    ["Head of Ticketing"],
    {
      body: `${query.queryCode} was raised by Sales with Ticketing Scope ${query.ticketingScope}. Assign a Ticketing SPOC before proposal work completes.`,
      entityId: queryId,
      entityType: "query",
      title: "Assign Ticketing SPOC",
    },
    { emailRoles: ["Head of Ticketing"] }
  );
}

export async function notifyAssignedQueryOwners(
  ctx: NotificationCtx,
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">
) {
  const notifications: Promise<unknown>[] = [];
  if (query.contractingOwnerId) {
    notifications.push(
      notifyQueryOwner(ctx, query.contractingOwnerId, {
        body: `${query.queryCode} was submitted by Sales and is ready for contracting proposal work.`,
        entityId: queryId,
        entityType: "query",
        title: "Query submitted for proposal work",
      })
    );
  }
  if (query.ticketingOwnerId) {
    notifications.push(
      notifyQueryOwner(ctx, query.ticketingOwnerId, {
        body: `${query.queryCode} was submitted by Sales and is ready for ticketing inputs.`,
        entityId: queryId,
        entityType: "query",
        title: "Query submitted for ticketing inputs",
      })
    );
  }
  await Promise.all(notifications);
}
