import { describe, expect, test } from "bun:test";
import { buildAggregateReport } from "./reports";

describe("bounded report aggregate parity", () => {
  const values = {
    "queries.confirmed": 4,
    "queries.lost": 2,
    "queries.type.Cement.budget": 90_000,
    "queries.type.Cement.confirmed": 2,
    "queries.type.Cement.confirmedBudget": 70_000,
    "queries.type.Cement.count": 3,
    "queries.type.MICE.budget": 150_000,
    "queries.type.MICE.confirmed": 2,
    "queries.type.MICE.confirmedBudget": 100_000,
    "queries.type.MICE.count": 3,
  };

  test("preserves director totals across query types", () => {
    expect(buildAggregateReport(values, false)).toMatchObject({
      confirmedQueries: 4,
      lostQueries: 2,
      totalPipelineBudget: 240_000,
    });
  });

  test("keeps Accounts and Finance query meaning limited to confirmed work", () => {
    const report = buildAggregateReport(values, true);
    expect(report).toMatchObject({
      confirmedQueries: 4,
      lostQueries: 0,
      totalPipelineBudget: 170_000,
    });
    expect(report.revenueByType.find((row) => row.queryType === "MICE")).toMatchObject({
      count: 2,
      revenue: 100_000,
    });
  });
});
