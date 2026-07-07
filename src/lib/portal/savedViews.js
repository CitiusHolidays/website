import { serializeUrlFilterState } from "./urlFilterState";

function emptySavedViewState() {
  return {
    columns: [],
    dateRange: { from: "", to: "" },
    jobCardFilter: "",
    listFilters: {},
    search: "",
    sort: {},
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
    columns: Array.isArray(input.columns) ? input.columns : [],
    dateRange: {
      from: input.dateRange?.from ?? "",
      to: input.dateRange?.to ?? "",
    },
    jobCardFilter: input.jobCardFilter ?? "",
    listFilters,
    search: String(input.search ?? "").trim(),
    sort: input.sort ?? {},
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
    filterState: normalizeSavedViewState(
      { dateRange, jobCardFilter, listFilters, search },
      filterConfig
    ),
    pathname,
    view,
  };
}
