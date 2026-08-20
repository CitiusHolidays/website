import { describe, expect, test } from "bun:test";
import { fromAny } from "@total-typescript/shoehorn";
import type { FunctionReference } from "convex/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import {
  enqueueDirtySources,
  METRIC_VERSION,
  processDirtyUnit,
  reconcileAll,
} from "./metricAggregates";
import { enqueueMetricSourceDirty } from "./metricDirty";
import { METRIC_SOURCE_TYPES } from "./metricTypes";

describe("Change-driven CRM metric maintenance", () => {
  test("Coalesces repeated source writes into one durable dirty unit", async () => {
    const rows: any[] = [];
    const ctx = {
      db: {
        insert: (_table: string, value: RuntimeObject) => {
          rows.push({ _id: `dirty-${rows.length + 1}`, ...value });
        },
        patch: (_table: string, id: string, value: RuntimeObject) => {
          Object.assign(
            rows.find((row) => row._id === id),
            value
          );
        },
        query: (table: string) => {
          expect(table).toBe("crmMetricDirty");
          return {
            withIndex: (_name: string, configure: (q: any) => RuntimeValue) => {
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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await enqueueMetricSourceDirty(fromAny<never, unknown>(ctx), "queries", "query-1")).toBe(
      true
    );
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await enqueueMetricSourceDirty(fromAny<never, unknown>(ctx), "queries", "query-1")).toBe(
      false
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "source:queries:query-1", kind: "source" });
  });

  test("Schedules one worker when a mutation enqueues several distinct sources", async () => {
    const rows: any[] = [];
    let scheduled = 0;
    const ctx = {
      db: {
        insert: (_table: string, value: RuntimeObject) => {
          rows.push({ _id: `dirty-${rows.length + 1}`, ...value });
        },
        patch: () => undefined,
        query: (table: string) => {
          expect(table).toBe("crmMetricDirty");
          return {
            withIndex: (_name: string, configure?: (q: any) => RuntimeValue) => {
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
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(enqueueDirtySources)._handler(ctx, {
        sourceIds: ["ticket-1"],
        sourceType: "tickets",
      })
    ).toEqual({ enqueued: 1, scheduled: true });
    expect(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      await fromAny<any, unknown>(enqueueDirtySources)._handler(ctx, {
        sourceIds: ["ticket-2"],
        sourceType: "tickets",
      })
    ).toEqual({ enqueued: 1, scheduled: false });
    expect(rows).toHaveLength(2);
    expect(scheduled).toBe(1);
  });

  test("Removes a deleted source projection exactly once across retries", async () => {
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
          withIndex: (_name: string, configure?: (q: any) => RuntimeValue) => {
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

    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await fromAny<any, unknown>(processDirtyUnit)._handler(ctx, {})).toEqual({
      changed: 1,
      processed: 1,
      scheduled: false,
    });
    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await fromAny<any, unknown>(processDirtyUnit)._handler(ctx, {})).toEqual({
      changed: 0,
      processed: 0,
      scheduled: false,
    });
    expect(deleted).toEqual(["crmMetricProjections:projection-1", "crmMetricDirty:dirty-1"]);
  });

  test("Bounds dependency refreshes and persists their cursor before rescheduling", async () => {
    const dirty = {
      _id: "dirty-context",
      kind: "jobContext",
      sourceId: "job-1",
      updatedAt: 1,
    };
    const scheduled: unknown[] = [];
    const ctx = {
      db: {
        normalizeId: (_table: string, id: string) => id,
        patch: async (_table: string, _id: string, value: RuntimeObject) =>
          Object.assign(dirty, value),
        query: (table: string) => ({
          withIndex: (_name: string, configure?: (q: any) => RuntimeValue) => {
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
        runAfter: (
          _delay: number,
          _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
          args: RuntimeObject
        ) => {
          scheduled.push(args);
        },
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await fromAny<any, unknown>(processDirtyUnit)._handler(ctx, {})).toMatchObject({
      changed: 0,
      processed: 1,
      scheduled: true,
    });
    expect(dirty).toMatchObject({ cursor: "page-2", stage: "expenseEntries" });
    expect(scheduled).toHaveLength(1);
  });

  test("Keeps current zero-dirty readiness flat unless full repair is explicit", async () => {
    const readiness = {
      _id: "readiness-1",
      generation: 7,
      key: "global",
      lastCompletedGeneration: 7,
      lastCompletedMetricVersion: METRIC_VERSION,
      metricVersion: METRIC_VERSION,
      updatedAt: Date.now(),
    };
    const scheduled: unknown[] = [];
    const ctx = {
      db: {
        patch: (_table: string, _id: string, value: RuntimeObject) =>
          Object.assign(readiness, value),
        query: (table: string) => ({
          withIndex: (_name: string, configure?: (q: any) => RuntimeValue) => {
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
        runAfter: (
          _delay: number,
          _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
          args: RuntimeObject
        ) => {
          scheduled.push(args);
        },
      },
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await fromAny<any, unknown>(reconcileAll)._handler(ctx, {})).toEqual({
      alreadyRunning: false,
      generation: 7,
      scheduled: 0,
    });
    expect(scheduled).toEqual([]);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    expect(await fromAny<any, unknown>(reconcileAll)._handler(ctx, { force: true })).toEqual({
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
});
