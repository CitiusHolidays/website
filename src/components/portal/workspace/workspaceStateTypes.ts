import type { JsonValue } from "@/lib/jsonValue";
import { INITIAL_FORM, type PortalFormState } from "@/lib/portal/workspaceContract";

export interface ListFiltersState {
  [field: string]: string;
}

export type PortalWorkspaceForm = Partial<PortalFormState> & {
  _confirmedOfferQueryId?: string;
  _confirmedOfferState?: "loading" | "missing" | "ready";
  _focusedDetailState?: "loading" | "missing" | "ready";
  entryPoint?: "jobCard" | "proposal" | "query";
  focusedDetailType?: "jobCard" | "proposal" | "query";
  proposalRevision?: number;
  reportingInstructions?: string;
};
export type StateUpdate<T> = T | ((current: T) => T);

export interface WorkspaceListRow {
  createdAt?: number | string;
  expenseDate?: number | string;
  hotelAllocation?: string;
  id?: string;
  jobCardId?: null | string;
  roomType?: string;
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
  airfarePerPax?: number;
  clientName?: string;
  landCostPerPax?: number;
  preparedBy?: string;
  proposalCode?: string;
  queryCode?: string;
  sellingPrice?: number;
  status?: string;
  visaCostPerPax?: number;
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
  canMutate?: boolean;
  createdAt?: string;
  filterState: JsonValue;
  id: string;
  isFavorite?: boolean;
  isPinnedToDashboard?: boolean;
  name: string;
  pathname?: string;
  sharedRole?: null | string;
  updatedAt?: string;
  view?: string;
}

export interface SaveCurrentViewOptions {
  isFavorite?: boolean;
  isPinnedToDashboard?: boolean;
  sharedRole?: string;
}

type EmptyMutationResult = ReturnType<() => void>;
export type MutationResult = boolean | null | number | object | string | EmptyMutationResult;
export type MutationLike<Args extends object = object> = (args: Args) => Promise<MutationResult>;
export type ConfirmFn = (options: {
  confirmLabel?: string;
  danger?: boolean;
  message: string;
  onConfirm?: () => Promise<MutationResult>;
  title: string;
}) => Promise<boolean>;
export interface PortalToastApi {
  error: (message: string) => string;
  success: (message: string) => string;
}

export const compactRows = <T>(rows: readonly (T | null | undefined)[] | null | undefined): T[] =>
  (rows ?? []).filter((row): row is T => row !== null && row !== undefined);

export const resolveUpdate = <T>(value: StateUpdate<T>, current: T): T =>
  value instanceof Function ? value(current) : value;

export function resetWorkspaceView(viewRef: { current: string }, view: string) {
  if (viewRef.current === view) {
    return {};
  }
  viewRef.current = view;
  return {
    error: "",
    form: INITIAL_FORM,
    isSaving: false,
    modal: null,
    pendingExpenseProofFiles: [],
    pendingProposalFiles: [],
    pendingQueryFiles: [],
    saveFlash: false,
  };
}
