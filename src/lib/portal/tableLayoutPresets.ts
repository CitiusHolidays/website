import { isJsonObject, type JsonObject, type JsonValue } from "@/lib/jsonValue";
import { isRuntimeString } from "@/lib/runtimeValues";
import type { PortalSortDirection, PortalSortState } from "./portalDataGrid";

export const PORTAL_TABLE_LAYOUT_KIND = "portal-table-layout-v1";

const MAX_COLUMN_COUNT = 40;
const MAX_COLUMN_ID_LENGTH = 64;
const MAX_SCOPE_LENGTH = 80;
const COLUMN_ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const SCOPE_RE = /^[a-z0-9][a-z0-9:_-]*$/i;

export interface PortalTableLayoutSort extends JsonObject {
  columnId: string;
  direction: PortalSortDirection;
}

export interface PortalTableLayoutState extends JsonObject {
  columns: string[];
  kind: typeof PORTAL_TABLE_LAYOUT_KIND;
  scope: string;
  sort: PortalTableLayoutSort | null;
}

export interface PortalTableLayoutPresetRecord {
  filterState: JsonValue;
  id: string;
  name: string;
  sharedRole?: null | string;
}

export interface PortalSavedViewPartition<T> {
  layoutPresets: T[];
  savedViews: T[];
}

function normalizeColumnId(value: JsonValue): null | string {
  if (!isRuntimeString(value)) {
    return null;
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_COLUMN_ID_LENGTH ||
    !COLUMN_ID_RE.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeDirection(value: JsonValue): PortalSortDirection | null {
  return value === "asc" || value === "desc" ? value : null;
}

export function normalizePortalTableLayoutScope(value: JsonValue): null | string {
  if (!isRuntimeString(value)) {
    return null;
  }
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_SCOPE_LENGTH ||
    !SCOPE_RE.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeSort(
  value: JsonValue
): { sort: PortalTableLayoutSort | null; valid: true } | { valid: false } {
  if (value === null) {
    return { sort: null, valid: true };
  }
  if (!isJsonObject(value)) {
    return { valid: false };
  }
  const columnId = normalizeColumnId(value.columnId);
  const direction = normalizeDirection(value.direction);
  return columnId && direction ? { sort: { columnId, direction }, valid: true } : { valid: false };
}

function normalizeColumns(value: JsonValue): null | string[] {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const candidate of value) {
    const columnId = normalizeColumnId(candidate);
    if (!columnId || seen.has(columnId)) {
      continue;
    }
    seen.add(columnId);
    columns.push(columnId);
    if (columns.length === MAX_COLUMN_COUNT) {
      break;
    }
  }
  return columns;
}

export function normalizePortalTableLayoutState(value: JsonValue): PortalTableLayoutState | null {
  if (!isJsonObject(value) || value.kind !== PORTAL_TABLE_LAYOUT_KIND) {
    return null;
  }
  const candidate: JsonObject = value;
  const columns = normalizeColumns(candidate.columns);
  const scope = normalizePortalTableLayoutScope(candidate.scope);
  const sortResult = normalizeSort(candidate.sort);
  if (!(columns && scope && sortResult.valid)) {
    return null;
  }
  return {
    columns,
    kind: PORTAL_TABLE_LAYOUT_KIND,
    scope,
    sort: sortResult.sort,
  };
}

export function createPortalTableLayoutState({
  columns,
  scope,
  sort,
}: {
  columns: readonly string[];
  scope: string;
  sort: PortalSortState | null;
}): PortalTableLayoutState {
  const normalizedColumns = normalizeColumns([...columns]);
  const normalizedScope = normalizePortalTableLayoutScope(scope);
  const columnId = normalizeColumnId(sort?.columnId);
  const direction = normalizeDirection(sort?.direction);
  if (!(normalizedColumns && normalizedScope)) {
    throw new Error("Portal table layouts require a valid stable table scope");
  }
  return {
    columns: normalizedColumns,
    kind: PORTAL_TABLE_LAYOUT_KIND,
    scope: normalizedScope,
    sort: columnId && direction ? { columnId, direction } : null,
  };
}

export function isPortalTableLayoutPreset(
  savedView: Pick<PortalTableLayoutPresetRecord, "filterState">
): boolean {
  return (
    isJsonObject(savedView.filterState) && savedView.filterState.kind === PORTAL_TABLE_LAYOUT_KIND
  );
}

export function splitPortalSavedViews<T extends Pick<PortalTableLayoutPresetRecord, "filterState">>(
  savedViews: readonly T[] | null | undefined
): PortalSavedViewPartition<T> {
  const layoutPresets: T[] = [];
  const filterSavedViews: T[] = [];
  for (const savedView of savedViews ?? []) {
    if (isPortalTableLayoutPreset(savedView)) {
      layoutPresets.push(savedView);
    } else {
      filterSavedViews.push(savedView);
    }
  }
  return { layoutPresets, savedViews: filterSavedViews };
}

export function portalTableLayoutsEqual(
  left: Pick<PortalTableLayoutState, "columns" | "scope" | "sort">,
  right: Pick<PortalTableLayoutState, "columns" | "scope" | "sort">
): boolean {
  if (left.scope !== right.scope) {
    return false;
  }
  if (left.columns.length !== right.columns.length) {
    return false;
  }
  const leftColumns = new Set(left.columns);
  if (!right.columns.every((columnId) => leftColumns.has(columnId))) {
    return false;
  }
  return (
    left.sort?.columnId === right.sort?.columnId && left.sort?.direction === right.sort?.direction
  );
}
