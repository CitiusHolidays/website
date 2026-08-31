import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export type OperationalControlKey = (typeof OPERATIONAL_CONTROL_CATALOG_SOURCE)[number]["key"];

export const LEGACY_OPERATIONAL_CONTROL_KEYS = [
  "email.auth",
  "files.document_preview_worker",
  "jobs.scheduled",
  "payments.razorpay",
] as const;
export type LegacyOperationalControlKey = (typeof LEGACY_OPERATIONAL_CONTROL_KEYS)[number];

export const LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS = {
  "email.auth": ["email.auth.verification", "email.auth.password_reset", "email.auth.staff_setup"],
  "files.document_preview_worker": ["files.document_preview_preparation"],
  "jobs.scheduled": [
    "jobs.check_cl_sl_leave_lapse",
    "jobs.cleanup_ai_runtime",
    "jobs.cleanup_passenger_exports",
    "jobs.cleanup_portal_rate_limits",
    "jobs.cleanup_sacred_bharat_rate_limits",
    "jobs.purge_commercial_files",
    "jobs.reconcile_crm_metrics",
    "jobs.reconcile_list_search",
    "jobs.reconcile_proposal_links",
    "jobs.reconcile_proposal_relations",
    "jobs.reconcile_query_commercial",
    "jobs.run_workflow_nudges",
  ],
  "payments.razorpay": ["payments.razorpay_new_order"],
} as const satisfies Record<LegacyOperationalControlKey, readonly OperationalControlKey[]>;

const LEGACY_CONTROL_KEY_BY_REPLACEMENT = new Map<
  OperationalControlKey,
  LegacyOperationalControlKey
>(
  LEGACY_OPERATIONAL_CONTROL_KEYS.flatMap((legacyKey) =>
    LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS[legacyKey].map((replacementKey) => [
      replacementKey,
      legacyKey,
    ])
  )
);
const LEGACY_CONTROL_KEYS = new Set<string>(LEGACY_OPERATIONAL_CONTROL_KEYS);

export function isLegacyOperationalControlKey(value: string): value is LegacyOperationalControlKey {
  return LEGACY_CONTROL_KEYS.has(value);
}

export const operationalControlStateValidator = v.union(
  v.literal("default"),
  v.literal("enabled"),
  v.literal("disabled")
);

export interface OperationalControlCatalogEntry {
  availability: "available" | "unavailable";
  category: "AI" | "Authentication" | "Contact" | "CRM" | "Infrastructure" | "Payments" | "Public";
  dependencies: readonly OperationalControlKey[];
  description: string;
  enforcement: string;
  key: OperationalControlKey;
  label: string;
  standardEnabled: boolean;
  unavailableReason?: string;
}

const OPERATIONAL_CONTROL_CATALOG_SOURCE = [
  {
    availability: "available",
    category: "Public",
    dependencies: [],
    description:
      "Publish Sacred Bharat / 001. Turning it off replaces the edition with a transparent review notice.",
    enforcement: "Sacred Bharat / 001 request-time page gate",
    key: "public.sacred_bharat_001",
    label: "Sacred Bharat / 001",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Contact",
    dependencies: [],
    description: "Accept and durably store public enquiries in the CRM inbound queue.",
    enforcement: "Inbound Query Intent transaction",
    key: "inbound.crm_intake",
    label: "CRM intake",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "CRM",
    dependencies: [],
    description: "Create in-app bell rows for CRM workflow events.",
    enforcement: "Workflow Notification publisher",
    key: "notifications.crm_bell",
    label: "CRM bell notifications",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Contact",
    dependencies: [],
    description:
      "Allow new consented Customer journey reminder requests through Sent. In-flight requests and signed webhook reconciliation continue.",
    enforcement: "Customer journey reminder action immediately before the Sent provider request",
    key: "messaging.customer_journey_reminders",
    label: "Customer journey reminders",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "CRM",
    dependencies: [],
    description:
      "Queue Resend email for CRM workflow events. Existing queued deliveries are unchanged.",
    enforcement: "Workflow Notification publisher",
    key: "email.crm_workflow",
    label: "CRM workflow email",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Contact",
    dependencies: ["notifications.crm_bell"],
    description: "Create the Sales and Sales Head bell alert for a new inbound enquiry.",
    enforcement: "Inbound Query Intent notification plan",
    key: "inbound.sales_bell",
    label: "Inbound Sales bell",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Contact",
    dependencies: ["email.crm_workflow"],
    description: "Queue the Sales workflow email for a new inbound enquiry.",
    enforcement: "Inbound Query Intent notification plan",
    key: "inbound.sales_email",
    label: "Inbound Sales email",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Contact",
    dependencies: ["email.crm_workflow"],
    description: "Queue the retained info@citius.in copy for Website enquiries.",
    enforcement: "Inbound Query Intent notification plan",
    key: "inbound.info_mailbox_email",
    label: "Inbound mailbox copy",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Authentication",
    dependencies: [],
    description: "Send email-address verification messages through Resend.",
    enforcement: "Transactional authentication email delivery",
    key: "email.auth.verification",
    label: "Email verification",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Authentication",
    dependencies: [],
    description: "Send password-reset messages through Resend.",
    enforcement: "Transactional authentication email delivery",
    key: "email.auth.password_reset",
    label: "Password reset email",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Authentication",
    dependencies: [],
    description: "Send account-setup messages created by the Admin staff workflow.",
    enforcement: "Admin staff account setup",
    key: "email.auth.staff_setup",
    label: "Staff setup email",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "AI",
    dependencies: [],
    description: "Allow server-side Citius Concierge requests.",
    enforcement: "Operational Control server gateway",
    key: "ai.concierge",
    label: "Citius Concierge",
    standardEnabled: true,
  },
  {
    availability: "unavailable",
    category: "AI",
    dependencies: [],
    description: "Retained only for historical Journey Planner control and audit compatibility.",
    enforcement: "Retired route returns 410 before control resolution or provider work",
    key: "ai.journey_planner",
    label: "Journey Planner",
    standardEnabled: false,
    unavailableReason: "Journey Planner is retired; its route and stream are historical only.",
  },
  {
    availability: "available",
    category: "Payments",
    dependencies: [],
    description:
      "Allow creation of new Razorpay checkout orders. Verification and webhooks continue for in-flight payments.",
    enforcement: "New checkout order route through the Operational Control server gateway",
    key: "payments.razorpay_new_order",
    label: "New Razorpay orders",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Run the daily CL and SL leave-lapse check.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.check_cl_sl_leave_lapse",
    label: "Leave lapse check",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Remove expired AI runtime records.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.cleanup_ai_runtime",
    label: "AI runtime cleanup",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Remove expired passenger export files.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.cleanup_passenger_exports",
    label: "Passenger export cleanup",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Remove expired Portal rate-limit records.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.cleanup_portal_rate_limits",
    label: "Portal rate-limit cleanup",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Remove expired Sacred Bharat rate-limit records.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.cleanup_sacred_bharat_rate_limits",
    label: "Sacred Bharat rate-limit cleanup",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Purge commercial files whose retention window has ended.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.purge_commercial_files",
    label: "Commercial file purge",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Reconcile CRM metrics with their source records.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.reconcile_crm_metrics",
    label: "CRM metrics reconciliation",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Reconcile the CRM list-search projection.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.reconcile_list_search",
    label: "List-search reconciliation",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Reconcile proposal document links.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.reconcile_proposal_links",
    label: "Proposal link reconciliation",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Reconcile proposal relationship projections.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.reconcile_proposal_relations",
    label: "Proposal relationship reconciliation",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Reconcile query commercial summaries.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.reconcile_query_commercial",
    label: "Query commercial reconciliation",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Run due CRM workflow nudges.",
    enforcement: "Scheduled-job action gateway",
    key: "jobs.run_workflow_nudges",
    label: "Workflow nudges",
    standardEnabled: true,
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Allow first-party document preview worker preparation.",
    enforcement: "Document Preview preparation transaction plus existing rollout setting",
    key: "files.document_preview_preparation",
    label: "Document preview preparation",
    standardEnabled: true,
  },
] as const;

export const OPERATIONAL_CONTROL_CATALOG: readonly OperationalControlCatalogEntry[] =
  OPERATIONAL_CONTROL_CATALOG_SOURCE;

export const OPERATIONAL_CONTROL_KEYS = OPERATIONAL_CONTROL_CATALOG.map((entry) => entry.key);
export const OPERATIONAL_CONTROL_AVAILABLE_KEYS = OPERATIONAL_CONTROL_CATALOG.flatMap((entry) =>
  entry.availability === "available" ? [entry.key] : []
);

export const operationalControlKeyValidator = v.union(
  ...OPERATIONAL_CONTROL_KEYS.map((key) => v.literal(key))
);

const CATALOG_BY_KEY = new Map(
  OPERATIONAL_CONTROL_CATALOG.map((entry) => [entry.key, entry] as const)
);

function isCurrentOperationalControlKey(value: string): value is OperationalControlKey {
  return OPERATIONAL_CONTROL_KEYS.some((key) => key === value);
}

const SAFE_ENABLED_KEYS = new Set<OperationalControlKey>(["inbound.crm_intake"]);
type ControlDbCtx = Pick<QueryCtx | MutationCtx, "db">;
type StoredState = Doc<"operationalControlStates">["state"];
type OperationalEffectReceipt = Doc<"operationalEffectReceipts">;
type ResolutionReason =
  | "configured_default"
  | "corrupt_safe_default"
  | "explicit_disabled"
  | "explicit_enabled"
  | "expired_safe_default"
  | "missing_safe_default"
  | "pre_activation_standard"
  | "prerequisite_disabled";

export interface ResolvedOperationalControl {
  blockedBy: OperationalControlKey[];
  enabled: boolean;
  key: OperationalControlKey;
  reason: ResolutionReason;
}

export interface OperationalCutoverChange {
  expectedRevision: number;
  key: OperationalControlKey;
  state: "default" | "disabled" | "enabled";
}

export type OperationalCutoverBlockerCode =
  | "control_plane_inactive"
  | "duplicate_state"
  | "missing_state"
  | "rollback_owner_invalid"
  | "stale_revision"
  | "temporary_change_active"
  | "unsafe_state";

interface OperationalCutoverSnapshot {
  expiresAt?: number;
  state: "default" | "disabled" | "enabled" | "safe_default";
}

interface OperationalEffectReceiptResult {
  id: Id<"operationalEffectReceipts">;
  receipt: Omit<OperationalEffectReceipt, "_creationTime" | "_id">;
  replayed: boolean;
}

const effectReceiptRuns = new WeakMap<
  object,
  Map<string, Promise<OperationalEffectReceiptResult>>
>();

function safeDefault(key: OperationalControlKey) {
  return SAFE_ENABLED_KEYS.has(key);
}

export function catalogEntry(key: OperationalControlKey) {
  const entry = CATALOG_BY_KEY.get(key);
  if (!entry) {
    throw new ConvexError("UNKNOWN_OPERATIONAL_CONTROL");
  }
  return entry;
}

export function assertAvailableControl(key: OperationalControlKey) {
  const entry = catalogEntry(key);
  if (entry.availability !== "available") {
    throw new ConvexError("OPERATIONAL_CONTROL_UNAVAILABLE");
  }
  return entry;
}

async function stateRows(ctx: ControlDbCtx, key: string) {
  return await ctx.db
    .query("operationalControlStates")
    .withIndex("by_key", (query) => query.eq("key", key))
    .take(2);
}

async function stateRowsForResolution(ctx: ControlDbCtx, key: OperationalControlKey) {
  const directRows = await stateRows(ctx, key);
  if (directRows.length > 0) {
    return directRows;
  }
  const legacyKey = LEGACY_CONTROL_KEY_BY_REPLACEMENT.get(key);
  return legacyKey ? await stateRows(ctx, legacyKey) : directRows;
}

export async function inspectOperationalControlState(
  ctx: ControlDbCtx,
  key: OperationalControlKey,
  at: number
) {
  const rows = await stateRows(ctx, key);
  const current = rows.length === 1 ? rows[0] : null;
  return {
    current,
    duplicate: rows.length > 1,
    resolution: resolveStoredState(key, rows, at),
  };
}

export function inspectOperationalControlStateFromRows(
  rows: Doc<"operationalControlStates">[],
  key: OperationalControlKey,
  at: number
) {
  const matching = rows.filter((row) => row.key === key);
  return {
    current: matching.length === 1 ? matching[0] : null,
    duplicate: matching.length > 1,
    resolution: resolveStoredState(key, matching, at),
  };
}

function resolveStoredState(
  key: OperationalControlKey,
  rows: Doc<"operationalControlStates">[],
  at: number
) {
  if (rows.length > 1) {
    return { enabled: safeDefault(key), reason: "corrupt_safe_default" as const };
  }
  const [row] = rows;
  if (!row) {
    return {
      enabled: safeDefault(key),
      reason: "missing_safe_default" as const,
    };
  }
  if (row.state === "safe_default") {
    return { enabled: safeDefault(key), reason: "missing_safe_default" as const };
  }
  if (row.expiresAt !== undefined && row.expiresAt <= at) {
    return { enabled: safeDefault(key), reason: "expired_safe_default" as const };
  }
  if (row.state === "default") {
    return {
      enabled: catalogEntry(key).standardEnabled,
      reason: "configured_default" as const,
    };
  }
  return {
    enabled: row.state === "enabled",
    reason:
      row.state === "enabled" ? ("explicit_enabled" as const) : ("explicit_disabled" as const),
  };
}

export async function isOperationalControlPlaneActive(ctx: ControlDbCtx) {
  const rows = await ctx.db
    .query("operationalControlPlaneState")
    .withIndex("by_key", (query) => query.eq("key", "global"))
    .take(2);
  // Any activation marker is authoritative. A duplicate marker is corrupt,
  // but must never reopen pre-activation compatibility behavior.
  return rows.length > 0;
}

function resolveBaseControl(
  key: OperationalControlKey,
  rows: Doc<"operationalControlStates">[],
  at: number,
  controlPlaneActive: boolean
) {
  if (!controlPlaneActive) {
    return {
      enabled: catalogEntry(key).standardEnabled,
      reason: "pre_activation_standard" as const,
    };
  }
  return resolveStoredState(key, rows, at);
}

export async function resolveOperationalControls(
  ctx: ControlDbCtx,
  keys: OperationalControlKey[],
  options: {
    at: number;
    controlPlaneActive?: boolean;
    stateRows?: Doc<"operationalControlStates">[];
  }
) {
  const requested = Array.from(new Set(keys));
  for (const key of requested) {
    assertAvailableControl(key);
  }
  const controlPlaneActive =
    options.controlPlaneActive ?? (await isOperationalControlPlaneActive(ctx));
  const allKeys = new Set<OperationalControlKey>(requested);
  for (const key of requested) {
    for (const dependency of catalogEntry(key).dependencies) {
      allKeys.add(dependency);
    }
  }
  const base = new Map<OperationalControlKey, { enabled: boolean; reason: ResolutionReason }>(
    await Promise.all(
      Array.from(allKeys).map(async (key) => {
        let rows: Doc<"operationalControlStates">[];
        if (options.stateRows) {
          const directRows = options.stateRows.filter((row) => row.key === key);
          const legacyKey = LEGACY_CONTROL_KEY_BY_REPLACEMENT.get(key);
          const legacyRows = legacyKey
            ? options.stateRows.filter((row) => row.key === legacyKey)
            : [];
          rows = directRows.length > 0 ? directRows : legacyRows;
        } else {
          rows = await stateRowsForResolution(ctx, key);
        }
        const resolution = resolveBaseControl(key, rows, options.at, controlPlaneActive);
        return [key, resolution] as const;
      })
    )
  );
  return requested.map((key): ResolvedOperationalControl => {
    const resolved = base.get(key) ?? {
      enabled: safeDefault(key),
      reason: "missing_safe_default" as const,
    };
    const blockedBy = catalogEntry(key).dependencies.filter(
      (dependency) => !base.get(dependency)?.enabled
    );
    const result: ResolvedOperationalControl = {
      blockedBy,
      enabled: resolved.enabled && blockedBy.length === 0,
      key,
      reason: blockedBy.length > 0 ? "prerequisite_disabled" : resolved.reason,
    };
    return result;
  });
}

export async function resolveOperationalControl(
  ctx: ControlDbCtx,
  key: OperationalControlKey,
  options: { at: number }
) {
  const [resolution] = await resolveOperationalControls(ctx, [key], options);
  if (!resolution) {
    throw new ConvexError("UNKNOWN_OPERATIONAL_CONTROL");
  }
  return resolution;
}

function cutoverSnapshot(row: Doc<"operationalControlStates"> | null): OperationalCutoverSnapshot {
  if (!row) {
    return { state: "default" };
  }
  return row.expiresAt === undefined
    ? { state: row.state }
    : { expiresAt: row.expiresAt, state: row.state };
}

function sameControlKeys(
  left: readonly OperationalControlKey[],
  right: readonly OperationalControlKey[]
) {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

function rollbackOwnerIsCoherent(
  key: OperationalControlKey,
  current: Doc<"operationalControlStates">,
  owner: Doc<"operationalControlChangeSets"> | null
) {
  if (owner?.status !== "applied") {
    return false;
  }
  const ownedChanges = owner.changes.filter((change) => change.key === key);
  return ownedChanges.length === 1 && ownedChanges[0]?.after.state === current.state;
}

function rollbackOwnerBlocker(
  key: OperationalControlKey,
  current: Doc<"operationalControlStates">,
  owner: Doc<"operationalControlChangeSets"> | null
): OperationalCutoverBlockerCode | null {
  if (current.changeSetId === undefined) {
    return null;
  }
  if (!rollbackOwnerIsCoherent(key, current, owner)) {
    return "rollback_owner_invalid";
  }
  return owner?.restorationAt === undefined ? null : "temporary_change_active";
}

/**
 * Builds a read-only cutover rehearsal from one deterministic reference time.
 * The caller still owns exact-Admin and target-identity checks, and Apply must
 * rerun this function instead of trusting a previously rendered preview.
 */
export async function buildOperationalCutoverPreview(
  ctx: ControlDbCtx,
  input: {
    changes: OperationalCutoverChange[];
    referenceAt: number;
    restorationAfterMs: number | null;
  }
) {
  const allStateRows = (
    await Promise.all(
      [...OPERATIONAL_CONTROL_KEYS, ...LEGACY_OPERATIONAL_CONTROL_KEYS].map(async (key) =>
        stateRows(ctx, key)
      )
    )
  ).flat();
  const controlPlaneActive = await isOperationalControlPlaneActive(ctx);
  const requestedKeys = new Set(input.changes.map((change) => change.key));
  const changeByKey = new Map(input.changes.map((change) => [change.key, change] as const));
  const inspectedByKey = new Map(
    input.changes.map((change) => [
      change.key,
      inspectOperationalControlStateFromRows(allStateRows, change.key, input.referenceAt),
    ])
  );
  const ownerByKey = new Map(
    await Promise.all(
      input.changes.map(async (change) => {
        const current = inspectedByKey.get(change.key)?.current;
        const owner = current?.changeSetId
          ? await ctx.db.get("operationalControlChangeSets", current.changeSetId)
          : null;
        return [change.key, owner] as const;
      })
    )
  );
  const simulatedRows = allStateRows.map((row) => {
    const change = isCurrentOperationalControlKey(row.key) ? changeByKey.get(row.key) : undefined;
    return change ? { ...row, expiresAt: undefined, state: change.state } : row;
  });
  const [beforeResolutions, afterResolutions] = await Promise.all([
    resolveOperationalControls(ctx, [...OPERATIONAL_CONTROL_AVAILABLE_KEYS], {
      at: input.referenceAt,
      controlPlaneActive,
      stateRows: allStateRows,
    }),
    resolveOperationalControls(ctx, [...OPERATIONAL_CONTROL_AVAILABLE_KEYS], {
      at: input.referenceAt,
      controlPlaneActive,
      stateRows: simulatedRows,
    }),
  ]);
  const beforeByKey = new Map(beforeResolutions.map((resolution) => [resolution.key, resolution]));
  const afterByKey = new Map(afterResolutions.map((resolution) => [resolution.key, resolution]));
  const blockers: Array<{
    code: OperationalCutoverBlockerCode;
    key?: OperationalControlKey;
  }> = controlPlaneActive ? [] : [{ code: "control_plane_inactive" }];

  for (const change of input.changes) {
    const inspected = inspectedByKey.get(change.key);
    if (inspected?.duplicate) {
      blockers.push({ code: "duplicate_state", key: change.key });
      continue;
    }
    const current = inspected?.current;
    if (!current) {
      blockers.push({ code: "missing_state", key: change.key });
      continue;
    }
    if (current.revision !== change.expectedRevision) {
      blockers.push({ code: "stale_revision", key: change.key });
    }
    if (
      current.state === "safe_default" ||
      (current.expiresAt !== undefined && current.expiresAt <= input.referenceAt)
    ) {
      blockers.push({ code: "unsafe_state", key: change.key });
    }
    const ownerBlocker = rollbackOwnerBlocker(
      change.key,
      current,
      ownerByKey.get(change.key) ?? null
    );
    if (ownerBlocker) {
      blockers.push({ code: ownerBlocker, key: change.key });
    }
  }

  const items = input.changes.map((change) => {
    const inspected = inspectedByKey.get(change.key);
    const before = cutoverSnapshot(inspected?.current ?? null);
    const after = afterByKey.get(change.key);
    return {
      after: { state: change.state },
      blockedByAfter: after?.blockedBy ?? [],
      currentRevision: inspected?.current?.revision ?? 0,
      dependencies: [...catalogEntry(change.key).dependencies],
      effectiveEnabledAfter: after?.enabled ?? false,
      expectedRevision: change.expectedRevision,
      key: change.key,
      rollback: before,
    };
  });
  const effects = OPERATIONAL_CONTROL_AVAILABLE_KEYS.flatMap((key) => {
    const before = beforeByKey.get(key);
    const after = afterByKey.get(key);
    if (!(before && after)) {
      return [];
    }
    const changed =
      requestedKeys.has(key) ||
      before.enabled !== after.enabled ||
      before.reason !== after.reason ||
      !sameControlKeys(before.blockedBy, after.blockedBy);
    return changed
      ? [
          {
            afterEnabled: after.enabled,
            beforeEnabled: before.enabled,
            blockedByAfter: after.blockedBy,
            key,
          },
        ]
      : [];
  });
  return {
    blockers,
    effects,
    items,
    ready: blockers.length === 0,
    referenceAt: input.referenceAt,
    restorationAfterMs: input.restorationAfterMs,
    undoAvailableAfterApply: true,
  };
}

export async function operationalEffectReceiptForId(ctx: ControlDbCtx, effectId: string) {
  const rows = await ctx.db
    .query("operationalEffectReceipts")
    .withIndex("by_effectId", (query) => query.eq("effectId", effectId))
    .take(2);
  if (rows.length > 1) {
    throw new ConvexError("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");
  }
  return rows[0] ?? null;
}

async function recordOperationalEffectOnce(
  ctx: MutationCtx,
  input: {
    control: ResolvedOperationalControl;
    disposition: Doc<"operationalEffectReceipts">["disposition"];
    effectId: string;
    entityId?: string;
    entityType?: string;
    payloadFingerprint?: string;
    recipientCount?: number;
    reasonOverride?: Doc<"operationalEffectReceipts">["reason"];
  }
): Promise<OperationalEffectReceiptResult> {
  const reason = input.reasonOverride ?? input.control.reason;
  const existing = await operationalEffectReceiptForId(ctx, input.effectId);
  if (existing) {
    const compatible =
      existing.controlKey === input.control.key &&
      existing.entityId === input.entityId &&
      existing.entityType === input.entityType &&
      (existing.payloadFingerprint === undefined ||
        existing.payloadFingerprint === input.payloadFingerprint);
    if (!compatible) {
      throw new ConvexError("OPERATIONAL_EFFECT_RECEIPT_CONFLICT");
    }
    const { _creationTime: _ignoredCreationTime, _id, ...receipt } = existing;
    return { id: _id, receipt, replayed: true };
  }
  const receipt = {
    controlKey: input.control.key,
    createdAt: Date.now(),
    disposition: input.disposition,
    effectId: input.effectId,
    entityId: input.entityId,
    entityType: input.entityType,
    payloadFingerprint: input.payloadFingerprint,
    reason,
    recipientCount: input.recipientCount,
  };
  const id = await ctx.db.insert("operationalEffectReceipts", receipt);
  return { id, receipt, replayed: false };
}

export async function recordOperationalEffect(
  ctx: MutationCtx,
  input: Parameters<typeof recordOperationalEffectOnce>[1]
) {
  let runs = effectReceiptRuns.get(ctx);
  if (!runs) {
    runs = new Map();
    effectReceiptRuns.set(ctx, runs);
  }
  const previous = runs.get(input.effectId);
  const current = (previous ?? Promise.resolve())
    .catch(() => undefined)
    .then(async () => await recordOperationalEffectOnce(ctx, input));
  runs.set(input.effectId, current);
  try {
    return await current;
  } finally {
    if (runs.get(input.effectId) === current) {
      runs.delete(input.effectId);
    }
  }
}

export function publicStoredState(state: StoredState) {
  return state;
}
