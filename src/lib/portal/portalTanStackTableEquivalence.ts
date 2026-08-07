"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  type ColumnDef,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@/components/ui/foundation/table";
import { shouldResetLoadedPage } from "./paginatedRows";
import type { PortalGridColumn, PortalSortDirection, PortalSortValue } from "./portalDataGrid";
import { preparePortalColumns } from "./portalDataGrid";

interface PortalTanStackRow {
  id: unknown;
}

export interface PortalTanStackColumnMeta<Row extends PortalTanStackRow = PortalTanStackRow> {
  portalColumn: PortalGridColumn<Row>;
}

// biome-ignore assist/source/useSortedKeys: TanStack v9 feature plugins must precede dependent row-model slots.
const portalTanStackColumnFeatures = tableFeatures({
  columnMeta: metaHelper<PortalTanStackColumnMeta>(),
  columnVisibilityFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const PORTAL_PAGE_SIZE = 25;

type PortalTanStackColumnDef<Row extends PortalTanStackRow> = ColumnDef<
  typeof portalTanStackColumnFeatures,
  Row,
  unknown
>;

function normalizePortalSortValue(value: PortalSortValue): PortalSortValue {
  return typeof value === "string" && value.trim() === "" ? undefined : (value ?? undefined);
}

function comparePortalSortValues(left: PortalSortValue, right: PortalSortValue): number {
  if (left === right) {
    return 0;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }
  return String(left).localeCompare(String(right), "en-IN", {
    numeric: true,
    sensitivity: "base",
  });
}

export function createPortalTanStackColumns<Row extends PortalTanStackRow>(
  columns: readonly PortalGridColumn<Row>[]
): PortalTanStackColumnDef<Row>[] {
  return preparePortalColumns(columns).map((portalColumn) => {
    const getSortValue = portalColumn.sortValue ?? portalColumn.semanticValue;
    const shared = {
      cell: ({ row }: { row: { original: Row } }): ReactNode => portalColumn.render(row.original),
      enableHiding: portalColumn.hideable === true,
      enableSorting: Boolean(getSortValue),
      header: portalColumn.label,
      id: portalColumn.id,
      meta: { portalColumn } as PortalTanStackColumnMeta,
    };
    return getSortValue
      ? ({
          ...shared,
          accessorFn: (row: Row) => normalizePortalSortValue(getSortValue(row)),
          sortDescFirst: false,
          sortFn: (left, right, columnId) =>
            comparePortalSortValues(left.getValue(columnId), right.getValue(columnId)),
          sortUndefined: "last",
        } as PortalTanStackColumnDef<Row>)
      : (shared as PortalTanStackColumnDef<Row>);
  });
}

export interface PortalTanStackEquivalenceModel<Row extends PortalTanStackRow> {
  allPageRowsSelected: boolean;
  clearSelection: () => void;
  currentPage: number;
  deleteSelected: (onBulkDelete: (ids: string[]) => boolean | Promise<boolean>) => Promise<boolean>;
  pageRows: Row[];
  selectedIds: string[];
  setPage: (page: number) => void;
  somePageRowsSelected: boolean;
  sort: { columnId: string; direction: PortalSortDirection } | null;
  toggleColumn: (columnId: string) => void;
  togglePageSelection: () => void;
  toggleRow: (rowId: string) => void;
  toggleSort: (columnId: string) => void;
  totalPages: number;
  visibleColumnIds: string[];
}

interface UsePortalTanStackTableEquivalenceInput<Row extends PortalTanStackRow> {
  columns: readonly PortalGridColumn<Row>[];
  rows: readonly Row[];
  selectable?: boolean;
}

export function usePortalTanStackTableEquivalence<Row extends PortalTanStackRow>({
  columns,
  rows,
  selectable = false,
}: UsePortalTanStackTableEquivalenceInput<Row>): PortalTanStackEquivalenceModel<Row> {
  const mappedColumns = useMemo(() => createPortalTanStackColumns(columns), [columns]);
  const table = useTable({
    autoResetPageIndex: false,
    columns: mappedColumns,
    data: rows,
    enableMultiSort: false,
    enableRowRangeSelection: false,
    enableRowSelection: selectable,
    enableSortingRemoval: true,
    enableSubRowSelection: false,
    features: portalTanStackColumnFeatures,
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: PORTAL_PAGE_SIZE } },
    sortDescFirst: false,
  });
  const tableRef = useRef(table);
  tableRef.current = table;
  const previousRowIdsRef = useRef<string[] | null>(null);
  const rowIds = useMemo(() => rows.map((row) => String(row.id)), [rows]);
  const rowIdentity = rowIds.join("\0");

  useEffect(() => {
    const currentTable = tableRef.current;
    const previousRowIds = previousRowIdsRef.current;
    const currentRowIds = rowIdentity ? rowIdentity.split("\0") : [];
    if (shouldResetLoadedPage(previousRowIds, currentRowIds)) {
      currentTable.firstPage();
    } else {
      const lastPageIndex = Math.max(0, currentTable.getPageCount() - 1);
      if (currentTable.atoms.pagination.get().pageIndex > lastPageIndex) {
        currentTable.setPageIndex(lastPageIndex);
      }
    }
    const currentSelection = currentTable.atoms.rowSelection.get();
    const visibleRowIds = new Set(currentRowIds);
    const nextSelection = Object.fromEntries(
      Object.keys(currentSelection)
        .filter((rowId) => visibleRowIds.has(rowId))
        .map((rowId) => [rowId, true] as const)
    );
    if (Object.keys(nextSelection).length !== Object.keys(currentSelection).length) {
      currentTable.setRowSelection(nextSelection);
    }
    previousRowIdsRef.current = currentRowIds;
  }, [rowIdentity]);

  const [sorting] = table.state.sorting;
  const totalPages = Math.max(1, table.getPageCount());

  return {
    allPageRowsSelected: table.getIsAllPageRowsSelected(),
    clearSelection: () => table.resetRowSelection(true),
    currentPage: Math.min(table.state.pagination.pageIndex + 1, totalPages),
    deleteSelected: async (onBulkDelete) => {
      const selectedIds = table.getSelectedRowIds();
      if (selectedIds.length === 0) {
        return false;
      }
      const deleted = await onBulkDelete(selectedIds);
      if (deleted) {
        table.resetRowSelection(true);
      }
      return deleted;
    },
    pageRows: table.getPaginatedRowModel().rows.map((row) => row.original),
    selectedIds: table.getSelectedRowIds(),
    setPage: (page) => {
      const nextPage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
      table.setPageIndex(nextPage - 1);
    },
    somePageRowsSelected: table.getIsSomePageRowsSelected(),
    sort: sorting ? { columnId: sorting.id, direction: sorting.desc ? "desc" : "asc" } : null,
    toggleColumn: (columnId) => {
      const column = table.getColumn(columnId);
      if (!column?.getCanHide()) {
        return;
      }
      if (column.getIsSorted()) {
        column.clearSorting();
      }
      column.toggleVisibility();
    },
    togglePageSelection: () => table.toggleAllPageRowsSelected(),
    toggleRow: (rowId) => table.getRow(rowId, true).toggleSelected(),
    toggleSort: (columnId) => {
      table.firstPage();
      table.getColumn(columnId)?.toggleSorting(undefined, false);
    },
    totalPages,
    visibleColumnIds: table.getVisibleLeafColumns().map((column) => column.id),
  };
}
