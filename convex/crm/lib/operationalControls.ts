import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export const operationalControlKeyValidator = v.union(
  v.literal("ai.concierge"),
  v.literal("ai.journey_planner"),
  v.literal("email.auth.password_reset"),
  v.literal("email.auth.staff_setup"),
  v.literal("email.auth.verification"),
  v.literal("email.crm_workflow"),
  v.literal("files.document_preview_preparation"),
  v.literal("inbound.crm_intake"),
  v.literal("inbound.info_mailbox_email"),
  v.literal("inbound.sales_bell"),
  v.literal("inbound.sales_email"),
  v.literal("jobs.check_cl_sl_leave_lapse"),
  v.literal("jobs.cleanup_ai_runtime"),
  v.literal("jobs.cleanup_passenger_exports"),
  v.literal("jobs.cleanup_portal_rate_limits"),
  v.literal("jobs.cleanup_sacred_bharat_rate_limits"),
  v.literal("jobs.purge_commercial_files"),
  v.literal("jobs.reconcile_crm_metrics"),
  v.literal("jobs.reconcile_list_search"),
  v.literal("jobs.reconcile_proposal_links"),
  v.literal("jobs.reconcile_proposal_relations"),
  v.literal("jobs.reconcile_query_commercial"),
  v.literal("jobs.run_workflow_nudges"),
  v.literal("notifications.crm_bell"),
  v.literal("payments.razorpay_new_order"),
  v.literal("public.sacred_bharat_001")
);

export type OperationalControlKey =
  | "ai.concierge"
  | "ai.journey_planner"
  | "email.auth.password_reset"
  | "email.auth.staff_setup"
  | "email.auth.verification"
  | "email.crm_workflow"
  | "files.document_preview_preparation"
  | "inbound.crm_intake"
  | "inbound.info_mailbox_email"
  | "inbound.sales_bell"
  | "inbound.sales_email"
  | "jobs.check_cl_sl_leave_lapse"
  | "jobs.cleanup_ai_runtime"
  | "jobs.cleanup_passenger_exports"
  | "jobs.cleanup_portal_rate_limits"
  | "jobs.cleanup_sacred_bharat_rate_limits"
  | "jobs.purge_commercial_files"
  | "jobs.reconcile_crm_metrics"
  | "jobs.reconcile_list_search"
  | "jobs.reconcile_proposal_links"
  | "jobs.reconcile_proposal_relations"
  | "jobs.reconcile_query_commercial"
  | "jobs.run_workflow_nudges"
  | "notifications.crm_bell"
  | "payments.razorpay_new_order"
  | "public.sacred_bharat_001";

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
  dependencies: OperationalControlKey[];
  description: string;
  enforcement: string;
  key: OperationalControlKey;
  label: string;
  standardEnabled: boolean;
  unavailableReason?: string;
}

export const OPERATIONAL_CONTROL_CATALOG = [
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
    availability: "available",
    category: "AI",
    dependencies: [],
    description: "Allow server-side Sacred Bharat Journey Planner requests.",
    enforcement: "Operational Control server gateway",
    key: "ai.journey_planner",
    label: "Journey Planner",
    standardEnabled: true,
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
] as const satisfies readonly OperationalControlCatalogEntry[];

const CATALOG_BY_KEY = new Map(
  OPERATIONAL_CONTROL_CATALOG.map((entry) => [entry.key, entry] as const)
);

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
