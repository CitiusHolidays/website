import { afterEach, describe, expect, test } from "bun:test";
import { runAuthIdentityMigrationPage } from "./authIdentityMigration";
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
      const id = maybeValue ? (idOrValue as string) : tableOrId;
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const value = maybeValue ?? (idOrValue as RuntimeObject);
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

describe("bounded auth identity migration", () => {
  test("converts a linked booking, creates its entitlement, then verifies zero residual", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx, tables } = makeCtx();
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const run = (runAuthIdentityMigrationPage as any)._handler;
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

  test("rejects calls without the target migration capability", async () => {
    process.env.MIGRATION_SECRET = "local-test-secret";
    const { ctx } = makeCtx();
    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (runAuthIdentityMigrationPage as any)._handler(ctx, {
        dryRun: true,
        secret: "wrong-secret",
        table: "bookings",
      })
    ).rejects.toThrow("Invalid migration secret");
  });
});
