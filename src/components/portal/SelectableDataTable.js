"use client";

import { m } from "motion/react";
import { Trash2 } from "lucide-react";
import { useBulkSelection } from "@/lib/portal/bulkSelection";

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-border bg-white px-6 py-12 text-center text-sm text-brand-muted">
      {label}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="rounded-2xl border border-brand-border bg-white px-6 py-12 text-center text-sm text-brand-muted">
      Loading…
    </div>
  );
}

function BulkActionBar({ selectedCount, entityLabel, onDeleteSelected, onClear }) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-citius-blue/[0.04] px-4 py-3">
      <span className="text-sm font-medium text-citius-blue">
        {selectedCount} {entityLabel}
        {selectedCount === 1 ? "" : "s"} selected
      </span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="portal-small-btn" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="portal-danger-btn" onClick={onDeleteSelected}>
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

  if (!rows) return <LoadingPanel />;
  if (rows.length === 0) return <EmptyState label={emptyLabel} />;

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
              type="checkbox"
              className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
              checked={bulk.selectedIds.has(row.id)}
              onChange={() => bulk.toggleOne(row.id)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select ${selectionLabel(row)}`}
            />
          ),
        ],
      ]
    : [];

  const tableColumns = [...selectionColumn, ...columns];

  const handleBulkDelete = async () => {
    if (!onBulkDelete || bulk.selectedCount === 0) return;
    const ids = [...bulk.selectedIds];
    const ok = await onBulkDelete(ids);
    if (ok) {
      bulk.clearSelection();
    }
  };

  return (
    <m.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm"
    >
      {selectable && (
        <BulkActionBar
          selectedCount={bulk.selectedCount}
          entityLabel={entityLabel}
          onDeleteSelected={handleBulkDelete}
          onClear={bulk.clearSelection}
        />
      )}
      {mobileCardRender && (
        <div className="divide-y divide-brand-border md:hidden">
          {rows.map((row, rowIndex) => (
            <m.div
              key={row.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
              className="flex gap-3 p-4"
            >
              {selectable && (
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                  checked={bulk.selectedIds.has(row.id)}
                  onChange={() => bulk.toggleOne(row.id)}
                  aria-label={`Select ${selectionLabel(row)}`}
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
                <th className="w-10 border-b border-brand-border px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-brand-border text-citius-blue focus:ring-citius-blue/20"
                    checked={bulk.allVisibleSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = bulk.someVisibleSelected && !bulk.allVisibleSelected;
                      }
                    }}
                    onChange={bulk.toggleAllVisible}
                    aria-label="Select all visible rows"
                  />
                </th>
              )}
              {columns.map(([label]) => (
                <th
                  key={label}
                  className="border-b border-brand-border px-4 py-3 text-left text-xs font-semibold text-citius-blue/80"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <m.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
                className="transition-colors hover:bg-citius-blue/[0.03]"
              >
                {tableColumns.map(([label, render], columnIndex) => (
                  <td
                    key={label || `select-${columnIndex}`}
                    className={`border-b border-brand-border px-4 ${compact ? "py-2" : "py-3"} text-sm text-brand-dark last:border-b-0`}
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
