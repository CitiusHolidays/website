import { describe, expect, test } from "bun:test";
import {
  buildAggregateSegments,
  buildMetricValues,
  METRIC_SOURCE_TYPES,
  METRIC_VERSION,
  reconcileSourcePage,
  summarizeMetricReadiness,
} from "./metricAggregates";

describe("bounded CRM metric aggregates", () => {
  test("labels incomplete and stale aggregate generations as partial", () => {
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

  test("uses monthly rollups for all-time and day buckets only at partial month edges", () => {
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

  test("projects canonical query transitions into additive metric values", () => {
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

  test("projects finance and traveller updates without reading sibling tables", () => {
    expect(
      buildMetricValues("invoices", {
        balanceAmount: 400,
        expectedAmount: 1000,
        receivedAmount: 600,
      })
    ).toEqual({
      "invoices.expected": 1000,
      "invoices.outstanding": 400,
      "invoices.pending": 1,
      "invoices.received": 600,
    });
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

  test("an old in-flight metric page aborts and restarts every source at the current version", async () => {
    const scheduled: Array<{ args: any; delay: number }> = [];
    const state: Record<string, any> = {
      _id: "metric_readiness",
      completedSourceTypes: [],
      generation: 4,
      key: "global",
      lastCompletedGeneration: 3,
      metricVersion: METRIC_VERSION - 1,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await (reconcileSourcePage as any)._handler(
      {
        db: {
          insert: () => {
            throw new Error("the existing metric readiness row should be patched");
          },
          patch: (_id: string, patch: Record<string, unknown>) => Object.assign(state, patch),
          query: (table: string) => {
            if (table !== "crmMetricReadiness") {
              throw new Error("a stale metric page must not project source rows");
            }
            return {
              withIndex: (_name: string, callback: (q: any) => unknown) => {
                const q = { eq: () => q };
                callback(q);
                return { unique: () => state };
              },
            };
          },
        },
        scheduler: {
          runAfter: (delay: number, _fn: unknown, args: unknown) => {
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
    expect(scheduled).toHaveLength(METRIC_SOURCE_TYPES.length);
    expect(
      scheduled
        .map((entry) => entry.args.sourceType)
        .sort((left, right) => left.localeCompare(right))
    ).toEqual([...METRIC_SOURCE_TYPES].sort((left, right) => left.localeCompare(right)));
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
});
