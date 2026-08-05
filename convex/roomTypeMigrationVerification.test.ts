import { afterEach, describe, expect, test } from "bun:test";
import { assertMatchesRegisteredReturnContract } from "./crm/validateReturnContract";
import { getRoomTypeMigrationStatus, migrateRoomTypes, verifyRoomTypes } from "./migrations";

interface Row {
  _id: string;
  [key: string]: unknown;
}

function migrationContext(initial: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  ) as Record<string, Row[]>;
  const ctx = {
    db: {
      get: async (id: string) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            return row;
          }
        }
        return null;
      },
      insert: async (table: string, value: Record<string, unknown>) => {
        const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
        tables[table] ||= [];
        tables[table].push({ _creationTime: Date.now(), _id: id, ...value });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        for (const rows of Object.values(tables)) {
          const row = rows.find((candidate) => candidate._id === id);
          if (row) {
            Object.assign(row, value);
            return;
          }
        }
      },
      query: (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          order: (direction: "asc" | "desc") => {
            rows.sort((left, right) =>
              direction === "asc"
                ? Number(left._creationTime ?? 0) - Number(right._creationTime ?? 0)
                : Number(right._creationTime ?? 0) - Number(left._creationTime ?? 0)
            );
            return builder;
          },
          paginate: async ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
            const start = cursor ? Number(cursor) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return {
              continueCursor: String(next),
              isDone: next >= rows.length,
              page,
            };
          },
          unique: async () => rows[0] ?? null,
          withIndex: (_name: string, callback?: (query: any) => unknown) => {
            if (callback) {
              const filters: Array<{ field: string; value: unknown }> = [];
              const index = {
                eq: (field: string, value: unknown) => {
                  filters.push({ field, value });
                  return index;
                },
              };
              callback(index);
              rows = rows.filter((row) =>
                filters.every((filter) => row[filter.field] === filter.value)
              );
            }
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return { ctx, tables };
}

function registry(overrides: Record<string, unknown> = {}) {
  return {
    _id: "migration_1",
    converted: 0,
    cursor: null,
    key: "room-type-v2",
    legacyRemaining: 0,
    processed: 0,
    stage: "travellers",
    startedAt: 1,
    status: "running",
    updatedAt: 1,
    ...overrides,
  };
}

afterEach(() => {
  Reflect.deleteProperty(process.env, "MIGRATION_SECRET");
});

describe("room-type migration verification", () => {
  test("resumes migration from server state and ignores a forged caller cursor", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [],
      roomingListEntries: [],
      travellers: [
        {
          _creationTime: 1,
          _id: "traveller_1",
          hotelAllocation: "SGL",
          roomType: "SGL",
          updatedAt: 1,
        },
        {
          _creationTime: 2,
          _id: "traveller_2",
          hotelAllocation: "DBL",
          roomType: "DBL",
          updatedAt: 1,
        },
      ],
    });

    const first = await (migrateRoomTypes as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    const second = await (migrateRoomTypes as any)._handler(ctx, {
      cursor: "999",
      limit: 1,
      secret: "migration-secret",
    });

    assertMatchesRegisteredReturnContract(migrateRoomTypes, first);
    assertMatchesRegisteredReturnContract(migrateRoomTypes, second);
    expect(first).toMatchObject({ cursor: "1", stage: "travellers", status: "running" });
    expect(tables.travellers.map((row) => row.roomType)).toEqual(["Single", "Double"]);
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      cursor: null,
      stage: "roomingListEntries",
      status: "running",
    });
  });

  test("uses a separate persisted scan and resumes verification after interruption", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [registry({ stage: "verifyTravellers" })],
      roomingListEntries: [],
      travellers: [
        {
          _creationTime: 1,
          _id: "traveller_1",
          hotelAllocation: "Single",
          roomType: "Single",
        },
        {
          _creationTime: 2,
          _id: "traveller_2",
          hotelAllocation: "Double",
          roomType: "Double",
        },
      ],
    });

    const first = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    const second = await (verifyRoomTypes as any)._handler(ctx, {
      cursor: "999",
      limit: 1,
      secret: "migration-secret",
    });

    expect(first).toMatchObject({ cursor: "1", stage: "verifyTravellers", status: "running" });
    expect(second).toMatchObject({
      cursor: null,
      legacyRemaining: 0,
      stage: "verifyRoomingListEntries",
      status: "running",
    });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      cursor: null,
      stage: "verifyRoomingListEntries",
    });
  });

  test("keeps readiness false and reports residual legacy and mismatched records", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [registry({ stage: "verifyTravellers" })],
      roomingListEntries: [{ _creationTime: 1, _id: "rooming_1", roomType: "TPL", updatedAt: 1 }],
      travellers: [
        {
          _creationTime: 1,
          _id: "traveller_1",
          hotelAllocation: "Single",
          roomType: "Twin",
        },
      ],
    });

    const travellers = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });
    const rooming = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });

    expect(travellers).toMatchObject({ legacyRemaining: 1, mismatchedTravellers: 1 });
    expect(rooming).toMatchObject({
      legacyRemaining: 2,
      legacyRoomingRoomTypes: 1,
      stage: "verifyRoomingListEntries",
      status: "failed",
    });
    expect(tables.dataMigrationRegistry[0]).toMatchObject({
      legacyRemaining: 2,
      status: "failed",
    });
    const status = await (getRoomTypeMigrationStatus as any)._handler(ctx, {
      secret: "migration-secret",
    });
    expect(status).toMatchObject({ legacyRemaining: 2, verified: false });
  });

  test("sets readiness only after both clean scans finish and remains idempotent", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx } = migrationContext({
      dataMigrationRegistry: [registry({ stage: "verifyTravellers" })],
      roomingListEntries: [{ _creationTime: 1, _id: "rooming_1", roomType: "Twin", updatedAt: 1 }],
      travellers: [
        {
          _creationTime: 1,
          _id: "traveller_1",
          hotelAllocation: "Twin",
          roomType: "Twin",
        },
      ],
    });

    await (verifyRoomTypes as any)._handler(ctx, { limit: 10, secret: "migration-secret" });
    const completed = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });
    const rerun = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });

    expect(completed).toMatchObject({
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(rerun).toMatchObject({
      legacyRemaining: 0,
      processed: 0,
      stage: "complete",
      status: "verified",
    });
    const status = await (getRoomTypeMigrationStatus as any)._handler(ctx, {
      secret: "migration-secret",
    });
    assertMatchesRegisteredReturnContract(getRoomTypeMigrationStatus, status);
    expect(status).toMatchObject({ stage: "complete", verified: true });
  });

  test("a failed residual scan can restart migration and reach a clean rerun", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [
        registry({ legacyRemaining: 2, stage: "verifyRoomingListEntries", status: "failed" }),
      ],
      roomingListEntries: [{ _creationTime: 1, _id: "rooming_1", roomType: "TPL", updatedAt: 1 }],
      travellers: [
        {
          _creationTime: 1,
          _id: "traveller_1",
          hotelAllocation: "SGL",
          roomType: "SGL",
          updatedAt: 1,
        },
      ],
    });

    await (migrateRoomTypes as any)._handler(ctx, { limit: 10, secret: "migration-secret" });
    await (migrateRoomTypes as any)._handler(ctx, { limit: 10, secret: "migration-secret" });
    await (verifyRoomTypes as any)._handler(ctx, { limit: 10, secret: "migration-secret" });
    const completed = await (verifyRoomTypes as any)._handler(ctx, {
      limit: 10,
      secret: "migration-secret",
    });

    expect(tables.travellers[0]).toMatchObject({
      hotelAllocation: "Single",
      roomType: "Single",
    });
    expect(tables.roomingListEntries[0]?.roomType).toBe("Triple");
    expect(completed).toMatchObject({ legacyRemaining: 0, status: "verified" });
  });
});
