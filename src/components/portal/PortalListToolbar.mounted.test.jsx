import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import PortalListToolbar from "./PortalListToolbar";
import { buildPortalWorkspaceFilters } from "./workspace/portalWorkspaceFilters";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});
beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});
afterAll(() => dom.window.close());

const buttons = (container, text) =>
  [...container.querySelectorAll("button")].filter((button) => button.textContent === text);

async function mount(props) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(() => root.render(<PortalListToolbar title="All Sales Queries" {...props} />));
  return {
    container,
    async unmount() {
      await act(() => root.unmount());
      container.remove();
    },
  };
}

describe("Staff list filter recovery", () => {
  test("Keeps one reset reachable with collapsed filters and preserves the real reset contract", async () => {
    window.history.replaceState(
      null,
      "",
      "/portal/queries?q=Cedar&from=2026-10-01&to=2026-10-31&jc=job-1&f_salesStatus=Order+Confirmed&open=query&id=query-1#record"
    );
    const setSearch = mock();
    const setDateRange = mock();
    const setJobCardFilter = mock();
    const setListFilters = mock();
    const createSavedView = mock();
    const listFilterConfig = getListFilterConfig("queries");
    const filters = buildPortalWorkspaceFilters({
      allowed: true,
      createSavedView,
      dateRange: { from: "2026-10-01", to: "2026-10-31" },
      jobCardFilter: "job-1",
      listFilterConfig,
      listFilters: { salesStatus: "Order Confirmed" },
      pathname: "/portal/queries",
      removeSavedView: mock(),
      savedViews: [],
      search: "Cedar",
      searchParams: new URLSearchParams(window.location.search),
      setDateRange,
      setJobCardFilter,
      setListFilters,
      setSearch,
      showToast: { error: mock(), success: mock() },
      updateSavedView: mock(),
      view: "queries",
    });
    const view = await mount({
      dateRange: {},
      filtersActive: filters.filtersActive,
      listFilterConfig,
      onClearAllFilters: filters.clearAllFilters,
      resultCount: 0,
      search: "Cedar",
      setSearch,
    });
    const [toggle] = buttons(view.container, "Filters active");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(view.container.textContent).toContain("0 loaded results");
    expect(buttons(view.container, "Clear filters")).toHaveLength(1);
    await act(() => buttons(view.container, "Clear filters")[0].click());
    expect(setSearch.mock.calls).toEqual([[""]]);
    expect(setDateRange.mock.calls).toEqual([[{ from: null, to: null }]]);
    expect(setJobCardFilter.mock.calls).toEqual([[""]]);
    expect(setListFilters.mock.calls).toEqual([[{}]]);
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      "/portal/queries?open=query&id=query-1#record"
    );
    expect(createSavedView).not.toHaveBeenCalled();
    await act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(buttons(view.container, "Clear filters")).toHaveLength(1);
    expect(setSearch).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  test("Allows search-only recovery even when the view has no filter row", async () => {
    const clear = mock();
    const view = await mount({
      filtersActive: true,
      onClearAllFilters: clear,
      search: "Avery",
      setSearch: mock(),
      showPeriodFilter: false,
    });
    expect(buttons(view.container, "Filters")).toHaveLength(0);
    await act(() => buttons(view.container, "Clear filters")[0].click());
    expect(clear).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  test("Omits reset for an unfiltered list and preserves its primary action", async () => {
    const create = mock();
    const view = await mount({
      actions: (
        <button onClick={create} type="button">
          New query
        </button>
      ),
      filtersActive: false,
      onClearAllFilters: mock(),
      search: "",
      setSearch: mock(),
      showPeriodFilter: false,
    });
    expect(buttons(view.container, "Clear filters")).toHaveLength(0);
    await act(() => buttons(view.container, "New query")[0].click());
    expect(create).toHaveBeenCalledTimes(1);
    await view.unmount();
  });
});
