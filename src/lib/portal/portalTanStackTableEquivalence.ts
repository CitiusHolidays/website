"use client";

import type { ReactNode } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
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
import { isRuntimeBoolean, isRuntimeNumber, isRuntimeString } from "../runtimeValues";
import { shouldResetLoadedPage } from "./paginatedRows";
import type { PortalGridColumn, PortalSortDirection, PortalSortValue } from "./portalDataGrid";
import { preparePortalColumns } from "./portalDataGrid";
import type { PortalTableLayoutState } from "./tableLayoutPresets";

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
  return isRuntimeString(value) && value.trim() === "" ? undefined : (value ?? undefined);
}

function comparePortalSortValues(left: PortalSortValue, right: PortalSortValue): number {
  if (left === right) {
    return 0;
  }
  if (isRuntimeNumber(left) && isRuntimeNumber(right)) {
    return left - right;
  }
  if (isRuntimeBoolean(left) && isRuntimeBoolean(right)) {
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
      // SAFETY: this module owns the TanStack meta object and writes the complete PortalTanStackColumnMeta shape.
      meta: { portalColumn } as PortalTanStackColumnMeta,
    };
    // SAFETY: both branches build the complete TanStack column contract from a validated portal column.
    return getSortValue
      ? // SAFETY: the accessor branch supplies the complete accessor-column contract expected by TanStack.
        ({
          ...shared,
          accessorFn: (row: Row) => normalizePortalSortValue(getSortValue(row)),
          sortDescFirst: false,
          sortFn: (left, right, columnId) =>
            comparePortalSortValues(left.getValue(columnId), right.getValue(columnId)),
          sortUndefined: "last",
        } as PortalTanStackColumnDef<Row>)
      : // SAFETY: the display-column branch needs no accessor and shared contains its complete contract.
        (shared as PortalTanStackColumnDef<Row>);
  });
}

export interface PortalTanStackEquivalenceModel<Row extends PortalTanStackRow> {
  allPageRowsSelected: boolean;
  clearSelection: () => void;
  currentPage: number;
  deleteSelected: (onBulkDelete: (ids: string[]) => boolean | Promise<boolean>) => Promise<boolean>;
  pageRows: Row[];
  resetLayout: () => void;
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

export interface PortalTableLayoutCommand {
  id: number;
  layout: PortalTableLayoutState | null;
  scope: string;
}

interface UsePortalTanStackTableEquivalenceInput<Row extends PortalTanStackRow> {
  columns: readonly PortalGridColumn<Row>[];
  layoutCommand?: PortalTableLayoutCommand | null;
  layoutIdentity?: string;
  layoutScope?: null | string;
  onLayoutCommandApplied?: (scope: string, commandId: number) => void;
  rows: readonly Row[];
  selectable?: boolean;
}

export function usePortalTanStackTableEquivalence<Row extends PortalTanStackRow>({
  columns,
  layoutIdentity = "",
  layoutCommand,
  layoutScope,
  onLayoutCommandApplied,
  rows,
  selectable = false,
}: UsePortalTanStackTableEquivalenceInput<Row>): PortalTanStackEquivalenceModel<Row> {
  const mappedColumns = createPortalTanStackColumns(columns);
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
  const getLatestTable = useEffectEvent(() => table);
  const acknowledgeLayoutCommand = useEffectEvent((scope: string, commandId: number) => {
    onLayoutCommandApplied?.(scope, commandId);
  });
  const previousRowIdsRef = useRef<string[] | null>(null);
  const previousLayoutIdentityRef = useRef(`${layoutIdentity}\0${layoutScope ?? ""}`);
  const rowIds = rows.map((row) => String(row.id));
  const rowIdentity = rowIds.join("\0");

  useEffect(() => {
    const currentTable = getLatestTable();
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
      Object.keys(currentSelection).flatMap((rowId) =>
        visibleRowIds.has(rowId) ? ([[rowId, true]] as const) : []
      )
    );
    if (Object.keys(nextSelection).length !== Object.keys(currentSelection).length) {
      currentTable.setRowSelection(nextSelection);
    }
    previousRowIdsRef.current = currentRowIds;
  }, [rowIdentity]);

  useEffect(() => {
    const nextIdentity = `${layoutIdentity}\0${layoutScope ?? ""}`;
    if (previousLayoutIdentityRef.current === nextIdentity) {
      return;
    }
    previousLayoutIdentityRef.current = nextIdentity;
    const currentTable = getLatestTable();
    currentTable.setColumnVisibility({});
    currentTable.setSorting([]);
    currentTable.resetRowSelection(true);
    currentTable.firstPage();
  }, [layoutIdentity, layoutScope]);

  useEffect(() => {
    if (
      !layoutCommand ||
      layoutCommand.scope !== layoutScope ||
      (layoutCommand.layout && layoutCommand.layout.scope !== layoutCommand.scope)
    ) {
      return;
    }
    const currentTable = getLatestTable();
    if (!layoutCommand.layout) {
      currentTable.setColumnVisibility({});
      currentTable.setSorting([]);
      currentTable.firstPage();
      acknowledgeLayoutCommand(layoutCommand.scope, layoutCommand.id);
      return;
    }

    const visibleIds = new Set(layoutCommand.layout.columns);
    const visibility = Object.fromEntries(
      currentTable
        .getAllLeafColumns()
        .flatMap((column) => (column.getCanHide() ? [[column.id, visibleIds.has(column.id)]] : []))
    );
    currentTable.setColumnVisibility(visibility);

    const requestedSort = layoutCommand.layout.sort;
    const sortColumn = requestedSort ? currentTable.getColumn(requestedSort.columnId) : undefined;
    const sortColumnVisible =
      sortColumn && (!sortColumn.getCanHide() || visibleIds.has(sortColumn.id));
    currentTable.setSorting(
      requestedSort && sortColumn?.getCanSort() && sortColumnVisible
        ? [{ desc: requestedSort.direction === "desc", id: requestedSort.columnId }]
        : []
    );
    currentTable.firstPage();
    acknowledgeLayoutCommand(layoutCommand.scope, layoutCommand.id);
  }, [layoutCommand, layoutScope]);

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
    resetLayout: () => {
      table.setColumnVisibility({});
      table.setSorting([]);
      table.firstPage();
    },
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
