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
    };
  });
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
