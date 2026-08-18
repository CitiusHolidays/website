import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { publishWorkflowNotification, type WorkflowNotificationPlan } from "./lib";
import { requiresTicketingSpocAssignment } from "./ticketingIntakePolicy";

const OPS_START_ROLES = [
  "Contracting",
  "Contracting Head",
  "Operations",
  "Operations Head",
  "Ticketing",
  "Head of Ticketing",
] as const;

type NotificationCtx = MutationCtx;

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
  notification: WorkflowNotificationPlan["content"]
) {
  if (!ownerId) {
    return;
  }
  const staffId = ctx.db.normalizeId("staffUsers", ownerId);
  if (!staffId) {
    return;
  }
  await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "staff", staffIds: [staffId] },
    content: notification,
    emailTargets: { kind: "staff", staffIds: [staffId] },
  });
}

export async function notifyOrderConfirmedWorkflow(
  ctx: NotificationCtx,
  query: { queryCode: string; contractingOwnerId?: string; ticketingOwnerId?: string },
  queryId: Id<"queries">
) {
  const entity = { entityId: queryId, entityType: "query" as const };
  await Promise.all([
    publishWorkflowNotification(ctx, {
      bellTargets: { kind: "roles", roles: [...OPS_START_ROLES] },
      content: {
        body: `${query.queryCode} was confirmed by Sales. Accounts will open a Job Card; contracting, operations, and ticketing can begin traveller master, tickets, passport, visa, and tour manager work.`,
        title: "Order confirmed — prepare operations",
        ...entity,
      },
      emailTargets: { kind: "roles", roles: [...OPS_START_ROLES] },
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
      publishWorkflowNotification(ctx, {
        bellTargets: { kind: "staff", staffIds: [staff._id] },
        content: {
          body: `${query.queryCode} is confirmed. Create the Job Card in Accounts.`,
          entityId: queryId,
          entityType: "query",
          title: "Order confirmed — open Job Card",
        },
        emailTargets: { kind: "staff", staffIds: [staff._id] },
      })
    );
  }
  await Promise.all(notifications);
}

export async function notifyQueryAssignmentHeads(
  ctx: NotificationCtx,
  query: { ticketingOwnerId?: string; ticketingScope?: string },
  notification: WorkflowNotificationPlan["content"]
) {
  const roles = queryAssignmentHeadRoles(query);
  await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "roles", roles },
    content: notification,
    emailTargets: { kind: "roles", roles },
  });
}

export async function notifyTicketingHeadOnQueryIntake(
  ctx: NotificationCtx,
  query: {
    queryCode: string;
    ticketingScope?: string;
  },
  queryId: Id<"queries">
) {
  if (!requiresTicketingSpocAssignment(query.ticketingScope)) {
    return;
  }
  await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "roles", roles: ["Head of Ticketing"] },
    content: {
      body: `${query.queryCode} was raised by Sales with Ticketing Scope ${query.ticketingScope}. Assign a Ticketing SPOC before proposal work completes.`,
      entityId: queryId,
      entityType: "query",
      title: "Assign Ticketing SPOC",
    },
    emailTargets: { kind: "roles", roles: ["Head of Ticketing"] },
  });
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
