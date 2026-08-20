import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";
import { JSDOM } from "jsdom";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { isRuntimeFunction } from "../runtimeValues";
import type { PortalGridColumn } from "./portalDataGrid";
import {
  createPortalTanStackColumns,
  type PortalTanStackColumnMeta,
  type PortalTanStackEquivalenceModel,
  usePortalTanStackTableEquivalence,
} from "./portalTanStackTableEquivalence";

interface TestRow {
  id: string;
  label: null | string;
  status: string;
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://citiusholidays.com/portal/queries",
});

beforeAll(() => {
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: dom.window.Node,
    window: dom.window,
  });
});

afterAll(() => dom.window.close());

async function renderAdapter(
  rows: TestRow[],
  columns: PortalGridColumn<TestRow>[]
): Promise<{
  getModel: () => PortalTanStackEquivalenceModel<TestRow>;
  rerender: (nextRows: TestRow[]) => Promise<void>;
  root: Root;
  unmount: () => Promise<void>;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  let model: PortalTanStackEquivalenceModel<TestRow> | undefined;

  function Harness({ data }: { data: TestRow[] }) {
    model = usePortalTanStackTableEquivalence({ columns, rows: data, selectable: true });
    return null;
  }

  await act(async () => root.render(<Harness data={rows} />));
  return {
    getModel: () => {
      if (!model) {
        throw new Error("Adapter model was not rendered");
      }
      return model;
    },
    rerender: async (nextRows) => {
      await act(async () => root.render(<Harness data={nextRows} />));
    },
    root,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("Private portal TanStack Table equivalence adapter", () => {
  test("Maps portal columns without taking ownership of presentation metadata or renderers", () => {
    const render = (candidate: TestRow) => `Rendered ${candidate.label}`;
    const columns: PortalGridColumn<TestRow>[] = [
      {
        cellClassName: "cell-class",
        headerClassName: "header-class",
        hideable: true,
        id: "label",
        kind: "data",
        label: "Label",
        mobile: "primary",
        priority: 3,
        render,
        sortValue: (candidate) => candidate.label,
        sticky: "left",
        width: 240,
      },
    ];

    const [mapped] = createPortalTanStackColumns(columns);
    // SAFETY: This test controls the asserted value at the framework boundary below.
    const meta = fromPartial<PortalTanStackColumnMeta<TestRow> | undefined>(mapped?.meta);
    const testRow = { id: "row-1", label: "Journey 10", status: "Open" };

    expect(mapped?.id).toBe("label");
    expect(mapped?.header).toBe("Label");
    expect(mapped?.enableHiding).toBe(true);
    expect(mapped?.enableSorting).toBe(true);
    expect(meta?.portalColumn).toMatchObject({
      cellClassName: "cell-class",
      headerClassName: "header-class",
      hideable: true,
      kind: "data",
      mobile: "primary",
      priority: 3,
      sticky: "left",
      width: 240,
    });
    expect(meta?.portalColumn.render).toBe(render);
    expect(meta?.portalColumn.render(testRow)).toBe("Rendered Journey 10");
    expect(isRuntimeFunction(mapped?.cell)).toBe(true);
    if (!isRuntimeFunction(mapped?.cell)) {
      throw new Error("The mapped cell must be a function");
    }
    const cell = fromAny<(context: { row: { original: TestRow } }) => ReactNode, unknown>(
      mapped.cell
    );
    expect(cell({ row: { original: testRow } })).toBe("Rendered Journey 10");
  });

  test("Uses stable application row ids and the legacy single-column sort cycle", async () => {
    const rows = [
      { id: "journey-10", label: "Journey 10", status: "Open" },
      { id: "journey-2", label: "Journey 2", status: "Open" },
      { id: "journey-1", label: "Journey 1", status: "Open" },
    ];
    const columns: PortalGridColumn<TestRow>[] = [
      {
        id: "label",
        kind: "identity",
        label: "Label",
        render: (row) => row.label,
        sortValue: (row) => row.label,
      },
    ];
    const harness = await renderAdapter(rows, columns);

    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "journey-10",
      "journey-2",
      "journey-1",
    ]);
    expect(harness.getModel().sort).toBeNull();

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().sort).toEqual({ columnId: "label", direction: "asc" });
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "journey-1",
      "journey-2",
      "journey-10",
    ]);

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().sort).toEqual({ columnId: "label", direction: "desc" });
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "journey-10",
      "journey-2",
      "journey-1",
    ]);

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().sort).toBeNull();
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "journey-10",
      "journey-2",
      "journey-1",
    ]);

    await harness.unmount();
  });

  test("Matches en-IN numeric sorting with blank values last and stable ties", async () => {
    const rows = [
      { id: "zulu", label: "Zulu", status: "Open" },
      { id: "blank", label: "", status: "Open" },
      { id: "null", label: null, status: "Open" },
      { id: "alpha-first", label: "Alpha", status: "Open" },
      { id: "alpha-second", label: "alpha", status: "Open" },
      { id: "item-10", label: "Item 10", status: "Open" },
      { id: "item-2", label: "Item 2", status: "Open" },
    ];
    const columns: PortalGridColumn<TestRow>[] = [
      {
        id: "label",
        label: "Label",
        render: (row) => row.label,
        sortValue: (row) => row.label,
      },
    ];
    const harness = await renderAdapter(rows, columns);

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "alpha-first",
      "alpha-second",
      "item-2",
      "item-10",
      "zulu",
      "blank",
      "null",
    ]);

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "zulu",
      "item-10",
      "item-2",
      "alpha-first",
      "alpha-second",
      "blank",
      "null",
    ]);

    await harness.unmount();
  });

  test("Keeps critical columns visible and clears sorting when a hideable column is hidden", async () => {
    const rows = [{ id: "row-1", label: "Alpha", status: "Open" }];
    const columns: PortalGridColumn<TestRow>[] = [
      {
        id: "label",
        kind: "identity",
        label: "Label",
        render: (row) => row.label,
      },
      {
        hideable: true,
        id: "status",
        label: "Status",
        render: (row) => row.status,
        sortValue: (row) => row.status,
      },
    ];
    const harness = await renderAdapter(rows, columns);

    expect(harness.getModel().visibleColumnIds).toEqual(["label", "status"]);
    await act(async () => harness.getModel().toggleSort("status"));
    expect(harness.getModel().sort).toEqual({ columnId: "status", direction: "asc" });

    await act(async () => harness.getModel().toggleColumn("status"));
    expect(harness.getModel().visibleColumnIds).toEqual(["label"]);
    expect(harness.getModel().sort).toBeNull();

    await act(async () => harness.getModel().toggleColumn("label"));
    expect(harness.getModel().visibleColumnIds).toEqual(["label"]);

    await harness.unmount();
  });

  test("Pages by 25, preserves prefix appends, and resets or clamps replacement data", async () => {
    const rows = Array.from({ length: 52 }, (_, index) => ({
      id: `row-${index + 1}`,
      label: `Row ${String(index + 1).padStart(2, "0")}`,
      status: "Open",
    }));
    const columns: PortalGridColumn<TestRow>[] = [
      {
        id: "label",
        label: "Label",
        render: (row) => row.label,
        sortValue: (row) => row.label,
      },
    ];
    const harness = await renderAdapter(rows, columns);

    expect(harness.getModel().currentPage).toBe(1);
    expect(harness.getModel().totalPages).toBe(3);
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual(
      rows.slice(0, 25).map((row) => row.id)
    );

    await act(async () => harness.getModel().setPage(3));
    expect(harness.getModel().currentPage).toBe(3);
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual(["row-51", "row-52"]);

    const appended = [...rows, { id: "row-53", label: "Row 53", status: "Open" }];
    await harness.rerender(appended);
    expect(harness.getModel().currentPage).toBe(3);
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual([
      "row-51",
      "row-52",
      "row-53",
    ]);

    await act(async () => harness.getModel().toggleSort("label"));
    expect(harness.getModel().currentPage).toBe(1);

    await act(async () => harness.getModel().setPage(3));
    const [firstRow, secondRow] = rows;
    if (!(firstRow && secondRow)) {
      throw new Error("Pagination fixture requires two rows");
    }
    await harness.rerender([secondRow, firstRow]);
    expect(harness.getModel().currentPage).toBe(1);
    expect(harness.getModel().totalPages).toBe(1);
    expect(harness.getModel().pageRows.map((row) => row.id)).toEqual(["row-1", "row-2"]);

    await harness.unmount();
  });

  test("Keeps selection across loaded pages, prunes removed rows, and honors bulk-delete outcomes", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      id: `row-${index + 1}`,
      label: `Row ${index + 1}`,
      status: "Open",
    }));
    const columns: PortalGridColumn<TestRow>[] = [
      { id: "label", label: "Label", render: (row) => row.label },
    ];
    const harness = await renderAdapter(rows, columns);

    await act(async () => harness.getModel().toggleRow("row-1"));
    await act(async () => harness.getModel().setPage(2));
    await act(async () => harness.getModel().togglePageSelection());
    expect(harness.getModel().selectedIds).toEqual([
      "row-1",
      "row-26",
      "row-27",
      "row-28",
      "row-29",
      "row-30",
    ]);
    expect(harness.getModel().allPageRowsSelected).toBe(true);
    expect(harness.getModel().somePageRowsSelected).toBe(true);

    const appended = [...rows, { id: "row-31", label: "Row 31", status: "Open" }];
    await harness.rerender(appended);
    expect(harness.getModel().selectedIds).toHaveLength(6);
    expect(harness.getModel().allPageRowsSelected).toBe(false);
    expect(harness.getModel().somePageRowsSelected).toBe(true);

    const [firstRow, secondRow] = rows;
    if (!(firstRow && secondRow)) {
      throw new Error("Selection fixture requires two rows");
    }
    await harness.rerender([firstRow, secondRow]);
    expect(harness.getModel().selectedIds).toEqual(["row-1"]);

    let attemptedIds: string[] = [];
    let failedDelete = true;
    await act(async () => {
      failedDelete = await harness.getModel().deleteSelected((ids) => {
        attemptedIds = ids;
        return false;
      });
    });
    expect(failedDelete).toBe(false);
    expect(attemptedIds).toEqual(["row-1"]);
    expect(harness.getModel().selectedIds).toEqual(["row-1"]);

    let successfulDelete = false;
    await act(async () => {
      successfulDelete = await harness.getModel().deleteSelected(async () => true);
    });
    expect(successfulDelete).toBe(true);
    expect(harness.getModel().selectedIds).toEqual([]);

    await harness.unmount();
  });
});
