import { serializeUrlFilterState } from "./urlFilterState";

function emptySavedViewState() {
  return {
    search: "",
    dateRange: { from: "", to: "" },
    jobCardFilter: "",
    listFilters: {},
    sort: {},
    columns: [],
  };
}

export function normalizeSavedViewState(input = {}, filterConfig = []) {
  const allowed = new Set(filterConfig.map((filter) => filter.field));
  const listFilters = {};
  for (const [field, value] of Object.entries(input.listFilters || {})) {
    if (value && (!allowed.size || allowed.has(field))) {
      listFilters[field] = value;
    }
  }
  return {
    ...emptySavedViewState(),
    search: String(input.search ?? "").trim(),
    dateRange: {
      from: input.dateRange?.from ?? "",
      to: input.dateRange?.to ?? "",
    },
    jobCardFilter: input.jobCardFilter ?? "",
    listFilters,
    sort: input.sort ?? {},
    columns: Array.isArray(input.columns) ? input.columns : [],
  };
}

export function savedViewToUrl(pathname, savedView, filterConfig = []) {
  const state = normalizeSavedViewState(savedView?.filterState ?? savedView ?? {}, filterConfig);
  const query = serializeUrlFilterState(state, filterConfig).toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function currentFiltersToSavedViewInput({
  view,
  pathname,
  search,
  dateRange,
  jobCardFilter,
  listFilters,
  filterConfig = [],
}) {
  return {
    view,
    pathname,
    filterState: normalizeSavedViewState(
      { search, dateRange, jobCardFilter, listFilters },
      filterConfig,
    ),
  };
}
