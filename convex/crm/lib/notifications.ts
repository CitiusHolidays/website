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
  operationalEffectReceiptForId,
  type ResolvedOperationalControl,
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
type NotificationEffectReceipt = Pick<Doc<"operationalEffectReceipts">, "disposition">;

type WorkflowNotificationResult = Awaited<ReturnType<typeof publishWorkflowNotificationOnce>>;
const workflowNotificationRuns = new WeakMap<
  object,
  Map<string, Promise<WorkflowNotificationResult>>
>();

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

interface PreparedWorkflowNotification {
  additionalEmailControl: ResolvedOperationalControl;
  additionalRecipients: Set<string>;
  audienceStaffIds: Set<Id<"staffUsers">>;
  audienceUserIds: Set<string>;
  bellControl: ResolvedOperationalControl;
  bellRows: NotificationBellRow[];
  emailControl: ResolvedOperationalControl;
  emailRecipients: Set<string>;
  payloadFingerprint: string;
  workflowRecipients: Set<string>;
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
  workflowRecipients: Set<string>,
  additionalRecipients: Set<string>,
  plan: WorkflowNotificationPlan
) {
  const bellRecipients = bellRows
    .map((row) =>
      [row.recipientRole ?? "", String(row.recipientStaffId ?? ""), row.recipientUserId ?? ""].join(
        ":"
      )
    )
    .sort((left, right) => left.localeCompare(right));
  const material = JSON.stringify({
    additionalEmailControlKey: plan.operationalControls?.additionalEmailKey,
    additionalEmailRecipients: Array.from(additionalRecipients).sort((left, right) =>
      left.localeCompare(right)
    ),
    bellControlKey: plan.operationalControls?.bellKey,
    bellRecipients,
    body: plan.content.body,
    emailControlKey: plan.operationalControls?.emailKey,
    emailDelayMs: plan.emailDelayMs,
    emailRecipients: Array.from(workflowRecipients).sort((left, right) =>
      left.localeCompare(right)
    ),
    entityId: notificationEntityId(plan.content.entityId),
    entityType: plan.content.entityType,
    title: plan.content.title,
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

function notificationReceiptDisposition(receipt: NotificationEffectReceipt) {
  if (
    receipt.disposition !== "queued" &&
    receipt.disposition !== "suppressed" &&
    receipt.disposition !== "not_applicable"
  ) {
    throw new Error("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");
  }
  return receipt.disposition;
}

async function requireNotificationEffectReceipt(ctx: MutationCtx, effectId: string) {
  const receipt = await operationalEffectReceiptForId(ctx, effectId);
  if (!receipt) {
    throw new Error("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");
  }
  return receipt;
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
  const staffIds = new Set<Id<"staffUsers">>();
  const userIds = new Set<string>();
  const directIds =
    targets.kind === "staff" ? new Set(targets.staffIds.map(String)) : new Set<string>();

  for (const member of activeStaff) {
    const selected =
      (targets.kind === "roles" && staffWantsEmailForRoles(member, targets.roles)) ||
      (targets.kind === "staff" && directIds.has(String(member._id))) ||
      (targets.kind === "matching" && targets.matches(member));
    if (selected) {
      const normalizedEmail = normalizeEmail(member.email);
      if (normalizedEmail) {
        recipients.add(normalizedEmail);
        staffIds.add(member._id);
        if (member.authUserId) {
          userIds.add(member.authUserId);
        }
      }
    }
  }
  return { recipients, staffIds, userIds };
}

function addAdditionalRecipientAudience(
  activeStaff: NotificationStaff[],
  additionalRecipients: Set<string>,
  staffIds: Set<Id<"staffUsers">>,
  userIds: Set<string>
) {
  for (const member of activeStaff) {
    if (!additionalRecipients.has(normalizeEmail(member.email))) {
      continue;
    }
    staffIds.add(member._id);
    if (member.authUserId) {
      userIds.add(member.authUserId);
    }
  }
}

async function recordNotificationEmailOrigin(
  ctx: MutationCtx,
  eventId: string,
  input: NotificationInput,
  createdAt: number,
  audienceStaffIds: Set<Id<"staffUsers">>,
  audienceUserIds: Set<string>
) {
  const existing = await ctx.db
    .query("notificationEmailEventOrigins")
    .withIndex("by_eventId", (query) => query.eq("eventId", eventId))
    .unique();
  const origin = {
    audienceStaffIds: Array.from(audienceStaffIds),
    audienceUserIds: Array.from(audienceUserIds),
    createdAt,
    entityId: notificationEntityId(input.entityId),
    entityType: input.entityType,
    eventId,
    label: input.title,
  };
  if (!existing) {
    await insertWithE2eOwnership(ctx, "notificationEmailEventOrigins", origin);
    return;
  }
  const sameOrigin =
    existing.entityId === origin.entityId &&
    existing.entityType === origin.entityType &&
    existing.label === origin.label &&
    JSON.stringify(existing.audienceStaffIds.map(String).sort()) ===
      JSON.stringify(origin.audienceStaffIds.map(String).sort()) &&
    JSON.stringify([...existing.audienceUserIds].sort()) ===
      JSON.stringify([...origin.audienceUserIds].sort());
  if (!sameOrigin) {
    throw new Error("NOTIFICATION_EMAIL_EVENT_ORIGIN_CONFLICT");
  }
}

async function prepareWorkflowNotification(
  ctx: MutationCtx,
  plan: WorkflowNotificationPlan,
  createdAt: number
): Promise<PreparedWorkflowNotification> {
  const {
    additionalEmail: additionalEmailControl,
    bell: bellControl,
    email: emailControl,
  } = await resolveWorkflowOperationalControls(ctx, plan.operationalControls, createdAt);
  const staffRows = await ctx.db.query("staffUsers").collect();
  const activeStaff = staffRows.filter((member) => member.active);
  const requestedBellRows = notificationBellRows(
    activeStaff,
    plan.bellTargets,
    plan.content,
    createdAt
  );
  const requestedWorkflowAudience = notificationEmailRecipients(activeStaff, plan.emailTargets);
  const requestedAdditionalRecipients = new Set<string>();
  for (const email of plan.additionalEmailRecipients ?? []) {
    addNotificationEmailRecipient(requestedAdditionalRecipients, email);
  }
  const audienceStaffIds = new Set(requestedWorkflowAudience.staffIds);
  const audienceUserIds = new Set(requestedWorkflowAudience.userIds);
  addAdditionalRecipientAudience(
    activeStaff,
    requestedAdditionalRecipients,
    audienceStaffIds,
    audienceUserIds
  );
  const bellRows = bellControl.enabled ? requestedBellRows : [];
  const workflowRecipients = emailControl.enabled
    ? requestedWorkflowAudience.recipients
    : new Set<string>();
  const additionalRecipients = additionalEmailControl.enabled
    ? requestedAdditionalRecipients
    : new Set<string>();
  return {
    additionalEmailControl,
    additionalRecipients,
    audienceStaffIds,
    audienceUserIds,
    bellControl,
    bellRows,
    emailControl,
    emailRecipients: new Set([...workflowRecipients, ...additionalRecipients]),
    payloadFingerprint: await workflowEffectDigest(
      requestedBellRows,
      requestedWorkflowAudience.recipients,
      requestedAdditionalRecipients,
      plan
    ),
    workflowRecipients,
  };
}

async function replayedWorkflowNotificationResult(
  ctx: MutationCtx,
  effectId: string,
  bellReceipt: Awaited<ReturnType<typeof recordOperationalEffect>>,
  hasAdditionalEmail: boolean
) {
  const emailReceipt = await requireNotificationEffectReceipt(ctx, `${effectId}:email`);
  const additionalEmailReceipt = hasAdditionalEmail
    ? await requireNotificationEffectReceipt(ctx, `${effectId}:additional_email`)
    : null;
  return {
    additionalEmail: additionalEmailReceipt
      ? {
          disposition: notificationReceiptDisposition(additionalEmailReceipt),
          recipientCount: additionalEmailReceipt.recipientCount ?? 0,
        }
      : null,
    bell: {
      disposition: notificationReceiptDisposition(bellReceipt.receipt),
      recipientCount: bellReceipt.receipt.recipientCount ?? 0,
    },
    email: {
      disposition: notificationReceiptDisposition(emailReceipt),
      recipientCount: emailReceipt.recipientCount ?? 0,
    },
    eventId: effectId,
  };
}

async function publishWorkflowNotificationOnce(ctx: MutationCtx, plan: WorkflowNotificationPlan) {
  const createdAt = Date.now();
  const {
    additionalEmailControl,
    additionalRecipients,
    audienceStaffIds,
    audienceUserIds,
    bellControl,
    bellRows,
    emailControl,
    emailRecipients,
    payloadFingerprint,
    workflowRecipients,
  } = await prepareWorkflowNotification(ctx, plan, createdAt);
  const synthetic = plan.operationalControls?.synthetic ?? false;
  const entityId = notificationEntityId(plan.content.entityId);
  const bellDisposition = notificationEffectDisposition(
    bellControl.enabled,
    bellRows.length > 0,
    true
  );
  const provisionalEffectId =
    plan.operationalControls?.effectId ?? `workflow:${createdAt}:${payloadFingerprint}`;
  const bellEffect: Parameters<typeof recordOperationalEffect>[1] = {
    control: bellControl,
    disposition: bellDisposition,
    effectId: `${provisionalEffectId}:bell`,
    entityId,
    entityType: plan.content.entityType,
    payloadFingerprint,
    recipientCount: bellRows.length,
    synthetic,
  };
  if (bellControl.enabled && bellRows.length === 0) {
    bellEffect.reasonOverride = "no_recipients";
  }
  const bellReceipt = await recordOperationalEffect(ctx, bellEffect);
  const effectId = plan.operationalControls?.effectId ?? `workflow:${String(bellReceipt.id)}`;
  if (bellReceipt.replayed) {
    return await replayedWorkflowNotificationResult(
      ctx,
      effectId,
      bellReceipt,
      plan.additionalEmailRecipients !== undefined
    );
  }
  const notificationIds = await Promise.all(
    bellRows.map(async (row) => {
      const projection = await projectNotificationInsert(ctx, row);
      return await insertWithE2eOwnership(ctx, "notifications", { ...row, ...projection });
    })
  );
  const emailEventId = notificationIds[0] ? String(notificationIds[0]) : effectId;
  if (emailRecipients.size > 0) {
    await recordNotificationEmailOrigin(
      ctx,
      emailEventId,
      plan.content,
      createdAt,
      audienceStaffIds,
      audienceUserIds
    );
  }
  const scheduled = await queueNotificationEmail(ctx, emailRecipients, emailEventId, plan.content, {
    emailDelayMs: plan.emailDelayMs,
  });
  const workflowRecipientCount = workflowRecipients.size;
  const emailDisposition = notificationEffectDisposition(
    emailControl.enabled,
    workflowRecipientCount > 0,
    scheduled
  );
  const emailEffect: Parameters<typeof recordOperationalEffect>[1] = {
    control: emailControl,
    disposition: emailDisposition,
    effectId: `${effectId}:email`,
    entityId,
    entityType: plan.content.entityType,
    payloadFingerprint,
    recipientCount: workflowRecipientCount,
    synthetic,
  };
  if (emailControl.enabled && workflowRecipientCount === 0) {
    emailEffect.reasonOverride = "no_recipients";
  }
  await recordOperationalEffect(ctx, emailEffect);
  const additionalEmailDisposition = notificationEffectDisposition(
    additionalEmailControl.enabled,
    additionalRecipients.size > 0,
    scheduled
  );
  if (plan.additionalEmailRecipients) {
    const additionalEmailEffect: Parameters<typeof recordOperationalEffect>[1] = {
      control: additionalEmailControl,
      disposition: additionalEmailDisposition,
      effectId: `${effectId}:additional_email`,
      entityId,
      entityType: plan.content.entityType,
      payloadFingerprint,
      recipientCount: additionalRecipients.size,
      synthetic,
    };
    if (additionalEmailControl.enabled && additionalRecipients.size === 0) {
      additionalEmailEffect.reasonOverride = "no_recipients";
    }
    await recordOperationalEffect(ctx, additionalEmailEffect);
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

export async function publishWorkflowNotification(
  ctx: MutationCtx,
  plan: WorkflowNotificationPlan
): Promise<Awaited<ReturnType<typeof publishWorkflowNotificationOnce>>> {
  const effectId = plan.operationalControls?.effectId;
  if (!effectId) {
    return await publishWorkflowNotificationOnce(ctx, plan);
  }
  let runs = workflowNotificationRuns.get(ctx);
  if (!runs) {
    runs = new Map();
    workflowNotificationRuns.set(ctx, runs);
  }
  const previous = runs.get(effectId);
  const current = (previous ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => await publishWorkflowNotificationOnce(ctx, plan));
  runs.set(effectId, current);
  try {
    return await current;
  } finally {
    if (runs.get(effectId) === current) {
      runs.delete(effectId);
    }
  }
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
