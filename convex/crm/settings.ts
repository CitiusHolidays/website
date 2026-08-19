import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import {
  assertAvailableControl,
  assertTestScopeKeys,
  inspectOperationalControlState,
  OPERATIONAL_CONTROL_CATALOG,
  type OperationalControlKey,
  type OperationalTestScope,
  operationalControlKeyValidator,
  operationalControlStateValidator,
  operationalTestScopeValidator,
  operationalTestTokenForCommand,
  operationalTestTokenHash,
  resolveOperationalControls,
} from "./lib/operationalControls";
import { PERMISSIONS } from "./lib/rolePolicy";
import { isAdmin, requireStaff } from "./lib/staffAccess";
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
  v.literal("prerequisite_disabled"),
  v.literal("test_override"),
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
  v.literal("prerequisite_disabled"),
  v.literal("test_override")
);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATIONAL_TEST_OVERRIDE_MS = 30 * 60 * 1000;

function assertCommandId(commandId: string) {
  if (!UUID_PATTERN.test(commandId)) {
    throw new ConvexError("INVALID_OPERATIONAL_CONTROL_COMMAND");
  }
}

function normalizedReason(reason: string) {
  const value = reason.trim();
  if (value.length < 8 || value.length > 500) {
    throw new ConvexError("OPERATIONAL_CONTROL_REASON_REQUIRED");
  }
  return value;
}

async function requireExactAdmin(ctx: Parameters<typeof requireStaff>[0]) {
  const access = await requireStaff(ctx);
  if (!(access.staffId && isAdmin(access))) {
    throw new ConvexError("FORBIDDEN");
  }
  return access;
}

function snapshotState(
  row: {
    expiresAt?: number;
    state: "default" | "enabled" | "disabled" | "safe_default";
  } | null
) {
  return row
    ? {
        ...(row.expiresAt === undefined ? {} : { expiresAt: row.expiresAt }),
        state: row.state,
      }
    : { state: "default" as const };
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

async function stateForMutation(ctx: MutationCtx, key: OperationalControlKey) {
  const rows = await ctx.db
    .query("operationalControlStates")
    .withIndex("by_key", (index) => index.eq("key", key))
    .take(2);
  if (rows.length > 1) {
    throw new ConvexError("CORRUPT_OPERATIONAL_CONTROL");
  }
  return rows[0] ?? null;
}

function sameSnapshot(
  actual: { expiresAt?: number; state: string } | undefined,
  expected: { expiresAt?: number; state: string }
) {
  return actual?.state === expected.state && actual.expiresAt === expected.expiresAt;
}

function sameOverrides(
  left: Array<{ key: string; state: string }>,
  right: Array<{ key: string; state: string }>
) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertGatewaySecret(secret: string) {
  const expected = process.env.OPERATIONAL_CONTROL_GATEWAY_SECRET?.trim();
  if (!(expected && secret === expected)) {
    throw new ConvexError("FORBIDDEN");
  }
}

const operationalControlMutationResultValidator = v.object({
  auditEventId: v.id("operationalControlAuditEvents"),
  replayed: v.boolean(),
  revision: v.number(),
});

const operationalControlResolutionValidator = v.object({
  blockedBy: v.array(operationalControlKeyValidator),
  enabled: v.boolean(),
  key: operationalControlKeyValidator,
  reason: operationalEffectReasonValidator,
  testSessionId: v.optional(v.id("operationalControlTestSessions")),
});
const operationalStateSnapshotValidator = v.object({
  expiresAt: v.optional(v.number()),
  state: persistedOperationalControlStateValidator,
});
const operationalTestSnapshotValidator = v.union(
  v.object({ status: v.literal("absent") }),
  v.object({
    expiresAt: v.number(),
    overrideCount: v.number(),
    scope: operationalTestScopeValidator,
    status: v.union(v.literal("active"), v.literal("revoked")),
  })
);
const operationalAuditEventValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("operationalControlAuditEvents"),
  action: v.union(
    v.literal("global_set"),
    v.literal("global_rollback"),
    v.literal("test_created"),
    v.literal("test_revoked")
  ),
  actorId: v.string(),
  actorName: v.string(),
  after: v.optional(operationalStateSnapshotValidator),
  before: v.optional(operationalStateSnapshotValidator),
  commandId: v.string(),
  controlKey: v.optional(v.string()),
  createdAt: v.number(),
  reason: v.string(),
  revision: v.optional(v.number()),
  rollbackOfAuditEventId: v.optional(v.id("operationalControlAuditEvents")),
  testAfter: v.optional(operationalTestSnapshotValidator),
  testBefore: v.optional(operationalTestSnapshotValidator),
  testSessionId: v.optional(v.id("operationalControlTestSessions")),
});
const operationalEffectReceiptValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("operationalEffectReceipts"),
  controlKey: v.string(),
  createdAt: v.number(),
  disposition: v.union(
    v.literal("created"),
    v.literal("duplicate"),
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
  synthetic: v.boolean(),
  testSessionId: v.optional(v.id("operationalControlTestSessions")),
});

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

export const listOperationalControls = query({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    await requireExactAdmin(ctx);
    return await Promise.all(
      OPERATIONAL_CONTROL_CATALOG.map(async (entry) => {
        const inspected = await inspectOperationalControlState(ctx, entry.key, args.at);
        const resolved =
          entry.availability === "available"
            ? (await resolveOperationalControls(ctx, [entry.key], { at: args.at }))[0]
            : null;
        return {
          availability: entry.availability,
          category: entry.category,
          dependencies: [...entry.dependencies],
          description: entry.description,
          effectiveEnabled: resolved?.enabled ?? null,
          enforcement: entry.enforcement,
          expiresAt: inspected.current?.expiresAt,
          key: entry.key,
          label: entry.label,
          revision: inspected.current?.revision ?? 0,
          source: resolved?.reason ?? ("unavailable" as const),
          standardEnabled: entry.standardEnabled,
          state: operationalStateForList(inspected.current?.state, inspected.duplicate),
          unavailableReason: "unavailableReason" in entry ? entry.unavailableReason : undefined,
          updatedAt: inspected.current?.updatedAt,
          updatedByName: inspected.current?.updatedByName,
        };
      })
    );
  },
  returns: v.array(
    v.object({
      availability: v.union(v.literal("available"), v.literal("unavailable")),
      category: v.union(
        v.literal("AI"),
        v.literal("Authentication"),
        v.literal("Contact"),
        v.literal("CRM"),
        v.literal("Infrastructure"),
        v.literal("Payments")
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

export const setOperationalControl = mutation({
  args: {
    commandId: v.string(),
    expectedRevision: v.number(),
    expiresAt: v.union(v.number(), v.null()),
    key: operationalControlKeyValidator,
    reason: v.string(),
    state: operationalControlStateValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireExactAdmin(ctx);
    assertCommandId(args.commandId);
    assertAvailableControl(args.key);
    const reason = normalizedReason(args.reason);
    const now = Date.now();
    if (args.expiresAt !== null && !(Number.isFinite(args.expiresAt) && args.expiresAt > now)) {
      throw new ConvexError("INVALID_OPERATIONAL_CONTROL_EXPIRY");
    }
    const after = {
      ...(args.expiresAt === null ? {} : { expiresAt: args.expiresAt }),
      state: args.state,
    };
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (
        replay.action !== "global_set" ||
        replay.controlKey !== args.key ||
        replay.reason !== reason ||
        !sameSnapshot(replay.after, after) ||
        replay.revision === undefined
      ) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return { auditEventId: replay._id, replayed: true, revision: replay.revision };
    }
    const current = await stateForMutation(ctx, args.key);
    const currentRevision = current?.revision ?? 0;
    if (args.expectedRevision !== currentRevision) {
      throw new ConvexError("STALE_OPERATIONAL_CONTROL");
    }
    const revision = currentRevision + 1;
    const values = {
      expiresAt: args.expiresAt === null ? undefined : args.expiresAt,
      key: args.key,
      reason,
      revision,
      state: args.state,
      updatedAt: now,
      updatedBy: access.authUserId ?? String(access.staffId),
      updatedByName: access.name,
    };
    if (current) {
      await ctx.db.patch("operationalControlStates", current._id, values);
    } else {
      await ctx.db.insert("operationalControlStates", values);
    }
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "global_set",
      actorId: access.authUserId ?? String(access.staffId),
      actorName: access.name,
      after,
      before: snapshotState(current),
      commandId: args.commandId,
      controlKey: args.key,
      createdAt: now,
      reason,
      revision,
    });
    return { auditEventId, replayed: false, revision };
  },
  returns: operationalControlMutationResultValidator,
});

export const rollbackOperationalControl = mutation({
  args: {
    auditEventId: v.id("operationalControlAuditEvents"),
    commandId: v.string(),
    expectedRevision: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireExactAdmin(ctx);
    assertCommandId(args.commandId);
    const reason = normalizedReason(args.reason);
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (
        replay.action !== "global_rollback" ||
        replay.rollbackOfAuditEventId !== args.auditEventId ||
        replay.reason !== reason ||
        replay.revision === undefined
      ) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return { auditEventId: replay._id, replayed: true, revision: replay.revision };
    }
    const target = await ctx.db.get("operationalControlAuditEvents", args.auditEventId);
    if (!(target?.controlKey && target.before)) {
      throw new ConvexError("OPERATIONAL_CONTROL_ROLLBACK_UNAVAILABLE");
    }
    const key = target.controlKey as OperationalControlKey;
    assertAvailableControl(key);
    const current = await stateForMutation(ctx, key);
    const currentRevision = current?.revision ?? 0;
    if (args.expectedRevision !== currentRevision) {
      throw new ConvexError("STALE_OPERATIONAL_CONTROL");
    }
    const revision = currentRevision + 1;
    const after = snapshotState(target.before);
    const now = Date.now();
    const values = {
      expiresAt: after.expiresAt,
      key,
      reason,
      revision,
      state: after.state,
      updatedAt: now,
      updatedBy: access.authUserId ?? String(access.staffId),
      updatedByName: access.name,
    };
    if (current) {
      await ctx.db.patch("operationalControlStates", current._id, values);
    } else {
      await ctx.db.insert("operationalControlStates", values);
    }
    const auditEventId = await ctx.db.insert("operationalControlAuditEvents", {
      action: "global_rollback",
      actorId: access.authUserId ?? String(access.staffId),
      actorName: access.name,
      after,
      before: snapshotState(current),
      commandId: args.commandId,
      controlKey: key,
      createdAt: now,
      reason,
      revision,
      rollbackOfAuditEventId: args.auditEventId,
    });
    return { auditEventId, replayed: false, revision };
  },
  returns: operationalControlMutationResultValidator,
});

export const createOperationalTestOverride = mutation({
  args: {
    commandId: v.string(),
    overrides: v.array(
      v.object({
        key: operationalControlKeyValidator,
        state: v.union(v.literal("enabled"), v.literal("disabled")),
      })
    ),
    reason: v.string(),
    scope: operationalTestScopeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireExactAdmin(ctx);
    assertCommandId(args.commandId);
    const reason = normalizedReason(args.reason);
    assertTestScopeKeys(
      args.scope,
      args.overrides.map((entry) => entry.key)
    );
    const actorId = access.authUserId ?? String(access.staffId);
    const token = await operationalTestTokenForCommand(args.commandId, actorId, args.scope);
    const tokenHash = await operationalTestTokenHash(token);
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      const session = replay.testSessionId
        ? await ctx.db.get("operationalControlTestSessions", replay.testSessionId)
        : null;
      if (
        replay.action !== "test_created" ||
        replay.reason !== reason ||
        !session ||
        session.scope !== args.scope ||
        session.tokenHash !== tokenHash ||
        !sameOverrides(session.overrides, args.overrides)
      ) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return {
        expiresAt: session.expiresAt,
        replayed: true,
        sessionId: session._id,
        token,
      };
    }
    const matchingTokens = await ctx.db
      .query("operationalControlTestSessions")
      .withIndex("by_tokenHash", (index) => index.eq("tokenHash", tokenHash))
      .take(1);
    if (matchingTokens.length > 0) {
      throw new ConvexError("OPERATIONAL_TEST_TOKEN_CONFLICT");
    }
    const now = Date.now();
    const expiresAt = now + OPERATIONAL_TEST_OVERRIDE_MS;
    const sessionId = await ctx.db.insert("operationalControlTestSessions", {
      createdAt: now,
      createdBy: actorId,
      createdByName: access.name,
      expiresAt,
      overrides: args.overrides,
      reason,
      scope: args.scope,
      tokenHash,
    });
    await ctx.db.insert("operationalControlAuditEvents", {
      action: "test_created",
      actorId: access.authUserId ?? String(access.staffId),
      actorName: access.name,
      commandId: args.commandId,
      createdAt: now,
      reason,
      testAfter: {
        expiresAt,
        overrideCount: args.overrides.length,
        scope: args.scope,
        status: "active",
      },
      testBefore: { status: "absent" },
      testSessionId: sessionId,
    });
    return { expiresAt, replayed: false, sessionId, token };
  },
  returns: v.object({
    expiresAt: v.number(),
    replayed: v.boolean(),
    sessionId: v.id("operationalControlTestSessions"),
    token: v.string(),
  }),
});

export const revokeOperationalTestOverride = mutation({
  args: {
    commandId: v.string(),
    reason: v.string(),
    sessionId: v.id("operationalControlTestSessions"),
  },
  handler: async (ctx, args) => {
    const access = await requireExactAdmin(ctx);
    assertCommandId(args.commandId);
    const reason = normalizedReason(args.reason);
    const replay = await auditForCommand(ctx, args.commandId);
    if (replay) {
      if (
        replay.action !== "test_revoked" ||
        replay.testSessionId !== args.sessionId ||
        replay.reason !== reason
      ) {
        throw new ConvexError("OPERATIONAL_CONTROL_COMMAND_CONFLICT");
      }
      return { replayed: true, sessionId: args.sessionId };
    }
    const session = await ctx.db.get("operationalControlTestSessions", args.sessionId);
    if (!session) {
      throw new ConvexError("OPERATIONAL_TEST_OVERRIDE_NOT_FOUND");
    }
    const now = Date.now();
    if (session.revokedAt === undefined) {
      await ctx.db.patch("operationalControlTestSessions", args.sessionId, {
        revokedAt: now,
        revokedBy: access.authUserId ?? String(access.staffId),
      });
    }
    await ctx.db.insert("operationalControlAuditEvents", {
      action: "test_revoked",
      actorId: access.authUserId ?? String(access.staffId),
      actorName: access.name,
      commandId: args.commandId,
      createdAt: now,
      reason,
      testAfter: {
        expiresAt: session.expiresAt,
        overrideCount: session.overrides.length,
        scope: session.scope,
        status: "revoked",
      },
      testBefore: {
        expiresAt: session.expiresAt,
        overrideCount: session.overrides.length,
        scope: session.scope,
        status: session.revokedAt === undefined ? "active" : "revoked",
      },
      testSessionId: args.sessionId,
    });
    return { replayed: false, sessionId: args.sessionId };
  },
  returns: v.object({
    replayed: v.boolean(),
    sessionId: v.id("operationalControlTestSessions"),
  }),
});

export const listOperationalTestOverrides = query({
  args: { at: v.number() },
  handler: async (ctx, args) => {
    await requireExactAdmin(ctx);
    const rows = await ctx.db
      .query("operationalControlTestSessions")
      .withIndex("by_expiresAt", (index) => index.gte("expiresAt", args.at))
      .order("desc")
      .take(100);
    return rows.map((row) => ({
      _id: row._id,
      createdAt: row.createdAt,
      createdByName: row.createdByName,
      expiresAt: row.expiresAt,
      overrides: row.overrides.map((override) => ({
        key: override.key as OperationalControlKey,
        state: override.state,
      })),
      reason: row.reason,
      revokedAt: row.revokedAt,
      scope: row.scope,
    }));
  },
  returns: v.array(
    v.object({
      _id: v.id("operationalControlTestSessions"),
      createdAt: v.number(),
      createdByName: v.string(),
      expiresAt: v.number(),
      overrides: v.array(
        v.object({
          key: operationalControlKeyValidator,
          state: v.union(v.literal("enabled"), v.literal("disabled")),
        })
      ),
      reason: v.string(),
      revokedAt: v.optional(v.number()),
      scope: operationalTestScopeValidator,
    })
  ),
});

export const listOperationalControlAudit = query({
  args: {
    controlKey: v.optional(operationalControlKeyValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireExactAdmin(ctx);
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    if (args.controlKey) {
      const { controlKey } = args;
      return await ctx.db
        .query("operationalControlAuditEvents")
        .withIndex("by_controlKey_createdAt", (index) => index.eq("controlKey", controlKey))
        .order("desc")
        .paginate(paginationOpts);
    }
    return await ctx.db
      .query("operationalControlAuditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(paginationOpts);
  },
  returns: paginationResultValidator(operationalAuditEventValidator),
});

export const listOperationalEffectReceipts = query({
  args: {
    controlKey: v.optional(operationalControlKeyValidator),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireExactAdmin(ctx);
    const paginationOpts = boundedPaginationOptions(args.paginationOpts);
    if (args.controlKey) {
      const { controlKey } = args;
      return await ctx.db
        .query("operationalEffectReceipts")
        .withIndex("by_controlKey_createdAt", (index) => index.eq("controlKey", controlKey))
        .order("desc")
        .paginate(paginationOpts);
    }
    return await ctx.db
      .query("operationalEffectReceipts")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(paginationOpts);
  },
  returns: paginationResultValidator(operationalEffectReceiptValidator),
});

export const resolveOperationalControlsForGateway = mutation({
  args: {
    gatewaySecret: v.string(),
    keys: v.array(operationalControlKeyValidator),
    synthetic: v.boolean(),
    testScope: v.optional(operationalTestScopeValidator),
    testToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertGatewaySecret(args.gatewaySecret);
    const hasTestCapability = Boolean(args.testToken && args.testScope);
    const hasPartialTestCapability = Boolean(args.testToken || args.testScope);
    if (args.synthetic !== hasTestCapability || hasPartialTestCapability !== hasTestCapability) {
      throw new ConvexError("INVALID_OPERATIONAL_TEST_OVERRIDE");
    }
    const controls = await resolveOperationalControls(ctx, args.keys, {
      at: Date.now(),
      ...(hasTestCapability
        ? {
            test: {
              scope: args.testScope as OperationalTestScope,
              synthetic: true as const,
              token: args.testToken as string,
            },
          }
        : {}),
    });
    return { controls };
  },
  returns: v.object({ controls: v.array(operationalControlResolutionValidator) }),
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
