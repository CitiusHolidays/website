import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, internalQuery } from "./_generated/server";
import { NOTIFICATION_UNREAD_READINESS_KEY } from "./crm/notificationUnreadProjection";
import {
  AUTH_IDENTITY_FIELD_SPECS,
  type AuthIdentityFieldSpec,
  authIdentityMigrationRegistryKey,
  classifyStoredIdentity,
} from "./lib/authIdentityMigration";
import {
  isIdentityQuarantined,
  privacySafeIdentityHash,
  recordIdentityQuarantine,
  upsertBookingEntitlement,
} from "./lib/customerIdentityAccess";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { isRuntimeString, propertiesWhen } from "./lib/runtimeValues";
import { sacredBharatLeaderboardRanks } from "./lib/sacredBharatLeaderboardRank";
import {
  assertMigrationTarget,
  assertTargetBoundMigration,
  migrationTargetArgs,
  migrationTargetResultFields,
  targetBoundMigrationArgs,
  targetBoundMigrationRegistryKey,
} from "./migrationAuth";

const MAX_PAGE_SIZE = 50;
const BOOKING_ENTITLEMENT_MIGRATION_VERSION = 1;
const MAX_LINKED_LEGACY_IDENTITIES = 3;

interface DynamicRow {
  _id: string;
  [field: string]: RuntimeValue;
}

interface DynamicIndexRange {
  eq: (field: string, value: RuntimeValue) => DynamicIndexRange;
}

interface DynamicQuery {
  order: (direction: "asc" | "desc") => DynamicQuery;
  paginate: (args: { cursor: string | null; numItems: number }) => Promise<{
    continueCursor: string;
    isDone: boolean;
    page: DynamicRow[];
  }>;
  take: (limit: number) => Promise<DynamicRow[]>;
  withIndex: (
    index: string,
    callback: (range: DynamicIndexRange) => DynamicIndexRange
  ) => DynamicQuery;
}

interface DynamicDatabase {
  patch: (table: string, id: string, value: RuntimeObject) => Promise<void>;
  query: (table: string) => DynamicQuery;
}

const migrationStatusValidator = v.union(
  v.literal("pending" as const),
  v.literal("running" as const),
  v.literal("verified" as const),
  v.literal("failed" as const)
);

const migrationResultValidator = v.object({
  converted: v.number(),
  cursor: v.union(v.string(), v.null()),
  dryRun: v.boolean(),
  legacyRemaining: v.number(),
  ...migrationTargetResultFields,
  processed: v.number(),
  quarantined: v.number(),
  stage: v.string(),
  status: migrationStatusValidator,
  table: v.string(),
});

function boundedLimit(value?: number) {
  return Math.min(Math.max(Math.trunc(value ?? MAX_PAGE_SIZE), 1), MAX_PAGE_SIZE);
}

function specForTable(table: string): AuthIdentityFieldSpec | null {
  return AUTH_IDENTITY_FIELD_SPECS.find((spec) => spec.table === table) ?? null;
}

async function loadRegistry(ctx: MutationCtx | QueryCtx, key: string) {
  return await ctx.db
    .query("dataMigrationRegistry")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

async function identityLinksForValues(ctx: MutationCtx, values: string[]) {
  const pages = await Promise.all(
    values.map((legacyAuthUserId) =>
      ctx.db
        .query("authIdentityLinks")
        .withIndex("by_legacyAuthUserId", (q) => q.eq("legacyAuthUserId", legacyAuthUserId))
        .take(3)
    )
  );
  return pages.flat();
}

function identityValues(row: DynamicRow, fields: readonly string[]) {
  return [
    ...new Set(
      fields.flatMap((field) => {
        const value = row[field];
        return isRuntimeString(value) && value.trim() ? [value.trim()] : [];
      })
    ),
  ];
}

async function collidesWithCanonicalRow(
  db: DynamicDatabase,
  row: DynamicRow,
  patch: RuntimeObject,
  spec: NonNullable<ReturnType<typeof specForTable>>
) {
  if (!spec.uniqueKey) {
    return false;
  }
  const projected = { ...row, ...patch };
  let complete = true;
  const matches = await db
    .query(spec.table)
    .withIndex(spec.uniqueKey.index, (range) => {
      let current = range;
      for (const field of spec.uniqueKey?.fields ?? []) {
        const value = projected[field];
        if (value === undefined || value === null) {
          complete = false;
          break;
        }
        current = current.eq(field, value);
      }
      return current;
    })
    .take(2);
  return complete && matches.some((candidate) => candidate._id !== row._id);
}

async function classifyRow(
  ctx: MutationCtx,
  row: DynamicRow,
  fields: readonly string[],
  table: string
) {
  const values = identityValues(row, fields);
  const links = await identityLinksForValues(ctx, values);
  const patch: RuntimeObject = {};
  const quarantinedValues: string[] = [];
  let remaining = 0;
  let convertible = 0;
  const fieldResults = await Promise.all(
    fields.map(async (field) => ({
      disposition: classifyStoredIdentity(row[field], links),
      field,
      quarantined:
        isRuntimeString(row[field]) &&
        (await isIdentityQuarantined(ctx, { legacyAuthUserId: row[field], table })),
    }))
  );
  for (const { disposition, field, quarantined } of fieldResults) {
    if (quarantined) {
      // SAFETY: quarantined can be true only when the corresponding row field passed isRuntimeString.
      quarantinedValues.push(row[field] as string);
    } else if (disposition.kind === "convert") {
      patch[field] = disposition.canonicalAuthUserId;
      convertible += 1;
    } else if (disposition.kind === "quarantine") {
      if (isRuntimeString(row[field])) {
        quarantinedValues.push(row[field]);
      }
    } else if (disposition.kind === "remaining") {
      remaining += 1;
    }
  }
  return { convertible, patch, quarantinedValues, remaining };
}

async function invalidateNotificationProjection(ctx: MutationCtx) {
  const readiness = await ctx.db
    .query("notificationUnreadProjectionReadiness")
    .withIndex("by_key", (q) => q.eq("key", NOTIFICATION_UNREAD_READINESS_KEY))
    .unique();
  if (readiness?.ready) {
    await ctx.db.patch("notificationUnreadProjectionReadiness", readiness._id, {
      failureCode: "AUTH_IDENTITY_MIGRATION_REBUILD_REQUIRED",
      ready: false,
      status: "failed",
      updatedAt: Date.now(),
    });
  }
}

async function processRow(
  ctx: MutationCtx,
  db: DynamicDatabase,
  row: DynamicRow,
  spec: NonNullable<ReturnType<typeof specForTable>>,
  dryRun: boolean
) {
  const classified = await classifyRow(ctx, row, spec.fields, spec.table);
  const legacyBookingOwner =
    spec.table === "bookings" && isRuntimeString(row.userId) ? row.userId : undefined;
  if (classified.quarantinedValues.length > 0) {
    if (!dryRun) {
      await Promise.all(
        classified.quarantinedValues.map((legacyAuthUserId) =>
          recordIdentityQuarantine(ctx, {
            legacyAuthUserId,
            reason: "ambiguous_owner",
            table: spec.table,
          })
        )
      );
    }
    return {
      converted: 0,
      quarantined: classified.quarantinedValues.length,
      remaining: classified.remaining,
    };
  }
  if (dryRun || classified.convertible === 0) {
    return {
      converted: 0,
      quarantined: 0,
      remaining: classified.remaining + classified.convertible,
    };
  }
  if (await collidesWithCanonicalRow(db, row, classified.patch, spec)) {
    const legacyValues = identityValues(row, spec.fields);
    await Promise.all(
      legacyValues.map((legacyAuthUserId) =>
        recordIdentityQuarantine(ctx, {
          legacyAuthUserId,
          reason: "ambiguous_owner",
          table: spec.table,
        })
      )
    );
    return { converted: 0, quarantined: classified.convertible, remaining: classified.remaining };
  }
  await db.patch(spec.table, row._id, classified.patch);
  if (spec.table === "sacredBharatLeaderboardSummaries") {
    // SAFETY: the table discriminator correlates row._id with sacredBharatLeaderboardSummaries.
    const updated = await ctx.db.get(
      "sacredBharatLeaderboardSummaries",
      row._id as Id<"sacredBharatLeaderboardSummaries">
    );
    if (!updated) {
      throw new ConvexError("SACRED_BHARAT_RANK_PROJECTION_UPDATE_FAILED");
    }
    // SAFETY: the same table discriminator correlates row with a leaderboard summary document.
    await sacredBharatLeaderboardRanks.replaceOrInsert(
      ctx,
      row as Doc<"sacredBharatLeaderboardSummaries">,
      updated
    );
  }
  if (spec.table === "bookings" && isRuntimeString(classified.patch.userId)) {
    // SAFETY: the bookings table discriminator correlates row._id with a booking ID.
    await upsertBookingEntitlement(ctx, {
      authUserId: classified.patch.userId,
      bookingId: row._id as never,
      legacyAuthUserId: legacyBookingOwner,
      source: "identity_migration",
    });
  }
  if (spec.table === "notifications" || spec.table === "notificationReads") {
    await invalidateNotificationProjection(ctx);
  }
  return { converted: classified.convertible, quarantined: 0, remaining: classified.remaining };
}

function bookingEntitlementRegistryKey(dryRun: boolean) {
  return `customer-journey-purchaser-v${BOOKING_ENTITLEMENT_MIGRATION_VERSION}${
    dryRun ? ":dry-run" : ""
  }`;
}

function canonicalBookingOwner(booking: Doc<"bookings">) {
  const owner = booking.userId.trim();
  return owner.includes("|") ? owner : null;
}

function isCompletePurchaserEntitlement(
  row: Doc<"customerJourneyEntitlements">,
  authUserId: string
) {
  return (
    row.authUserId === authUserId &&
    row.role === "purchaser" &&
    row.capabilities.includes("view_booking") &&
    (row.source === "public_booking_owner" || row.source === "identity_migration")
  );
}

async function recordBookingEntitlementQuarantine(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  authUserId: string
) {
  const quarantineId = await recordIdentityQuarantine(ctx, {
    legacyAuthUserId: bookingEntitlementQuarantineIdentity(booking, authUserId),
    reason: "ambiguous_owner",
    table: "customerJourneyEntitlements",
  });
  const quarantine = await ctx.db.get("authIdentityQuarantines", quarantineId);
  if (quarantine?.resolvedAt !== undefined) {
    await ctx.db.patch("authIdentityQuarantines", quarantineId, { resolvedAt: undefined });
  }
}

function bookingEntitlementQuarantineIdentity(booking: Doc<"bookings">, authUserId: string) {
  return `booking:${booking._id}:owner:${authUserId}`;
}

async function resolveBookingEntitlementQuarantine(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  authUserId: string
) {
  const legacyAuthUserIdHash = await privacySafeIdentityHash(
    bookingEntitlementQuarantineIdentity(booking, authUserId)
  );
  const existing = await ctx.db
    .query("authIdentityQuarantines")
    .withIndex("by_hash_table", (q) =>
      q.eq("legacyAuthUserIdHash", legacyAuthUserIdHash).eq("table", "customerJourneyEntitlements")
    )
    .first();
  if (existing && existing.resolvedAt === undefined) {
    await ctx.db.patch("authIdentityQuarantines", existing._id, { resolvedAt: Date.now() });
  }
}

async function bookingEntitlementQuarantinePage(
  ctx: MutationCtx,
  cursor: string | null,
  limit: number
) {
  return await ctx.db
    .query("authIdentityQuarantines")
    .withIndex("by_table_createdAt", (q) => q.eq("table", "customerJourneyEntitlements"))
    .paginate({ cursor, numItems: limit });
}

async function bookingEntitlementGroup(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  authUserId: string
) {
  const links = await ctx.db
    .query("authIdentityLinks")
    .withIndex("by_canonicalAuthUserId", (q) => q.eq("canonicalAuthUserId", authUserId))
    .take(MAX_LINKED_LEGACY_IDENTITIES + 1);
  const linkedLegacyAuthUserIds = links
    .filter((link) => link.status === "linked")
    .map((link) => link.legacyAuthUserId);
  const identityConflict =
    links.length > MAX_LINKED_LEGACY_IDENTITIES || links.some((link) => link.status !== "linked");
  const pages = await Promise.all(
    [authUserId, ...linkedLegacyAuthUserIds].map((identity) =>
      ctx.db
        .query("customerJourneyEntitlements")
        .withIndex("by_bookingId_authUserId", (q) =>
          q.eq("bookingId", booking._id).eq("authUserId", identity)
        )
        .take(2)
    )
  );
  const rows = [...new Map(pages.flat().map((row) => [String(row._id), row] as const)).values()];
  return { identityConflict, linkedLegacyAuthUserIds, rows };
}

async function processBookingEntitlement(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  apply: boolean,
  reconcileQuarantine: boolean
) {
  const authUserId = canonicalBookingOwner(booking);
  if (!authUserId) {
    return { converted: 0, quarantined: 0, remaining: 1 };
  }
  const group = await bookingEntitlementGroup(ctx, booking, authUserId);
  if (group.identityConflict || group.rows.length > 1) {
    if (apply) {
      await recordBookingEntitlementQuarantine(ctx, booking, authUserId);
    }
    return { converted: 0, quarantined: 1, remaining: 1 };
  }
  const complete =
    group.rows.length === 1 && isCompletePurchaserEntitlement(group.rows[0], authUserId);
  if (complete) {
    if (reconcileQuarantine) {
      await resolveBookingEntitlementQuarantine(ctx, booking, authUserId);
    }
    return { converted: 0, quarantined: 0, remaining: 0 };
  }
  if (!apply) {
    return { converted: 0, quarantined: 0, remaining: 1 };
  }
  await upsertBookingEntitlement(ctx, {
    authUserId,
    bookingId: booking._id,
    legacyAuthUserIds: group.linkedLegacyAuthUserIds,
    source: "identity_migration",
  });
  await resolveBookingEntitlementQuarantine(ctx, booking, authUserId);
  return { converted: 1, quarantined: 0, remaining: 0 };
}

function completion(args: {
  dryRun: boolean;
  isDone: boolean;
  legacyRemaining: number;
  stage: string;
}) {
  if (!args.isDone) {
    return { stage: args.stage, status: "running" as const };
  }
  if (!(args.dryRun || args.stage === "verify")) {
    return { stage: "verify", status: "running" as const };
  }
  return {
    stage: "complete",
    status: args.legacyRemaining === 0 ? ("verified" as const) : ("failed" as const),
  };
}

function statusAfterBoundedAudit(isDone: boolean, legacyRemaining: number) {
  if (!isDone) {
    return "running" as const;
  }
  return legacyRemaining === 0 ? ("verified" as const) : ("failed" as const);
}

interface BookingEntitlementPageArgs {
  dryRun: boolean;
  limit?: number;
  timestamp: number;
}

async function runBookingEntitlementQuarantineAuditPage(
  ctx: MutationCtx,
  registry: Doc<"dataMigrationRegistry">,
  args: BookingEntitlementPageArgs
) {
  const page = await bookingEntitlementQuarantinePage(
    ctx,
    registry.cursor,
    boundedLimit(args.limit)
  );
  const pageQuarantined = page.page.filter((row) => row.resolvedAt === undefined).length;
  const legacyRemaining = registry.legacyRemaining + pageQuarantined;
  const status = statusAfterBoundedAudit(page.isDone, legacyRemaining);
  const stage = page.isDone ? "complete" : "quarantine-verify";
  const cursor = page.isDone ? null : page.continueCursor;
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    cursor,
    legacyRemaining,
    quarantined: (registry.quarantined ?? 0) + pageQuarantined,
    stage,
    status,
    updatedAt: args.timestamp,
    ...propertiesWhen(status === "verified", () => ({ verifiedAt: args.timestamp })),
  });
  return {
    converted: 0,
    cursor,
    dryRun: args.dryRun,
    legacyRemaining,
    processed: 0,
    quarantined: pageQuarantined,
    stage,
    status,
    table: "bookingEntitlements",
  };
}

async function runBookingEntitlementSourcePage(
  ctx: MutationCtx,
  registry: Doc<"dataMigrationRegistry">,
  args: BookingEntitlementPageArgs
) {
  const limit = boundedLimit(args.limit);
  const page = await ctx.db
    .query("bookings")
    .order("asc")
    .paginate({ cursor: registry.cursor, numItems: limit });
  const apply = !(args.dryRun || registry.stage === "verify");
  const results = await Promise.all(
    page.page.map((booking) => processBookingEntitlement(ctx, booking, apply, !args.dryRun))
  );
  const pageConverted = results.reduce((total, result) => total + result.converted, 0);
  const pageQuarantined =
    registry.stage === "verify"
      ? 0
      : results.reduce((total, result) => total + result.quarantined, 0);
  const pageRemaining = results.reduce((total, result) => total + result.remaining, 0);
  const converted = registry.converted + pageConverted;
  const processed = registry.processed + page.page.length;
  let quarantined = (registry.quarantined ?? 0) + pageQuarantined;
  const observedLegacyRemaining = registry.legacyRemaining + pageRemaining;
  let { stage, status } = completion({
    dryRun: args.dryRun,
    isDone: page.isDone,
    legacyRemaining: observedLegacyRemaining,
    stage: registry.stage,
  });
  let legacyRemaining =
    stage === "verify" && registry.stage !== "verify" ? 0 : observedLegacyRemaining;
  let cursor = page.isDone ? null : page.continueCursor;
  let queueQuarantined = 0;
  if (
    (args.dryRun || registry.stage === "verify") &&
    page.isDone &&
    observedLegacyRemaining === 0
  ) {
    const quarantinePage = await bookingEntitlementQuarantinePage(ctx, null, limit);
    queueQuarantined = quarantinePage.page.filter((row) => row.resolvedAt === undefined).length;
    quarantined += queueQuarantined;
    legacyRemaining = queueQuarantined;
    cursor = quarantinePage.isDone ? null : quarantinePage.continueCursor;
    stage = quarantinePage.isDone ? "complete" : "quarantine-verify";
    status = statusAfterBoundedAudit(quarantinePage.isDone, legacyRemaining);
  }
  await ctx.db.patch("dataMigrationRegistry", registry._id, {
    converted,
    cursor,
    legacyRemaining,
    processed,
    quarantined,
    stage,
    status,
    updatedAt: args.timestamp,
    ...propertiesWhen(status === "verified", () => ({ verifiedAt: args.timestamp })),
  });
  return {
    converted: pageConverted,
    cursor,
    dryRun: args.dryRun,
    legacyRemaining,
    processed: page.page.length,
    quarantined: pageQuarantined + queueQuarantined,
    stage,
    status,
    table: "bookingEntitlements",
  };
}

export const runAuthIdentityMigrationPage = internalMutation({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    ...targetBoundMigrationArgs,
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const spec = specForTable(args.table);
    if (!spec) {
      throw new ConvexError("Unknown auth identity migration table");
    }
    const key = targetBoundMigrationRegistryKey(
      authIdentityMigrationRegistryKey(spec.table, args.dryRun),
      target
    );
    const timestamp = Date.now();
    let registry = await loadRegistry(ctx, key);
    if (args.restart && (registry?.status === "failed" || registry?.status === "verified")) {
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: args.dryRun ? "inventory" : "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get("dataMigrationRegistry", registry._id);
    }
    if (registry?.status === "verified" || registry?.status === "failed") {
      return {
        converted: registry.converted,
        cursor: null,
        dryRun: args.dryRun,
        legacyRemaining: registry.legacyRemaining,
        ...target,
        processed: 0,
        quarantined: registry.quarantined ?? 0,
        stage: registry.stage,
        status: registry.status,
        table: spec.table,
      };
    }
    if (!registry) {
      const id = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: args.dryRun ? "inventory" : "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
      });
      registry = await ctx.db.get("dataMigrationRegistry", id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize auth identity migration registry");
    }
    // SAFETY: each migration spec supplies a schema-owned table name hidden by the generated DB union.
    const db = ctx.db as typeof ctx.db & DynamicDatabase;
    const page = await db
      .query(spec.table)
      .order("asc")
      .paginate({ cursor: registry.cursor, numItems: boundedLimit(args.limit) });
    const results = await Promise.all(
      page.page.map((row) =>
        processRow(ctx, db, row, spec, args.dryRun || registry?.stage === "verify")
      )
    );
    const pageConverted = results.reduce((total, result) => total + result.converted, 0);
    const pageQuarantined =
      registry.stage === "verify"
        ? 0
        : results.reduce((total, result) => total + result.quarantined, 0);
    const pageRemaining = results.reduce((total, result) => total + result.remaining, 0);
    const converted = registry.converted + pageConverted;
    const processed = registry.processed + page.page.length;
    const quarantined = (registry.quarantined ?? 0) + pageQuarantined;
    const observedLegacyRemaining = registry.legacyRemaining + pageRemaining;
    const state = completion({
      dryRun: args.dryRun,
      isDone: page.isDone,
      legacyRemaining: observedLegacyRemaining,
      stage: registry.stage,
    });
    const legacyRemaining =
      state.stage === "verify" && registry.stage !== "verify" ? 0 : observedLegacyRemaining;
    const cursor = page.isDone ? null : page.continueCursor;
    await ctx.db.patch("dataMigrationRegistry", registry._id, {
      converted,
      cursor,
      legacyRemaining,
      processed,
      quarantined,
      stage: state.stage,
      status: state.status,
      updatedAt: timestamp,
      ...propertiesWhen(state.status === "verified", () => ({ verifiedAt: timestamp })),
    });
    return {
      converted: pageConverted,
      cursor,
      dryRun: args.dryRun,
      legacyRemaining,
      ...target,
      processed: page.page.length,
      quarantined: pageQuarantined,
      stage: state.stage,
      status: state.status,
      table: spec.table,
    };
  },
  returns: migrationResultValidator,
});

export const runBookingEntitlementMigrationPage = internalMutation({
  args: {
    dryRun: v.boolean(),
    limit: v.optional(v.number()),
    restart: v.optional(v.boolean()),
    ...targetBoundMigrationArgs,
  },
  handler: async (ctx, args) => {
    const target = assertTargetBoundMigration(args);
    const key = targetBoundMigrationRegistryKey(bookingEntitlementRegistryKey(args.dryRun), target);
    const timestamp = Date.now();
    let registry = await loadRegistry(ctx, key);
    if (args.restart && (registry?.status === "failed" || registry?.status === "verified")) {
      await ctx.db.patch("dataMigrationRegistry", registry._id, {
        converted: 0,
        cursor: null,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: args.dryRun ? "inventory" : "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
        verifiedAt: undefined,
      });
      registry = await ctx.db.get("dataMigrationRegistry", registry._id);
    }
    if (registry?.status === "verified" || registry?.status === "failed") {
      return {
        converted: registry.converted,
        cursor: null,
        dryRun: args.dryRun,
        legacyRemaining: registry.legacyRemaining,
        ...target,
        processed: 0,
        quarantined: registry.quarantined ?? 0,
        stage: registry.stage,
        status: registry.status,
        table: "bookingEntitlements",
      };
    }
    if (!registry) {
      const id = await ctx.db.insert("dataMigrationRegistry", {
        converted: 0,
        cursor: null,
        key,
        legacyRemaining: 0,
        processed: 0,
        quarantined: 0,
        stage: args.dryRun ? "inventory" : "backfill",
        startedAt: timestamp,
        status: "running",
        updatedAt: timestamp,
      });
      registry = await ctx.db.get("dataMigrationRegistry", id);
    }
    if (!registry) {
      throw new ConvexError("Unable to initialize Booking Entitlement migration registry");
    }
    const pageArgs = { dryRun: args.dryRun, limit: args.limit, timestamp };
    const result =
      registry.stage === "quarantine-verify"
        ? await runBookingEntitlementQuarantineAuditPage(ctx, registry, pageArgs)
        : await runBookingEntitlementSourcePage(ctx, registry, pageArgs);
    return { ...result, ...target };
  },
  returns: migrationResultValidator,
});

export const getBookingEntitlementMigrationStatus = internalQuery({
  args: { dryRun: v.boolean(), ...migrationTargetArgs },
  handler: async (ctx, args) => {
    const target = assertMigrationTarget(args);
    const registry = await loadRegistry(
      ctx,
      targetBoundMigrationRegistryKey(bookingEntitlementRegistryKey(args.dryRun), target)
    );
    return registry
      ? {
          converted: registry.converted,
          cursor: registry.cursor,
          dryRun: args.dryRun,
          legacyRemaining: registry.legacyRemaining,
          ...target,
          processed: registry.processed,
          quarantined: registry.quarantined ?? 0,
          stage: registry.stage,
          status: registry.status,
          table: "bookingEntitlements",
        }
      : {
          converted: 0,
          cursor: null,
          dryRun: args.dryRun,
          legacyRemaining: 0,
          ...target,
          processed: 0,
          quarantined: 0,
          stage: "pending",
          status: "pending" as const,
          table: "bookingEntitlements",
        };
  },
  returns: migrationResultValidator,
});

export const getAuthIdentityMigrationStatus = internalQuery({
  args: { dryRun: v.boolean(), ...migrationTargetArgs, table: v.string() },
  handler: async (ctx, args) => {
    const target = assertMigrationTarget(args);
    if (!specForTable(args.table)) {
      throw new ConvexError("Unknown auth identity migration table");
    }
    const registry = await loadRegistry(
      ctx,
      targetBoundMigrationRegistryKey(
        authIdentityMigrationRegistryKey(args.table, args.dryRun),
        target
      )
    );
    return registry
      ? {
          converted: registry.converted,
          cursor: registry.cursor,
          dryRun: args.dryRun,
          legacyRemaining: registry.legacyRemaining,
          ...target,
          processed: registry.processed,
          quarantined: registry.quarantined ?? 0,
          stage: registry.stage,
          status: registry.status,
          table: args.table,
        }
      : {
          converted: 0,
          cursor: null,
          dryRun: args.dryRun,
          legacyRemaining: 0,
          ...target,
          processed: 0,
          quarantined: 0,
          stage: "pending",
          status: "pending" as const,
          table: args.table,
        };
  },
  returns: migrationResultValidator,
});
