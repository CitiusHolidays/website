import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { deleteNotificationPage, queueEntityNotificationCleanup } from "../notificationCleanup";
import { projectNotificationInsert } from "../notificationUnreadProjection";
import { hasActiveE2eRun, insertWithE2eOwnership } from "./e2eOwnership";
import { normalizeEmail } from "./staffAccess";

function notificationEntityId(
  entityId?: string | Id<"staffUsers"> | Id<"queries"> | Id<"jobCards">
) {
  return entityId === undefined || entityId === null ? undefined : String(entityId);
}

function addNotificationEmailRecipient(recipients: Set<string>, email?: string | null) {
  const normalized = normalizeEmail(email);
  if (normalized) {
    recipients.add(normalized);
  }
}

const ROLE_EMAIL_RECIPIENT_EXPANSIONS: Record<string, string[]> = {
  Accounts: ["Accounts", "Accounts Head"],
  Contracting: ["Contracting", "Contracting Head"],
  Operations: ["Operations", "Operations Head"],
  Sales: ["Sales", "Sales Head"],
  Ticketing: ["Ticketing", "Head of Ticketing"],
};

export function expandNotificationEmailRoles(roles: string[]) {
  const expanded = new Set<string>();
  for (const role of roles) {
    expanded.add(role);
    for (const recipientRole of ROLE_EMAIL_RECIPIENT_EXPANSIONS[role] ?? []) {
      expanded.add(recipientRole);
    }
  }
  return Array.from(expanded);
}

function staffWantsEmailForRoles(
  member: { emailAlertRoles?: string[]; roles: string[] },
  eventEmailRoles: string[]
) {
  const enabledEmailRoles = new Set([...member.roles, ...(member.emailAlertRoles ?? [])]);
  return expandNotificationEmailRoles(eventEmailRoles).some((role) => enabledEmailRoles.has(role));
}

export const NOTIFICATION_EMAIL_STAGGER_MS = 600;

interface NotificationInput {
  body: string;
  entityId?: string | Id<"staffUsers"> | Id<"queries"> | Id<"jobCards">;
  entityType?: string;
  title: string;
}

type NotificationStaff = Doc<"staffUsers">;
type NotificationStaffMatcher = (staff: NotificationStaff) => boolean;
type NotificationBellRow = Omit<Doc<"notifications">, "_creationTime" | "_id">;
type NotificationRole = NotificationStaff["roles"][number];

export type BellNotificationTargets =
  | { kind: "roles"; roles: string[] }
  | { kind: "staff"; staffIds: Id<"staffUsers">[] }
  | { fallbackRoles?: string[]; kind: "matching"; matches: NotificationStaffMatcher };

export type EmailNotificationTargets =
  | { kind: "none" }
  | { kind: "roles"; roles: string[] }
  | { kind: "staff"; staffIds: Id<"staffUsers">[] }
  | { kind: "matching"; matches: NotificationStaffMatcher };

export interface WorkflowNotificationPlan {
  bellTargets: BellNotificationTargets;
  content: NotificationInput;
  emailDelayMs?: number;
  emailTargets: EmailNotificationTargets;
}

async function queueNotificationEmail(
  ctx: MutationCtx,
  recipients: Set<string>,
  eventId: Id<"notifications"> | undefined,
  input: NotificationInput,
  options?: {
    emailDelayMs?: number;
    emailRoles?: string[];
  }
) {
  if (recipients.size === 0 || !eventId) {
    return;
  }
  if (await hasActiveE2eRun(ctx)) {
    return;
  }
  await ctx.scheduler.runAfter(
    options?.emailDelayMs ?? 0,
    internal.crm.notificationEmails.sendNotificationEmail,
    {
      body: input.body,
      entityId: notificationEntityId(input.entityId),
      entityType: input.entityType,
      eventId: String(eventId),
      recipients: Array.from(recipients),
      title: input.title,
    }
  );
}

function notificationBellBase(input: NotificationInput, createdAt: number) {
  return {
    body: input.body,
    createdAt,
    entityId: notificationEntityId(input.entityId),
    entityType: input.entityType,
    title: input.title,
  };
}

function roleBellRows(
  roles: string[],
  base: ReturnType<typeof notificationBellBase>
): NotificationBellRow[] {
  return Array.from(new Set(roles), (role) => ({
    ...base,
    recipientRole: role as NotificationRole,
  }));
}

function directStaffBellRows(
  staffRows: NotificationStaff[],
  base: ReturnType<typeof notificationBellBase>
) {
  const notifiedUserIds = new Set<string>();
  const staffRoleKeys = new Set<string>();
  const rows: NotificationBellRow[] = [];

  for (const member of staffRows) {
    if (member.authUserId) {
      if (notifiedUserIds.has(member.authUserId)) {
        continue;
      }
      notifiedUserIds.add(member.authUserId);
      rows.push({
        ...base,
        recipientStaffId: member._id,
        recipientUserId: member.authUserId,
      });
      continue;
    }
    for (const role of member.roles) {
      const key = `${String(member._id)}:${role}`;
      if (staffRoleKeys.has(key)) {
        continue;
      }
      staffRoleKeys.add(key);
      rows.push({ ...base, recipientRole: role, recipientStaffId: member._id });
    }
  }
  return rows;
}

function staffForBellTargets(
  activeStaff: NotificationStaff[],
  targets: Exclude<BellNotificationTargets, { kind: "roles" }>
) {
  if (targets.kind === "matching") {
    return activeStaff.filter(targets.matches);
  }
  const ids = new Set(targets.staffIds.map(String));
  return activeStaff.filter((member) => ids.has(String(member._id)));
}

function fallbackBellRows(
  matchedStaff: NotificationStaff[],
  fallbackRoles: string[],
  base: ReturnType<typeof notificationBellBase>
) {
  return roleBellRows(
    fallbackRoles.filter(
      (role) =>
        !matchedStaff.some(
          (member) => member.authUserId && member.roles.some((memberRole) => memberRole === role)
        )
    ),
    base
  );
}

function notificationBellRows(
  activeStaff: NotificationStaff[],
  targets: BellNotificationTargets,
  input: NotificationInput,
  createdAt: number
) {
  const base = notificationBellBase(input, createdAt);
  if (targets.kind === "roles") {
    return roleBellRows(targets.roles, base);
  }
  const targetStaff = staffForBellTargets(activeStaff, targets);
  const rows = directStaffBellRows(targetStaff, base);
  if (targets.kind === "matching") {
    rows.push(...fallbackBellRows(targetStaff, targets.fallbackRoles ?? [], base));
  }
  return rows;
}

function notificationEmailRecipients(
  activeStaff: NotificationStaff[],
  targets: EmailNotificationTargets
) {
  const recipients = new Set<string>();
  const directIds =
    targets.kind === "staff" ? new Set(targets.staffIds.map(String)) : new Set<string>();

  for (const member of activeStaff) {
    const selected =
      (targets.kind === "roles" && staffWantsEmailForRoles(member, targets.roles)) ||
      (targets.kind === "staff" && directIds.has(String(member._id))) ||
      (targets.kind === "matching" && targets.matches(member));
    if (selected) {
      addNotificationEmailRecipient(recipients, member.email);
    }
  }
  return recipients;
}

export async function publishWorkflowNotification(
  ctx: MutationCtx,
  plan: WorkflowNotificationPlan
) {
  const createdAt = Date.now();
  const staffRows = await ctx.db.query("staffUsers").collect();
  const activeStaff = staffRows.filter((member) => member.active);
  const bellRows = notificationBellRows(activeStaff, plan.bellTargets, plan.content, createdAt);
  const notificationIds = await Promise.all(
    bellRows.map(async (row) => {
      const projection = await projectNotificationInsert(ctx, row);
      return await insertWithE2eOwnership(ctx, "notifications", { ...row, ...projection });
    })
  );
  const emailRecipients = notificationEmailRecipients(activeStaff, plan.emailTargets);

  await queueNotificationEmail(ctx, emailRecipients, notificationIds[0], plan.content, {
    emailDelayMs: plan.emailDelayMs,
  });
}

/** @deprecated Use publishWorkflowNotification with explicit channel targets. */
export async function notifyRoles(
  ctx: MutationCtx,
  roles: string[],
  input: NotificationInput,
  options?: { emailDelayMs?: number; emailRoles?: string[] }
) {
  return await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "roles", roles },
    content: input,
    emailDelayMs: options?.emailDelayMs,
    emailTargets:
      options?.emailRoles?.length === 0
        ? { kind: "none" }
        : { kind: "roles", roles: options?.emailRoles ?? roles },
  });
}

/** @deprecated Use publishWorkflowNotification with explicit channel targets. */
export async function notifyStaffMatching(
  ctx: MutationCtx,
  shouldNotify: NotificationStaffMatcher,
  input: NotificationInput,
  options?: { emailRoles?: string[]; fallbackRoles?: string[] }
) {
  const matchesEmail = (staff: NotificationStaff) =>
    shouldNotify(staff) &&
    (!options?.emailRoles || staffWantsEmailForRoles(staff, options.emailRoles));
  return await publishWorkflowNotification(ctx, {
    bellTargets: {
      fallbackRoles: options?.fallbackRoles,
      kind: "matching",
      matches: shouldNotify,
    },
    content: input,
    emailTargets:
      options?.emailRoles?.length === 0
        ? { kind: "none" }
        : { kind: "matching", matches: matchesEmail },
  });
}

export function canReceiveNotification(
  notification: {
    recipientStaffId?: Id<"staffUsers">;
    recipientUserId?: string;
    recipientRole?: string;
  },
  access: { staffId?: Id<"staffUsers"> | null; authUserId?: string | null; roles: string[] }
) {
  const roleSet = new Set(access.roles);
  if (
    notification.recipientStaffId &&
    String(notification.recipientStaffId) !== String(access.staffId ?? "")
  ) {
    return false;
  }
  if (notification.recipientUserId && notification.recipientUserId !== access.authUserId) {
    return String(notification.recipientStaffId ?? "") === String(access.staffId ?? "");
  }
  if (notification.recipientRole && !roleSet.has(notification.recipientRole)) {
    return false;
  }
  return true;
}

export async function notifyStaffMember(
  ctx: MutationCtx,
  staffId: Id<"staffUsers">,
  input: NotificationInput,
  options?: {
    emailDelayMs?: number;
    emailRoles?: string[];
  }
) {
  return await publishWorkflowNotification(ctx, {
    bellTargets: { kind: "staff", staffIds: [staffId] },
    content: input,
    emailDelayMs: options?.emailDelayMs,
    emailTargets:
      options?.emailRoles?.length === 0 ? { kind: "none" } : { kind: "staff", staffIds: [staffId] },
  });
}

export interface NotificationEntityIdentity {
  entityId: string;
  entityType: string;
}

export async function deleteEntityNotifications(
  ctx: MutationCtx,
  entityType: string,
  entityId: string,
  deferred?: NotificationEntityIdentity[]
) {
  if (deferred) {
    deferred.push({ entityId: String(entityId), entityType });
    return { deferred: true, deleted: 0, hasMore: false };
  }
  const result = await deleteNotificationPage(ctx, entityType, String(entityId));
  if (result.hasMore) {
    await ctx.scheduler.runAfter(0, internal.crm.notificationCleanup.continueEntityCleanup, {
      entityId: String(entityId),
      entityType,
    });
  }
  return result;
}

export async function flushDeferredNotificationCleanup(
  ctx: MutationCtx,
  identities: NotificationEntityIdentity[]
) {
  return await queueEntityNotificationCleanup(ctx, identities);
}
