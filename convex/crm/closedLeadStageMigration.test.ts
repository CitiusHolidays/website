import { describe, expect, test } from "bun:test";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import { isRuntimeString } from "../lib/runtimeValues";
import {
  CLOSED_LEAD_STAGE_MIGRATION_KEY,
  getClosedLeadStageMigrationStatus,
  migrateClosedLeadStages,
  verifyClosedLeadStages,
} from "./closedLeadStageMigration";
import { leadStageStorageValidator, leadStageValidator } from "./queryValidators";

interface Row {
  _id: string;
  [key: string]: RuntimeValue;
}

function makeCtx() {
  const tables = {
    dataMigrationRegistry: [],
    jobCards: [{ _id: "job_1", leadStage: "Closed" }],
    queries: [
      { _id: "query_1", leadStage: "Closed", updatedAt: 1 },
      { _id: "query_2", leadStage: "Proposal", updatedAt: 1 },
      { _id: "query_3", leadStage: "Closed", updatedAt: 1 },
    ],
  } satisfies Record<string, Row[]>;
  const rows = (table: string) => tables[table] ?? [];
  const queryBuilder = (table: string) => {
    let selected = rows(table);
    const builder = {
      order: () => builder,
      paginate: ({ cursor, numItems }: { cursor: string | null; numItems: number }) => {
        const start = cursor ? Number(cursor) : 0;
        const page = selected.slice(start, start + numItems).map((row) => ({ ...row }));
        const end = start + page.length;
        return Promise.resolve({
          continueCursor: String(end),
          isDone: end >= selected.length,
          page,
        });
      },
      unique: () => Promise.resolve(selected[0] ?? null),
      withIndex(_name: string, callback: (q: any) => RuntimeValue) {
        const filters: Array<{ field: string; value: unknown }> = [];
        const q = {
          eq(field: string, value: RuntimeValue) {
            filters.push({ field, value });
            return q;
          },
        };
        callback(q);
        selected = selected.filter((row) =>
          filters.every(({ field, value }) => row[field] === value)
        );
        return builder;
      },
    };
    return builder;
  };
  const ctx = {
    db: {
      get: (table: string, id?: string) => {
        const resolvedId = id ?? table;
        return Promise.resolve(
          Object.values(tables)
            .flat()
            .find((row) => row._id === resolvedId) ?? null
        );
      },
      insert: (table: string, document: RuntimeObject) => {
        const id = `${table}_${rows(table).length + 1}`;
        tables[table] = [...rows(table), { _id: id, ...document }];
        return Promise.resolve(id);
      },
      patch: (tableOrId: string, idOrPatch: string | RuntimeObject, maybePatch?: RuntimeObject) => {
        const id = isRuntimeString(idOrPatch) ? idOrPatch : tableOrId;
        const patch = isRuntimeString(idOrPatch) ? (maybePatch ?? {}) : idOrPatch;
        for (const [table, tableRows] of Object.entries(tables)) {
          const index = tableRows.findIndex((row) => row._id === id);
          if (index >= 0) {
            tables[table][index] = { ...tableRows[index], ...patch };
            return Promise.resolve();
          }
        }
        return Promise.resolve();
      },
      query: queryBuilder,
    },
    scheduler: { runAfter: async () => undefined },
  };
  return { ctx, tables };
}

async function withMigrationSecret(run: () => Promise<void>) {
  const previous = process.env.MIGRATION_SECRET;
  process.env.MIGRATION_SECRET = "test-secret";
  try {
    await run();
  } finally {
    if (previous === undefined) {
      delete process.env.MIGRATION_SECRET;
    } else {
      process.env.MIGRATION_SECRET = previous;
    }
  }
}

describe("Closed lead-stage migration", () => {
  test("keeps Closed in storage compatibility but rejects it from public writers", () => {
    const literals = (validator: { json: any }) =>
      validator.json.value.map((entry: { value: string }) => entry.value);
    expect(literals(leadStageValidator)).not.toContain("Closed");
    expect(literals(leadStageStorageValidator)).toContain("Closed");
  });

  test("dry-run counts only Query residuals without changing any record", async () => {
    await withMigrationSecret(async () => {
      const { ctx, tables } = makeCtx();
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const result = await (migrateClosedLeadStages as any)._handler(ctx, {
        dryRun: true,
        limit: 100,
        secret: "test-secret",
      });

      expect(result).toMatchObject({ dryRun: true, legacyRemaining: 2, status: "failed" });
      expect(tables.queries.map((query) => query.leadStage)).toEqual([
        "Closed",
        "Proposal",
        "Closed",
      ]);
      expect(tables.jobCards[0]?.leadStage).toBe("Closed");
    });
  });

  test("resumes from the server registry and verifies zero residuals independently", async () => {
    await withMigrationSecret(async () => {
      const { ctx, tables } = makeCtx();
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const first = await (migrateClosedLeadStages as any)._handler(ctx, {
        dryRun: false,
        limit: 2,
        secret: "test-secret",
      });
      expect(first).toMatchObject({ converted: 1, cursor: "2", stage: "backfill" });

      // SAFETY: This test controls the asserted value at the framework boundary below.
      const second = await (migrateClosedLeadStages as any)._handler(ctx, {
        dryRun: false,
        limit: 2,
        secret: "test-secret",
      });
      expect(second).toMatchObject({ converted: 1, cursor: null, stage: "verify" });
      expect(tables.queries.map((query) => query.leadStage)).toEqual(["Lost", "Proposal", "Lost"]);

      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (verifyClosedLeadStages as any)._handler(ctx, {
        limit: 2,
        secret: "test-secret",
      });
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const verified = await (verifyClosedLeadStages as any)._handler(ctx, {
        limit: 2,
        secret: "test-secret",
      });
      expect(verified).toMatchObject({ legacyRemaining: 0, status: "verified" });

      // SAFETY: This test controls the asserted value at the framework boundary below.
      const status = await (getClosedLeadStageMigrationStatus as any)._handler(ctx, {
        secret: "test-secret",
      });
      expect(status).toMatchObject({
        key: CLOSED_LEAD_STAGE_MIGRATION_KEY,
        legacyRemaining: 0,
        verified: true,
      });
      expect(tables.jobCards[0]?.leadStage).toBe("Closed");
    });
  });

  test("restarts a failed verification without accepting stale residual state", async () => {
    await withMigrationSecret(async () => {
      const { ctx, tables } = makeCtx();
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await (migrateClosedLeadStages as any)._handler(ctx, {
        dryRun: false,
        limit: 100,
        secret: "test-secret",
      });
      tables.queries[1] = { ...tables.queries[1], leadStage: "Closed" };
      // SAFETY: This test controls the asserted value at the framework boundary below.
      const failed = await (verifyClosedLeadStages as any)._handler(ctx, {
        limit: 100,
        secret: "test-secret",
      });
      expect(failed).toMatchObject({ legacyRemaining: 1, status: "failed" });

      // SAFETY: This test controls the asserted value at the framework boundary below.
      const retry = await (migrateClosedLeadStages as any)._handler(ctx, {
        dryRun: false,
        limit: 100,
        secret: "test-secret",
      });
      expect(retry).toMatchObject({ converted: 1, legacyRemaining: 0, stage: "verify" });
      expect(tables.queries[1]?.leadStage).toBe("Lost");
    });
  });
});
