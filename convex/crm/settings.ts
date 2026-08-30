import {
  makeFunctionReference,
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { SCHEDULED_JOBS, scheduledJobControlKey } from "../operationalScheduledJobs";
import { requireOperationalAdmin } from "./lib/operationalAdminAccess";
import {
  assertAvailableControl,
  inspectOperationalControlState,
  inspectOperationalControlStateFromRows,
  isLegacyOperationalControlKey,
  isOperationalControlPlaneActive,
  LEGACY_OPERATIONAL_CONTROL_KEYS,
  LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS,
  OPERATIONAL_CONTROL_CATALOG,
  type OperationalControlKey,
  operationalControlKeyValidator,
  operationalControlStateValidator,
  recordOperationalEffect,
  resolveOperationalControls,
} from "./lib/operationalControls";
import {
  assertOperationalTargetIdentity,
  operationalTargetIdentity,
} from "./lib/operationalTargetIdentity";
import { PERMISSIONS } from "./lib/rolePolicy";
import {
  composeRuntimeHealth,
  RUNTIME_HEALTH_LIST_TABLES,
  runtimeHealthResultValidator,
} from "./lib/runtimeHealth";
import { requireStaff } from "./lib/staffAccess";
import { boundedPaginationOptions } from "./paginationPolicy";
import {
  clearPresetsResultValidator,
  dropdownsResultValidator,
  nullableDropdownIdResultValidator,
} from "./staffSettingsReturnContracts";

const DROPDOWNS = {
  callingStatus: ["Pending", "Done", "No response"],
  contractingStatus: [
    "Query Received",
    "Proposal in progress",
    "Proposal sent",
    "Change in destination",
    "Date/Destination Change Required",
    "Order Confirmed",
  ],
  foodPreference: ["Veg", "Non-Veg", "Jain", "Vegan"],
  guestType: ["Employee", "Client", "VIP"],
  lostReason: ["Price", "Competition", "Not travelling", "Other"],
  paymentType: ["Company Paid", "Self Paid", "Upgraded Self Paid"],
  queryType: [
    "MICE",
    "MICE Bidding",
    "Cement",
    "Cement Bidding",
    "FIT",
    "Family Group",
    "B2B",
    "Spiritual",
  ],
  roomType: ["Single", "Twin", "Double", "Triple", "Child with Bed", "Family Room"],
  salesStatus: [
    "Proposal in discussion",
    "Change in destination",
    "Date/Destination Change Required",
    "Order Confirmed",
    "Order Lost",
  ],
  ticketStatus: [
    "Pending Issue",
    "Issued",
    "Name Change Required",
    "Reissue Required",
    "Cancelled",
    "Refund Pending",
    "Refunded",
  ],
  travelType: ["Domestic Travel", "International Travel"],
  visaStatus: [
    "Not Required",
    "Not Started",
    "Checklist Shared",
    "Documents Pending",
    "Documents Verified",
    "Appointment Scheduled",
    "Submitted",
    "Awaiting",
    "Approved",
    "Rejected",
    "Re-applied",
  ],
} satisfies Record<string, string[]>;

const PRESET_TABLES = ["roleDefinitions", "dropdownOptions", "paymentTerms"] as const;
const RETIRED_COARSE_OPERATIONAL_KEYS = LEGACY_OPERATIONAL_CONTROL_KEYS;
const legacyOperationalControlKeyValidator = v.union(
  v.literal("email.auth"),
  v.literal("files.document_preview_worker"),
  v.literal("jobs.scheduled"),
  v.literal("payments.razorpay")
);
const gatewayOperationalControlKeyValidator = v.union(
  operationalControlKeyValidator,
  legacyOperationalControlKeyValidator
);
type PresetTable = (typeof PRESET_TABLES)[number];

const persistedOperationalControlStateValidator = v.union(
  operationalControlStateValidator,
  v.literal("safe_default")
);
const operationalControlSourceValidator = v.union(
  v.literal("configured_default"),
  v.literal("corrupt_safe_default"),
  v.literal("explicit_disabled"),
  v.literal("explicit_enabled"),
  v.literal("expired_safe_default"),
  v.literal("missing_safe_default"),
  v.literal("pre_activation_standard"),
  v.literal("prerequisite_disabled"),
  v.literal("unavailable")
);
const operationalEffectReasonValidator = v.union(
  v.literal("configured_default"),
  v.literal("corrupt_safe_default"),
  v.literal("explicit_disabled"),
  v.literal("explicit_enabled"),
  v.literal("expired_safe_default"),
  v.literal("missing_safe_default"),
  v.literal("no_recipients"),
  v.literal("pre_activation_standard"),
  v.literal("prerequisite_disabled"),
  v.literal("test_override")
);
const operationalResolutionReasonValidator = v.union(
  v.literal("configured_default"),
  v.literal("corrupt_safe_default"),
  v.literal("explicit_disabled"),
  v.literal("explicit_enabled"),
  v.literal("expired_safe_default"),
  v.literal("missing_safe_default"),
  v.literal("pre_activation_standard"),
  v.literal("prerequisite_disabled")
);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertCommandId(commandId: string) {
  if (!UUID_PATTERN.test(commandId)) {
    throw new ConvexError("INVALID_OPERATIONAL_CONTROL_COMMAND");
  }
}

function normalizedReason(reason: string) {
  const value = reason.trim();
  if (value.length === 0) {
    throw new ConvexError("OPERATIONAL_CONTROL_REASON_REQUIRED");
  }
  return value;
}

interface OperationalControlSnapshot {
  expiresAt?: number;
  state: "default" | "enabled" | "disabled" | "safe_default";
}

interface OperationalChangeRequest {
  expectedRevision: number;
  key: OperationalControlKey;
  state: "default" | "disabled" | "enabled";
}

const OPERATIONAL_RESTORATION_DELAYS_MS = [
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;
const LEGACY_RESTORATION_CLOCK_SKEW_MS = 5 * 60 * 1000;

function resolveRestorationDelayMs(
  restorationAfterMs: number | null | undefined,
  legacyRestorationAt: number | null | undefined,
  referenceNow: number
) {
  if (restorationAfterMs !== undefined) {
    if (legacyRestorationAt !== undefined) {
      throw new ConvexError("INVALID_OPERATIONAL_CONTROL_EXPIRY");
    }
    return restorationAfterMs;
  }
  if (legacyRestorationAt === null) {
    return null;
  }
  if (legacyRestorationAt === undefined || !Number.isFinite(legacyRestorationAt)) {
    throw new ConvexError("INVALID_OPERATIONAL_CONTROL_EXPIRY");
  }
  const requestedDelay = legacyRestorationAt - referenceNow;
  const matchedDelay = OPERATIONAL_RESTORATION_DELAYS_MS.find(
    (delay) => Math.abs(delay - requestedDelay) <= LEGACY_RESTORATION_CLOCK_SKEW_MS
  );
  if (matchedDelay === undefined) {
    throw new ConvexError("INVALID_OPERATIONAL_CONTROL_EXPIRY");
  }
  return matchedDelay;
}

function assertValidOperationalChangeRequest(
  changes: OperationalChangeRequest[],
  restorationAfterMs: number | null
) {
  if (
    changes.length === 0 ||
    changes.length > OPERATIONAL_CONTROL_CATALOG.length ||
    new Set(changes.map((change) => change.key)).size !== changes.length
  ) {
    throw new ConvexError("INVALID_OPERATIONAL_CHANGE_SET");
  }
  for (const change of changes) {
    assertAvailableControl(change.key);
  }
  if (
    restorationAfterMs !== null &&
    !OPERATIONAL_RESTORATION_DELAYS_MS.some((delay) => delay === restorationAfterMs)
  ) {
    throw new ConvexError("INVALID_OPERATIONAL_CONTROL_EXPIRY");
  }
}

function snapshotState(row: OperationalControlSnapshot | null): OperationalControlSnapshot {
  if (!row) {
    return { state: "default" };
  }
  const snapshot: OperationalControlSnapshot = { state: row.state };
  if (row.expiresAt !== undefined) {
    snapshot.expiresAt = row.expiresAt;
  }
  return snapshot;
}

async function auditForCommand(ctx: MutationCtx, commandId: string) {
  const rows = await ctx.db
    .query("operationalControlAuditEvents")
    .withIndex("by_commandId", (index) => index.eq("commandId", commandId))
    .take(2);
  if (rows.length > 1) {
    throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
  }
  return rows[0] ?? null;
}

async function stateForMutation(ctx: MutationCtx, key: string) {
  const rows = await ctx.db
    .query("operationalControlStates")
    .withIndex("by_key", (index) => index.eq("key", key))
    .take(2);
  if (rows.length > 1) {
    throw new ConvexError("CORRUPT_OPERATIONAL_CONTROL");
  }
  return rows[0] ?? null;
}

async function loadValidatedOperationalChangeRows(
  ctx: MutationCtx,
  changes: OperationalChangeRequest[]
) {
  const currentRows = await Promise.all(
    changes.map(async (change) => ({
      change,
      current: await stateForMutation(ctx, change.key),
    }))
  );
  const owners = await Promise.all(
    currentRows.map(({ current }) =>
      current?.changeSetId
        ? ctx.db.get("operationalControlChangeSets", current.changeSetId)
        : Promise.resolve(null)
    )
  );
  currentRows.forEach(({ change, current }, index) => {
    if ((current?.revision ?? 0) !== change.expectedRevision) {
      throw new ConvexError("STALE_OPERATIONAL_CHANGE_SET");
    }
    if (!current) {
      throw new ConvexError("OPERATIONAL_CONTROL_RELEASE_SETUP_REQUIRED");
    }
    const owner = owners[index];
    if (owner?.status === "applied" && owner.restorationAt !== undefined) {
      throw new ConvexError("OPERATIONAL_CONTROL_TEMPORARY_CHANGE_ACTIVE");
    }
  });
  return currentRows;
}

async function currentStateForKey(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  key: OperationalControlKey
) {
  const rows = await ctx.db
    .query("operationalControlStates")
    .withIndex("by_key", (index) => index.eq("key", key))
    .take(2);
  return rows.length === 1 ? rows[0] : null;
}

async function latestUndoableChangeSetId(ctx: Pick<QueryCtx | MutationCtx, "db">) {
  const [changeSet] = await ctx.db
    .query("operationalControlChangeSets")
    .withIndex("by_appliedAt")
    .order("desc")
    .take(1);
  if (changeSet?.status !== "applied") {
    return null;
  }
  const currentRows = await Promise.all(
    changeSet.changes.map((change) =>
      isOperationalControlKey(change.key)
        ? currentStateForKey(ctx, change.key)
        : Promise.resolve(null)
    )
  );
  return currentRows.length === changeSet.changes.length &&
    currentRows.every(
      (current, index) =>
        current?.changeSetId === changeSet._id &&
        current.revision === changeSet.changes[index]?.appliedRevision
    )
    ? changeSet._id
    : null;
}

async function operationalControlPlaneRows(ctx: MutationCtx) {
  return await ctx.db
    .query("operationalControlPlaneState")
    .withIndex("by_key", (index) => index.eq("key", "global"))
    .take(2);
}

async function operationalControlPlanePreparation(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  at: number
) {
  const available = OPERATIONAL_CONTROL_CATALOG.filter(
    (entry) => entry.availability === "available"
  );
  const inspections = await Promise.all(
    available.map(async (entry) => ({
      entry,
      inspected: await inspectOperationalControlState(ctx, entry.key, at),
    }))
  );
  const blockingKeys: OperationalControlKey[] = [];
  const willInitializeKeys: OperationalControlKey[] = [];
  for (const { entry, inspected } of inspections) {
    if (inspected.duplicate) {
      blockingKeys.push(entry.key);
      continue;
    }
    const { current } = inspected;
    if (!current) {
      willInitializeKeys.push(entry.key);
      continue;
    }
    if (
      current.state === "safe_default" ||
      (current.expiresAt !== undefined && current.expiresAt <= at)
    ) {
      blockingKeys.push(entry.key);
    }
  }
  return { blockingKeys, willInitializeKeys };
}

function assertGatewaySecret(secret: string) {
  const expected = process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET?.trim();
  if (!(expected && secret === expected)) {
    throw new ConvexError("FORBIDDEN");
  }
}

function isOperationalControlKey(value: string): value is OperationalControlKey {
  return OPERATIONAL_CONTROL_CATALOG.some((entry) => entry.key === value);
}

const operationalControlPlaneActivationResultValidator = v.object({
  auditEventId: v.id("operationalControlAuditEvents"),
  initializedControlKeys: v.array(operationalControlKeyValidator),
  replayed: v.boolean(),
  revision: v.number(),
});
const operationalChangeValidator = v.object({
  expectedRevision: v.number(),
  key: operationalControlKeyValidator,
  state: operationalControlStateValidator,
});
const operationalChangeSetMutationResultValidator = v.object({
  auditEventId: v.id("operationalControlAuditEvents"),
  changeSetId: v.id("operationalControlChangeSets"),
  replayed: v.boolean(),
});
const operationalApplyChangeSetMutationResultValidator = v.object({
  auditEventId: v.id("operationalControlAuditEvents"),
  changeSetId: v.id("operationalControlChangeSets"),
  replayed: v.boolean(),
  restorationAt: v.union(v.number(), v.null()),
});
const operationalStateSnapshotValidator = v.object({
  expiresAt: v.optional(v.number()),
  state: persistedOperationalControlStateValidator,
});
const operationalChangeSetHistoryValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("operationalControlChangeSets"),
  appliedAt: v.number(),
  appliedByName: v.string(),
  auditEventId: v.id("operationalControlAuditEvents"),
  changeCount: v.number(),
  changes: v.array(
    v.object({
      after: v.object({ state: operationalControlStateValidator }),
      before: operationalStateSnapshotValidator,
      key: operationalControlKeyValidator,
    })
  ),
  reason: v.string(),
  resolutionAuditEventId: v.optional(v.id("operationalControlAuditEvents")),
  resolutionReason: v.optional(v.string()),
  resolvedByName: v.optional(v.string()),
  restorationAt: v.optional(v.number()),
  restoredAt: v.optional(v.number()),
  status: v.union(
    v.literal("applied"),
    v.literal("restoration_failed"),
    v.literal("restored"),
    v.literal("undone")
  ),
  targetDeployment: v.string(),
  targetEnvironment: v.string(),
  targetRevision: v.string(),
  undoAvailable: v.boolean(),
});

const operationalControlResolutionValidator = v.object({
  blockedBy: v.array(operationalControlKeyValidator),
  enabled: v.boolean(),
  key: operationalControlKeyValidator,
  reason: operationalEffectReasonValidator,
});
const gatewayOperationalControlResolutionValidator = v.object({
  blockedBy: v.array(operationalControlKeyValidator),
  enabled: v.boolean(),
  key: gatewayOperationalControlKeyValidator,
  reason: operationalEffectReasonValidator,
});
const operationalAuditEventValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("operationalControlAuditEvents"),
  action: v.union(
    v.literal("global_set"),
    v.literal("global_rollback"),
    v.literal("test_created"),
    v.literal("test_revoked"),
    v.literal("change_set_applied"),
    v.literal("change_set_restoration_failed"),
    v.literal("change_set_restored"),
    v.literal("change_set_undone"),
    v.literal("catalog_migrated"),
    v.literal("plane_activated")
  ),
  actorId: v.string(),
  actorName: v.string(),
  changeSetId: v.optional(v.id("operationalControlChangeSets")),
  changes: v.array(
    v.object({
      after: v.object({ state: operationalControlStateValidator }),
      before: operationalStateSnapshotValidator,
      key: operationalControlKeyValidator,
    })
  ),
  commandId: v.string(),
  createdAt: v.number(),
  initializedControlKeys: v.optional(v.array(operationalControlKeyValidator)),
  reason: v.string(),
  revision: v.optional(v.number()),
  targetDeployment: v.string(),
  targetEnvironment: v.string(),
  targetRevision: v.string(),
});
const operationalEffectReceiptValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("operationalEffectReceipts"),
  controlKey: v.string(),
  createdAt: v.number(),
  disposition: v.union(
    v.literal("created"),
    v.literal("duplicate"),
    v.literal("failed"),
    v.literal("not_applicable"),
    v.literal("queued"),
    v.literal("suppressed"),
    v.literal("throttled")
  ),
  effectId: v.string(),
  entityId: v.optional(v.string()),
  entityType: v.optional(v.string()),
  payloadFingerprint: v.optional(v.string()),
  reason: operationalEffectReasonValidator,
  recipientCount: v.optional(v.number()),
});

const restoreOperationalChangeSetRef = makeFunctionReference<
  "mutation",
  { changeSetId: Id<"operationalControlChangeSets"> },
  {
    auditEventId?: Id<"operationalControlAuditEvents">;
    changeSetId: Id<"operationalControlChangeSets">;
    replayed: boolean;
    status: "restoration_failed" | "restored" | "undone";
  }
>("crm/settings:restoreOperationalChangeSet");

function sameChangeSetInput(
  stored: {
    appliedAt: number;
    changes: Array<{ after: { state: string }; beforeRevision: number; key: string }>;
    reason: string;
    restorationAt?: number;
  },
  input: {
    changes: Array<{ expectedRevision: number; key: string; state: string }>;
    reason: string;
    restorationAfterMs: number | null;
  }
) {
  const storedRestorationAfterMs =
    stored.restorationAt === undefined ? null : stored.restorationAt - stored.appliedAt;
  return (
    stored.reason === input.reason &&
    storedRestorationAfterMs === input.restorationAfterMs &&
    JSON.stringify(
      stored.changes.map((change) => ({
        expectedRevision: change.beforeRevision,
        key: change.key,
        state: change.after.state,
      }))
    ) === JSON.stringify(input.changes)
  );
}

async function deletePresetTable<TableName extends PresetTable>(
  ctx: MutationCtx,
  table: TableName
) {
  const rows = await ctx.db.query(table).collect();
  await Promise.all(rows.map((row) => ctx.db.delete(table, row._id)));
  return rows.length;
}

function operationalStateForList(state: string | undefined, duplicate: boolean) {
  if (duplicate) {
    return "corrupt" as const;
  }
  switch (state) {
    case "default":
    case "disabled":
    case "enabled":
    case "safe_default":
      return state;
    default:
      return "missing" as const;
  }
}

function configuredStateForList(
  state: string | undefined,
  duplicate: boolean,
  expiresAt: number | undefined,
  at: number
) {
  if (duplicate || state === "safe_default" || (expiresAt !== undefined && expiresAt <= at)) {
    return "unavailable" as const;
  }
  if (state === "disabled") {
    return "paused" as const;
  }
  if (state === "enabled") {
    return "available" as const;
  }
  return "normal" as const;
}

async function deletePresetRows(ctx: MutationCtx) {
  const deleted = {
    dropdownOptions: 0,
    paymentTerms: 0,
    roleDefinitions: 0,
  };

  await Promise.all(
    PRESET_TABLES.map(async (table) => {
      deleted[table] = await deletePresetTable(ctx, table);
    })
  );

  return { deleted };
}

export const listDropdowns = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return DROPDOWNS;
  },
  returns: dropdownsResultValidator,
});

export const getOperationalControlPlaneStatus = internalQuery({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    const activationRows = await ctx.db
      .query("operationalControlPlaneState")
      .withIndex("by_key", (index) => index.eq("key", "global"))
      .take(2);
    const active = await isOperationalControlPlaneActive(ctx);
    const preparation = await operationalControlPlanePreparation(ctx, args.at);
    const blockingKeys: string[] = [...preparation.blockingKeys];
    if (activationRows.length > 1) {
      blockingKeys.push("control_plane");
    }
    const [activation] = activationRows;
    return {
      activatedAt: activation?.activatedAt,
      activatedByName: activation?.activatedByName,
      active,
      blockingKeys,
      ready: !active && blockingKeys.length === 0,
      revision: activation?.revision ?? 0,
      willInitializeKeys: preparation.willInitializeKeys,
    };
  },
  returns: v.object({
    activatedAt: v.optional(v.number()),
    activatedByName: v.optional(v.string()),
    active: v.boolean(),
    blockingKeys: v.array(v.string()),
    ready: v.boolean(),
    revision: v.number(),
    willInitializeKeys: v.array(operationalControlKeyValidator),
  }),
});

export const activateOperationalControlPlane = internalMutation({
  args: {
    commandId: v.string(),
    expectedRevision: v.number(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertCommandId(args.commandId);
    const reason = normalizedReason(args.reason);
    const target = assertOperationalTargetIdentity(args);
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (
        replay.action !== "plane_activated" ||
        replay.reason !== reason ||
        replay.revision === undefined
      ) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return {
        auditEventId: replay._id,
        initializedControlKeys: (replay.initializedControlKeys ?? []).filter(
          isOperationalControlKey
        ),
        replayed: true,
        revision: replay.revision,
      };
    }

    const activationRows = await operationalControlPlaneRows(ctx);
    const currentRevision = activationRows[0]?.revision ?? 0;
    if (args.expectedRevision !== currentRevision) {
      throw new ConvexError("STALE_OPERATIONAL_CONTROL_PLANE");
    }
    if (activationRows.length > 0) {
      throw new ConvexError(
        activationRows.length > 1
          ? "CORRUPT_OPERATIONAL_CONTROL_PLANE"
          : "OPERATIONAL_CONTROL_PLANE_ALREADY_ACTIVE"
      );
    }

    const now = Date.now();
    const preparation = await operationalControlPlanePreparation(ctx, now);
    if (preparation.blockingKeys.length > 0) {
      throw new ConvexError("OPERATIONAL_CONTROL_PLANE_NOT_READY");
    }
    const actorId = "release-setup";
    await Promise.all(
      preparation.willInitializeKeys.map(async (key) => {
        await ctx.db.insert("operationalControlStates", {
          key,
          reason: "Initialized atomically when the operational control plane was activated.",
          revision: 1,
          state: "default",
          updatedAt: now,
          updatedBy: actorId,
          updatedByName: "Release setup",
        });
      })
    );
    const revision = 1;
    await ctx.db.insert("operationalControlPlaneState", {
      activatedAt: now,
      activatedBy: actorId,
      activatedByName: "Release setup",
      key: "global",
      reason,
      revision,
    });
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "plane_activated",
      actorId,
      actorName: "Release setup",
      commandId: args.commandId,
      createdAt: now,
      initializedControlKeys: preparation.willInitializeKeys,
      reason,
      revision,
      ...target,
    });
    return {
      auditEventId,
      initializedControlKeys: preparation.willInitializeKeys,
      replayed: false,
      revision,
    };
  },
  returns: operationalControlPlaneActivationResultValidator,
});

export const listOperationalControls = query({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    const [controlPlaneActive, stateRows] = await Promise.all([
      isOperationalControlPlaneActive(ctx),
      ctx.db.query("operationalControlStates").collect(),
    ]);
    const inspectedByKey = new Map(
      OPERATIONAL_CONTROL_CATALOG.map((entry) => [
        entry.key,
        inspectOperationalControlStateFromRows(stateRows, entry.key, args.at),
      ])
    );
    const changeSetIds = Array.from(
      new Set(
        Array.from(inspectedByKey.values()).flatMap((inspected) =>
          inspected.current?.changeSetId ? [inspected.current.changeSetId] : []
        )
      )
    );
    const changeSets = new Map(
      await Promise.all(
        changeSetIds.map(
          async (id) => [id, await ctx.db.get("operationalControlChangeSets", id)] as const
        )
      )
    );
    const availableKeys = OPERATIONAL_CONTROL_CATALOG.flatMap((entry) =>
      entry.availability === "available" ? [entry.key] : []
    );
    const resolvedByKey = new Map(
      (
        await resolveOperationalControls(ctx, availableKeys, {
          at: args.at,
          controlPlaneActive,
          stateRows,
        })
      ).map((resolved) => [resolved.key, resolved])
    );
    return OPERATIONAL_CONTROL_CATALOG.map((entry) => {
      const inspected =
        inspectedByKey.get(entry.key) ??
        inspectOperationalControlStateFromRows([], entry.key, args.at);
      const owningChangeSet = inspected.current?.changeSetId
        ? changeSets.get(inspected.current.changeSetId)
        : null;
      const resolved = resolvedByKey.get(entry.key) ?? null;
      const presentation =
        controlPlaneActive || !inspected.current
          ? resolved
          : {
              enabled: inspected.resolution.enabled,
              reason: inspected.resolution.reason,
            };
      return {
        availability: entry.availability,
        blockedBy: resolved?.blockedBy ?? [],
        category: entry.category,
        configuredState: configuredStateForList(
          inspected.current?.state,
          inspected.duplicate,
          inspected.current?.expiresAt,
          args.at
        ),
        dependencies: [...entry.dependencies],
        description: entry.description,
        effectiveEnabled: presentation?.enabled ?? null,
        enforcement: entry.enforcement,
        expiresAt:
          owningChangeSet?.status === "applied" && owningChangeSet.restorationAt !== undefined
            ? owningChangeSet.restorationAt
            : inspected.current?.expiresAt,
        key: entry.key,
        label: entry.label,
        revision: inspected.current?.revision ?? 0,
        source: presentation?.reason ?? ("unavailable" as const),
        standardEnabled: entry.standardEnabled,
        state: operationalStateForList(inspected.current?.state, inspected.duplicate),
        unavailableReason: undefined,
        updatedAt: inspected.current?.updatedAt,
        updatedByName: inspected.current?.updatedByName,
      };
    });
  },
  returns: v.array(
    v.object({
      availability: v.union(v.literal("available"), v.literal("unavailable")),
      blockedBy: v.array(operationalControlKeyValidator),
      category: v.union(
        v.literal("AI"),
        v.literal("Authentication"),
        v.literal("Contact"),
        v.literal("CRM"),
        v.literal("Infrastructure"),
        v.literal("Payments"),
        v.literal("Public")
      ),
      configuredState: v.union(
        v.literal("available"),
        v.literal("normal"),
        v.literal("paused"),
        v.literal("unavailable")
      ),
      dependencies: v.array(operationalControlKeyValidator),
      description: v.string(),
      effectiveEnabled: v.union(v.boolean(), v.null()),
      enforcement: v.string(),
      expiresAt: v.optional(v.number()),
      key: operationalControlKeyValidator,
      label: v.string(),
      revision: v.number(),
      source: operationalControlSourceValidator,
      standardEnabled: v.boolean(),
      state: v.union(
        persistedOperationalControlStateValidator,
        v.literal("missing"),
        v.literal("corrupt")
      ),
      unavailableReason: v.optional(v.string()),
      updatedAt: v.optional(v.number()),
      updatedByName: v.optional(v.string()),
    })
  ),
});

export const getOperationalControlTargetIdentity = query({
  args: {},
  handler: async (ctx) => {
    await requireOperationalAdmin(ctx);
    return operationalTargetIdentity();
  },
  returns: v.object({
    targetDeployment: v.string(),
    targetEnvironment: v.string(),
    targetRevision: v.string(),
  }),
});

export const getRuntimeHealth = query({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    operationalTargetIdentity();
    const controlKeys = SCHEDULED_JOBS.map(scheduledJobControlKey);
    const [
      controls,
      scheduledReceiptEntries,
      metricReadiness,
      metricDirty,
      listReadiness,
      listDirty,
      notificationUnreadReadiness,
      notificationEmailReadiness,
      proposalAttachmentReadiness,
      workflowNudgeRun,
    ] = await Promise.all([
      resolveOperationalControls(ctx, controlKeys, { at: args.at }),
      Promise.all(
        SCHEDULED_JOBS.map(async (job) => {
          const controlKey = scheduledJobControlKey(job);
          const receipt = await ctx.db
            .query("operationalEffectReceipts")
            .withIndex("by_controlKey_createdAt", (index) => index.eq("controlKey", controlKey))
            .order("desc")
            .first();
          return [job, receipt] as const;
        })
      ),
      ctx.db
        .query("crmMetricReadiness")
        .withIndex("by_key", (index) => index.eq("key", "global"))
        .unique(),
      ctx.db.query("crmMetricDirty").withIndex("by_updatedAt").first(),
      Promise.all(
        RUNTIME_HEALTH_LIST_TABLES.map(
          async (table) =>
            await ctx.db
              .query("crmListSearchReadiness")
              .withIndex("by_table", (index) => index.eq("table", table))
              .unique()
        )
      ),
      ctx.db.query("crmListSearchDirty").withIndex("by_updatedAt").first(),
      ctx.db
        .query("notificationUnreadProjectionReadiness")
        .withIndex("by_key", (index) => index.eq("key", "notificationUnread"))
        .unique(),
      ctx.db
        .query("notificationEmailSummaryReadiness")
        .withIndex("by_key", (index) => index.eq("key", "notificationEmailDeliveries"))
        .unique(),
      ctx.db
        .query("proposalAttachmentSummaryReadiness")
        .withIndex("by_key", (index) => index.eq("key", "proposalAttachments"))
        .unique(),
      ctx.db
        .query("portalWorkflowNudgeRuns")
        .withIndex("by_key", (index) => index.eq("key", "scheduled"))
        .unique(),
    ]);

    return composeRuntimeHealth({
      at: args.at,
      controls: new Map(controls.map((control) => [control.key, control])),
      listDirty,
      listReadiness,
      metricDirty,
      metricReadiness,
      notificationEmailReadiness,
      notificationUnreadReadiness,
      proposalAttachmentReadiness,
      scheduledReceipts: new Map(scheduledReceiptEntries),
      workflowNudgeRun,
    });
  },
  returns: runtimeHealthResultValidator,
});

/**
 * Release-only catalog setup. This is intentionally internal so expanding the
 * live catalog cannot be mistaken for an everyday Admin operation.
 */
export const migrateOperationalControlCatalog = internalMutation({
  args: {
    commandId: v.string(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertCommandId(args.commandId);
    const reason = normalizedReason(args.reason);
    const target = assertOperationalTargetIdentity(args);
    if (!(await isOperationalControlPlaneActive(ctx))) {
      throw new ConvexError("OPERATIONAL_CONTROL_RELEASE_SETUP_REQUIRED");
    }
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (replay.action !== "catalog_migrated" || replay.reason !== reason) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return {
        initializedControlKeys: (replay.initializedControlKeys ?? []).filter(
          isOperationalControlKey
        ),
        replayed: true,
      };
    }
    const now = Date.now();
    const retiredRows = await Promise.all(
      RETIRED_COARSE_OPERATIONAL_KEYS.map(async (retiredKey) => ({
        key: retiredKey,
        row: await stateForMutation(ctx, retiredKey),
      }))
    );
    const retiredByReplacement = new Map<
      OperationalControlKey,
      NonNullable<Awaited<ReturnType<typeof stateForMutation>>>
    >(
      retiredRows.flatMap(({ key, row }) =>
        row
          ? LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS[key].map(
              (replacementKey) => [replacementKey, row] as const
            )
          : []
      )
    );
    const catalogRows = await Promise.all(
      OPERATIONAL_CONTROL_CATALOG.map(async (entry) => ({
        direct: await stateForMutation(ctx, entry.key),
        entry,
      }))
    );
    const missingEntries = catalogRows.flatMap(({ direct, entry }) => (direct ? [] : [entry]));
    await Promise.all(
      missingEntries.map((entry) => {
        const retired = retiredByReplacement.get(entry.key);
        return ctx.db.insert("operationalControlStates", {
          expiresAt: retired?.expiresAt,
          key: entry.key,
          reason: retired?.reason ?? `Catalog migration: ${reason}`,
          revision: retired?.revision ?? 1,
          state: retired?.state ?? "default",
          updatedAt: retired?.updatedAt ?? now,
          updatedBy: retired?.updatedBy ?? "release-setup",
          updatedByName: retired?.updatedByName ?? "Release setup",
        });
      })
    );
    const initializedControlKeys = missingEntries.map((entry) => entry.key);
    await Promise.all(
      retiredRows.flatMap(({ row }) =>
        row ? [ctx.db.delete("operationalControlStates", row._id)] : []
      )
    );
    await ctx.db.insert("operationalControlAuditEvents", {
      action: "catalog_migrated",
      actorId: "release-setup",
      actorName: "Release setup",
      commandId: args.commandId,
      createdAt: now,
      initializedControlKeys,
      reason,
      ...target,
    });
    return { initializedControlKeys, replayed: false };
  },
  returns: v.object({
    initializedControlKeys: v.array(operationalControlKeyValidator),
    replayed: v.boolean(),
  }),
});

export const applyOperationalChangeSet = mutation({
  args: {
    changes: v.array(operationalChangeValidator),
    commandId: v.string(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    reason: v.string(),
    restorationAfterMs: v.optional(v.union(v.number(), v.null())),
    restorationAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const access = await requireOperationalAdmin(ctx);
    assertCommandId(args.commandId);
    const target = assertOperationalTargetIdentity(args);
    const reason = normalizedReason(args.reason);
    const now = Date.now();
    const restorationAfterMs = resolveRestorationDelayMs(
      args.restorationAfterMs,
      args.restorationAt,
      now
    );
    assertValidOperationalChangeRequest(args.changes, restorationAfterMs);
    const restorationAt = restorationAfterMs === null ? null : now + restorationAfterMs;
    if (!(await isOperationalControlPlaneActive(ctx))) {
      throw new ConvexError("OPERATIONAL_CONTROL_RELEASE_SETUP_REQUIRED");
    }

    const replayRows = await ctx.db
      .query("operationalControlChangeSets")
      .withIndex("by_commandId", (index) => index.eq("commandId", args.commandId))
      .take(2);
    if (replayRows.length > 1) {
      throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
    }
    const [replay] = replayRows;
    if (replay) {
      if (!sameChangeSetInput(replay, { changes: args.changes, reason, restorationAfterMs })) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return {
        auditEventId: replay.auditEventId,
        changeSetId: replay._id,
        replayed: true,
        restorationAt: replay.restorationAt ?? null,
      };
    }

    const currentRows = await loadValidatedOperationalChangeRows(ctx, args.changes);

    const actorId = access.authUserId ?? String(access.staffId);
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "change_set_applied",
      actorId,
      actorName: access.name,
      commandId: args.commandId,
      createdAt: now,
      reason,
      ...target,
    });
    const changeSetId = await ctx.db.insert("operationalControlChangeSets", {
      appliedAt: now,
      appliedBy: actorId,
      appliedByName: access.name,
      auditEventId,
      changes: currentRows.map(({ change, current }) => ({
        after: { state: change.state },
        appliedRevision: change.expectedRevision + 1,
        before: snapshotState(current),
        beforeChangeSetId: current?.changeSetId,
        beforeRevision: change.expectedRevision,
        key: change.key,
      })),
      commandId: args.commandId,
      reason,
      restorationAt: restorationAt ?? undefined,
      status: "applied",
      ...target,
    });
    await ctx.db.patch("operationalControlAuditEvents", auditEventId, { changeSetId });
    await Promise.all(
      currentRows.map(async ({ change, current }) => {
        if (!current) {
          throw new ConvexError("OPERATIONAL_CONTROL_RELEASE_SETUP_REQUIRED");
        }
        await ctx.db.patch("operationalControlStates", current._id, {
          changeSetId,
          expiresAt: undefined,
          reason,
          revision: change.expectedRevision + 1,
          state: change.state,
          updatedAt: now,
          updatedBy: actorId,
          updatedByName: access.name,
        });
      })
    );
    if (restorationAt !== null) {
      const scheduledRestorationId = await ctx.scheduler.runAt(
        restorationAt,
        restoreOperationalChangeSetRef,
        { changeSetId }
      );
      await ctx.db.patch("operationalControlChangeSets", changeSetId, {
        scheduledRestorationId,
      });
    }
    return { auditEventId, changeSetId, replayed: false, restorationAt };
  },
  returns: operationalApplyChangeSetMutationResultValidator,
});

function publicOperationalEffectReceipt(receipt: Doc<"operationalEffectReceipts">) {
  return {
    _creationTime: receipt._creationTime,
    _id: receipt._id,
    controlKey: receipt.controlKey,
    createdAt: receipt.createdAt,
    disposition: receipt.disposition,
    effectId: receipt.effectId,
    entityId: receipt.entityId,
    entityType: receipt.entityType,
    payloadFingerprint: receipt.payloadFingerprint,
    reason: receipt.reason,
    recipientCount: receipt.recipientCount,
  };
}

export const restoreOperationalChangeSet = internalMutation({
  args: { changeSetId: v.id("operationalControlChangeSets") },
  handler: async (ctx, args) => {
    const changeSet = await ctx.db.get("operationalControlChangeSets", args.changeSetId);
    if (!changeSet) {
      throw new ConvexError("OPERATIONAL_CHANGE_SET_NOT_FOUND");
    }
    if (changeSet.status !== "applied") {
      return {
        auditEventId: changeSet.restorationAuditEventId,
        changeSetId: changeSet._id,
        replayed: true,
        status: changeSet.status,
      };
    }
    const now = Date.now();
    if (changeSet.restorationAt === undefined || changeSet.restorationAt > now) {
      throw new ConvexError("OPERATIONAL_CHANGE_SET_RESTORATION_NOT_DUE");
    }
    const currentRows = await Promise.all(
      changeSet.changes.map(async (change) => ({
        change,
        current: isOperationalControlKey(change.key)
          ? await stateForMutation(ctx, change.key)
          : null,
      }))
    );
    const conflict = currentRows.some(
      ({ change, current }) =>
        !current ||
        current.changeSetId !== changeSet._id ||
        current.revision !== change.appliedRevision
    );
    if (conflict) {
      const reason =
        "Automatic restoration could not run because a newer or corrupt control state was found. No controls were changed.";
      const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
        action: "change_set_restoration_failed",
        actorId: "system",
        actorName: "Automatic restoration",
        changeSetId: changeSet._id,
        commandId: `restoration-failed:${changeSet._id}`,
        createdAt: now,
        reason,
        targetDeployment: changeSet.targetDeployment,
        targetEnvironment: changeSet.targetEnvironment,
        targetRevision: changeSet.targetRevision,
      });
      await ctx.db.patch("operationalControlChangeSets", changeSet._id, {
        resolutionReason: reason,
        resolvedByName: "Automatic restoration",
        restorationAuditEventId: auditEventId,
        restorationFailure: reason,
        status: "restoration_failed",
      });
      return {
        auditEventId,
        changeSetId: changeSet._id,
        replayed: false,
        status: "restoration_failed" as const,
      };
    }
    await Promise.all(
      currentRows.map(async ({ change, current }) => {
        if (!current) {
          throw new ConvexError("OPERATIONAL_CHANGE_SET_RESTORATION_CONFLICT");
        }
        await ctx.db.patch("operationalControlStates", current._id, {
          changeSetId: change.beforeChangeSetId,
          expiresAt: change.before.expiresAt,
          reason: `Automatic restoration: ${changeSet.reason}`,
          revision: current.revision + 1,
          state: change.before.state,
          updatedAt: now,
          updatedBy: "system",
          updatedByName: "Automatic restoration",
        });
      })
    );
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "change_set_restored",
      actorId: "system",
      actorName: "Automatic restoration",
      changeSetId: changeSet._id,
      commandId: `restoration:${changeSet._id}`,
      createdAt: now,
      reason: `Automatic restoration: ${changeSet.reason}`,
      targetDeployment: changeSet.targetDeployment,
      targetEnvironment: changeSet.targetEnvironment,
      targetRevision: changeSet.targetRevision,
    });
    await ctx.db.patch("operationalControlChangeSets", changeSet._id, {
      resolutionReason: `Automatic restoration: ${changeSet.reason}`,
      resolvedByName: "Automatic restoration",
      restorationAuditEventId: auditEventId,
      restoredAt: now,
      status: "restored",
    });
    return {
      auditEventId,
      changeSetId: changeSet._id,
      replayed: false,
      status: "restored" as const,
    };
  },
  returns: v.object({
    auditEventId: v.optional(v.id("operationalControlAuditEvents")),
    changeSetId: v.id("operationalControlChangeSets"),
    replayed: v.boolean(),
    status: v.union(v.literal("restoration_failed"), v.literal("restored"), v.literal("undone")),
  }),
});

export const undoOperationalChangeSet = mutation({
  args: {
    changeSetId: v.id("operationalControlChangeSets"),
    commandId: v.string(),
    expectedTargetDeployment: v.string(),
    expectedTargetEnvironment: v.string(),
    expectedTargetRevision: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireOperationalAdmin(ctx);
    assertCommandId(args.commandId);
    const target = assertOperationalTargetIdentity(args);
    const reason = normalizedReason(args.reason);
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (replay.action !== "change_set_undone" || replay.changeSetId !== args.changeSetId) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return {
        auditEventId: replay._id,
        changeSetId: args.changeSetId,
        replayed: true,
      };
    }
    const changeSet = await ctx.db.get("operationalControlChangeSets", args.changeSetId);
    if (changeSet?.status !== "applied") {
      throw new ConvexError("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");
    }
    if (
      changeSet.targetDeployment !== target.targetDeployment ||
      changeSet.targetEnvironment !== target.targetEnvironment ||
      changeSet.targetRevision !== target.targetRevision
    ) {
      throw new ConvexError("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    }
    if ((await latestUndoableChangeSetId(ctx)) !== changeSet._id) {
      throw new ConvexError("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");
    }
    const currentRows = await Promise.all(
      changeSet.changes.map(async (change) => ({
        change,
        current: isOperationalControlKey(change.key)
          ? await stateForMutation(ctx, change.key)
          : null,
      }))
    );
    if (
      currentRows.some(
        ({ change, current }) =>
          !current ||
          current.changeSetId !== changeSet._id ||
          current.revision !== change.appliedRevision
      )
    ) {
      throw new ConvexError("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");
    }
    const now = Date.now();
    const actorId = access.authUserId ?? String(access.staffId);
    await Promise.all(
      currentRows.map(async ({ change, current }) => {
        if (!current) {
          throw new ConvexError("OPERATIONAL_CHANGE_SET_UNDO_UNAVAILABLE");
        }
        await ctx.db.patch("operationalControlStates", current._id, {
          changeSetId: change.beforeChangeSetId,
          expiresAt: change.before.expiresAt,
          reason,
          revision: current.revision + 1,
          state: change.before.state,
          updatedAt: now,
          updatedBy: actorId,
          updatedByName: access.name,
        });
      })
    );
    if (changeSet.scheduledRestorationId) {
      await ctx.scheduler.cancel(changeSet.scheduledRestorationId);
    }
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "change_set_undone",
      actorId,
      actorName: access.name,
      changeSetId: changeSet._id,
      commandId: args.commandId,
      createdAt: now,
      reason,
      ...target,
    });
    await ctx.db.patch("operationalControlChangeSets", changeSet._id, {
      resolutionReason: reason,
      resolvedByName: access.name,
      restorationAuditEventId: auditEventId,
      restoredAt: now,
      status: "undone",
      undoCommandId: args.commandId,
    });
    return { auditEventId, changeSetId: changeSet._id, replayed: false };
  },
  returns: operationalChangeSetMutationResultValidator,
});

export const listOperationalChangeSets = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    const result = await ctx.db
      .query("operationalControlChangeSets")
      .withIndex("by_appliedAt")
      .order("desc")
      .paginate(boundedPaginationOptions(args.paginationOpts));
    const latestUndoableId = await latestUndoableChangeSetId(ctx);
    return {
      ...result,
      page: result.page.map((changeSet) => {
        const undoAvailable = changeSet._id === latestUndoableId;
        return {
          _creationTime: changeSet._creationTime,
          _id: changeSet._id,
          appliedAt: changeSet.appliedAt,
          appliedByName: changeSet.appliedByName,
          auditEventId: changeSet.auditEventId,
          changeCount: changeSet.changes.length,
          changes: changeSet.changes.map((change) => {
            if (!isOperationalControlKey(change.key)) {
              throw new ConvexError("CORRUPT_OPERATIONAL_CHANGE_SET");
            }
            return { after: change.after, before: change.before, key: change.key };
          }),
          reason: changeSet.reason,
          resolutionAuditEventId: changeSet.restorationAuditEventId,
          resolutionReason: changeSet.resolutionReason,
          resolvedByName: changeSet.resolvedByName,
          restorationAt: changeSet.restorationAt,
          restoredAt: changeSet.restoredAt,
          status: changeSet.status,
          targetDeployment: changeSet.targetDeployment,
          targetEnvironment: changeSet.targetEnvironment,
          targetRevision: changeSet.targetRevision,
          undoAvailable,
        };
      }),
    };
  },
  returns: paginationResultValidator(operationalChangeSetHistoryValidator),
});

export const listOperationalControlAudit = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    const result = await ctx.db
      .query("operationalControlAuditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(paginationOpts);
    const changeSetIds = Array.from(
      new Set(result.page.flatMap((event) => (event.changeSetId ? [event.changeSetId] : [])))
    );
    const changeSets = new Map(
      await Promise.all(
        changeSetIds.map(
          async (id) => [id, await ctx.db.get("operationalControlChangeSets", id)] as const
        )
      )
    );
    return {
      ...result,
      page: result.page.map((event) => {
        const changeSet = event.changeSetId ? changeSets.get(event.changeSetId) : null;
        const changes = (changeSet?.changes ?? []).map((change) => {
          if (!isOperationalControlKey(change.key)) {
            throw new ConvexError("CORRUPT_OPERATIONAL_CHANGE_SET");
          }
          return { after: change.after, before: change.before, key: change.key };
        });
        const initializedControlKeys =
          event.initializedControlKeys?.filter(isOperationalControlKey);
        return {
          _creationTime: event._creationTime,
          _id: event._id,
          action: event.action,
          actorId: event.actorId,
          actorName: event.actorName,
          changeSetId: event.changeSetId,
          changes,
          commandId: event.commandId,
          createdAt: event.createdAt,
          initializedControlKeys,
          reason: event.reason,
          revision: event.revision,
          targetDeployment: event.targetDeployment ?? "Legacy target not recorded",
          targetEnvironment: event.targetEnvironment ?? "legacy",
          targetRevision: event.targetRevision ?? "Legacy revision not recorded",
        };
      }),
    };
  },
  returns: paginationResultValidator(operationalAuditEventValidator),
});

export const listOperationalEffectReceipts = query({
  args: {
    controlKey: v.optional(operationalControlKeyValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOperationalAdmin(ctx);
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    if (args.controlKey) {
      const { controlKey } = args;
      const result = await ctx.db
        .query("operationalEffectReceipts")
        .withIndex("by_controlKey_createdAt", (index) => index.eq("controlKey", controlKey))
        .order("desc")
        .paginate(paginationOpts);
      return { ...result, page: result.page.map(publicOperationalEffectReceipt) };
    }
    const result = await ctx.db
      .query("operationalEffectReceipts")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(paginationOpts);
    return { ...result, page: result.page.map(publicOperationalEffectReceipt) };
  },
  returns: paginationResultValidator(operationalEffectReceiptValidator),
});

export const resolveOperationalControlsForGateway = mutation({
  args: {
    gatewaySecret: v.string(),
    keys: v.array(gatewayOperationalControlKeyValidator),
    synthetic: v.optional(v.boolean()),
    testScope: v.optional(v.literal("inbound_contact")),
    testToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    if (args.synthetic === true || args.testScope !== undefined || args.testToken !== undefined) {
      throw new ConvexError("OPERATIONAL_TEST_OVERRIDE_RETIRED");
    }
    const expandedKeys = Array.from(
      new Set(
        args.keys.flatMap((key) =>
          isLegacyOperationalControlKey(key)
            ? [...LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS[key]]
            : [key]
        )
      )
    );
    const resolved = await resolveOperationalControls(ctx, expandedKeys, { at: Date.now() });
    const byKey = new Map(resolved.map((control) => [control.key, control] as const));
    return {
      controls: args.keys.map((requestedKey) => {
        const replacementKeys = isLegacyOperationalControlKey(requestedKey)
          ? LEGACY_OPERATIONAL_CONTROL_REPLACEMENTS[requestedKey]
          : [requestedKey];
        const replacements = replacementKeys.flatMap((key) => {
          const control = byKey.get(key);
          return control ? [control] : [];
        });
        if (replacements.length !== replacementKeys.length) {
          throw new ConvexError("OPERATIONAL_CONTROL_RESOLUTION_MISSING");
        }
        const disabled = replacements.find((control) => !control.enabled);
        const representative = disabled ?? replacements[0];
        if (!representative) {
          throw new ConvexError("OPERATIONAL_CONTROL_RESOLUTION_MISSING");
        }
        return {
          blockedBy: Array.from(new Set(replacements.flatMap((control) => control.blockedBy))),
          enabled: replacements.every((control) => control.enabled),
          key: requestedKey,
          reason: representative.reason,
        };
      }),
    };
  },
  returns: v.object({ controls: v.array(gatewayOperationalControlResolutionValidator) }),
});

export const resolveOperationalControlsInternal = internalQuery({
  args: {
    at: v.number(),
    keys: v.array(operationalControlKeyValidator),
  },
  handler: async (ctx, args) => ({
    controls: await resolveOperationalControls(ctx, args.keys, { at: args.at }),
  }),
  returns: v.object({ controls: v.array(operationalControlResolutionValidator) }),
});

export const recordOperationalEffectInternal = internalMutation({
  args: {
    blockedBy: v.array(operationalControlKeyValidator),
    disposition: v.union(v.literal("created"), v.literal("failed"), v.literal("suppressed")),
    effectId: v.string(),
    enabled: v.boolean(),
    key: operationalControlKeyValidator,
    reason: operationalResolutionReasonValidator,
  },
  handler: async (ctx, args) =>
    await recordOperationalEffect(ctx, {
      control: {
        blockedBy: args.blockedBy,
        enabled: args.enabled,
        key: args.key,
        reason: args.reason,
      },
      disposition: args.disposition,
      effectId: args.effectId,
      entityType: "scheduledJob",
    }),
  returns: v.object({
    id: v.id("operationalEffectReceipts"),
    receipt: v.any(),
    replayed: v.boolean(),
  }),
});

/**
 * Atomically decides whether a new controlled effect may start and records
 * that start. A later pause therefore applies only to work that has not yet
 * claimed its execution boundary.
 */
export const beginOperationalEffectInternal = internalMutation({
  args: {
    effectId: v.string(),
    key: operationalControlKeyValidator,
  },
  handler: async (ctx, args) => {
    const [control] = await resolveOperationalControls(ctx, [args.key], { at: Date.now() });
    if (!control) {
      throw new ConvexError("OPERATIONAL_CONTROL_RESOLUTION_MISSING");
    }
    await recordOperationalEffect(ctx, {
      control,
      disposition: control.enabled ? "queued" : "suppressed",
      effectId: args.effectId,
    });
    return control;
  },
  returns: v.object({
    blockedBy: v.array(operationalControlKeyValidator),
    enabled: v.boolean(),
    key: operationalControlKeyValidator,
    reason: operationalResolutionReasonValidator,
  }),
});

export const clearPortalPresetData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_STAFF);
    return await deletePresetRows(ctx);
  },
  returns: clearPresetsResultValidator,
});

export const clearPortalPresetDataInternal = internalMutation({
  args: {},
  handler: async (ctx) => await deletePresetRows(ctx),
  returns: clearPresetsResultValidator,
});

export const setDropdownOptionActive = mutation({
  args: {
    active: v.boolean(),
    optionId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx, PERMISSIONS.MANAGE_DROPDOWNS);
    const id = ctx.db.normalizeId("dropdownOptions", args.optionId);
    if (!id) {
      return null;
    }
    await ctx.db.patch("dropdownOptions", id, { active: args.active, updatedAt: Date.now() });
    return { id };
  },
  returns: nullableDropdownIdResultValidator,
});
