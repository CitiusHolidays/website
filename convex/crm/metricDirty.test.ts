import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Glob } from "bun";
import {
  enqueueDirtySources,
  METRIC_VERSION,
  processDirtyUnit,
  reconcileAll,
} from "./metricAggregates";
import { enqueueMetricSourceDirty } from "./metricDirty";
import { METRIC_SOURCE_TYPES } from "./metricTypes";

const METRIC_SOURCE_PATTERN =
  "approvalRequests|expenseEntries|invoices|jobCards|pnrs|proposals|queries|tickets|travellers|visaRecords";
const DIRECT_SOURCE_WRITE = new RegExp(
  `db\\.(?:insert|patch|delete)\\(\\s*["'](?:${METRIC_SOURCE_PATTERN})["']`
);
const OWNED_SOURCE_WRITE = new RegExp(
  `(?:insert|patch)WithE2eOwnership\\(\\s*ctx,\\s*["'](?:${METRIC_SOURCE_PATTERN})["']`
);
const METRIC_SCHEDULE = /schedule(?:Crm|Finance|JobInvoice)MetricSync(?:Batch)?\(/;

describe("change-driven CRM metric maintenance", () => {
  test("coalesces repeated source writes into one durable dirty unit", async () => {
    const rows: any[] = [];
    const ctx = {
      db: {
        insert: (_table: string, value: Record<string, unknown>) => {
          rows.push({ _id: `dirty-${rows.length + 1}`, ...value });
        },
        patch: (_table: string, id: string, value: Record<string, unknown>) => {
          Object.assign(
            rows.find((row) => row._id === id),
            value
          );
        },
        query: (table: string) => {
          expect(table).toBe("crmMetricDirty");
          return {
            withIndex: (_name: string, configure: (q: any) => unknown) => {
              let key = "";
              const q = {
                eq: (_field: string, value: string) => {
                  key = value;
                  return q;
                },
              };
              configure(q);
              return { unique: async () => rows.find((row) => row.key === key) ?? null };
            },
          };
        },
      },
    };

    expect(await enqueueMetricSourceDirty(ctx as never, "queries", "query-1")).toBe(true);
    expect(await enqueueMetricSourceDirty(ctx as never, "queries", "query-1")).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "source:queries:query-1", kind: "source" });
  });

  test("schedules one worker when a mutation enqueues several distinct sources", async () => {
    const rows: any[] = [];
    let scheduled = 0;
    const ctx = {
      db: {
        insert: (_table: string, value: Record<string, unknown>) => {
          rows.push({ _id: `dirty-${rows.length + 1}`, ...value });
        },
        patch: () => undefined,
        query: (table: string) => {
          expect(table).toBe("crmMetricDirty");
          return {
            withIndex: (_name: string, configure?: (q: any) => unknown) => {
              let key = "";
              const q = {
                eq: (_field: string, value: string) => {
                  key = value;
                  return q;
                },
              };
              configure?.(q);
              return {
                first: () => rows[0] ?? null,
                unique: () => rows.find((row) => row.key === key) ?? null,
              };
            },
          };
        },
      },
      scheduler: {
        runAfter: () => {
          scheduled += 1;
        },
      },
    };

    expect(
      await (enqueueDirtySources as any)._handler(ctx, {
        sourceIds: ["ticket-1"],
        sourceType: "tickets",
      })
    ).toEqual({ enqueued: 1, scheduled: true });
    expect(
      await (enqueueDirtySources as any)._handler(ctx, {
        sourceIds: ["ticket-2"],
        sourceType: "tickets",
      })
    ).toEqual({ enqueued: 1, scheduled: false });
    expect(rows).toHaveLength(2);
    expect(scheduled).toBe(1);
  });

  test("removes a deleted source projection exactly once across retries", async () => {
    let dirty: any = {
      _id: "dirty-1",
      kind: "source",
      sourceId: "query-1",
      sourceType: "queries",
    };
    let projection: any = {
      _id: "projection-1",
      day: "2026-08-13",
      scopes: ["all"],
      sourceId: "query-1",
      sourceType: "queries",
      values: {},
    };
    const deleted: string[] = [];
    const ctx = {
      db: {
        delete: (table: string, id: string) => {
          deleted.push(`${table}:${id}`);
          if (table === "crmMetricDirty") {
            dirty = null;
          } else if (table === "crmMetricProjections") {
            projection = null;
          }
        },
        get: async () => null,
        normalizeId: (_table: string, id: string) => id,
        query: (table: string) => ({
          withIndex: (_name: string, configure?: (q: any) => unknown) => {
            const q = { eq: () => q };
            configure?.(q);
            return {
              first: async () => (table === "crmMetricDirty" ? dirty : null),
              unique: async () => (table === "crmMetricProjections" ? projection : null),
            };
          },
        }),
      },
      scheduler: { runAfter: async () => undefined },
    };

    expect(await (processDirtyUnit as any)._handler(ctx, {})).toEqual({
      changed: 1,
      processed: 1,
      scheduled: false,
    });
    expect(await (processDirtyUnit as any)._handler(ctx, {})).toEqual({
      changed: 0,
      processed: 0,
      scheduled: false,
    });
    expect(deleted).toEqual(["crmMetricProjections:projection-1", "crmMetricDirty:dirty-1"]);
  });

  test("bounds dependency refreshes and persists their cursor before rescheduling", async () => {
    const dirty: any = {
      _id: "dirty-context",
      kind: "jobContext",
      sourceId: "job-1",
      updatedAt: 1,
    };
    const scheduled: unknown[] = [];
    const ctx = {
      db: {
        normalizeId: (_table: string, id: string) => id,
        patch: async (_table: string, _id: string, value: Record<string, unknown>) =>
          Object.assign(dirty, value),
        query: (table: string) => ({
          withIndex: (_name: string, configure?: (q: any) => unknown) => {
            const q = { eq: () => q };
            configure?.(q);
            return {
              first: async () => (table === "crmMetricDirty" ? dirty : null),
              paginate: (options: { cursor: string | null; numItems: number }) => {
                expect(table).toBe("expenseEntries");
                expect(options).toEqual({ cursor: null, numItems: 20 });
                return { continueCursor: "page-2", isDone: false, page: [] };
              },
            };
          },
        }),
      },
      scheduler: {
        runAfter: (_delay: number, _reference: unknown, args: unknown) => {
          scheduled.push(args);
        },
      },
    };

    expect(await (processDirtyUnit as any)._handler(ctx, {})).toMatchObject({
      changed: 0,
      processed: 1,
      scheduled: true,
    });
    expect(dirty).toMatchObject({ cursor: "page-2", stage: "expenseEntries" });
    expect(scheduled).toHaveLength(1);
  });

  test("keeps current zero-dirty readiness flat unless full repair is explicit", async () => {
    const readiness: any = {
      _id: "readiness-1",
      generation: 7,
      key: "global",
      lastCompletedGeneration: 7,
      lastCompletedMetricVersion: METRIC_VERSION,
      metricVersion: METRIC_VERSION,
      updatedAt: Date.now(),
    };
    const scheduled: any[] = [];
    const ctx = {
      db: {
        patch: (_table: string, _id: string, value: Record<string, unknown>) =>
          Object.assign(readiness, value),
        query: (table: string) => ({
          withIndex: (_name: string, configure?: (q: any) => unknown) => {
            const q = { eq: () => q };
            configure?.(q);
            return {
              first: async () => null,
              unique: async () => (table === "crmMetricReadiness" ? readiness : null),
            };
          },
        }),
      },
      scheduler: {
        runAfter: (_delay: number, _reference: unknown, args: unknown) => {
          scheduled.push(args);
        },
      },
    };

    expect(await (reconcileAll as any)._handler(ctx, {})).toEqual({
      alreadyRunning: false,
      generation: 7,
      scheduled: 0,
    });
    expect(scheduled).toEqual([]);

    expect(await (reconcileAll as any)._handler(ctx, { force: true })).toEqual({
      alreadyRunning: false,
      generation: 8,
      scheduled: 1,
    });
    expect(scheduled[0]).toMatchObject({
      cursor: null,
      generation: 8,
      metricVersion: METRIC_VERSION,
      sourceType: METRIC_SOURCE_TYPES[0],
    });
  });

  test("discovers production source writers and requires durable metric scheduling", async () => {
    const glob = new Glob("convex/crm/**/*.ts");
    const paths = Array.from(glob.scanSync({ cwd: process.cwd(), onlyFiles: true })).filter(
      (path) =>
        !(path.endsWith(".test.ts") || path.endsWith(".integration.ts")) &&
        path !== "convex/crm/e2eFixtures.ts"
    );
    const missing = (
      await Promise.all(paths.map(async (path) => ({ path, source: await readFile(path, "utf8") })))
    ).flatMap(({ path, source }) =>
      (DIRECT_SOURCE_WRITE.test(source) || OWNED_SOURCE_WRITE.test(source)) &&
      !METRIC_SCHEDULE.test(source)
        ? [path]
        : []
    );

    expect(missing).toEqual([]);
    const dynamicOwners = ["jobCardDeletion.ts", "pnrCleanup.ts", "travellers.ts"];
    const dynamicSources = await Promise.all(
      dynamicOwners.map(async (path) => await readFile(new URL(path, import.meta.url), "utf8"))
    );
    for (const [index, source] of dynamicSources.entries()) {
      const dynamicOwner = dynamicOwners[index];
      expect(source, dynamicOwner).toContain("scheduleCrmMetricSync");
    }
  });
});
