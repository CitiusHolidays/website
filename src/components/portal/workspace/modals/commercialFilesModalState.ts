export type CommercialFileSourceType = "query" | "proposal" | "jobCard";
export type CommercialFileCategory = "workingFile" | "proposalDoc";
export type CommercialFileTeamArea =
  | "sales"
  | "contracting"
  | "ticketing"
  | "accounts"
  | "operations"
  | "tourManager";

export interface CommercialFileSourceOption {
  code: string;
  id: string;
  label: string;
  sourceType: CommercialFileSourceType;
  teamAreas: CommercialFileTeamArea[];
}

export interface CommercialFileListRow {
  id: string;
}

export interface CommercialFileFilters {
  category: CommercialFileCategory | "";
  search: string;
  showDeleted: boolean;
  sourceFilter: string;
  teamArea: CommercialFileTeamArea | "";
}

export interface CommercialFilePagerState<Row extends CommercialFileListRow> {
  cursor?: string;
  hiddenRowIds: string[];
  previousRows: Row[];
  signature: string;
}

export type CommercialFilePagerAction<Row extends CommercialFileListRow> =
  | { signature: string; type: "reset" }
  | { id: string; type: "hideRow" }
  | { cursor: string; rows: Row[]; signature: string; type: "loadMore" };

export interface CommercialFileViewState<Row extends CommercialFileListRow> {
  filters: CommercialFileFilters;
  pager: CommercialFilePagerState<Row>;
}

export type CommercialFileViewAction<Row extends CommercialFileListRow> =
  | {
      name: keyof CommercialFileFilters;
      type: "setFilter";
      value: CommercialFileFilters[keyof CommercialFileFilters];
    }
  | { id: string; type: "hideRow" }
  | { cursor: string; rows: Row[]; signature: string; type: "loadMore" };

export const INITIAL_COMMERCIAL_FILE_FILTERS: CommercialFileFilters = {
  category: "",
  search: "",
  showDeleted: false,
  sourceFilter: "",
  teamArea: "",
};

export function commercialFileFilterSignature(
  filters: CommercialFileFilters,
  entryPoint: CommercialFileSourceType,
  entityId: string
) {
  return JSON.stringify({ ...filters, entityId, entryPoint });
}

export function createCommercialFilePagerState<Row extends CommercialFileListRow>(
  signature: string
): CommercialFilePagerState<Row> {
  return { hiddenRowIds: [], previousRows: [], signature };
}

function mergeRows<Row extends CommercialFileListRow>(left: Row[], right: Row[]) {
  const merged = new Map(left.map((row) => [row.id, row]));
  for (const row of right) {
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

export function commercialFilePagerReducer<Row extends CommercialFileListRow>(
  state: CommercialFilePagerState<Row>,
  action: CommercialFilePagerAction<Row>
): CommercialFilePagerState<Row> {
  if (action.type === "reset") {
    return createCommercialFilePagerState(action.signature);
  }
  if (action.type === "hideRow") {
    return state.hiddenRowIds.includes(action.id)
      ? state
      : { ...state, hiddenRowIds: [...state.hiddenRowIds, action.id] };
  }
  if (action.signature !== state.signature) {
    return state;
  }
  return {
    ...state,
    cursor: action.cursor,
    previousRows: mergeRows(state.previousRows, action.rows),
  };
}

export function createCommercialFileViewState<Row extends CommercialFileListRow>(
  entryPoint: CommercialFileSourceType,
  entityId: string
): CommercialFileViewState<Row> {
  return {
    filters: INITIAL_COMMERCIAL_FILE_FILTERS,
    pager: createCommercialFilePagerState(
      commercialFileFilterSignature(INITIAL_COMMERCIAL_FILE_FILTERS, entryPoint, entityId)
    ),
  };
}

export function createCommercialFileViewReducer<Row extends CommercialFileListRow>(
  entryPoint: CommercialFileSourceType,
  entityId: string
) {
  return (
    state: CommercialFileViewState<Row>,
    action: CommercialFileViewAction<Row>
  ): CommercialFileViewState<Row> => {
    if (action.type === "setFilter") {
      const filters = { ...state.filters, [action.name]: action.value };
      return {
        filters,
        pager: commercialFilePagerReducer(state.pager, {
          signature: commercialFileFilterSignature(filters, entryPoint, entityId),
          type: "reset",
        }),
      };
    }
    return { ...state, pager: commercialFilePagerReducer(state.pager, action) };
  };
}

export function commercialFileRowsForPage<Row extends CommercialFileListRow>(
  state: CommercialFilePagerState<Row>,
  signature: string,
  pageRows: Row[]
) {
  if (state.signature !== signature) {
    return [];
  }
  const hidden = new Set(state.hiddenRowIds);
  return mergeRows(state.previousRows, pageRows).filter((row) => !hidden.has(row.id));
}

export function commercialFileSourceKey(source: CommercialFileSourceOption) {
  return `${source.sourceType}:${source.id}`;
}

export function resolveCommercialFileUploadSelection(args: {
  entityId: string;
  entryPoint: CommercialFileSourceType;
  requestedSourceKey: string;
  requestedTeamArea: CommercialFileTeamArea | "";
  sourceOptions: CommercialFileSourceOption[];
}) {
  const current = args.sourceOptions.find(
    (option) => option.sourceType === args.entryPoint && option.id === args.entityId
  );
  const source =
    args.sourceOptions.find(
      (option) => commercialFileSourceKey(option) === args.requestedSourceKey
    ) ??
    current ??
    args.sourceOptions[0];
  const teamArea: CommercialFileTeamArea | "" =
    source && args.requestedTeamArea && source.teamAreas.includes(args.requestedTeamArea)
      ? args.requestedTeamArea
      : (source?.teamAreas[0] ?? "");
  return {
    proposalDocAllowed:
      source?.sourceType === "proposal" && source.teamAreas.includes("contracting"),
    source,
    sourceKey: source ? commercialFileSourceKey(source) : "",
    teamArea,
  };
}
