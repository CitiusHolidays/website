import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export const operationalControlKeyValidator = v.union(
  v.literal("ai.concierge"),
  v.literal("ai.journey_planner"),
  v.literal("email.auth"),
  v.literal("email.crm_workflow"),
  v.literal("files.document_preview_worker"),
  v.literal("inbound.crm_intake"),
  v.literal("inbound.info_mailbox_email"),
  v.literal("inbound.sales_bell"),
  v.literal("inbound.sales_email"),
  v.literal("jobs.scheduled"),
  v.literal("notifications.crm_bell"),
  v.literal("payments.razorpay")
);

export type OperationalControlKey =
  | "ai.concierge"
  | "ai.journey_planner"
  | "email.auth"
  | "email.crm_workflow"
  | "files.document_preview_worker"
  | "inbound.crm_intake"
  | "inbound.info_mailbox_email"
  | "inbound.sales_bell"
  | "inbound.sales_email"
  | "jobs.scheduled"
  | "notifications.crm_bell"
  | "payments.razorpay";

export const operationalControlStateValidator = v.union(
  v.literal("default"),
  v.literal("enabled"),
  v.literal("disabled")
);

export const operationalTestScopeValidator = v.literal("inbound_contact");

export type OperationalTestScope = "inbound_contact";

export interface OperationalControlCatalogEntry {
  availability: "available" | "unavailable";
  category: "AI" | "Authentication" | "Contact" | "CRM" | "Infrastructure" | "Payments";
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
    description: "Send verification, password reset, and staff setup email through Resend.",
    enforcement: "Transactional authentication email delivery",
    key: "email.auth",
    label: "Authentication email",
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
    key: "payments.razorpay",
    label: "Razorpay payments",
    standardEnabled: true,
  },
  {
    availability: "unavailable",
    category: "Infrastructure",
    dependencies: [],
    description: "Pause recurring background maintenance jobs.",
    enforcement: "Not yet enforced",
    key: "jobs.scheduled",
    label: "Scheduled jobs",
    standardEnabled: true,
    unavailableReason: "The current cron registrations do not share one reversible execution seam.",
  },
  {
    availability: "available",
    category: "Infrastructure",
    dependencies: [],
    description: "Allow first-party document preview worker preparation.",
    enforcement: "Document Preview preparation transaction plus existing rollout setting",
    key: "files.document_preview_worker",
    label: "Document preview worker",
    standardEnabled: true,
  },
] as const satisfies readonly OperationalControlCatalogEntry[];

const CATALOG_BY_KEY = new Map(
  OPERATIONAL_CONTROL_CATALOG.map((entry) => [entry.key, entry] as const)
);

const SAFE_ENABLED_KEYS = new Set<OperationalControlKey>(["inbound.crm_intake"]);
const OPERATIONAL_TEST_TOKEN_PATTERN = /^oct_[a-f0-9]{64}$/;

const TEST_SCOPE_KEYS: Record<OperationalTestScope, ReadonlySet<OperationalControlKey>> = {
  inbound_contact: new Set([
    "email.crm_workflow",
    "inbound.crm_intake",
    "inbound.info_mailbox_email",
    "inbound.sales_bell",
    "inbound.sales_email",
    "notifications.crm_bell",
  ]),
};

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
  | "prerequisite_disabled"
  | "test_override";

export interface ResolvedOperationalControl {
  blockedBy: OperationalControlKey[];
  enabled: boolean;
  key: OperationalControlKey;
  reason: ResolutionReason;
  testSessionId?: Id<"operationalControlTestSessions">;
}

export interface OperationalTestContext {
  scope: OperationalTestScope;
  synthetic: true;
  token: string;
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

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function operationalTestTokenHash(token: string) {
  return hex(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
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

export function assertTestScopeKeys(scope: OperationalTestScope, keys: OperationalControlKey[]) {
  const allowed = TEST_SCOPE_KEYS[scope];
  if (
    keys.length === 0 ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !allowed.has(key))
  ) {
    throw new ConvexError("INVALID_OPERATIONAL_TEST_SCOPE");
  }
  for (const key of keys) {
    assertAvailableControl(key);
  }
}

async function stateRows(ctx: ControlDbCtx, key: OperationalControlKey) {
  return await ctx.db
    .query("operationalControlStates")
    .withIndex("by_key", (query) => query.eq("key", key))
    .take(2);
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
      enabled: catalogEntry(key).standardEnabled,
      reason: "configured_default" as const,
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

async function requireTestSession(ctx: ControlDbCtx, test: OperationalTestContext, at: number) {
  assertOperationalTestToken(test.token);
  const tokenHash = await operationalTestTokenHash(test.token);
  const sessions = await ctx.db
    .query("operationalControlTestSessions")
    .withIndex("by_tokenHash", (query) => query.eq("tokenHash", tokenHash))
    .take(2);
  const session = sessions.length === 1 ? sessions[0] : null;
  if (
    !session ||
    session.revokedAt !== undefined ||
    session.expiresAt <= at ||
    session.scope !== test.scope
  ) {
    throw new ConvexError("INVALID_OPERATIONAL_TEST_OVERRIDE");
  }
  return session;
}

export async function resolveOperationalControls(
  ctx: ControlDbCtx,
  keys: OperationalControlKey[],
  options: { at: number; test?: OperationalTestContext }
) {
  const requested = Array.from(new Set(keys));
  for (const key of requested) {
    assertAvailableControl(key);
  }
  const testSession = options.test ? await requireTestSession(ctx, options.test, options.at) : null;
  if (options.test) {
    assertTestScopeKeys(options.test.scope, requested);
  }
  const testOverrides = new Map(testSession?.overrides.map((entry) => [entry.key, entry.state]));
  const allKeys = new Set<OperationalControlKey>(requested);
  for (const key of requested) {
    for (const dependency of catalogEntry(key).dependencies) {
      allKeys.add(dependency);
    }
  }
  const base = new Map<OperationalControlKey, { enabled: boolean; reason: ResolutionReason }>(
    await Promise.all(
      Array.from(allKeys).map(async (key) => {
        const override = testOverrides.get(key);
        const resolution = override
          ? ({ enabled: override === "enabled", reason: "test_override" } as const)
          : resolveStoredState(key, await stateRows(ctx, key), options.at);
        return [key, resolution] as const;
      })
    )
  );
  return requested.map((key): ResolvedOperationalControl => {
    const resolved = base.get(key) ?? {
      enabled: catalogEntry(key).standardEnabled,
      reason: "configured_default" as const,
    };
    const blockedBy = catalogEntry(key).dependencies.filter(
      (dependency) => !base.get(dependency)?.enabled
    );
    return {
      blockedBy,
      enabled: resolved.enabled && blockedBy.length === 0,
      key,
      reason: blockedBy.length > 0 ? "prerequisite_disabled" : resolved.reason,
      ...(testSession ? { testSessionId: testSession._id } : {}),
    };
  });
}

export async function resolveOperationalControl(
  ctx: ControlDbCtx,
  key: OperationalControlKey,
  options: { at: number; test?: OperationalTestContext }
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
    synthetic?: boolean;
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
        existing.payloadFingerprint === input.payloadFingerprint) &&
      existing.synthetic === (input.synthetic ?? false);
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
    synthetic: input.synthetic ?? false,
    testSessionId: input.control.testSessionId,
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

export function assertOperationalTestToken(token: string) {
  if (!OPERATIONAL_TEST_TOKEN_PATTERN.test(token)) {
    throw new ConvexError("INVALID_OPERATIONAL_TEST_TOKEN");
  }
}

export async function operationalTestTokenForCommand(
  commandId: string,
  actorId: string,
  scope: OperationalTestScope
) {
  const secret = process.env.OPERATIONAL_CONTROL_TEST_SIGNING_SECRET?.trim();
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new ConvexError("OPERATIONAL_CONTROL_TEST_SIGNING_UNAVAILABLE");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${commandId}:${actorId}:${scope}`)
  );
  return `oct_${hex(signature)}`;
}

export function publicStoredState(state: StoredState) {
  return state;
}
