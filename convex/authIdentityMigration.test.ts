import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  getAuthIdentityMigrationStatus,
  getBookingEntitlementMigrationStatus,
  runAuthIdentityMigrationPage,
  runBookingEntitlementMigrationPage,
} from "./authIdentityMigration";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import { targetBoundMigrationRegistryKey } from "./migrationAuth";

interface Row {
  _id: string;
  [field: string]: RuntimeValue;
}

function makeCtx() {
  const tables = {
    authIdentityLinks: [
      {
        _id: "link_1",
        canonicalAuthUserId: "issuer-a|customer",
        legacyAuthUserId: "legacy-customer",
        status: "linked",
      },
    ],
    authIdentityQuarantines: [],
    bookings: [
      {
        _id: "booking_1",
        createdAt: 1,
        userId: "legacy-customer",
      },
    ],
    customerJourneyEntitlements: [],
    dataMigrationRegistry: [],
    notificationUnreadProjectionReadiness: [],
  } satisfies Record<string, Row[]>;
  let nextId = 1;
  const db = {
    get: (tableOrId: string, maybeId?: string) => {
      const id = maybeId ?? tableOrId;
      return (
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null
      );
    },
    insert: (table: string, value: RuntimeObject) => {
      const id = `${table}_${nextId}`;
      nextId += 1;
      tables[table] ??= [];
      tables[table].push({ _id: id, ...value });
      return id;
    },
    patch: (tableOrId: string, idOrValue: string | RuntimeObject, maybeValue?: RuntimeObject) => {
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const id = maybeValue ? fromPartial<string>(idOrValue) : tableOrId;
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const value = maybeValue ?? fromPartial<RuntimeObject>(idOrValue);
      const row = Object.values(tables)
        .flat()
        .find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, value);
      }
    },
    query: (table: string) => {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        first: async () => rows[0] ?? null,
        order: () => builder,
        paginate: async () => ({ continueCursor: "", isDone: true, page: rows }),
        take: async (limit: number) => rows.slice(0, limit),
        unique: async () => rows[0] ?? null,
        withIndex: (_index: string, callback: (range: any) => RuntimeValue) => {
          const filters: [string, unknown][] = [];
          const range = {
            eq: (field: string, value: RuntimeValue) => {
              filters.push([field, value]);
              return range;
            },
          };
          callback(range);
          rows = rows.filter((row) => filters.every(([field, value]) => row[field] === value));
          return builder;
        },
      };
      return builder;
    },
  };
  return { ctx: { db }, tables };
}

const TARGET_IDENTITY = {
  targetDeployment: "development:test",
  targetEnvironment: "development" as const,
  targetRevision: "test-revision",
};
const MIGRATION_TARGET = {
  expectedTargetDeployment: TARGET_IDENTITY.targetDeployment,
  expectedTargetEnvironment: TARGET_IDENTITY.targetEnvironment,
  expectedTargetRevision: TARGET_IDENTITY.targetRevision,
} as const;

const previousEnvironment = {
  deployment: process.env.OPERATIONAL_CONTROL_TARGET_ID,
  environment: process.env.VERCEL_ENV,
  revision: process.env.OPERATIONAL_CONTROL_SOURCE_REVISION,
  secret: process.env.MIGRATION_SECRET,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  process.env.OPERATIONAL_CONTROL_TARGET_ID = MIGRATION_TARGET.expectedTargetDeployment;
  process.env.VERCEL_ENV = MIGRATION_TARGET.expectedTargetEnvironment;
  process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = MIGRATION_TARGET.expectedTargetRevision;
});

afterEach(() => {
  restore("MIGRATION_SECRET", previousEnvironment.secret);
  restore("OPERATIONAL_CONTROL_TARGET_ID", previousEnvironment.deployment);
  restore("VERCEL_ENV", previousEnvironment.environment);
  restore("OPERATIONAL_CONTROL_SOURCE_REVISION", previousEnvironment.revision);
});

describe("Bounded auth identity migration", () => {
  test("Converts a linked booking, creates its entitlement, then verifies zero residual", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler;
    const first = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    });
    expect(first).toMatchObject({ converted: 1, stage: "verify", status: "running" });
    expect(tables.bookings[0].userId).toBe("issuer-a|customer");
    expect(tables.customerJourneyEntitlements).toHaveLength(1);
    expect(tables.customerJourneyEntitlements[0]).toMatchObject({
      authUserId: "issuer-a|customer",
      bookingId: "booking_1",
      source: "identity_migration",
    });

    const verified = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, stage: "complete", status: "verified" });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      converted: 1,
      legacyRemaining: 0,
      quarantined: 0,
      status: "verified",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const status = await fromAny<any, unknown>(getAuthIdentityMigrationStatus)._handler(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      table: "bookings",
    });
    expect(status).toMatchObject({ ...TARGET_IDENTITY, status: "verified" });
  });

  test("Rejects calls without the target migration capability", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx } = makeCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler(ctx, {
        ...MIGRATION_TARGET,
        dryRun: true,
        secret: "wrong-secret",
        table: "bookings",
      })
    ).rejects.toThrow("Invalid migration secret");
  });

  test("Rejects a valid secret for the wrong target before writing migration state", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    const original = structuredClone(tables);

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler(ctx, {
        ...MIGRATION_TARGET,
        dryRun: false,
        expectedTargetRevision: "wrong-revision",
        secret: "local-test-secret",
        table: "bookings",
      })
    ).rejects.toThrow("OPERATIONAL_CONTROL_TARGET_MISMATCH");
    expect(tables).toEqual(original);
  });

  test("Keeps persisted migration state isolated across source revisions", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler;

    await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: true,
      secret: "local-test-secret",
      table: "bookings",
    });
    process.env.OPERATIONAL_CONTROL_SOURCE_REVISION = "next-revision";
    const nextTarget = {
      ...MIGRATION_TARGET,
      expectedTargetRevision: "next-revision",
    };
    const next = await run(ctx, {
      ...nextTarget,
      dryRun: true,
      secret: "local-test-secret",
      table: "bookings",
    });

    expect(next).toMatchObject({ status: "failed", targetRevision: "next-revision" });
    expect(tables.dataMigrationRegistry).toHaveLength(2);
    expect(new Set(tables.dataMigrationRegistry.map((row) => row.key)).size).toBe(2);
  });

  test("Restarts a failed table after its authoritative identity link is remediated", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    const [authoritativeLink] = tables.authIdentityLinks.splice(0);
    if (!authoritativeLink) {
      throw new Error("Missing authoritative identity-link fixture");
    }
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler;
    const args = {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    };

    await expect(run(ctx, args)).resolves.toMatchObject({
      stage: "verify",
      status: "running",
    });
    await expect(run(ctx, args)).resolves.toMatchObject({
      legacyRemaining: 1,
      stage: "complete",
      status: "failed",
    });

    tables.authIdentityLinks.push(authoritativeLink);
    await expect(run(ctx, args)).resolves.toMatchObject({
      legacyRemaining: 1,
      status: "failed",
    });
    expect(tables.bookings[0].userId).toBe("legacy-customer");

    await expect(run(ctx, { ...args, restart: true })).resolves.toMatchObject({
      converted: 1,
      legacyRemaining: 0,
      stage: "verify",
      status: "running",
    });
    await expect(run(ctx, args)).resolves.toMatchObject({
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(tables.bookings[0].userId).toBe("issuer-a|customer");
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      converted: 1,
      legacyRemaining: 0,
      processed: 2,
      quarantined: 0,
      status: "verified",
      verifiedAt: expect.any(Number),
    });
  });

  test("Does not reactivate a purchaser entitlement that Staff explicitly revoked", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.customerJourneyEntitlements.push({
      _id: "entitlement_revoked",
      authUserId: "legacy-customer",
      bookingId: "booking_1",
      capabilities: ["view_booking"],
      createdAt: 1,
      revokedAt: 2,
      role: "purchaser",
      source: "identity_migration",
      updatedAt: 2,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler;
    await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    });

    expect(tables.bookings[0].userId).toBe("issuer-a|customer");
    expect(tables.customerJourneyEntitlements).toHaveLength(1);
    expect(tables.customerJourneyEntitlements[0].authUserId).toBe("issuer-a|customer");
    expect(tables.customerJourneyEntitlements[0].revokedAt).toBe(2);
    const verified = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
    expect(tables.customerJourneyEntitlements[0].revokedAt).toBe(2);
  });

  test("Backfills and independently verifies an already-canonical Booking", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings[0].userId = "issuer-a|customer";
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler;

    const backfill = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(backfill).toMatchObject({ converted: 1, stage: "verify", status: "running" });
    expect(tables.customerJourneyEntitlements).toHaveLength(1);
    expect(tables.customerJourneyEntitlements[0]).toMatchObject({
      authUserId: "issuer-a|customer",
      bookingId: "booking_1",
      source: "identity_migration",
    });

    const verified = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const status = await fromAny<any, unknown>(getBookingEntitlementMigrationStatus)._handler(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
    });
    expect(status).toMatchObject({ ...TARGET_IDENTITY, status: "verified" });
  });

  test("Does not verify a malformed canonical purchaser row", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings[0].userId = "issuer-a|customer";
    tables.customerJourneyEntitlements.push({
      _id: "entitlement_malformed",
      authUserId: "issuer-a|customer",
      bookingId: "booking_1",
      capabilities: [],
      createdAt: 1,
      role: "organizer",
      source: "crm_operator_grant",
      updatedAt: 1,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler(ctx, {
      ...MIGRATION_TARGET,
      dryRun: true,
      secret: "local-test-secret",
    });

    expect(result).toMatchObject({ legacyRemaining: 1, status: "failed" });
  });

  test("Quarantines duplicate entitlement conflicts and continues the bounded page", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings[0].userId = "issuer-a|customer";
    tables.bookings.push({
      _id: "booking_2",
      createdAt: 2,
      userId: "issuer-a|customer",
    });
    tables.customerJourneyEntitlements.push(
      {
        _id: "entitlement_active",
        authUserId: "issuer-a|customer",
        bookingId: "booking_1",
        capabilities: ["view_booking"],
        createdAt: 1,
        role: "purchaser",
        source: "identity_migration",
        updatedAt: 1,
      },
      {
        _id: "entitlement_revoked_duplicate",
        authUserId: "issuer-a|customer",
        bookingId: "booking_1",
        capabilities: ["view_booking"],
        createdAt: 1,
        revokedAt: 2,
        role: "purchaser",
        source: "identity_migration",
        updatedAt: 2,
      }
    );

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler;
    const backfill = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });

    expect(backfill).toMatchObject({
      converted: 1,
      processed: 2,
      quarantined: 1,
      stage: "verify",
      status: "running",
    });
    expect(tables.authIdentityQuarantines).toHaveLength(1);
    expect(tables.authIdentityQuarantines[0]).toMatchObject({
      reason: "ambiguous_owner",
      table: "customerJourneyEntitlements",
    });
    expect(tables.authIdentityQuarantines[0]).not.toHaveProperty("legacyAuthUserId");
    expect(tables.customerJourneyEntitlements.some((row) => row.bookingId === "booking_2")).toBe(
      true
    );

    const verified = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(verified).toMatchObject({
      legacyRemaining: 1,
      quarantined: 0,
      status: "failed",
    });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      legacyRemaining: 1,
      quarantined: 1,
      status: "failed",
    });

    const duplicateIndex = tables.customerJourneyEntitlements.findIndex(
      (row) => row._id === "entitlement_revoked_duplicate"
    );
    const [duplicate] = tables.customerJourneyEntitlements.splice(duplicateIndex, 1);
    if (!duplicate) {
      throw new Error("Missing duplicate entitlement fixture");
    }
    const restarted = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      restart: true,
      secret: "local-test-secret",
    });
    expect(restarted).toMatchObject({
      legacyRemaining: 0,
      stage: "verify",
      status: "running",
    });
    const restartVerified = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(restartVerified).toMatchObject({
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(tables.authIdentityQuarantines[0].resolvedAt).toEqual(expect.any(Number));
    expect(tables.authIdentityQuarantines.some((row) => row.resolvedAt === undefined)).toBe(false);

    tables.customerJourneyEntitlements.push(duplicate);
    const recurrent = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      restart: true,
      secret: "local-test-secret",
    });
    expect(recurrent).toMatchObject({ quarantined: 1, stage: "verify", status: "running" });
    expect(tables.authIdentityQuarantines[0].resolvedAt).toBeUndefined();
    const recurrenceFailed = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(recurrenceFailed).toMatchObject({ legacyRemaining: 1, status: "failed" });
  });

  test("Restart audits a legacy verified registry with an orphaned entitlement quarantine", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings.splice(0);
    tables.authIdentityQuarantines.push({
      _id: "quarantine_orphaned_booking",
      createdAt: 1,
      legacyAuthUserIdHash: "a".repeat(64),
      reason: "ambiguous_owner",
      table: "customerJourneyEntitlements",
    });
    tables.dataMigrationRegistry.push({
      _id: "legacy_verified_registry",
      converted: 1,
      cursor: null,
      key: targetBoundMigrationRegistryKey("customer-journey-purchaser-v1", TARGET_IDENTITY),
      legacyRemaining: 0,
      processed: 1,
      quarantined: 0,
      stage: "complete",
      startedAt: 1,
      status: "verified",
      updatedAt: 2,
      verifiedAt: 2,
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler;
    const stale = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(stale).toMatchObject({ legacyRemaining: 0, status: "verified" });

    const restarted = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      restart: true,
      secret: "local-test-secret",
    });
    expect(restarted).toMatchObject({ stage: "verify", status: "running" });

    const failed = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(failed).toMatchObject({
      legacyRemaining: 1,
      quarantined: 1,
      stage: "complete",
      status: "failed",
    });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      legacyRemaining: 1,
      status: "failed",
    });

    const dryRun = await run(ctx, {
      ...MIGRATION_TARGET,
      dryRun: true,
      secret: "local-test-secret",
    });
    expect(dryRun).toMatchObject({
      legacyRemaining: 1,
      quarantined: 1,
      status: "failed",
    });
  });

  test("Quarantines linked-identity conflicts without aborting the page", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings[0].userId = "issuer-a|customer";
    tables.authIdentityLinks[0].status = "quarantined";

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler(ctx, {
      ...MIGRATION_TARGET,
      dryRun: false,
      secret: "local-test-secret",
    });

    expect(result).toMatchObject({
      converted: 0,
      legacyRemaining: 0,
      quarantined: 1,
      stage: "verify",
      status: "running",
    });
    expect(tables.authIdentityQuarantines).toHaveLength(1);
  });
});
