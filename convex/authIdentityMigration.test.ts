import { afterEach, describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import {
  runAuthIdentityMigrationPage,
  runBookingEntitlementMigrationPage,
} from "./authIdentityMigration";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";

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

const previousSecret = process.env.MIGRATION_SECRET;

afterEach(() => {
  if (previousSecret === undefined) {
    delete process.env.MIGRATION_SECRET;
  } else {
    process.env.MIGRATION_SECRET = previousSecret;
  }
});

describe("Bounded auth identity migration", () => {
  test("Converts a linked booking, creates its entitlement, then verifies zero residual", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler;
    const first = await run(ctx, {
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
  });

  test("Rejects calls without the target migration capability", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx } = makeCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      fromAny<any, unknown>(runAuthIdentityMigrationPage)._handler(ctx, {
        dryRun: true,
        secret: "wrong-secret",
        table: "bookings",
      })
    ).rejects.toThrow("Invalid migration secret");
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
      dryRun: false,
      secret: "local-test-secret",
      table: "bookings",
    });

    expect(tables.bookings[0].userId).toBe("issuer-a|customer");
    expect(tables.customerJourneyEntitlements).toHaveLength(1);
    expect(tables.customerJourneyEntitlements[0].authUserId).toBe("issuer-a|customer");
    expect(tables.customerJourneyEntitlements[0].revokedAt).toBe(2);
    const verified = await run(ctx, {
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
      dryRun: false,
      secret: "local-test-secret",
    });
    expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });
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
  });

  test("Quarantines linked-identity conflicts without aborting the page", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    tables.bookings[0].userId = "issuer-a|customer";
    tables.authIdentityLinks[0].status = "quarantined";

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await fromAny<any, unknown>(runBookingEntitlementMigrationPage)._handler(ctx, {
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
