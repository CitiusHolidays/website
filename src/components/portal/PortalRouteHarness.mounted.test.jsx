import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { resolveTabId } from "@/lib/portal/portalTabs";
import { parseUrlFilterState, serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import { PortalFilterActionsProvider } from "./PortalFilterActions";
import { PortalTabs } from "./PortalTabs";
import { SelectableDataTable } from "./SelectableDataTable";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/hotels",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.Event = dom.window.Event;
  globalThis.PopStateEvent = dom.window.PopStateEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
});

afterAll(() => dom.window.close());

const FILTER_CONFIG = [{ field: "status" }];
const TABS = [
  { id: "hotels", label: "Hotels" },
  { id: "rooming", label: "Rooming" },
  { id: "room-count", label: "Room Count" },
];
const ROWS = [
  { due: "2026-08-01", id: "1", name: "Alpha", status: "Open" },
  { due: null, id: "2", name: "Bravo", status: "Open" },
  { due: "2026-07-01", id: "3", name: "Zulu", status: "Open" },
];
const COLUMNS = [
  {
    id: "name",
    kind: "identity",
    label: "Name",
    render: (row) => row.name,
    sortValue: (row) => row.name,
  },
  {
    hideable: true,
    id: "due",
    label: "Due",
    render: (row) => row.due || "—",
    sortValue: (row) => row.due,
  },
  {
    id: "action",
    kind: "action",
    label: "Action",
    render: () => <button type="button">Open</button>,
  },
];

function currentRoute() {
  return `${window.location.pathname}${window.location.search}`;
}

function RouteHarness() {
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState(() =>
    parseUrlFilterState(new URLSearchParams(window.location.search), FILTER_CONFIG)
  );
  const searchParams = new URLSearchParams(window.location.search);
  const tab = resolveTabId(
    TABS.map((item) => item.id),
    searchParams.get("tab"),
    "room-count"
  );

  useEffect(() => {
    const restore = () => {
      setFilters(parseUrlFilterState(new URLSearchParams(window.location.search), FILTER_CONFIG));
      setRevision((value) => value + 1);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  const writeFilters = (next) => {
    const params = serializeUrlFilterState(next, FILTER_CONFIG, {
      preserveRouteContext: true,
      searchParams: new URLSearchParams(window.location.search),
    });
    window.history.pushState({}, "", `${window.location.pathname}?${params}`);
    setFilters(() => next);
    setRevision((value) => value + 1);
  };
  const clearAllFilters = () =>
    writeFilters({
      dateRange: { from: "", to: "" },
      jobCardFilter: "",
      listFilters: {},
      search: "",
    });
  const visibleRows = ROWS.filter((row) =>
    row.name.toLowerCase().includes(filters.search.toLowerCase())
  );

  return (
    <PortalFilterActionsProvider clearAllFilters={clearAllFilters}>
      <label>
        Search rows
        <input
          aria-label="Search rows"
          onChange={(event) => writeFilters({ ...filters, search: event.currentTarget.value })}
          value={filters.search}
        />
      </label>
      <button onClick={() => writeFilters({ ...filters, search: "Alpha" })} type="button">
        Filter Alpha
      </button>
      <output data-testid="route">{currentRoute()}</output>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <output data-testid="revision">{revision}</output>
      <PortalTabs
        ariaLabel="Hotel and rooming tabs"
        items={TABS}
        onValueChange={(nextTab) => {
          const params = new URLSearchParams(window.location.search);
          params.set("tab", nextTab);
          window.history.pushState({}, "", `${window.location.pathname}?${params}`);
          setRevision((value) => value + 1);
        }}
        value={tab}
      >
        <p>{tab} workspace</p>
      </PortalTabs>
      <SelectableDataTable
        columns={COLUMNS}
        empty="No records"
        filtersActive={Boolean(filters.search || filters.dateRange.from || filters.jobCardFilter)}
        rowAttention={(row) =>
          row.name === "Zulu" ? { label: "Urgent traveller record", tone: "warning" } : undefined
        }
        rows={visibleRows}
        selectable
      />
    </PortalFilterActionsProvider>
  );
}

function PaginatedGridHarness() {
  const [rows, setRows] = useState(
    Array.from({ length: 30 }, (_, index) => ({
      id: `row-${index + 1}`,
      name: `Row ${index + 1}`,
      status: "Open",
    }))
  );
  const [canLoadMore, setCanLoadMore] = useState(true);
  return (
    <PortalFilterActionsProvider clearAllFilters={() => undefined}>
      <SelectableDataTable
        canLoadMore={canLoadMore}
        columns={COLUMNS}
        empty="No records"
        onLoadMore={() => {
          setRows((current) => [...current, { id: "row-31", name: "Row 31", status: "Open" }]);
          setCanLoadMore(false);
        }}
        rowLabel={(row) => row.name}
        rows={rows}
        selectable
      />
      <button
        onClick={() => setRows((current) => current.filter((row) => row.id === "row-1"))}
        type="button"
      >
        Replace with filtered rows
      </button>
    </PortalFilterActionsProvider>
  );
}

function rowOrder(container) {
  return [...container.querySelectorAll("tbody tr")].map((row) => row.textContent);
}

describe("mounted portal route boundary", () => {
  test("clears live filtered-empty state while preserving valid tab and deep-link context", async () => {
    window.history.replaceState(
      {},
      "",
      "/portal/hotels?q=missing&from=2026-07-01&to=2026-07-31&jc=jc1&f_status=Open&f_unknown=stale&tab=rooming&open=ticket&id=t1"
    );
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<RouteHarness />));
    expect(container.textContent).toContain("No matches");
    expect(container.querySelector('[data-tab-id="rooming"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );

    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Clear filters")
        ?.click()
    );
    expect(rowOrder(container).length).toBe(ROWS.length);
    const route = container.querySelector('[data-testid="route"]').textContent;
    expect(route).toContain("tab=rooming");
    expect(route).toContain("open=ticket");
    expect(route).toContain("id=t1");
    expect(route).not.toContain("f_unknown");
    expect(route).not.toContain("q=");
    expect(container.querySelector('[data-testid="filters"]').textContent).toContain('"search":""');

    await act(async () => root.unmount());
    container.remove();
  });

  test("restores URL-backed search and tab state through browser history", async () => {
    window.history.replaceState({}, "", "/portal/hotels?tab=hotels");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<RouteHarness />));

    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Filter Alpha")
        ?.click()
    );
    await act(async () => container.querySelector('[data-tab-id="room-count"]')?.click());
    expect(currentRoute()).toContain("q=Alpha");
    expect(currentRoute()).toContain("tab=room-count");

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[data-tab-id="hotels"]')?.getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(container.querySelector('[aria-label="Search rows"]').value).toBe("Alpha");

    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.querySelector('[aria-label="Search rows"]').value).toBe("");
    expect(rowOrder(container).length).toBe(ROWS.length);

    await act(async () => root.unmount());
    container.remove();
  });

  test("renders stable loading geometry, semantic attention, selection announcements, and visible sort ownership", async () => {
    window.history.replaceState({}, "", "/portal/hotels?tab=room-count");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <PortalFilterActionsProvider clearAllFilters={() => undefined}>
          <SelectableDataTable columns={COLUMNS} empty="No records" rows={undefined} />
          <RouteHarness />
        </PortalFilterActionsProvider>
      )
    );
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-attention="warning"]').length).toBe(2);

    const dueHeader = [...container.querySelectorAll("th button")].find((button) =>
      button.textContent.includes("Due")
    );
    await act(async () => dueHeader.click());
    expect(rowOrder(container).at(-1)).toContain("Bravo");
    await act(async () => dueHeader.click());
    expect(rowOrder(container).at(-1)).toContain("Bravo");

    const details = container.querySelector("details");
    details.open = true;
    const dueVisibility = [...details.querySelectorAll("label")]
      .find((label) => label.textContent.includes("Due"))
      ?.querySelector("input");
    await act(async () => dueVisibility.click());
    expect(container.querySelector('th[aria-sort="descending"]')).toBeNull();

    const firstSelection = container.querySelector('tbody input[aria-label^="Select "]');
    await act(async () => firstSelection.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("1 record selected");

    await act(async () => root.unmount());
    container.remove();
  });

  test("appends cursor pages without losing table sort or selection state", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<PaginatedGridHarness />));

    expect(container.textContent).toContain("Page 1 of 2");
    expect(container.textContent).toContain("Showing 1–25 of 30 loaded");

    const nameHeader = [...container.querySelectorAll("th button")].find((button) =>
      button.textContent.includes("Name")
    );
    await act(async () => nameHeader.click());
    expect(rowOrder(container)[0]).toContain("Row 1");

    const firstSelection = container.querySelector('tbody input[aria-label="Select Row 1"]');
    await act(async () => firstSelection.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("1 record selected");

    const nextPage = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Next"
    );
    await act(async () => nextPage?.click());
    expect(container.textContent).toContain("Page 2 of 2");
    expect(container.textContent).toContain("Showing 26–30 of 30 loaded");

    const selectAll = container.querySelector('thead input[aria-label="Select all visible rows"]');
    await act(async () => selectAll?.click());
    expect(container.querySelector('[role="status"]')?.textContent).toContain("6 records selected");

    const loadMore = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Load more records"
    );
    expect(loadMore).not.toBeUndefined();
    await act(async () => loadMore?.click());
    expect(container.textContent).toContain("Showing 26–31 of 31 loaded");
    expect(container.querySelector('[role="status"]')?.textContent).toContain("6 records selected");
    expect(container.querySelector('th[aria-sort="ascending"]')).not.toBeNull();

    const replaceRows = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Replace with filtered rows"
    );
    await act(async () => replaceRows?.click());
    expect(rowOrder(container)).toHaveLength(1);
    expect(rowOrder(container)[0]).toContain("Row 1");

    await act(async () => root.unmount());
    container.remove();
  });
});
