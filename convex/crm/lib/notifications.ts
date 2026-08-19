import { internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { hasOwnKey } from "../../lib/runtimeValues";
import { deleteNotificationPage, queueEntityNotificationCleanup } from "../notificationCleanup";
import { projectNotificationInsert } from "../notificationUnreadProjection";
import { hasActiveE2eRun, insertWithE2eOwnership } from "./e2eOwnership";
import {
  type OperationalControlKey,
  type OperationalTestContext,
  recordOperationalEffect,
  resolveOperationalControls,
} from "./operationalControls";
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

const ROLE_EMAIL_RECIPIENT_EXPANSIONS = {
  Accounts: ["Accounts", "Accounts Head"],
  Contracting: ["Contracting", "Contracting Head"],
  Operations: ["Operations", "Operations Head"],
  Sales: ["Sales", "Sales Head"],
  Ticketing: ["Ticketing", "Head of Ticketing"],
} satisfies Record<string, string[]>;

export function expandNotificationEmailRoles(roles: string[]) {
  const expanded = new Set<string>();
  for (const role of roles) {
    expanded.add(role);
    const recipientRoles = hasOwnKey(ROLE_EMAIL_RECIPIENT_EXPANSIONS, role)
      ? ROLE_EMAIL_RECIPIENT_EXPANSIONS[role]
      : [];
    for (const recipientRole of recipientRoles) {
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
type NotificationEffectDisposition = "not_applicable" | "queued" | "suppressed";

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
  additionalEmailRecipients?: string[];
  bellTargets: BellNotificationTargets;
  content: NotificationInput;
  emailDelayMs?: number;
  emailTargets: EmailNotificationTargets;
  operationalControls?: {
    additionalEmailKey?: OperationalControlKey;
    bellKey?: OperationalControlKey;
    effectId?: string;
    emailKey?: OperationalControlKey;
    synthetic?: boolean;
    test?: OperationalTestContext;
  };
}

async function queueNotificationEmail(
  ctx: MutationCtx,
  recipients: Set<string>,
  eventId: string | undefined,
  input: NotificationInput,
  options?: {
    emailDelayMs?: number;
    emailRoles?: string[];
  }
) {
  if (recipients.size === 0 || !eventId) {
    return false;
  }
  if (await hasActiveE2eRun(ctx)) {
    return false;
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
  return true;
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

async function workflowEffectDigest(
  bellRows: NotificationBellRow[],
  recipients: Set<string>,
  content: NotificationInput
) {
  const bellRecipients = bellRows
    .map((row) =>
      [row.recipientRole ?? "", String(row.recipientStaffId ?? ""), row.recipientUserId ?? ""].join(
        ":"
      )
    )
    .sort((left, right) => left.localeCompare(right));
  const material = JSON.stringify({
    bellRecipients,
    body: content.body,
    emailRecipients: Array.from(recipients).sort((left, right) => left.localeCompare(right)),
    entityId: notificationEntityId(content.entityId),
    entityType: content.entityType,
    title: content.title,
  });
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function notificationEffectDisposition(
  enabled: boolean,
  hasRecipients: boolean,
  scheduled: boolean
): NotificationEffectDisposition {
  if (!enabled) {
    return "suppressed";
  }
  return hasRecipients && scheduled ? "queued" : "not_applicable";
}

async function resolveWorkflowOperationalControls(
  ctx: MutationCtx,
  config: WorkflowNotificationPlan["operationalControls"],
  at: number
) {
  const bellKey = config?.bellKey ?? "notifications.crm_bell";
  const emailKey = config?.emailKey ?? "email.crm_workflow";
  const additionalEmailKey = config?.additionalEmailKey ?? emailKey;
  const resolved = await resolveOperationalControls(ctx, [bellKey, emailKey, additionalEmailKey], {
    at,
    test: config?.test,
  });
  const bell = resolved.find((control) => control.key === bellKey);
  const email = resolved.find((control) => control.key === emailKey);
  const additionalEmail = resolved.find((control) => control.key === additionalEmailKey);
  if (!(bell && email && additionalEmail)) {
    throw new Error("OPERATIONAL_CONTROL_RESOLUTION_MISSING");
  }
  return { additionalEmail, bell, email };
}

function roleBellRows(
  roles: string[],
  base: ReturnType<typeof notificationBellBase>
): NotificationBellRow[] {
  return Array.from(new Set(roles), (role) => ({
    ...base,
    // SAFETY: roles is filtered against NOTIFICATION_ROLE_SET before notification insertion.
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
  const {
    additionalEmail: additionalEmailControl,
    bell: bellControl,
    email: emailControl,
  } = await resolveWorkflowOperationalControls(ctx, plan.operationalControls, createdAt);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const activeStaff = staffRows.filter((member) => member.active);
  const bellRows = bellControl.enabled
    ? notificationBellRows(activeStaff, plan.bellTargets, plan.content, createdAt)
    : [];
  const notificationIds = await Promise.all(
    bellRows.map(async (row) => {
      const projection = await projectNotificationInsert(ctx, row);
      return await insertWithE2eOwnership(ctx, "notifications", { ...row, ...projection });
    })
  );
  const workflowRecipients = emailControl.enabled
    ? notificationEmailRecipients(activeStaff, plan.emailTargets)
    : new Set<string>();
  const emailRecipients = new Set(workflowRecipients);
  const additionalRecipients = new Set<string>();
  if (additionalEmailControl.enabled) {
    for (const email of plan.additionalEmailRecipients ?? []) {
      addNotificationEmailRecipient(additionalRecipients, email);
    }
  }
  for (const email of additionalRecipients) {
    emailRecipients.add(email);
  }
  const synthetic = plan.operationalControls?.synthetic ?? false;
  const entityId = notificationEntityId(plan.content.entityId);
  const bellDisposition = notificationEffectDisposition(
    bellControl.enabled,
    bellRows.length > 0,
    true
  );
  const provisionalEffectId =
    plan.operationalControls?.effectId ??
    `workflow:${createdAt}:${await workflowEffectDigest(bellRows, emailRecipients, plan.content)}`;
  const bellReceiptId = await recordOperationalEffect(ctx, {
    control: bellControl,
    disposition: bellDisposition,
    effectId: `${provisionalEffectId}:bell`,
    entityId,
    entityType: plan.content.entityType,
    recipientCount: bellRows.length,
    ...(bellControl.enabled && bellRows.length === 0 ? { reasonOverride: "no_recipients" } : {}),
    synthetic,
  });
  const effectId = plan.operationalControls?.effectId ?? `workflow:${String(bellReceiptId)}`;
  const emailEventId = notificationIds[0] ? String(notificationIds[0]) : effectId;
  const scheduled = await queueNotificationEmail(ctx, emailRecipients, emailEventId, plan.content, {
    emailDelayMs: plan.emailDelayMs,
  });
  const workflowRecipientCount = workflowRecipients.size;
  const emailDisposition = notificationEffectDisposition(
    emailControl.enabled,
    workflowRecipientCount > 0,
    scheduled
  );
  await recordOperationalEffect(ctx, {
    control: emailControl,
    disposition: emailDisposition,
    effectId: `${effectId}:email`,
    entityId,
    entityType: plan.content.entityType,
    recipientCount: workflowRecipientCount,
    ...(emailControl.enabled && workflowRecipientCount === 0
      ? { reasonOverride: "no_recipients" }
      : {}),
    synthetic,
  });
  const additionalEmailDisposition = notificationEffectDisposition(
    additionalEmailControl.enabled,
    additionalRecipients.size > 0,
    scheduled
  );
  if (plan.additionalEmailRecipients) {
    await recordOperationalEffect(ctx, {
      control: additionalEmailControl,
      disposition: additionalEmailDisposition,
      effectId: `${effectId}:additional_email`,
      entityId,
      entityType: plan.content.entityType,
      recipientCount: additionalRecipients.size,
      ...(additionalEmailControl.enabled && additionalRecipients.size === 0
        ? { reasonOverride: "no_recipients" }
        : {}),
      synthetic,
    });
  }
  return {
    additionalEmail: plan.additionalEmailRecipients
      ? {
          disposition: additionalEmailDisposition,
          recipientCount: additionalRecipients.size,
        }
      : null,
    bell: {
      disposition: bellDisposition,
      recipientCount: bellRows.length,
    },
    email: {
      disposition: emailDisposition,
      recipientCount: workflowRecipientCount,
    },
    eventId: emailEventId,
  };
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
