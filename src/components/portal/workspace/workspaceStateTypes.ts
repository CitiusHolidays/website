export type AnyRecord = Record<string, any>;
export type ListFiltersState = Record<string, any>;
export type StateUpdate<T> = T | ((current: T) => T);

interface WorkspaceListRow extends Record<string, unknown> {
  createdAt?: number | string;
  id?: string;
  jobCardId?: string;
  updatedAt?: number | string;
}

export interface WorkspaceJobCardRow extends WorkspaceListRow {
  clientName?: string;
  destination?: string;
  jobCode?: string;
  queryType?: string;
  status?: string;
}

export interface WorkspaceProposalRow extends WorkspaceListRow {
  clientName?: string;
  preparedBy?: string;
  proposalCode?: string;
  queryCode?: string;
  status?: string;
}

export interface WorkspaceQueryRow extends WorkspaceListRow {
  clientName?: string;
  contractingStatus?: string;
  destination?: string;
  queryCode?: string;
  queryType?: string;
  salesOwnerName?: string;
  salesStatus?: string;
}

export interface DateRangeState {
  from?: null | string;
  to?: null | string;
}

export interface SavedViewRecord {
  filterState: unknown;
  id: string;
  isFavorite?: boolean;
  isPinnedToDashboard?: boolean;
  pathname?: string;
}

export interface SaveCurrentViewOptions {
  isFavorite?: boolean;
  isPinnedToDashboard?: boolean;
  sharedRole?: string;
}

export type MutationLike = (args: AnyRecord) => Promise<unknown>;

export const compactRows = <T>(rows: readonly (T | null | undefined)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null && row !== undefined);

export const resolveUpdate = <T>(value: StateUpdate<T>, current: T): T =>
  typeof value === "function" ? (value as (currentValue: T) => T)(current) : value;
