// biome-ignore-all lint/performance/noJsxPropsBind: React Compiler memoizes these local handlers; useCallback is redundant and React Doctor rejects it.
"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Trash2,
} from "lucide-react";
import type { AriaAttributes, ChangeEvent, Key, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { HoldToDeleteButton } from "@/components/motion-ui/hold-to-delete";
import { SkeletonMobileCards, SkeletonTable } from "@/components/motion-ui/skeleton";
import { usePortalFilterActions } from "@/components/portal/portalFilterActionsState";
import { ResponsiveDataCards } from "@/components/portal/ResponsiveDataCards";
import { useBulkSelection } from "@/lib/portal/bulkSelection";
import { shouldResetLoadedPage } from "@/lib/portal/paginatedRows";
import {
  desktopPinnedColumnClass,
  nextSortState,
  type PortalGridAttention,
  type PortalGridColumn,
  type PortalSortDirection,
  type PortalSortState,
  preparePortalColumns,
  reconcilePortalSort,
  sortPortalRows,
  visiblePortalColumns,
} from "@/lib/portal/portalDataGrid";

type PortalRowTone = NonNullable<PortalGridAttention["tone"]>;

interface PortalDataRow {
  fullName?: string;
  id: Key;
  invoiceNumber?: string;
  jobCode?: string;
  queryCode?: string;
  readonly [key: string]: any;
}

interface SelectableDataTableProps<Row extends PortalDataRow> {
  canLoadMore?: boolean;
  columns: readonly PortalGridColumn<Row>[];
  compact?: boolean;
  empty: string;
  entityLabel?: string;
  filtersActive?: boolean;
  isLoadingMore?: boolean;
  mobileCardIncludesActions?: boolean;
  mobileCardRender?: (row: Row) => ReactNode;
  onBulkDelete?: (ids: string[]) => boolean | Promise<boolean>;
  onLoadMore?: () => void;
  rowAttention?: (row: Row) => PortalGridAttention | undefined;
  rowLabel?: (row: Row) => string;
  rows?: readonly Row[];
  rowTone?: (row: Row) => PortalRowTone | undefined;
  scrollHints?: boolean;
  selectable?: boolean;
  tableClassName?: string;
}

const ROW_TONE_CLASSES: Record<PortalRowTone, string> = {
  danger: "bg-red-50/45",
  info: "bg-citius-blue/[0.025]",
  warning: "bg-amber-50/45",
};

const PAGE_SIZE = 25;

function columnAriaSort<Row>(
  column: PortalGridColumn<Row>,
  sort: PortalSortState | null
): AriaAttributes["aria-sort"] {
  if (!(column.sortValue || column.semanticValue)) {
    return;
  }
  if (sort?.columnId !== column.id) {
    return "none";
  }
  return sort.direction === "asc" ? "ascending" : "descending";
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction?: PortalSortDirection;
}) {
  if (!active) {
    return <ArrowUpDown aria-hidden className="opacity-45" size={13} />;
  }
  return direction === "asc" ? (
    <ArrowUp aria-hidden size={13} />
  ) : (
    <ArrowDown aria-hidden size={13} />
  );
}

function GridHeaderCell<Row>({
  column,
  onSort,
  sort,
}: {
  column: PortalGridColumn<Row>;
  onSort: (columnId: string) => void;
  sort: PortalSortState | null;
}) {
  const handleSort = () => onSort(column.id);
  return (
    <th
      aria-sort={columnAriaSort(column, sort)}
      className={`border-brand-border border-b px-4 py-3 font-semibold text-citius-blue/80 text-xs ${column.align === "right" ? "text-right" : "text-left"} ${desktopPinnedColumnClass(column.kind, "header", column.sticky)} ${column.headerClassName || ""}`}
      style={column.width ? { minWidth: column.width } : undefined}
    >
      {column.sortValue || column.semanticValue ? (
        <button
          className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2 transition-colors hover:bg-citius-blue/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2 ${column.align === "right" ? "ml-auto" : ""}`}
          onClick={handleSort}
          type="button"
        >
          {column.label}
          <SortIndicator active={sort?.columnId === column.id} direction={sort?.direction} />
        </button>
      ) : (
        column.label
      )}
    </th>
  );
}

function ColumnVisibilityToggle<Row>({
  column,
  hidden,
  onToggle,
}: {
  column: PortalGridColumn<Row>;
  hidden: boolean;
  onToggle: (columnId: string) => void;
}) {
  const handleChange = () => onToggle(column.id);
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-brand-dark text-sm hover:bg-brand-light">
      <input
        checked={!hidden}
        className="size-5 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
        onChange={handleChange}
        type="checkbox"
      />
      {column.label}
    </label>
  );
}

function LoadMoreButton({
  isLoadingMore,
  onLoadMore,
}: {
  isLoadingMore: boolean;
  onLoadMore?: () => void;
}) {
  if (!onLoadMore) {
    return null;
  }
  return (
    <button
      aria-busy={isLoadingMore || undefined}
      className="portal-small-btn bg-white"
      disabled={isLoadingMore}
      onClick={onLoadMore}
      type="button"
    >
      {isLoadingMore ? "Loading more…" : "Load more records"}
    </button>
  );
}

function TableHorizontalScrollContainer({
  children,
  contentKey,
  scrollHints = true,
}: {
  children: ReactNode;
  contentKey: string;
  scrollHints?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    overflow: false,
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const updateScrollState = () => {
      const overflow = node.scrollWidth > node.clientWidth + 1;
      setScrollState({
        canScrollLeft: overflow && node.scrollLeft > 1,
        canScrollRight: overflow && node.scrollLeft + node.clientWidth < node.scrollWidth - 1,
        overflow,
      });
    };

    updateScrollState();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(node);
    node.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      resizeObserver?.disconnect();
      node.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [contentKey]);

  const scrollBy = (direction: "left" | "right") => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    const distance = Math.max(node.clientWidth * 0.7, 160);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollBy({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      left: direction === "left" ? -distance : distance,
    });
  };

  return (
    <div className="relative hidden md:block">
      {scrollHints && scrollState.overflow && scrollState.canScrollLeft ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-white to-transparent"
          />
          <button
            aria-label="Scroll table left"
            className="absolute top-1/2 left-1 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-brand-border bg-white/95 text-brand-muted shadow-sm transition-colors hover:text-citius-blue"
            onClick={() => scrollBy("left")}
            type="button"
          >
            <ChevronLeft aria-hidden size={16} />
          </button>
        </>
      ) : null}
      {scrollHints && scrollState.overflow && scrollState.canScrollRight ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-white to-transparent"
          />
          <button
            aria-label="Scroll table right"
            className="absolute top-1/2 right-1 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-brand-border bg-white/95 text-brand-muted shadow-sm transition-colors hover:text-citius-blue"
            onClick={() => scrollBy("right")}
            type="button"
          >
            <ChevronRight aria-hidden size={16} />
          </button>
        </>
      ) : null}
      <div
        className="overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-sm"
        ref={scrollRef}
      >
        {children}
      </div>
    </div>
  );
}

function EmptyState({
  isLoadingMore,
  label,
  onClear,
  onLoadMore,
}: {
  isLoadingMore: boolean;
  label: string;
  onClear?: () => void;
  onLoadMore?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-border border-dashed bg-white px-6 py-12 text-center text-brand-muted text-sm">
      <p>{label}</p>
      {onClear || onLoadMore ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <LoadMoreButton isLoadingMore={isLoadingMore} onLoadMore={onLoadMore} />
          {onClear ? (
            <button className="portal-small-btn bg-white" onClick={onClear} type="button">
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TablePaginationFooter({
  canLoadMore,
  currentPage,
  isLoadingMore,
  loadedCount,
  onLoadMore,
  onPageChange,
  pageEnd,
  pageStart,
  totalPages,
}: {
  canLoadMore: boolean;
  currentPage: number;
  isLoadingMore: boolean;
  loadedCount: number;
  onLoadMore?: () => void;
  onPageChange: (page: number) => void;
  pageEnd: number;
  pageStart: number;
  totalPages: number;
}) {
  const showPagination = totalPages > 1;
  const showLoadMore = canLoadMore || isLoadingMore;
  if (!(showPagination || showLoadMore)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <span aria-live="polite" className="text-brand-muted text-xs" role="status">
        {showPagination
          ? `Showing ${pageStart}–${pageEnd} of ${loadedCount} loaded`
          : `${loadedCount} record${loadedCount === 1 ? "" : "s"} loaded`}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {showPagination ? (
          <>
            <button
              aria-label="Previous page"
              className="portal-small-btn bg-white disabled:opacity-50"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              type="button"
            >
              <ChevronLeft aria-hidden size={14} />
              Previous
            </button>
            <span className="px-1 text-brand-muted text-xs tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <button
              aria-label="Next page"
              className="portal-small-btn bg-white disabled:opacity-50"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              type="button"
            >
              Next
              <ChevronRight aria-hidden size={14} />
            </button>
          </>
        ) : null}
        {showLoadMore && currentPage >= totalPages ? (
          <LoadMoreButton isLoadingMore={isLoadingMore} onLoadMore={onLoadMore} />
        ) : null}
      </div>
    </div>
  );
}

function LoadingPanel({ columnCount = 4 }: { columnCount?: number }) {
  return (
    <div className="space-y-3">
      <SkeletonMobileCards />
      <div className="hidden md:block">
        <SkeletonTable columnCount={columnCount} />
      </div>
    </div>
  );
}

function BulkActionBar({
  selectedCount,
  entityLabel,
  onDeleteSelected,
  onClear,
}: {
  entityLabel: string;
  onClear: () => void;
  onDeleteSelected: () => boolean | Promise<boolean | undefined> | undefined;
  selectedCount: number;
}) {
  const [holdKey, setHoldKey] = useState(0);

  if (selectedCount === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-citius-blue/15 bg-citius-blue/[0.04] px-4 py-3">
      <span
        aria-atomic="true"
        aria-live="polite"
        className="font-medium text-citius-blue text-sm"
        role="status"
      >
        {selectedCount} {entityLabel}
        {selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <button className="portal-small-btn" onClick={onClear} type="button">
          Clear
        </button>
        <HoldToDeleteButton
          className="min-h-8 px-3.5 text-xs"
          data-testid="portal-bulk-delete-hold"
          key={holdKey}
          onConfirm={() => {
            void Promise.resolve(onDeleteSelected()).then((ok) => {
              if (ok === false) {
                setHoldKey((current) => current + 1);
              }
            });
          }}
        >
          <Trash2 size={13} />
          Hold to delete selected
        </HoldToDeleteButton>
      </div>
    </div>
  );
}

export function SelectableDataTable<Row extends PortalDataRow>({
  rows,
  columns,
  empty,
  compact = false,
  mobileCardRender,
  selectable = false,
  entityLabel = "record",
  onBulkDelete,
  rowLabel,
  filtersActive = false,
  mobileCardIncludesActions = false,
  tableClassName = "",
  rowAttention,
  rowTone,
  canLoadMore = false,
  isLoadingMore = false,
  onLoadMore,
  scrollHints = true,
}: SelectableDataTableProps<Row>) {
  const { clearAllFilters } = usePortalFilterActions();
  const [sort, setSort] = useState<PortalSortState | null>(null);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<string>>(() => new Set());
  const [requestedPage, setCurrentPage] = useState(1);
  const previousRowIdsRef = useRef<string[] | null>(null);
  const gridColumns = preparePortalColumns(columns);
  const visibleGridColumns = visiblePortalColumns(gridColumns, hiddenColumnIds);
  const reconciledSort = reconcilePortalSort(sort, visibleGridColumns);
  const sortedRows = sortPortalRows(rows || [], gridColumns, reconciledSort);
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, sortedRows.length);
  const pageRows = sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageRowIds = pageRows.map((row) => String(row.id));
  const bulk = useBulkSelection(selectable ? [...(rows || [])] : [], {
    pageRowIds: selectable ? pageRowIds : undefined,
  });

  const rowIds = (rows || []).map((row) => String(row.id));
  const rowIdentity = rowIds.join("\0");

  useEffect(() => {
    const currentRowIds = rowIdentity ? rowIdentity.split("\0") : [];
    const previousRowIds = previousRowIdsRef.current;
    if (shouldResetLoadedPage(previousRowIds, currentRowIds)) {
      setCurrentPage(1);
    }
    previousRowIdsRef.current = currentRowIds;
  }, [rowIdentity]);
  const visibleResponsiveColumns = [...visibleGridColumns]
    .filter((column) => column.mobile !== "hidden")
    .sort((left, right) => (left.priority ?? 50) - (right.priority ?? 50));
  const hideableColumns = gridColumns.filter((column) => column.hideable);
  const emptyLabel =
    filtersActive && rows?.length === 0 ? "No matches — adjust or clear filters." : empty;

  const selectionLabel = (row: Row) => {
    if (typeof rowLabel === "function") {
      return rowLabel(row);
    }
    return String(row.fullName || row.queryCode || row.jobCode || row.invoiceNumber || row.id);
  };

  const handleRowSelection = (event: ChangeEvent<HTMLInputElement>) =>
    bulk.toggleOne(event.currentTarget.dataset.rowId ?? "");

  const setSelectAllIndeterminate = (input: HTMLInputElement | null) => {
    if (input) {
      input.indeterminate = bulk.someVisibleSelected && !bulk.allVisibleSelected;
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || bulk.selectedCount === 0) {
      return false;
    }
    const ids = [...bulk.selectedIds];
    const ok = await onBulkDelete(ids);
    if (ok) {
      bulk.clearSelection();
    }
    return ok;
  };

  const handleSortColumn = (columnId: string) => {
    setCurrentPage(1);
    setSort((current) => nextSortState(current, columnId));
  };

  const handleToggleColumn = (columnId: string) => {
    if (sort?.columnId === columnId) {
      setSort(null);
    }
    setHiddenColumnIds((current) => {
      const next = new Set(current);
      if (next.has(columnId)) {
        next.delete(columnId);
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const responsiveRowAttention = (row: Row) => {
    const attention = rowAttention?.(row);
    if (attention) {
      return attention;
    }
    const tone = rowTone?.(row);
    return tone ? { label: `Attention: ${tone}`, tone } : undefined;
  };

  const renderSelectionControl = (row: Row) => (
    <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
      <input
        aria-label={`Select ${selectionLabel(row)}`}
        checked={bulk.selectedIds.has(String(row.id))}
        className="size-5 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
        data-row-id={String(row.id)}
        onChange={handleRowSelection}
        type="checkbox"
      />
    </label>
  );

  if (!rows) {
    return <LoadingPanel columnCount={Math.min(Math.max(columns.length, 4), 8)} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        isLoadingMore={isLoadingMore}
        label={emptyLabel}
        onClear={filtersActive ? clearAllFilters : undefined}
        onLoadMore={canLoadMore ? onLoadMore : undefined}
      />
    );
  }

  const selectionControl = selectable ? renderSelectionControl : undefined;

  return (
    <div className="space-y-3">
      {selectable ? (
        <BulkActionBar
          entityLabel={entityLabel}
          onClear={bulk.clearSelection}
          onDeleteSelected={handleBulkDelete}
          selectedCount={bulk.selectedCount}
        />
      ) : null}
      <ResponsiveDataCards
        appendColumnActions={!mobileCardIncludesActions}
        columns={visibleResponsiveColumns}
        mobileCardRender={mobileCardRender}
        rowAttention={responsiveRowAttention}
        rows={pageRows}
        selectionControl={selectionControl}
      />
      {hideableColumns.length > 0 ? (
        <div className="relative hidden justify-end md:flex">
          <details className="group relative">
            <summary className="portal-small-btn cursor-pointer list-none bg-white [&::-webkit-details-marker]:hidden">
              <Columns3 aria-hidden size={14} />
              Columns
            </summary>
            <div className="absolute top-full right-0 z-30 mt-2 min-w-52 rounded-xl border border-brand-border bg-white p-2 shadow-xl">
              <p className="px-2 py-1 font-semibold text-brand-muted text-xs uppercase tracking-[0.08em]">
                Optional columns
              </p>
              {hideableColumns.map((column) => (
                <ColumnVisibilityToggle
                  column={column}
                  hidden={hiddenColumnIds.has(column.id)}
                  key={column.id}
                  onToggle={handleToggleColumn}
                />
              ))}
            </div>
          </details>
        </div>
      ) : null}
      <TableHorizontalScrollContainer
        contentKey={`${pageRows.length}:${visibleGridColumns.length}`}
        scrollHints={scrollHints}
      >
        <table className={`min-w-full border-collapse ${tableClassName}`}>
          <thead className="bg-brand-light/80">
            <tr>
              {selectable ? (
                <th className="w-10 border-brand-border border-b px-4 py-3 text-left">
                  <label className="flex size-11 cursor-pointer items-center justify-center">
                    <input
                      aria-label="Select all visible rows"
                      checked={bulk.allVisibleSelected}
                      className="size-5 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                      onChange={bulk.toggleAllVisible}
                      ref={setSelectAllIndeterminate}
                      type="checkbox"
                    />
                  </label>
                </th>
              ) : null}
              {visibleGridColumns.map((column) => (
                <GridHeaderCell
                  column={column}
                  key={column.id}
                  onSort={handleSortColumn}
                  sort={reconciledSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const attention = rowAttention?.(row);
              const tone = attention?.tone ?? rowTone?.(row);
              const toneClass = tone ? ROW_TONE_CLASSES[tone] : "";
              return (
                <tr
                  aria-label={attention?.label}
                  className={`group transition-colors hover:bg-citius-blue/[0.04] ${toneClass}`}
                  data-attention={tone || undefined}
                  key={row.id}
                >
                  {selectable ? (
                    <td className="border-brand-border border-b px-4 py-3 last:border-b-0">
                      <label className="flex size-11 cursor-pointer items-center justify-center">
                        <input
                          aria-label={`Select ${selectionLabel(row)}`}
                          checked={bulk.selectedIds.has(String(row.id))}
                          className="size-5 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                          data-row-id={String(row.id)}
                          onChange={handleRowSelection}
                          type="checkbox"
                        />
                      </label>
                    </td>
                  ) : null}
                  {visibleGridColumns.map((column) => (
                    <td
                      className={`border-brand-border border-b px-4 ${compact ? "py-2" : "py-3"} text-brand-dark text-sm last:border-b-0 ${column.align === "right" ? "text-right tabular-nums" : "text-left"} ${desktopPinnedColumnClass(column.kind, "cell", column.sticky)} ${column.cellClassName || ""}`}
                      key={column.id}
                      style={column.width ? { minWidth: column.width } : undefined}
                    >
                      {column.render(row) ?? (column.label ? "-" : null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableHorizontalScrollContainer>
      <TablePaginationFooter
        canLoadMore={canLoadMore}
        currentPage={currentPage}
        isLoadingMore={isLoadingMore}
        loadedCount={rows.length}
        onLoadMore={canLoadMore ? onLoadMore : undefined}
        onPageChange={setCurrentPage}
        pageEnd={pageEnd}
        pageStart={pageStart}
        totalPages={totalPages}
      />
    </div>
  );
}
