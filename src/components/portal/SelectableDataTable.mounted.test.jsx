// biome-ignore-all lint/performance/noJsxPropsBind: Mounted contracts intentionally use inline callbacks to model consumer render props.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.ResizeObserver = class {
    observe() {
      // JSDOM has no layout; tests drive resize and scroll events directly.
    }
    disconnect() {
      // No observer resources exist in this test double.
    }
  };
});

afterAll(() => dom.window.close());

describe("SelectableDataTable horizontal scroll", () => {
  test("keeps desktop rows, mobile cards, and query actions on the same sorted page", async () => {
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

  test("keeps select-all mixed state and the hidden native input indeterminate", async () => {
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

  test("shows skeleton loading when rows are undefined", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(() => {
      root.render(
        <SelectableDataTable
          columns={[{ id: "query", label: "Query", render: (row) => row.id }]}
          empty="No rows"
        />
      );
    });

    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.querySelector("table")).toBeNull();

    await act(() => {
      root.render(
        <SelectableDataTable
          columns={[{ id: "query", label: "Query", render: (row) => row.id }]}
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

  test("renders accessible scroll controls when desktop table overflows", async () => {
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
});
