import { describe, expect, test } from "bun:test";
import { getListFilterConfig } from "./listFilterConfig.js";
import {
  hasAnyFilterState,
  parseUrlFilterState,
  serializeUrlFilterState,
} from "./urlFilterState.js";

describe("urlFilterState", () => {
  const config = getListFilterConfig("queries");

  test("round-trips search, dates, job card, and status filters", () => {
    const params = new URLSearchParams({
      q: "acme",
      from: "2026-01-01",
      to: "2026-01-31",
      jc: "job1",
      f_salesStatus: "Inquiry",
      f_queryType: "MICE",
    });
    const parsed = parseUrlFilterState(params, config);
    expect(parsed.search).toBe("acme");
    expect(parsed.dateRange).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(parsed.jobCardFilter).toBe("job1");
    expect(parsed.listFilters).toEqual({
      salesStatus: "Inquiry",
      queryType: "MICE",
    });

    const serialized = serializeUrlFilterState(parsed, config);
    expect(serialized.get("q")).toBe("acme");
    expect(serialized.get("from")).toBe("2026-01-01");
    expect(serialized.get("to")).toBe("2026-01-31");
    expect(serialized.get("jc")).toBe("job1");
    expect(serialized.get("f_salesStatus")).toBe("Inquiry");
    expect(serialized.get("f_queryType")).toBe("MICE");
  });

  test("drops list filters not in config", () => {
    const params = new URLSearchParams({
      f_salesStatus: "Inquiry",
      f_unknownField: "x",
    });
    const parsed = parseUrlFilterState(params, config);
    expect(parsed.listFilters).toEqual({ salesStatus: "Inquiry" });
  });

  test("preserves deep-link params while modal is open", () => {
    const incoming = new URLSearchParams("open=query&id=q1&q=acme");
    const serialized = serializeUrlFilterState(
      {
        search: "acme",
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
      },
      config,
      { preserveDeepLink: true, searchParams: incoming },
    );
    expect(serialized.get("open")).toBe("query");
    expect(serialized.get("id")).toBe("q1");
    expect(serialized.get("q")).toBe("acme");
  });

  test("hasAnyFilterState detects active filters", () => {
    expect(
      hasAnyFilterState({
        search: "",
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
      }),
    ).toBe(false);
    expect(
      hasAnyFilterState({
        search: "acme",
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
      }),
    ).toBe(true);
  });
});
