import { describe, expect, test } from "bun:test";
import type { FunctionReference } from "convex/server";
import type { RuntimeObject, RuntimeValue } from "../lib/runtimeValues";
import {
  buildAggregateSegments,
  loadMetricCoverage,
  loadMetricTotals,
  METRIC_VERSION,
  reconcileSourcePage,
  summarizeMetricReadiness,
  sweepProjectionPage,
  syncJobInvoicePage,
} from "./metricAggregates";
import { buildMetricValues } from "./metricProjection";
import { METRIC_SOURCE_TYPES } from "./metricTypes";

describe("Bounded CRM metric aggregates", () => {
  test("Labels incomplete and stale aggregate generations as partial", () => {
    const now = Date.parse("2026-07-14T12:00:00.000Z");
    expect(summarizeMetricReadiness(null, now)).toMatchObject({
      complete: false,
      state: "pending",
    });
    expect(
      summarizeMetricReadiness(
        {
          completedSourceTypes: ["queries"],
          generation: 2,
          metricVersion: METRIC_VERSION,
          startedAt: now - 2 * 60 * 60 * 1000,
          updatedAt: now - 2 * 60 * 60 * 1000,
        },
        now
      )
    ).toMatchObject({ complete: false, generation: 2, state: "stale" });
    expect(
      summarizeMetricReadiness(
        {
          completedSourceTypes: [...METRIC_SOURCE_TYPES],
          generation: 3,
          lastCompletedAt: now - 1000,
          lastCompletedGeneration: 3,
          lastCompletedMetricVersion: METRIC_VERSION,
          metricVersion: METRIC_VERSION,
          startedAt: now - 2000,
          updatedAt: now - 1000,
        },
        now
      )
    ).toMatchObject({ complete: true, generation: 3, state: "ready" });
  });

  test("Uses monthly rollups for all-time and day buckets only at partial month edges", () => {
    expect(buildAggregateSegments(undefined)).toEqual([{ periodType: "month" }]);
    expect(buildAggregateSegments({ from: "2026-01-15", to: "2026-04-10" })).toEqual([
      { from: "2026-01-15", periodType: "day", to: "2026-01-31" },
      { from: "2026-04-01", periodType: "day", to: "2026-04-10" },
      { from: "2026-02", periodType: "month", to: "2026-03" },
    ]);
    expect(buildAggregateSegments({ from: "2026-02-02", to: "2026-02-20" })).toEqual([
      { from: "2026-02-02", periodType: "day", to: "2026-02-20" },
    ]);
  });

  test("Heavy metric totals depend on a stable publication marker, not mutable readiness", async () => {
    const queriedTables: string[] = [];
    const result = await loadMetricTotals(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      {
        db: {
          query: (table: string) => {
            queriedTables.push(table);
            return {
              withIndex: (_name: string, callback?: (q: any) => RuntimeValue) => {
                const q = {
                  eq: () => q,
                  gte: () => q,
                  lte: () => q,
                };
                callback?.(q);
                if (table === "crmMetricPublications") {
                  return {
                    unique: () => ({
                      generation: 9,
                      key: "global",
                      metricVersion: METRIC_VERSION,
                      publishedAt: Date.parse("2026-07-29T08:00:00.000Z"),
                    }),
                  };
                }
                if (table === "crmMetricBuckets") {
                  return { take: () => [] };
                }
                if (table === "crmMetricDirty") {
                  return { first: () => null };
                }
                throw new Error(`Unexpected table ${table}`);
              },
            };
          },
        },
      } as any,
      "all",
      undefined,
      Date.parse("2026-07-29T08:01:00.000Z")
    );

    expect(queriedTables).toContain("crmMetricPublications");
    expect(queriedTables).not.toContain("crmMetricReadiness");
    expect(result.complete).toBe(true);
  });

  test("Lightweight metric coverage reports mutable reconciliation progress separately", async () => {
    const now = Date.parse("2026-07-29T08:01:00.000Z");
    const queriedTables: string[] = [];
    const coverage = await loadMetricCoverage(
      // SAFETY: This test controls the asserted value at the framework boundary below.
      {
        db: {
          query: (table: string) => {
            queriedTables.push(table);
            return {
              withIndex: (_name: string, callback?: (q: any) => RuntimeValue) => {
                const q = { eq: () => q, gte: () => q, lte: () => q };
                callback?.(q);
                if (table === "crmMetricPublications") {
                  return {
                    unique: () => ({
                      generation: 8,
                      key: "global",
                      metricVersion: METRIC_VERSION,
                      publishedAt: now - 60_000,
                    }),
                  };
                }
                if (table === "crmMetricReadiness") {
                  return {
                    unique: () => ({
                      completedSourceTypes: [METRIC_SOURCE_TYPES[0]],
                      generation: 9,
                      key: "global",
                      lastCompletedAt: now - 60_000,
                      lastCompletedGeneration: 8,
                      lastCompletedMetricVersion: METRIC_VERSION,
                      metricVersion: METRIC_VERSION,
                      startedAt: now - 5000,
                      updatedAt: now - 1000,
                    }),
                  };
                }
                if (table === "crmMetricBuckets") {
                  return { take: () => [] };
                }
                if (table === "crmMetricDirty") {
                  return { first: () => null };
                }
                throw new Error(`Unexpected table ${table}`);
              },
            };
          },
        },
      } as any,
      "all",
      undefined,
      now
    );

    expect(queriedTables).toContain("crmMetricReadiness");
    expect(coverage.complete).toBe(true);
    expect(coverage.readiness).toMatchObject({ generation: 9, state: "reconciling" });
  });

  test("Projects canonical query transitions into additive metric values", () => {
    expect(
      buildMetricValues("queries", {
        budgetAmount: 125_000,
        leadStage: "Proposal",
        queryType: "MICE",
        salesStatus: "Order Confirmed",
      })
    ).toEqual({
      "queries.confirmed": 1,
      "queries.stage.Proposal.budget": 125_000,
      "queries.stage.Proposal.count": 1,
      "queries.total": 1,
      "queries.type.MICE.budget": 125_000,
      "queries.type.MICE.confirmed": 1,
      "queries.type.MICE.confirmedBudget": 125_000,
      "queries.type.MICE.count": 1,
    });
  });

  test("Projects finance and traveller updates without reading sibling tables", () => {
    expect(
      buildMetricValues(
        "invoices",
        {
          balanceAmount: 400,
          expectedAmount: 1000,
          receivedAmount: 600,
        },
        { jobOpen: true, minAdvancePercent: 70 }
      )
    ).toEqual({
      "invoices.advancePipeline": 700,
      "invoices.expected": 1000,
      "invoices.outstanding": 400,
      "invoices.pending": 1,
      "invoices.received": 600,
    });
    expect(
      buildMetricValues(
        "expenseEntries",
        {
          amount: 850,
          approvalStatus: "Approved",
          reimbursementStatus: "Pending",
        },
        { jobOpen: true }
      )
    ).toEqual({
      "expenseEntries.approved": 850,
      "expenseEntries.pendingReimbursement": 850,
    });
    expect(
      buildMetricValues("expenseEntries", {
        amount: 500,
        approvalStatus: "Pending",
        reimbursementStatus: "Not Submitted",
      })
    ).toEqual({ "expenseEntries.pendingApproval": 500 });
    expect(
      buildMetricValues(
        "invoices",
        {
          balanceAmount: 400,
          dueDate: "2026-07-12",
          expectedAmount: 1000,
          receivedAmount: 600,
          status: "Part Paid",
        },
        { referenceDate: "2026-07-13" }
      )
    ).toMatchObject({ "invoices.overdue": 1 });
    expect(
      buildMetricValues(
        "invoices",
        {
          balanceAmount: 0,
          dueDate: "2026-07-12",
          expectedAmount: 1000,
          receivedAmount: 1000,
          status: "Paid",
        },
        { referenceDate: "2026-07-13" }
      )
    ).not.toHaveProperty("invoices.overdue");
    expect(
      buildMetricValues(
        "travellers",
        {
          foodPreference: "Veg",
          fullName: "A Traveller",
          hotelAllocation: "Room 4",
          passportStatus: "Received",
          ticketStatus: "Issued",
          travelHub: "DEL",
          visaStatus: "Approved",
        },
        { tourManagerAssigned: true }
      )
    ).toMatchObject({
      "travellers.guestDataDone": 1,
      "travellers.passportDone": 1,
      "travellers.roomingAssignments": 1,
      "travellers.roomingDone": 1,
      "travellers.roomType.Unassigned.assignments": 1,
      "travellers.ticketIssued": 1,
      "travellers.total": 1,
      "travellers.tourManagerDone": 1,
      "travellers.visaApproved": 1,
    });
  });

  test("Refreshes job invoice metrics in bounded cursor pages", async () => {
    const scheduled: Array<{ args: any; delay: number }> = [];
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (syncJobInvoicePage as any)._handler(
      {
        db: {
          query: (table: string) => {
            expect(table).toBe("invoices");
            const builder = {
              paginate: (options: { cursor: string | null; numItems: number }) => {
                expect(options).toEqual({ cursor: "page-1", numItems: 20 });
                return {
                  continueCursor: "page-2",
                  isDone: false,
                  page: [],
                };
              },
              withIndex: (name: string, callback: (q: any) => RuntimeValue) => {
                expect(name).toBe("by_jobCardId");
                const q = { eq: () => q };
                callback(q);
                return builder;
              },
            };
            return builder;
          },
        },
        scheduler: {
          runAfter: (
            delay: number,
            _reference: FunctionReference<"query" | "mutation" | "action", "public" | "internal">,
            args: any
          ) => {
            scheduled.push({ args, delay });
          },
        },
      },
      { cursor: "page-1", jobCardId: "job-1" }
    );

    expect(result).toEqual({ changed: 0, isDone: false, processed: 0 });
    expect(scheduled).toEqual([{ args: { cursor: "page-2", jobCardId: "job-1" }, delay: 0 }]);
  });

  test("An old in-flight metric page aborts and restarts one serialized source at the current version", async () => {
    const scheduled: Array<{ args: any; delay: number }> = [];
    const state: RuntimeObject = {
      _id: "metric_readiness",
      completedSourceTypes: [],
      generation: 4,
      key: "global",
      lastCompletedGeneration: 3,
      metricVersion: METRIC_VERSION - 1,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    // SAFETY: This test controls the asserted value at the framework boundary below.
    const result = await (reconcileSourcePage as any)._handler(
      {
        db: {
          insert: () => {
            throw new Error("the existing metric readiness row should be patched");
          },
          patch: (_table: string, _id: string, patch: RuntimeObject) => Object.assign(state, patch),
          query: (table: string) => {
            if (table !== "crmMetricReadiness") {
              throw new Error("a stale metric page must not project source rows");
            }
            return {
              withIndex: (_name: string, callback: (q: any) => RuntimeValue) => {
                const q = { eq: () => q };
                callback(q);
                return { unique: () => state };
              },
            };
          },
        },
        scheduler: {
          runAfter: (
            delay: number,
            _fn: FunctionReference<"mutation", "internal">,
            args: RuntimeObject
          ) => {
            scheduled.push({ args, delay });
          },
        },
      },
      {
        cursor: "old-version-cursor",
        generation: 4,
        sourceType: "invoices",
      }
    );

    expect(result).toMatchObject({ processed: 0, restarted: true, stale: true });
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]?.args.sourceType).toBe(METRIC_SOURCE_TYPES[0]);
    expect(
      scheduled.every(
        (entry) =>
          entry.delay === 0 &&
          entry.args.cursor === null &&
          entry.args.generation === 5 &&
          entry.args.metricVersion === METRIC_VERSION
      )
    ).toBe(true);
    expect(state).toMatchObject({
      completedSourceTypes: [],
      generation: 5,
      metricVersion: METRIC_VERSION,
    });
  });

  test("A completed source schedules only the next source without publishing partial readiness", async () => {
    const scheduled: Array<{ args: any; delay: number }> = [];
    const patches: Array<RuntimeObject> = [];
    const completions: Array<RuntimeObject> = [];
    const state = {
      _id: "metric_readiness",
      completedSourceTypes: [],
      generation: 7,
      key: "global",
      lastCompletedGeneration: 6,
      lastCompletedMetricVersion: METRIC_VERSION,
      metricVersion: METRIC_VERSION,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    const query = (table: string) => ({
      withIndex: (_name: string, callback: (q: any) => RuntimeValue) => {
        const q = { eq: () => q };
        callback(q);
        if (table === "crmMetricReadiness") {
          return { unique: () => state };
        }
        if (table === "crmMetricProjections") {
          return {
            paginate: () => ({ continueCursor: "", isDone: true, page: [] }),
          };
        }
        if (table === "crmMetricReadinessSourceCompletions") {
          return {
            collect: () => completions,
            unique: () => null,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (sweepProjectionPage as any)._handler(
      {
        db: {
          insert: (_table: string, value: RuntimeObject) => {
            completions.push({ _id: `completion_${completions.length}`, ...value });
          },
          patch: (_table: string, _id: string, value: RuntimeObject) => patches.push(value),
          query,
        },
        scheduler: {
          runAfter: (
            delay: number,
            _fn: FunctionReference<"mutation", "internal">,
            args: RuntimeObject
          ) => {
            scheduled.push({ args, delay });
          },
        },
      },
      {
        cursor: null,
        generation: 7,
        metricVersion: METRIC_VERSION,
        sourceType: METRIC_SOURCE_TYPES[0],
      }
    );

    expect(patches).toEqual([
      expect.objectContaining({ completedSourceTypes: [METRIC_SOURCE_TYPES[0]] }),
    ]);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toMatchObject({
      args: {
        cursor: null,
        generation: 7,
        metricVersion: METRIC_VERSION,
        sourceType: METRIC_SOURCE_TYPES[1],
      },
      delay: 0,
    });
  });

  test("The final serialized source publishes one stable completion marker", async () => {
    const completions = METRIC_SOURCE_TYPES.slice(0, -1).map((sourceType, index) => ({
      _id: `completion_${index}`,
      generation: 11,
      metricVersion: METRIC_VERSION,
      sourceType,
    }));
    const inserts: Array<{ table: string; value: RuntimeObject }> = [];
    const patches: Array<RuntimeObject> = [];
    const state = {
      _id: "metric_readiness",
      completedSourceTypes: [],
      generation: 11,
      key: "global",
      lastCompletedGeneration: 10,
      lastCompletedMetricVersion: METRIC_VERSION,
      metricVersion: METRIC_VERSION,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    const finalSource = METRIC_SOURCE_TYPES.at(-1);

    // SAFETY: This test controls the asserted value at the framework boundary below.
    await (sweepProjectionPage as any)._handler(
      {
        db: {
          insert: (table: string, value: RuntimeObject) => {
            inserts.push({ table, value });
            if (table === "crmMetricReadinessSourceCompletions") {
              // SAFETY: This test controls the asserted value at the framework boundary below.
              completions.push({ _id: "completion_final", ...value } as any);
            }
          },
          patch: (_table: string, _id: string, value: RuntimeObject) => patches.push(value),
          query: (table: string) => ({
            withIndex: (_name: string, callback: (q: any) => RuntimeValue) => {
              const q = { eq: () => q };
              callback(q);
              if (table === "crmMetricReadiness") {
                return { unique: () => state };
              }
              if (table === "crmMetricProjections") {
                return { paginate: () => ({ continueCursor: "", isDone: true, page: [] }) };
              }
              if (table === "crmMetricReadinessSourceCompletions") {
                return { collect: () => completions, unique: () => null };
              }
              if (table === "crmMetricPublications") {
                return { unique: () => null };
              }
              throw new Error(`Unexpected table ${table}`);
            },
          }),
        },
        scheduler: { runAfter: () => undefined },
      },
      {
        cursor: null,
        generation: 11,
        metricVersion: METRIC_VERSION,
        sourceType: finalSource,
      }
    );

    expect(inserts.filter((entry) => entry.table === "crmMetricPublications")).toHaveLength(1);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      lastCompletedGeneration: 11,
      lastCompletedMetricVersion: METRIC_VERSION,
    });
  });
});
