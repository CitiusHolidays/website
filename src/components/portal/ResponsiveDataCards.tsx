"use client";

import type { Key, ReactNode } from "react";
import type { PortalGridAttention, PortalGridColumn } from "@/lib/portal/portalDataGrid";

interface PortalDataRow {
  id: Key;
}

interface RenderedEntry {
  id: string;
  label: string;
  value: ReactNode;
}

interface MobileActionAreaProps {
  entries: RenderedEntry[];
}

interface GenericMobileCardProps<Row extends PortalDataRow> {
  columns: readonly PortalGridColumn<Row>[];
  row: Row;
}

interface ResponsiveDataCardsProps<Row extends PortalDataRow> {
  appendColumnActions?: boolean;
  columns: readonly PortalGridColumn<Row>[];
  mobileCardRender?: (row: Row) => ReactNode;
  rowAttention?: (row: Row) => PortalGridAttention | undefined;
  rows: readonly Row[];
  selectionControl?: (row: Row) => ReactNode;
}

function isActionColumn<Row>(column: PortalGridColumn<Row>): boolean {
  return column.mobile === "action" || column.kind === "action";
}

function renderedEntries<Row extends PortalDataRow>(
  row: Row,
  columns: readonly PortalGridColumn<Row>[]
): RenderedEntry[] {
  const entries: RenderedEntry[] = [];
  for (const column of columns) {
    const value = column.render(row);
    if (value !== null && value !== undefined && value !== false) {
      entries.push({ id: column.id, label: column.mobileLabel || column.label, value });
    }
  }
  return entries;
}

function MobileActionArea({ entries }: MobileActionAreaProps) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <fieldset className="portal-mobile-card-actions mt-4 border-brand-border/70 border-t pt-3">
      <legend className="sr-only">Record actions</legend>
      {entries.map((entry) => (
        <div key={entry.id}>{entry.value}</div>
      ))}
    </fieldset>
  );
}

function GenericMobileCard<Row extends PortalDataRow>({
  columns,
  row,
}: GenericMobileCardProps<Row>) {
  const actions = columns.filter(isActionColumn);
  const data = columns.filter((column) => column.mobile !== "hidden" && !isActionColumn(column));
  const dataEntries = renderedEntries(row, data);
  const lead =
    dataEntries.find(
      (entry) => data.find((column) => column.id === entry.id)?.mobile === "primary"
    ) ?? dataEntries[0];
  const status = dataEntries.find(
    (entry) => data.find((column) => column.id === entry.id)?.mobile === "status"
  );
  const details = dataEntries.filter((entry) => entry.id !== lead?.id && entry.id !== status?.id);
  const actionEntries = renderedEntries(row, actions);

  return (
    <article>
      <div className="flex items-start justify-between gap-3">
        {lead ? (
          <div className="min-w-0">
            <div className="font-bold text-[length:var(--portal-label-size)] text-citius-blue uppercase tracking-[0.12em]">
              {lead.label}
            </div>
            <div className="mt-1 break-words font-heading font-semibold text-base text-brand-dark">
              {lead.value}
            </div>
          </div>
        ) : null}
        {status ? <div className="shrink-0">{status.value}</div> : null}
      </div>
      {details.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-brand-border/70 border-t pt-3">
          {details.map((entry) => (
            <div className="min-w-0" key={entry.id}>
              <div className="font-medium text-[length:var(--portal-meta-size)] text-brand-muted">
                {entry.label}
              </div>
              <div className="mt-0.5 break-words text-brand-dark text-sm">{entry.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      <MobileActionArea entries={actionEntries} />
    </article>
  );
}

export function ResponsiveDataCards<Row extends PortalDataRow>({
  appendColumnActions = true,
  columns,
  mobileCardRender,
  rowAttention,
  rows,
  selectionControl,
}: ResponsiveDataCardsProps<Row>) {
  const actions = columns.filter(isActionColumn);

  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => {
        const appendedActions =
          mobileCardRender && appendColumnActions ? renderedEntries(row, actions) : [];
        const attention = rowAttention?.(row);
        return (
          <div
            className="rounded-2xl border border-brand-border bg-white p-4 shadow-brand-dark/5 shadow-sm"
            data-attention={attention?.tone}
            key={row.id}
          >
            {attention ? <span className="sr-only">{attention.label}</span> : null}
            <div className={selectionControl ? "flex items-start gap-3" : ""}>
              {selectionControl?.(row)}
              <div className="min-w-0 flex-1">
                {mobileCardRender ? (
                  <>
                    {mobileCardRender(row)}
                    <MobileActionArea entries={appendedActions} />
                  </>
                ) : (
                  <GenericMobileCard columns={columns} row={row} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
