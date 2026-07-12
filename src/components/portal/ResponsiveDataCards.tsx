"use client";

import type { Key, ReactNode } from "react";

export type PortalColumnKind = "action" | "data" | "status";

export interface PortalColumnOptions {
  cellClassName?: string;
  headerClassName?: string;
  kind?: PortalColumnKind;
}

export interface PortalDataRow {
  id: Key;
}

export type PortalColumn<Row extends PortalDataRow = PortalDataRow> = readonly [
  label: string,
  render: (row: Row) => ReactNode,
  options?: PortalColumnOptions,
];

interface RenderedEntry {
  index: number;
  label: string;
  value: ReactNode;
}

interface MobileActionAreaProps {
  entries: RenderedEntry[];
}

interface GenericMobileCardProps<Row extends PortalDataRow> {
  columns: readonly PortalColumn<Row>[];
  row: Row;
}

interface ResponsiveDataCardsProps<Row extends PortalDataRow> {
  appendColumnActions?: boolean;
  columns: readonly PortalColumn<Row>[];
  mobileCardRender?: (row: Row) => ReactNode;
  rows: readonly Row[];
  selectionControl?: (row: Row) => ReactNode;
}

function columnKind<Row extends PortalDataRow>(column: PortalColumn<Row>): PortalColumnKind {
  return column[2]?.kind ?? "data";
}

function isActionColumn<Row extends PortalDataRow>(column: PortalColumn<Row>): boolean {
  return columnKind(column) === "action";
}

function isStatusColumn<Row extends PortalDataRow>(column: PortalColumn<Row>): boolean {
  return columnKind(column) === "status";
}

export function desktopActionColumnClass(
  kind: PortalColumnKind | undefined,
  surface: "cell" | "header"
): string {
  if (kind !== "action") {
    return "";
  }
  return surface === "header"
    ? "sticky right-0 z-20 min-w-48 bg-brand-light shadow-[-12px_0_16px_-16px_rgba(16,42,131,0.35)]"
    : "sticky right-0 z-10 min-w-48 bg-white shadow-[-12px_0_16px_-16px_rgba(16,42,131,0.35)] group-hover:bg-[#fbfcff]";
}

export function splitMobileColumns<Row extends PortalDataRow>(
  columns: readonly PortalColumn<Row>[]
): { actions: PortalColumn<Row>[]; data: PortalColumn<Row>[] } {
  const actions: PortalColumn<Row>[] = [];
  const data: PortalColumn<Row>[] = [];
  for (const column of columns) {
    if (isActionColumn(column)) {
      actions.push(column);
    } else {
      data.push(column);
    }
  }
  return { actions, data };
}

function renderedEntries<Row extends PortalDataRow>(
  row: Row,
  columns: readonly PortalColumn<Row>[]
): RenderedEntry[] {
  return columns
    .map(([label, render], index) => ({
      index,
      label,
      value: render(row),
    }))
    .filter((entry) => entry.value !== null && entry.value !== undefined && entry.value !== false);
}

function MobileActionArea({ entries }: MobileActionAreaProps) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <fieldset className="portal-mobile-card-actions mt-4 border-brand-border/70 border-t pt-3">
      <legend className="sr-only">Record actions</legend>
      {entries.map((entry) => (
        <div key={`${entry.label || "actions"}-${entry.index}`}>{entry.value}</div>
      ))}
    </fieldset>
  );
}

function GenericMobileCard<Row extends PortalDataRow>({
  columns,
  row,
}: GenericMobileCardProps<Row>) {
  const { actions, data } = splitMobileColumns(columns);
  const dataEntries = renderedEntries(row, data);
  const [lead] = dataEntries;
  const statusIndex = data.findIndex(isStatusColumn);
  const status =
    statusIndex >= 0 ? dataEntries.find((entry) => entry.index === statusIndex) : undefined;
  const details = dataEntries.filter((entry) => entry !== lead && entry !== status);
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
            <div className="min-w-0" key={`${entry.label}-${entry.index}`}>
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
  rows,
  selectionControl,
}: ResponsiveDataCardsProps<Row>) {
  const { actions } = splitMobileColumns(columns);

  return (
    <div className="space-y-3 md:hidden">
      {rows.map((row) => {
        const appendedActions =
          mobileCardRender && appendColumnActions ? renderedEntries(row, actions) : [];
        return (
          <div
            className="rounded-2xl border border-brand-border/90 bg-white p-4 shadow-[0_12px_32px_rgba(16,42,131,0.06)]"
            key={row.id}
          >
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
