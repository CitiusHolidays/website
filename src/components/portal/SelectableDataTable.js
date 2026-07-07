"use client";

import { Trash2 } from "lucide-react";
import { m } from "motion/react";
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-brand-border border-b bg-citius-blue/[0.04] px-4 py-3">
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
}) {
  const bulk = useBulkSelection(selectable ? rows : []);
  const emptyLabel =
    filtersActive && rows?.length === 0 ? "No matches — adjust or clear filters." : empty;

  if (!rows) {
    return <LoadingPanel />;
  }
  if (rows.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }

  const selectionLabel = (row) => {
    if (typeof rowLabel === "function") {
      return rowLabel(row);
    }
    return row.fullName || row.queryCode || row.jobCode || row.invoiceNumber || row.id;
  };

  const selectionColumn = selectable
    ? [
        [
          "",
          (row) => (
            <input
              aria-label={`Select ${selectionLabel(row)}`}
              checked={bulk.selectedIds.has(row.id)}
              className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
              onChange={() => bulk.toggleOne(row.id)}
              onClick={(event) => event.stopPropagation()}
              type="checkbox"
            />
          ),
        ],
      ]
    : [];

  const tableColumns = [...selectionColumn, ...columns];

  const handleBulkDelete = async () => {
    if (!onBulkDelete || bulk.selectedCount === 0) {
      return;
    }
    const ids = [...bulk.selectedIds];
    const ok = await onBulkDelete(ids);
    if (ok) {
      bulk.clearSelection();
    }
  };

  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.35 }}
    >
      {selectable && (
        <BulkActionBar
          entityLabel={entityLabel}
          onClear={bulk.clearSelection}
          onDeleteSelected={handleBulkDelete}
          selectedCount={bulk.selectedCount}
        />
      )}
      {mobileCardRender && (
        <div className="divide-y divide-brand-border md:hidden">
          {rows.map((row, rowIndex) => (
            <m.div
              animate={{ opacity: 1 }}
              className="flex gap-3 p-4"
              initial={{ opacity: 0 }}
              key={row.id}
              transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
            >
              {selectable && (
                <input
                  aria-label={`Select ${selectionLabel(row)}`}
                  checked={bulk.selectedIds.has(row.id)}
                  className="mt-1 size-4 shrink-0 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                  onChange={() => bulk.toggleOne(row.id)}
                  type="checkbox"
                />
              )}
              <div className="min-w-0 flex-1">{mobileCardRender(row)}</div>
            </m.div>
          ))}
        </div>
      )}
      <div className={`overflow-x-auto ${mobileCardRender ? "hidden md:block" : ""}`}>
        <table className="min-w-full border-collapse">
          <thead className="bg-brand-light/80">
            <tr>
              {selectable && (
                <th className="w-10 border-brand-border border-b px-4 py-3 text-left">
                  <input
                    aria-label="Select all visible rows"
                    checked={bulk.allVisibleSelected}
                    className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                    onChange={bulk.toggleAllVisible}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = bulk.someVisibleSelected && !bulk.allVisibleSelected;
                      }
                    }}
                    type="checkbox"
                  />
                </th>
              )}
              {columns.map(([label]) => (
                <th
                  className="border-brand-border border-b px-4 py-3 text-left font-semibold text-citius-blue/80 text-xs"
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <m.tr
                animate={{ opacity: 1 }}
                className="transition-colors hover:bg-citius-blue/[0.03]"
                initial={{ opacity: 0 }}
                key={row.id}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
              >
                {tableColumns.map(([label, render], columnIndex) => (
                  <td
                    className={`border-brand-border border-b px-4 ${compact ? "py-2" : "py-3"} text-brand-dark text-sm last:border-b-0`}
                    key={label || `select-${columnIndex}`}
                  >
                    {render(row) || (label ? "-" : null)}
                  </td>
                ))}
              </m.tr>
            ))}
          </tbody>
        </table>
      </div>
    </m.div>
  );
}
