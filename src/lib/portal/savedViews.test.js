import { describe, expect, test } from "bun:test";
import { getListFilterConfig } from "./listFilterConfig.js";
import {
  currentFiltersToSavedViewInput,
  isSafePortalHref,
  isSafePortalPathname,
  normalizeSavedViewState,
  savedViewToUrl,
} from "./savedViews.js";

describe("SavedViews", () => {
  const config = getListFilterConfig("queries");

  test("Normalizes and strips unknown filters", () => {
    const state = normalizeSavedViewState(
      {
        dateRange: { from: "2026-01-01", to: "2026-01-31" },
        jobCardFilter: "jc1",
        listFilters: { salesStatus: "Order Confirmed", unknown: "x" },
        search: "  acme  ",
      },
      config
    );
    expect(state.search).toBe("acme");
    expect(state.dateRange).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(state.jobCardFilter).toBe("jc1");
    expect(state.listFilters).toEqual({ salesStatus: "Order Confirmed" });
  });

  test("Builds a url through the existing serializer", () => {
    const href = savedViewToUrl(
      "/portal/queries",
      {
        filterState: {
          dateRange: { from: "2026-01-01", to: "" },
          listFilters: { queryType: "MICE" },
          search: "acme",
        },
      },
      config
    );
    expect(href).toBe("/portal/queries?q=acme&from=2026-01-01&f_queryType=MICE");
  });

  test("Keeps saved-view navigation on internal portal paths", () => {
    expect(isSafePortalPathname("/portal/queries")).toBe(true);
    expect(isSafePortalPathname("/portal/../auth/connect")).toBe(false);
    expect(isSafePortalPathname("/portal/%2e%2e/auth/connect")).toBe(false);
    expect(isSafePortalPathname("/portal/%252e%252e/auth/connect")).toBe(false);
    expect(isSafePortalPathname("https://attacker.test/login")).toBe(false);
    expect(isSafePortalHref("/portal/queries?q=acme")).toBe(true);
    expect(isSafePortalHref("/portal/../auth/connect?q=acme")).toBe(false);
    expect(isSafePortalHref("//attacker.test/login")).toBe(false);
    expect(
      savedViewToUrl("https://attacker.test/login", { filterState: { search: "acme" } }, config)
    ).toBe("/portal?q=acme");
  });

  test("Captures current filters as a saved view input", () => {
    const input = currentFiltersToSavedViewInput({
      dateRange: { from: "", to: "" },
      filterConfig: config,
      jobCardFilter: "",
      listFilters: { salesStatus: "Order Confirmed" },
      pathname: "/portal/queries",
      search: "acme",
      view: "queries",
    });
    expect(input.view).toBe("queries");
    expect(input.pathname).toBe("/portal/queries");
    expect(input.filterState.listFilters).toEqual({ salesStatus: "Order Confirmed" });
  });
});
