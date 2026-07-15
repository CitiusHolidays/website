import type { ReactNode } from "react";

export type PortalGridColumnKind = "action" | "data" | "identity" | "status";
export type PortalGridAlignment = "left" | "right";
export type PortalGridMobilePresentation = "action" | "hidden" | "primary" | "secondary" | "status";
export type PortalGridSticky = "left" | "none" | "right";
export type PortalSortDirection = "asc" | "desc";
export type PortalSortValue = boolean | number | string | null | undefined;

export interface PortalGridAttention {
  label: string;
  tone?: "danger" | "info" | "warning";
}

export interface PortalGridColumn<Row> {
  align?: PortalGridAlignment;
  cellClassName?: string;
  headerClassName?: string;
  hideable?: boolean;
  id: string;
  kind?: PortalGridColumnKind;
  label: string;
  mobile?: PortalGridMobilePresentation;
  mobileLabel?: string;
  priority?: number;
  render: (row: Row) => ReactNode;
  semanticValue?: (row: Row) => PortalSortValue;
  sortValue?: (row: Row) => PortalSortValue;
  sticky?: PortalGridSticky;
  width?: number;
}

export interface PortalSortState {
  columnId: string;
  direction: PortalSortDirection;
}

function defaultMobilePresentation(kind: PortalGridColumnKind): PortalGridMobilePresentation {
  if (kind === "identity") {
    return "primary";
  }
  if (kind === "status") {
    return "status";
  }
  if (kind === "action") {
    return "action";
  }
  return "secondary";
}

function defaultPriority(kind: PortalGridColumnKind): number {
  if (kind === "identity") {
    return 0;
  }
  if (kind === "status") {
    return 10;
  }
  if (kind === "data") {
    return 50;
  }
  return 100;
}

function defaultSticky(kind: PortalGridColumnKind): PortalGridSticky {
  if (kind === "identity") {
    return "left";
  }
  if (kind === "action") {
    return "right";
  }
  return "none";
}

export function preparePortalColumns<Row>(
  columns: readonly PortalGridColumn<Row>[]
): PortalGridColumn<Row>[] {
  const usedIds = new Set<string>();
  return columns.map((column) => {
    const id = column.id.trim();
    if (!id) {
      throw new Error("Portal grid column ids must not be empty");
    }
    if (usedIds.has(id)) {
      throw new Error(`Duplicate portal grid column id: ${id}`);
    }
    usedIds.add(id);
    const kind = column.kind ?? "data";
    const mobile = column.mobile ?? defaultMobilePresentation(kind);
    if ((kind === "identity" || kind === "action") && (column.hideable || mobile === "hidden")) {
      throw new Error(`Critical portal grid column cannot be hidden: ${id}`);
    }
    return {
      ...column,
      id,
      kind,
      mobile,
      priority: column.priority ?? defaultPriority(kind),
      sticky: column.sticky ?? defaultSticky(kind),
    } as PortalGridColumn<Row>;
  });
}

export function nextSortState(
  current: PortalSortState | null,
  columnId: string
): PortalSortState | null {
  if (current?.columnId !== columnId) {
    return { columnId, direction: "asc" };
  }
  if (current.direction === "asc") {
    return { columnId, direction: "desc" };
  }
  return null;
}

function isEmptySortValue(value: PortalSortValue): boolean {
  return (
    value === null || value === undefined || (typeof value === "string" && value.trim() === "")
  );
}

function compareSortValues(
  left: PortalSortValue,
  right: PortalSortValue,
  direction: PortalSortDirection
): number {
  if (left === right) {
    return 0;
  }
  if (isEmptySortValue(left)) {
    return 1;
  }
  if (isEmptySortValue(right)) {
    return -1;
  }
  const directionMultiplier = direction === "asc" ? 1 : -1;
  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * directionMultiplier;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return (Number(left) - Number(right)) * directionMultiplier;
  }
  return (
    String(left).localeCompare(String(right), "en-IN", {
      numeric: true,
      sensitivity: "base",
    }) * directionMultiplier
  );
}

export function sortPortalRows<Row>(
  rows: readonly Row[],
  columns: readonly PortalGridColumn<Row>[],
  sort: PortalSortState | null
): Row[] {
  if (!sort) {
    return [...rows];
  }
  const column = columns.find((candidate) => candidate.id === sort.columnId);
  const getSortValue = column?.sortValue ?? column?.semanticValue;
  if (!getSortValue) {
    return [...rows];
  }
  return rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const compared = compareSortValues(
        getSortValue(left.row),
        getSortValue(right.row),
        sort.direction
      );
      return compared === 0 ? left.index - right.index : compared;
    })
    .map(({ row }) => row);
}

export function reconcilePortalSort<Row>(
  sort: PortalSortState | null,
  visibleColumns: readonly PortalGridColumn<Row>[]
): PortalSortState | null {
  if (!sort) {
    return null;
  }
  const column = visibleColumns.find((candidate) => candidate.id === sort.columnId);
  return column && (column.sortValue || column.semanticValue) ? sort : null;
}

export function visiblePortalColumns<Row>(
  columns: readonly PortalGridColumn<Row>[],
  hiddenColumnIds: ReadonlySet<string>
): PortalGridColumn<Row>[] {
  return columns.filter((column) => !(column.hideable && hiddenColumnIds.has(column.id)));
}

export function desktopActionColumnClass(
  kind: PortalGridColumnKind | undefined,
  surface: "cell" | "header"
): string {
  if (kind !== "action") {
    return "";
  }
  return surface === "header"
    ? "sticky right-0 z-20 min-w-48 bg-brand-light shadow-[-12px_0_16px_-16px_rgba(16,42,131,0.35)]"
    : "sticky right-0 z-10 min-w-48 bg-white shadow-[-12px_0_16px_-16px_rgba(16,42,131,0.35)] group-hover:bg-[#fbfcff] group-data-[attention=warning]:bg-amber-50/90 group-data-[attention=danger]:bg-red-50/90 group-data-[attention=info]:bg-blue-50/70";
}

export function desktopPinnedColumnClass(
  kind: PortalGridColumnKind | undefined,
  surface: "cell" | "header",
  sticky?: PortalGridSticky
): string {
  let resolvedSticky = sticky ?? "none";
  if (!sticky && kind === "action") {
    resolvedSticky = "right";
  }
  if (!sticky && kind === "identity") {
    resolvedSticky = "left";
  }
  if (resolvedSticky === "right") {
    return desktopActionColumnClass("action", surface);
  }
  if (resolvedSticky !== "left") {
    return "";
  }
  return surface === "header"
    ? "sticky left-0 z-20 min-w-32 bg-brand-light shadow-[12px_0_16px_-16px_rgba(16,42,131,0.35)]"
    : "sticky left-0 z-10 min-w-32 bg-white shadow-[12px_0_16px_-16px_rgba(16,42,131,0.35)] group-hover:bg-[#fbfcff] group-data-[attention=warning]:bg-amber-50/90 group-data-[attention=danger]:bg-red-50/90 group-data-[attention=info]:bg-blue-50/70";
}
