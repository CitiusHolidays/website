// biome-ignore-all lint/performance/noJsxPropsBind: Mounted contracts intentionally use inline callbacks to model consumer render props.

import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createPortalTableLayoutState,
  PORTAL_TABLE_LAYOUT_KIND,
} from "@/lib/portal/tableLayoutPresets";

let PortalTableLayoutProvider;
let PortalLayoutPresetManager;
let PortalConfirmProvider;
let SelectableDataTable;
let usePortalConfirm;
let usePortalTableLayoutRegistry;

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  dom.window.requestAnimationFrame = globalThis.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globalThis.cancelAnimationFrame;
  dom.window.HTMLElement.prototype.attachEvent = () => undefined;
  dom.window.HTMLElement.prototype.detachEvent = () => undefined;
  dom.window.HTMLElement.prototype.scrollIntoView = () => undefined;
  globalThis.ResizeObserver = class {
    observe() {
      // JSDOM has no layout; tests drive resize and scroll events directly.
    }
    disconnect() {
      // No observer resources exist in this test double.
    }
  };
  const matchMedia = (query) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: String(query),
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  });
  dom.window.matchMedia = matchMedia;
  globalThis.matchMedia = matchMedia;
  ({ PortalConfirmProvider, usePortalConfirm } = await import(
    "@/components/portal/PortalConfirmDialog"
  ));
  ({ PortalTableLayoutProvider, usePortalTableLayoutRegistry } = await import(
    "@/components/portal/PortalTableLayoutContext"
  ));
  ({ PortalLayoutPresetManager } = await import("@/components/portal/PortalLayoutPresetManager"));
  ({ SelectableDataTable } = await import("@/components/portal/SelectableDataTable"));
});

afterAll(() => dom.window.close());

async function settle() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 30)));
}

function ConfirmingLayoutProvider({ children, preset }) {
  const { confirm } = usePortalConfirm();
  const deleteLayoutPreset = async (_preset, focusOrigin) => {
    await confirm({
      danger: true,
      focusOrigin,
      message: `Remove ${preset.name}?`,
      title: "Delete saved layout?",
    });
  };
  return (
    <PortalTableLayoutProvider
      value={{
        applyLayoutPreset: mock(() => undefined),
        deleteLayoutPreset,
        getActivePresetId: () => null,
        getLayoutCommand: () => null,
        layoutPresets: [preset],
        requestSaveLayout: mock(() => undefined),
        resetLayout: mock(() => undefined),
      }}
    >
      {children}
    </PortalTableLayoutProvider>
  );
}

function StatefulScopedLayoutProvider({ children, presets }) {
  const registry = usePortalTableLayoutRegistry("dashboard");
  return (
    <>
      <button
        data-testid="apply-layout-a"
        onClick={() => registry.applyLayoutPreset(presets[0])}
        type="button"
      >
        Apply A
      </button>
      <button
        data-testid="apply-layout-b"
        onClick={() => registry.applyLayoutPreset(presets[1])}
        type="button"
      >
        Apply B
      </button>
      <button
        data-testid="reset-layout-b"
        onClick={() => registry.resetLayout("dashboard:overdue-invoices")}
        type="button"
      >
        Reset B
      </button>
      <PortalTableLayoutProvider
        value={{
          acknowledgeLayoutCommand: registry.acknowledgeLayoutCommand,
          applyLayoutPreset: registry.applyLayoutPreset,
          deleteLayoutPreset: mock(() => undefined),
          getActivePresetId: registry.getActivePresetId,
          getLayoutCommand: registry.getLayoutCommand,
          layoutPresets: presets,
          registryKey: registry.registryKey,
          requestSaveLayout: mock(() => undefined),
          resetLayout: registry.resetLayout,
        }}
      >
        {children}
      </PortalTableLayoutProvider>
    </>
  );
}

function RemountingLayoutProvider({ children, preset }) {
  const registry = usePortalTableLayoutRegistry("dashboard");
  const [mounted, setMounted] = useState(true);
  return (
    <>
      <button
        data-testid="apply-remount-layout"
        onClick={() => registry.applyLayoutPreset(preset)}
        type="button"
      >
        Apply layout
      </button>
      <button
        data-testid="toggle-remount-table"
        onClick={() => setMounted((current) => !current)}
        type="button"
      >
        Toggle table
      </button>
      <PortalTableLayoutProvider
        value={{
          acknowledgeLayoutCommand: registry.acknowledgeLayoutCommand,
          applyLayoutPreset: registry.applyLayoutPreset,
          deleteLayoutPreset: mock(() => undefined),
          getActivePresetId: registry.getActivePresetId,
          getLayoutCommand: registry.getLayoutCommand,
          layoutPresets: [preset],
          registryKey: registry.registryKey,
          requestSaveLayout: mock(() => undefined),
          resetLayout: registry.resetLayout,
        }}
      >
        {mounted ? children : null}
      </PortalTableLayoutProvider>
    </>
  );
}

describe("SelectableDataTable horizontal scroll", () => {
  test("Keeps desktop rows, mobile cards, and query actions on the same sorted page", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const openedQueries = [];
    const rows = Array.from({ length: 30 }, (_, index) => {
      const sequence = 30 - index;
      return {
        id: `query-${sequence}`,
        queryCode: `Q-${String(sequence).padStart(4, "0")}`,
      };
    });
    const columns = [
      {
        id: "query",
        kind: "identity",
        label: "Query",
        render: (row) => <span data-query-id={row.id}>{row.queryCode}</span>,
        sortValue: (row) => row.queryCode,
      },
      {
        id: "actions",
        kind: "action",
        label: "Actions",
        render: (row) => (
          <button onClick={() => openedQueries.push(row.id)} type="button">
            Open {row.queryCode}
          </button>
        ),
      },
    ];

    await act(async () =>
      root.render(<SelectableDataTable columns={columns} empty="No queries" rows={rows} />)
    );

    const queryHeader = [...container.querySelectorAll("th button")].find((button) =>
      button.textContent.includes("Query")
    );
    await act(async () => queryHeader.click());

    const desktopOrder = () =>
      [...container.querySelectorAll("tbody [data-query-id]")].map((node) => node.textContent);
    const mobileOrder = () =>
      [...container.querySelectorAll(".md\\:hidden [data-query-id]")].map(
        (node) => node.textContent
      );
    expect(desktopOrder()).toEqual(mobileOrder());
    expect(desktopOrder()).toEqual(
      Array.from({ length: 25 }, (_, index) => `Q-${String(index + 1).padStart(4, "0")}`)
    );

    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Next")
        ?.click()
    );
    expect(desktopOrder()).toEqual(mobileOrder());
    expect(desktopOrder()).toEqual(["Q-0026", "Q-0027", "Q-0028", "Q-0029", "Q-0030"]);

    await act(async () => container.querySelector("tbody button")?.click());
    await act(async () => container.querySelector(".md\\:hidden button")?.click());
    expect(openedQueries).toEqual(["query-26", "query-26"]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps select-all mixed state and the hidden native input indeterminate", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <SelectableDataTable
          columns={[{ id: "query", label: "Query", render: (row) => row.queryCode }]}
          empty="No rows"
          rowLabel={(row) => row.queryCode}
          rows={[
            { id: "row-1", queryCode: "Q-0001" },
            { id: "row-2", queryCode: "Q-0002" },
          ]}
          selectable
        />
      )
    );

    const firstRow = container.querySelector('tbody [role="checkbox"][aria-label="Select Q-0001"]');
    await act(async () => firstRow.click());
    const selectAll = container.querySelector(
      'thead [role="checkbox"][aria-label="Select all visible rows"]'
    );
    expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
    expect(selectAll.nextElementSibling?.indeterminate).toBe(true);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Shows skeleton loading when rows are undefined", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => {
      root.render(
        <SelectableDataTable
          columns={[{ hideable: true, id: "query", label: "Query", render: (row) => row.id }]}
          empty="No rows"
        />
      );
    });

    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector('[aria-label="Table command dock"]')).not.toBeNull();

    await act(() => {
      root.render(
        <SelectableDataTable
          columns={[{ hideable: true, id: "query", label: "Query", render: (row) => row.id }]}
          empty="No rows"
          rows={[{ id: "row-1", queryCode: "Q-0001" }]}
        />
      );
    });

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector("table")).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("Renders accessible scroll controls when desktop table overflows", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const wideColumns = Array.from({ length: 8 }, (_, index) => ({
      id: `col-${index}`,
      label: `Column ${index}`,
      render: (row) => row.id,
      width: 240,
    }));

    await act(() => {
      root.render(
        <SelectableDataTable
          columns={wideColumns}
          empty="No rows"
          rows={[{ id: "row-1", queryCode: "Q-0001" }]}
        />
      );
    });

    const scrollContainer = container.querySelector(".overflow-x-auto");
    Object.defineProperty(scrollContainer, "clientWidth", { configurable: true, value: 400 });
    Object.defineProperty(scrollContainer, "scrollWidth", { configurable: true, value: 1200 });
    Object.defineProperty(scrollContainer, "scrollLeft", {
      configurable: true,
      value: 0,
      writable: true,
    });

    await act(() => {
      scrollContainer?.dispatchEvent(new window.Event("scroll"));
    });

    expect(container.querySelector('[aria-label="Scroll table right"]')).not.toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps role-owned layout state truthful in the mounted table dock", async () => {
    const layoutPreset = {
      canMutate: false,
      filterState: createPortalTableLayoutState({
        columns: ["query", "actions"],
        scope: "queries:list",
        sort: null,
      }),
      id: "sales-focus",
      name: "Sales focus",
      sharedRole: "Sales",
    };
    const columns = [
      {
        id: "query",
        kind: "identity",
        label: "Query",
        render: (row) => row.queryCode,
      },
      {
        hideable: true,
        id: "status",
        label: "Status",
        render: (row) => row.status,
      },
      {
        id: "actions",
        kind: "action",
        label: "Actions",
        render: () => <button type="button">Open</button>,
      },
    ];

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const contextValue = {
      applyLayoutPreset: mock(() => undefined),
      deleteLayoutPreset: mock(() => undefined),
      getActivePresetId: (scope) => (scope === "queries:list" ? "sales-focus" : null),
      getLayoutCommand: (scope) =>
        scope === "queries:list"
          ? { id: 1, layout: layoutPreset.filterState, scope: "queries:list" }
          : null,
      layoutPresets: [layoutPreset],
      requestSaveLayout: mock(() => undefined),
      resetLayout: mock(() => undefined),
    };

    await act(async () =>
      root.render(
        <PortalTableLayoutProvider value={contextValue}>
          <SelectableDataTable
            columns={columns}
            empty="No queries"
            layoutKey="queries:list"
            rows={[{ id: "q1", queryCode: "Q-1", status: "Open" }]}
          />
        </PortalTableLayoutProvider>
      )
    );

    const dock = container.querySelector('[aria-label="Table command dock"]');
    expect(dock).not.toBeNull();
    expect(dock.textContent).toContain("Current: Sales focus");
    expect(dock.textContent).toContain("2 of 3 columns");
    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Query",
      "Actions",
    ]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps an all-optional-columns-hidden preset truthfully selected", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const layout = createPortalTableLayoutState({
      columns: [],
      scope: "queries:list",
      sort: null,
    });
    const preset = {
      canMutate: false,
      filterState: layout,
      id: "identity-only",
      name: "Identity only",
    };

    await act(async () =>
      root.render(
        <PortalTableLayoutProvider
          value={{
            applyLayoutPreset: mock(() => undefined),
            deleteLayoutPreset: mock(() => undefined),
            getActivePresetId: () => preset.id,
            getLayoutCommand: () => ({ id: 1, layout, scope: "queries:list" }),
            layoutPresets: [preset],
            requestSaveLayout: mock(() => undefined),
            resetLayout: mock(() => undefined),
          }}
        >
          <SelectableDataTable
            columns={[
              { id: "query", kind: "identity", label: "Query", render: (row) => row.id },
              { hideable: true, id: "status", label: "Status", render: () => "Open" },
              {
                id: "action",
                kind: "action",
                label: "Action",
                render: () => <button type="button">Open</button>,
              },
            ]}
            empty="No queries"
            layoutKey="queries:list"
            rows={[{ id: "q1" }]}
          />
        </PortalTableLayoutProvider>
      )
    );
    await settle();

    const dock = container.querySelector('[aria-label="Table command dock"]');
    expect(dock.textContent).toContain("Current: Identity only");
    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Query",
      "Action",
    ]);
    const presetsTrigger = [...dock.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Presets"
    );
    await act(async () => presetsTrigger.click());
    await settle();
    expect(
      document.querySelector('[role="menuitemradio"][aria-checked="true"]')?.textContent
    ).toContain("Identity only");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps column controls keyboard-reachable with semantic mobile-card ordering", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const contextValue = {
      applyLayoutPreset: mock(() => undefined),
      deleteLayoutPreset: mock(() => undefined),
      getActivePresetId: () => null,
      getLayoutCommand: () => null,
      layoutPresets: [],
      requestSaveLayout: mock(() => undefined),
      resetLayout: mock(() => undefined),
    };

    await act(async () =>
      root.render(
        <PortalTableLayoutProvider value={contextValue}>
          <SelectableDataTable
            columns={[
              {
                id: "query",
                kind: "identity",
                label: "Query",
                render: (row) => row.queryCode,
              },
              {
                hideable: true,
                id: "status",
                label: "Status",
                render: (row) => row.status,
              },
              {
                id: "actions",
                kind: "action",
                label: "Actions",
                render: () => <button type="button">Open</button>,
              },
            ]}
            empty="No queries"
            layoutKey="queries:list"
            rows={[{ id: "q1", queryCode: "Q-1", status: "Open" }]}
          />
        </PortalTableLayoutProvider>
      )
    );

    const dock = container.querySelector('[aria-label="Table command dock"]');
    const mobileCards = container.querySelector(".md\\:hidden");
    const columnsTrigger = [...dock.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Columns"
    );
    expect(dock.className).toContain("flex-wrap");
    expect(dock.className).toContain("min-w-0");
    const tableSections = [...dock.parentElement.children];
    expect(tableSections.indexOf(dock)).toBeLessThan(tableSections.indexOf(mobileCards));
    expect(columnsTrigger.className).toContain("min-h-11");
    columnsTrigger.focus();
    await act(async () => columnsTrigger.click());
    await settle();

    const statusToggle = document.querySelector('[role="menuitemcheckbox"][aria-checked="true"]');
    expect(statusToggle.textContent).toContain("Status");
    statusToggle.focus();
    await act(async () =>
      statusToggle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }))
    );
    await settle();
    expect(document.querySelector('[role="menuitemcheckbox"]')).toBeNull();
    expect(document.activeElement).toBe(columnsTrigger);

    await act(async () => columnsTrigger.click());
    await settle();
    const reopenedStatusToggle = document.querySelector('[role="menuitemcheckbox"]');
    await act(async () => reopenedStatusToggle.click());
    expect(reopenedStatusToggle.getAttribute("aria-checked")).toBe("false");
    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Query",
      "Actions",
    ]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Scopes a layout command to one table when sibling tables share sortable column IDs", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const rows = [
      { client: "Alice", detail: "First detail", id: "row-1" },
      { client: "Bob", detail: "Second detail", id: "row-2" },
    ];
    const columns = [
      {
        id: "record",
        kind: "identity",
        label: "Record",
        render: (row) => row.id,
      },
      {
        id: "client",
        label: "Client",
        render: (row) => row.client,
        sortValue: (row) => row.client,
      },
      {
        hideable: true,
        id: "detail",
        label: "Detail",
        render: (row) => row.detail,
      },
    ];
    const layout = createPortalTableLayoutState({
      columns: ["record", "client"],
      scope: "dashboard:upcoming-departures",
      sort: { columnId: "client", direction: "desc" },
    });
    const overdueLayout = createPortalTableLayoutState({
      columns: ["record", "client", "detail"],
      scope: "dashboard:overdue-invoices",
      sort: { columnId: "client", direction: "desc" },
    });
    const layoutPresets = [
      {
        canMutate: false,
        filterState: layout,
        id: "upcoming-layout",
        name: "Upcoming departures",
      },
      {
        canMutate: false,
        filterState: overdueLayout,
        id: "overdue-layout",
        name: "Overdue invoices",
      },
    ];
    await act(async () =>
      root.render(
        <StatefulScopedLayoutProvider presets={layoutPresets}>
          <div data-testid="upcoming-table">
            <SelectableDataTable
              columns={columns}
              empty="No departures"
              layoutKey="dashboard:upcoming-departures"
              rows={rows}
            />
          </div>
          <div data-testid="overdue-table">
            <SelectableDataTable
              columns={columns}
              empty="No invoices"
              layoutKey="dashboard:overdue-invoices"
              rows={rows}
            />
          </div>
        </StatefulScopedLayoutProvider>
      )
    );

    await act(async () => container.querySelector('[data-testid="apply-layout-a"]').click());
    await settle();

    const tableText = (testId, selector) =>
      [...container.querySelector(`[data-testid="${testId}"]`).querySelectorAll(selector)].map(
        (node) => node.textContent.trim()
      );
    expect(tableText("upcoming-table", "th")).toEqual(["Record", "Client"]);
    expect(tableText("overdue-table", "th")).toEqual(["Record", "Client", "Detail"]);
    expect(tableText("upcoming-table", "tbody tr td:nth-child(2)")).toEqual(["Bob", "Alice"]);
    expect(tableText("overdue-table", "tbody tr td:nth-child(2)")).toEqual(["Alice", "Bob"]);
    expect(
      container.querySelector(
        '[data-testid="upcoming-table"] [data-testid="portal-table-current-layout"]'
      ).textContent
    ).toContain("Upcoming departures");

    await act(async () => container.querySelector('[data-testid="apply-layout-b"]').click());
    await settle();

    expect(tableText("upcoming-table", "tbody tr td:nth-child(2)")).toEqual(["Bob", "Alice"]);
    expect(tableText("overdue-table", "tbody tr td:nth-child(2)")).toEqual(["Bob", "Alice"]);
    expect(
      container.querySelector(
        '[data-testid="upcoming-table"] [data-testid="portal-table-current-layout"]'
      ).textContent
    ).toContain("Upcoming departures");
    expect(
      container.querySelector(
        '[data-testid="overdue-table"] [data-testid="portal-table-current-layout"]'
      ).textContent
    ).toContain("Overdue invoices");

    await act(async () => container.querySelector('[data-testid="reset-layout-b"]').click());
    await settle();

    expect(tableText("upcoming-table", "tbody tr td:nth-child(2)")).toEqual(["Bob", "Alice"]);
    expect(tableText("overdue-table", "tbody tr td:nth-child(2)")).toEqual(["Alice", "Bob"]);
    expect(
      container.querySelector(
        '[data-testid="upcoming-table"] [data-testid="portal-table-current-layout"]'
      ).textContent
    ).toContain("Upcoming departures");
    expect(
      container.querySelector(
        '[data-testid="overdue-table"] [data-testid="portal-table-current-layout"]'
      ).textContent
    ).toContain("Default layout");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Does not replay an acknowledged layout command when a table remounts", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const preset = {
      canMutate: false,
      filterState: createPortalTableLayoutState({
        columns: ["record"],
        scope: "dashboard:upcoming-departures",
        sort: null,
      }),
      id: "one-shot-layout",
      name: "Compact departures",
    };
    const columns = [
      { id: "record", kind: "identity", label: "Record", render: (row) => row.id },
      { hideable: true, id: "detail", label: "Detail", render: (row) => row.detail },
    ];

    await act(async () =>
      root.render(
        <RemountingLayoutProvider preset={preset}>
          <SelectableDataTable
            columns={columns}
            empty="No departures"
            layoutKey="dashboard:upcoming-departures"
            rows={[{ detail: "Visible by default", id: "row-1" }]}
          />
        </RemountingLayoutProvider>
      )
    );

    await act(async () => container.querySelector('[data-testid="apply-remount-layout"]').click());
    await settle();
    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Record",
    ]);

    await act(async () => container.querySelector('[data-testid="toggle-remount-table"]').click());
    await act(async () => container.querySelector('[data-testid="toggle-remount-table"]').click());
    await settle();

    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Record",
      "Detail",
    ]);
    expect(
      container.querySelector('[data-testid="portal-table-current-layout"]').textContent
    ).toContain("Default layout");

    await act(async () => root.unmount());
    container.remove();
  });

  test("Passes optional-column visibility to a custom mobile card without hiding actions", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const columns = [
      {
        id: "query",
        kind: "identity",
        label: "Query",
        render: (row) => row.queryCode,
      },
      {
        hideable: true,
        id: "status",
        label: "Status",
        render: (row) => row.status,
      },
      {
        id: "action",
        kind: "action",
        label: "Action",
        render: (row) => <button type="button">Open {row.queryCode}</button>,
      },
    ];

    await act(async () =>
      root.render(
        <SelectableDataTable
          columns={columns}
          empty="No queries"
          layoutKey="queries:list"
          mobileCardRender={(row, visibleColumnIds) => (
            <div>
              <span data-mobile-query>{row.queryCode}</span>
              {visibleColumnIds.has("status") ? <span data-mobile-status>{row.status}</span> : null}
            </div>
          )}
          rows={[{ id: "q1", queryCode: "Q-1", status: "Open" }]}
        />
      )
    );

    expect(container.querySelector(".md\\:hidden [data-mobile-query]")?.textContent).toBe("Q-1");
    expect(container.querySelector(".md\\:hidden [data-mobile-status]")?.textContent).toBe("Open");
    expect(container.querySelector(".md\\:hidden button")?.textContent).toBe("Open Q-1");

    const columnsTrigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Columns"
    );
    await act(async () => columnsTrigger.click());
    await settle();
    const statusToggle = [...document.querySelectorAll('[role="menuitemcheckbox"]')].find(
      (button) => button.textContent.includes("Status")
    );
    await act(async () => statusToggle.click());

    expect(container.querySelector(".md\\:hidden [data-mobile-query]")?.textContent).toBe("Q-1");
    expect(container.querySelector(".md\\:hidden [data-mobile-status]")).toBeNull();
    expect(container.querySelector(".md\\:hidden button")?.textContent).toBe("Open Q-1");
    expect([...container.querySelectorAll("th")].map((cell) => cell.textContent.trim())).toEqual([
      "Query",
      "Action",
    ]);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Keeps stale layouts and ordinary views removable with bucket-aware recovery", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const stalePreset = {
      canMutate: true,
      filterState: {
        columns: "status",
        kind: PORTAL_TABLE_LAYOUT_KIND,
        scope: "queries:list",
        sort: null,
      },
      id: "stale-layout",
      name: "Old layout",
    };
    const savedFilterView = {
      canMutate: true,
      filterState: { status: "Open" },
      id: "saved-filter",
      name: "My open queries",
      pathname: "/portal/queries",
      view: "queries",
    };
    const onDelete = mock(() => Promise.resolve());

    await act(async () =>
      root.render(
        <PortalLayoutPresetManager
          items={[stalePreset, savedFilterView]}
          onDelete={onDelete}
          overflowBuckets={[
            { canDelete: true, kind: "private", label: "your account", sharedRole: null },
            {
              canDelete: false,
              kind: "shared",
              label: "Finance role",
              sharedRole: "Finance",
            },
          ]}
        />
      )
    );

    const presetsTrigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Manage saved views"
    );
    await act(async () => presetsTrigger.click());
    await settle();
    const deleteButton = [...document.querySelectorAll('[role="menuitem"]')].find((button) =>
      button.textContent.includes("Delete Old layout")
    );
    expect(deleteButton.textContent).toContain("Table layout · Unavailable layout scope · Private");
    expect(document.body.textContent).toContain(
      "Delete a visible item from this bucket to reveal the next one."
    );
    expect(document.body.textContent).toContain(
      "Ask a saved-view manager to remove one from this bucket to reveal the next one."
    );
    const filterDeleteButton = [...document.querySelectorAll('[role="menuitem"]')].find((button) =>
      button.textContent.includes("Delete My open queries")
    );
    expect(filterDeleteButton.textContent).toContain("Saved view · queries · Private");
    await act(async () => filterDeleteButton.click());
    expect(onDelete).toHaveBeenCalledWith(savedFilterView, presetsTrigger);

    await act(async () => root.unmount());
    container.remove();
  });

  test("Restores focus to the Presets trigger after cancelling layout deletion", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const preset = {
      canMutate: true,
      filterState: createPortalTableLayoutState({
        columns: ["query"],
        scope: "queries:list",
        sort: null,
      }),
      id: "delete-me",
      name: "Delete me",
    };

    await act(async () =>
      root.render(
        <PortalConfirmProvider>
          <ConfirmingLayoutProvider preset={preset}>
            <SelectableDataTable
              columns={[
                { id: "query", kind: "identity", label: "Query", render: (row) => row.id },
                { hideable: true, id: "status", label: "Status", render: () => "Open" },
              ]}
              empty="No queries"
              layoutKey="queries:list"
              rows={[{ id: "q1" }]}
            />
          </ConfirmingLayoutProvider>
        </PortalConfirmProvider>
      )
    );

    const presetsTrigger = [...container.querySelectorAll("button")].find(
      (button) => button.textContent.trim() === "Presets"
    );
    await act(async () => presetsTrigger.focus());
    await act(async () => presetsTrigger.click());
    await settle();
    const deleteButton = [...document.querySelectorAll('[role="menuitem"]')].find((button) =>
      button.textContent.includes("Delete Delete me")
    );
    await act(async () => deleteButton.focus());
    await act(async () => {
      deleteButton.click();
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(document.querySelector('[data-testid="portal-confirm-dialog"]')).not.toBeNull();
    const cancelButton = document.querySelector('[data-testid="portal-confirm-cancel"]');
    expect(document.activeElement).toBe(cancelButton);
    await act(async () => cancelButton.click());
    await settle();
    expect(document.activeElement).toBe(presetsTrigger);

    await act(async () => root.unmount());
    container.remove();
  });
});
