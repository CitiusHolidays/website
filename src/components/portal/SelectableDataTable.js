"use client";

import { Trash2 } from "lucide-react";
import { useCallback } from "react";
import {
  desktopActionColumnClass,
  ResponsiveDataCards,
} from "@/components/portal/ResponsiveDataCards";
import { useBulkSelection } from "@/lib/portal/bulkSelection";

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-brand-border border-dashed bg-white px-6 py-12 text-center text-brand-muted text-sm">
      {label}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="rounded-2xl border border-brand-border bg-white px-6 py-12 text-center text-brand-muted text-sm">
      Loading…
    </div>
  );
}

function BulkActionBar({ selectedCount, entityLabel, onDeleteSelected, onClear }) {
  if (selectedCount === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-citius-blue/15 bg-citius-blue/[0.04] px-4 py-3">
      <span className="font-medium text-citius-blue text-sm">
        {selectedCount} {entityLabel}
        {selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <button className="portal-small-btn" onClick={onClear} type="button">
          Clear
        </button>
        <button className="portal-danger-btn" onClick={onDeleteSelected} type="button">
          <Trash2 size={13} />
          Delete selected
        </button>
      </div>
    </div>
  );
}

export function SelectableDataTable({
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
}) {
  const bulk = useBulkSelection(selectable ? rows : []);
  const emptyLabel =
    filtersActive && rows?.length === 0 ? "No matches — adjust or clear filters." : empty;

  const selectionLabel = (row) => {
    if (typeof rowLabel === "function") {
      return rowLabel(row);
    }
    return row.fullName || row.queryCode || row.jobCode || row.invoiceNumber || row.id;
  };

  const handleRowSelection = useCallback(
    (event) => bulk.toggleOne(event.currentTarget.dataset.rowId),
    [bulk]
  );
  const stopSelectionPropagation = useCallback((event) => event.stopPropagation(), []);
  const setSelectAllIndeterminate = useCallback(
    (input) => {
      if (input) {
        input.indeterminate = bulk.someVisibleSelected && !bulk.allVisibleSelected;
      }
    },
    [bulk.allVisibleSelected, bulk.someVisibleSelected]
  );

  const selectionColumn = selectable
    ? [
        [
          "",
          (row) => (
            <input
              aria-label={`Select ${selectionLabel(row)}`}
              checked={bulk.selectedIds.has(row.id)}
              className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
              data-row-id={row.id}
              onChange={handleRowSelection}
              onClick={stopSelectionPropagation}
              type="checkbox"
            />
          ),
        ],
      ]
    : [];

  const tableColumns = [...selectionColumn, ...columns];

  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || bulk.selectedCount === 0) {
      return;
    }
    const ids = [...bulk.selectedIds];
    const ok = await onBulkDelete(ids);
    if (ok) {
      bulk.clearSelection();
    }
  }, [bulk, onBulkDelete]);

  if (!rows) {
    return <LoadingPanel />;
  }
  if (rows.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  const selectionControl = selectable
    ? (row) => (
        <input
          aria-label={`Select ${selectionLabel(row)}`}
          checked={bulk.selectedIds.has(row.id)}
          className="mt-1 size-5 shrink-0 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
          data-row-id={row.id}
          onChange={handleRowSelection}
          type="checkbox"
        />
      )
    : undefined;

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
        columns={columns}
        mobileCardRender={mobileCardRender}
        rows={rows}
        selectionControl={selectionControl}
      />
      <div className="hidden overflow-x-auto rounded-2xl border border-brand-border bg-white shadow-sm md:block">
        <table className={`min-w-full border-collapse ${tableClassName}`}>
          <thead className="bg-brand-light/80">
            <tr>
              {selectable ? (
                <th className="w-10 border-brand-border border-b px-4 py-3 text-left">
                  <input
                    aria-label="Select all visible rows"
                    checked={bulk.allVisibleSelected}
                    className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                    onChange={bulk.toggleAllVisible}
                    ref={setSelectAllIndeterminate}
                    type="checkbox"
                  />
                </th>
              ) : null}
              {columns.map(([label, , options]) => (
                <th
                  className={`border-brand-border border-b px-4 py-3 text-left font-semibold text-citius-blue/80 text-xs ${desktopActionColumnClass(options?.kind, "header")} ${options?.headerClassName || ""}`}
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="group transition-colors hover:bg-citius-blue/[0.03]" key={row.id}>
                {tableColumns.map(([label, render, options], columnIndex) => (
                  <td
                    className={`border-brand-border border-b px-4 ${compact ? "py-2" : "py-3"} text-brand-dark text-sm last:border-b-0 ${desktopActionColumnClass(options?.kind, "cell")} ${options?.cellClassName || ""}`}
                    key={label || `select-${columnIndex}`}
                  >
                    {render(row) || (label ? "-" : null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
