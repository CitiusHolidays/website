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
      f_queryType: "MICE",
      f_salesStatus: "Inquiry",
      from: "2026-01-01",
      jc: "job1",
      q: "acme",
      to: "2026-01-31",
    });
    const parsed = parseUrlFilterState(params, config);
    expect(parsed.search).toBe("acme");
    expect(parsed.dateRange).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(parsed.jobCardFilter).toBe("job1");
    expect(parsed.listFilters).toEqual({
      queryType: "MICE",
      salesStatus: "Inquiry",
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
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
        search: "acme",
      },
      config,
      { preserveDeepLink: true, searchParams: incoming }
    );
    expect(serialized.get("open")).toBe("query");
    expect(serialized.get("id")).toBe("q1");
    expect(serialized.get("q")).toBe("acme");
  });

  test("preserves recognized hotel tabs and entity deep links for every filter writer", () => {
    const incoming = new URLSearchParams(
      "tab=rooming&open=ticket&id=t1&q=old&f_unknownField=stale"
    );
    const serialized = serializeUrlFilterState(
      {
        dateRange: { from: "2026-07-01", to: "2026-07-31" },
        jobCardFilter: "jc1",
        listFilters: { queryType: "MICE", unknownField: "stale" },
        search: "new",
      },
      config,
      { preserveRouteContext: true, searchParams: incoming }
    );

    expect(serialized.get("tab")).toBe("rooming");
    expect(serialized.get("open")).toBe("ticket");
    expect(serialized.get("id")).toBe("t1");
    expect(serialized.get("q")).toBe("new");
    expect(serialized.get("f_unknownField")).toBeNull();
  });

  test("drops unknown route context while retaining valid room count selection", () => {
    const incoming = new URLSearchParams("tab=room-count&open=madeUp&id=x");
    const serialized = serializeUrlFilterState(
      {
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
        search: "",
      },
      config,
      { preserveRouteContext: true, searchParams: incoming }
    );

    expect(serialized.get("tab")).toBe("room-count");
    expect(serialized.get("open")).toBeNull();
    expect(serialized.get("id")).toBeNull();
  });

  test("hasAnyFilterState detects active filters", () => {
    expect(
      hasAnyFilterState({
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
        search: "",
      })
    ).toBe(false);
    expect(
      hasAnyFilterState({
        dateRange: { from: "", to: "" },
        jobCardFilter: "",
        listFilters: {},
        search: "acme",
      })
    ).toBe(true);
  });
});
