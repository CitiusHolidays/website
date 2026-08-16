import { afterEach, describe, expect, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "./lib/runtimeValues";
import {
  backfillTravelBatchSummaries,
  getTravelBatchSummaryMigrationStatus,
  verifyTravelBatchSummaries,
} from "./migrations";
import { TRAVEL_BATCH_SUMMARY_MIGRATION_KEY } from "./travelBatchSummaryMigration";

interface Row {
  _creationTime: number;
  _id: string;
  [key: string]: RuntimeValue;
}

function migrationContext(initial: Record<string, Row[]>) {
  const tables = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])
  );
  const ctx = {
    db: {
      get: (_table: string, id: string) =>
        Promise.resolve(
          Object.values(tables)
            .flat()
            .find((row) => row._id === id) ?? null
        ),
      insert: (table: string, value: RuntimeObject) => {
        const id = `${table}_${(tables[table]?.length ?? 0) + 1}`;
        tables[table] ||= [];
        tables[table].push({ _creationTime: Date.now(), _id: id, ...value });
        return Promise.resolve(id);
      },
      patch: (_table: string, id: string, value: RuntimeObject) => {
        const row = Object.values(tables)
          .flat()
          .find((candidate) => candidate._id === id);
        if (row) {
          Object.assign(row, value);
        }
        return Promise.resolve();
      },
      query: (table: string) => {
        let rows = [...(tables[table] ?? [])];
        const builder = {
          order: () => {
            rows.sort((left, right) => left._creationTime - right._creationTime);
            return builder;
          },
          paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
            const start = cursor ? Number(cursor) : 0;
            const page = rows.slice(start, start + numItems);
            const next = start + page.length;
            return Promise.resolve({
              continueCursor: String(next),
              isDone: next >= rows.length,
              page,
            });
          },
          unique: () => Promise.resolve(rows[0] ?? null),
          withIndex: (
            _name: string,
            apply: (query: {
              eq: (field: string, value: RuntimeValue) => RuntimeValue;
            }) => RuntimeValue
          ) => {
            const filters: Array<{ field: string; value: unknown }> = [];
            const query = {
              eq: (field: string, value: RuntimeValue) => {
                filters.push({ field, value });
                return query;
              },
            };
            apply(query);
            rows = rows.filter((row) =>
              filters.every((filter) => row[filter.field] === filter.value)
            );
            return builder;
          },
        };
        return builder;
      },
    },
  };
  return { ctx, tables };
}

function registry(overrides: RuntimeObject = {}): Row {
  return {
    _creationTime: 1,
    _id: "migration_1",
    converted: 0,
    cursor: null,
    key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
    legacyRemaining: 0,
    processed: 0,
    stage: "backfill",
    startedAt: 1,
    status: "running",
    updatedAt: 1,
    ...overrides,
  };
}

afterEach(() => {
  Reflect.deleteProperty(process.env, "MIGRATION_SECRET");
});

describe("Travel Batch summary migration verification", () => {
  test("resumes by server cursor and never decreases the scalar counter", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [],
      jobCards: [
        {
          _creationTime: 1,
          _id: "job_1",
          travelBatchCount: 9,
          travelBatchSummaries: [{ batchCode: "B03", confirmedPax: 2 }],
        },
        {
          _creationTime: 2,
          _id: "job_2",
          travelBatchSummaries: [{ code: "B07", pax: 3, reference: "Batch 7" }],
        },
      ],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await (backfillTravelBatchSummaries as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const second = await (backfillTravelBatchSummaries as any)._handler(ctx, {
      cursor: "999",
      limit: 1,
      secret: "migration-secret",
    });

    expect(first).toMatchObject({ cursor: "1", stage: "backfill", status: "running" });
    expect(second).toMatchObject({ cursor: null, stage: "verify", status: "running" });
    expect(tables.jobCards.map((job) => job.travelBatchCount)).toEqual([9, 7]);
    expect(tables.jobCards.every((job) => job.travelBatchSummaries === undefined)).toBe(true);
  });

  test("uses an independent resumable scan before readiness becomes true", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx } = migrationContext({
      dataMigrationRegistry: [registry({ stage: "verify" })],
      jobCards: [
        { _creationTime: 1, _id: "job_1", travelBatchCount: 1 },
        { _creationTime: 2, _id: "job_2", travelBatchCount: 2 },
      ],
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const first = await (verifyTravelBatchSummaries as any)._handler(ctx, {
      limit: 1,
      secret: "migration-secret",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const second = await (verifyTravelBatchSummaries as any)._handler(ctx, {
      cursor: "999",
      limit: 1,
      secret: "migration-secret",
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const status = await (getTravelBatchSummaryMigrationStatus as any)._handler(ctx, {
      secret: "migration-secret",
    });

    expect(first).toMatchObject({ cursor: "1", stage: "verify", status: "running" });
    expect(second).toMatchObject({
      cursor: null,
      legacyRemaining: 0,
      stage: "complete",
      status: "verified",
    });
    expect(status).toMatchObject({
      key: TRAVEL_BATCH_SUMMARY_MIGRATION_KEY,
      legacyRemaining: 0,
      verified: true,
    });
  });

  test("fails closed for an unreviewed legacy shape", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx, tables } = migrationContext({
      dataMigrationRegistry: [],
      jobCards: [
        {
          _creationTime: 1,
          _id: "job_1",
          travelBatchCount: 4,
          travelBatchSummaries: [{ batchCode: "B05", unknownLegacyKey: true }],
        },
      ],
    });

    await expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      (backfillTravelBatchSummaries as any)._handler(ctx, {
        limit: 100,
        secret: "migration-secret",
      })
    ).rejects.toThrow("Unknown Travel Batch summary fields");
    expect(tables.jobCards[0]).toMatchObject({ travelBatchCount: 4 });
    expect(tables.jobCards[0].travelBatchSummaries).toHaveLength(1);
  });

  test("reports residual summaries as a failed verification", async () => {
    process.env.MIGRATION_SECRET = "migration-secret";
    const { ctx } = migrationContext({
      dataMigrationRegistry: [registry({ stage: "verify" })],
      jobCards: [
        {
          _creationTime: 1,
          _id: "job_1",
          travelBatchSummaries: [{ batchCode: "B01" }],
        },
      ],
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (verifyTravelBatchSummaries as any)._handler(ctx, {
      limit: 100,
      secret: "migration-secret",
    });
    expect(result).toMatchObject({ legacyRemaining: 1, stage: "verify", status: "failed" });
  });
});
