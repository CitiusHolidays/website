import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { deleteNotificationPage, queueEntityNotificationCleanup } from "../notificationCleanup";
import { normalizeEmail } from "./staffAccess";

function notificationEntityId(
  entityId?: string | Id<"staffUsers"> | Id<"queries"> | Id<"jobCards">
) {
  return entityId == null ? undefined : String(entityId);
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

function emailAlertRolesForStaff(member: { emailAlertRoles?: string[] }) {
  return member.emailAlertRoles ?? [];
}

function staffWantsEmailForRoles(
  member: { emailAlertRoles?: string[] },
  eventEmailRoles: string[]
) {
  const enabledEmailRoles = new Set(emailAlertRolesForStaff(member));
  return expandNotificationEmailRoles(eventEmailRoles).some((role) => enabledEmailRoles.has(role));
}

export const NOTIFICATION_EMAIL_STAGGER_MS = 600;

type NotificationInput = {
  title: string;
  body: string;
  entityType?: string;
  entityId?: string | Id<"staffUsers"> | Id<"queries"> | Id<"jobCards">;
};

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

export async function notifyRoles(
  ctx: MutationCtx,
  roles: string[],
  input: NotificationInput,
  options?: {
    emailDelayMs?: number;
    emailRoles?: string[];
  }
) {
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const recipientRoles = expandNotificationEmailRoles(roles);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const staffRoleSets = staffRows.map((member) => ({
    member,
    roles: new Set<string>(member.roles),
  }));
  const emailRecipients = new Set<string>();
  const emailRecipientRoles = new Set(expandNotificationEmailRoles(options?.emailRoles ?? roles));

  for (const { member } of staffRoleSets) {
    if (!member.active) {
      continue;
    }
    if (staffWantsEmailForRoles(member, Array.from(emailRecipientRoles))) {
      addNotificationEmailRecipient(emailRecipients, member.email);
    }
  }
  const notificationIds = await Promise.all(
    recipientRoles.map((role) =>
      ctx.db.insert("notifications", {
        body: input.body,
        createdAt,
        entityId,
        entityType: input.entityType,
        recipientRole: role as (typeof staffRows)[number]["roles"][number],
        title: input.title,
      })
    )
  );

  await queueNotificationEmail(ctx, emailRecipients, notificationIds[0], input, options);
}

export async function notifyStaffMatching(
  ctx: MutationCtx,
  shouldNotify: (staff: { roles: string[]; active: boolean; authUserId?: string }) => boolean,
  input: NotificationInput,
  options?: {
    emailRoles?: string[];
    fallbackRoles?: string[];
  }
) {
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const staffRoleSets = staffRows.map((member) => ({
    member,
    roles: new Set<string>(member.roles),
  }));
  const notifiedUserIds = new Set<string>();
  const emailRecipients = new Set<string>();
  const notificationInserts: Array<() => Promise<Id<"notifications">>> = [];

  for (const { member } of staffRoleSets) {
    if (!(member.active && shouldNotify(member))) {
      continue;
    }
    if (staffWantsEmailForRoles(member, options?.emailRoles ?? member.roles)) {
      addNotificationEmailRecipient(emailRecipients, member.email);
    }
    if (member.authUserId) {
      if (notifiedUserIds.has(member.authUserId)) {
        continue;
      }
      notifiedUserIds.add(member.authUserId);
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          body: input.body,
          createdAt,
          entityId,
          entityType: input.entityType,
          recipientStaffId: member._id,
          recipientUserId: member.authUserId,
          title: input.title,
        })
      );
      continue;
    }
    for (const role of member.roles) {
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          body: input.body,
          createdAt,
          entityId,
          entityType: input.entityType,
          recipientRole: role,
          title: input.title,
        })
      );
    }
  }

  for (const role of options?.fallbackRoles ?? []) {
    const hasLinkedStaff = staffRoleSets.some(
      ({ member, roles: memberRoles }) =>
        member.active && member.authUserId && memberRoles.has(role) && shouldNotify(member)
    );
    if (!hasLinkedStaff) {
      for (const { member, roles: memberRoles } of staffRoleSets) {
        if (
          member.active &&
          memberRoles.has(role) &&
          shouldNotify(member) &&
          staffWantsEmailForRoles(member, options?.emailRoles ?? member.roles)
        ) {
          addNotificationEmailRecipient(emailRecipients, member.email);
        }
      }
      notificationInserts.push(() =>
        ctx.db.insert("notifications", {
          body: input.body,
          createdAt,
          entityId,
          entityType: input.entityType,
          recipientRole: role as (typeof staffRows)[number]["roles"][number],
          title: input.title,
        })
      );
    }
  }

  const notificationIds = await Promise.all(notificationInserts.map((insert) => insert()));

  await queueNotificationEmail(ctx, emailRecipients, notificationIds[0], input);
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
  const staff = await ctx.db.get(staffId);
  if (!staff?.active) {
    return;
  }
  const createdAt = Date.now();
  const entityId = notificationEntityId(input.entityId);
  const emailRecipients = new Set<string>();
  if (staffWantsEmailForRoles(staff, options?.emailRoles ?? staff.roles)) {
    addNotificationEmailRecipient(emailRecipients, staff.email);
  }

  let eventId: Id<"notifications"> | undefined;
  if (staff.authUserId) {
    eventId = await ctx.db.insert("notifications", {
      body: input.body,
      createdAt,
      entityId,
      entityType: input.entityType,
      recipientStaffId: staffId,
      recipientUserId: staff.authUserId,
      title: input.title,
    });
  } else {
    const notificationIds = await Promise.all(
      staff.roles.map((role) =>
        ctx.db.insert("notifications", {
          body: input.body,
          createdAt,
          entityId,
          entityType: input.entityType,
          recipientRole: role,
          recipientStaffId: staffId,
          title: input.title,
        })
      )
    );
    eventId = notificationIds[0];
  }

  await queueNotificationEmail(ctx, emailRecipients, eventId, input, options);
}

export type NotificationEntityIdentity = {
  entityId: string;
  entityType: string;
};

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
