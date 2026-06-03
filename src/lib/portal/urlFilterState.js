const FILTER_PARAM_PREFIX = "f_";

export function parsePortalFilterParams(searchParams) {
  const search = searchParams.get("q") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const jc = searchParams.get("jc") ?? "";
  const listFilters = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith(FILTER_PARAM_PREFIX) && value) {
      listFilters[key.slice(FILTER_PARAM_PREFIX.length)] = value;
    }
  }
  return {
    search,
    dateRange: { from, to },
    jobCardFilter: jc,
    listFilters,
  };
}

/** @param {URLSearchParams} searchParams @param {Array<{ field: string }>} filterConfig */
export function parseUrlFilterState(searchParams, filterConfig = []) {
  const parsed = parsePortalFilterParams(searchParams);
  const allowed = new Set(filterConfig.map((def) => def.field));
  const listFilters = {};
  for (const [field, value] of Object.entries(parsed.listFilters)) {
    if (!allowed.size || allowed.has(field)) {
      listFilters[field] = value;
    }
  }
  return { ...parsed, listFilters };
}

export function serializePortalFilterParams({
  search,
  dateRange,
  jobCardFilter,
  listFilters,
  deepLink = null,
}) {
  const params = new URLSearchParams();
  const term = (search || "").trim();
  if (term) params.set("q", term);
  if (dateRange?.from) params.set("from", dateRange.from);
  if (dateRange?.to) params.set("to", dateRange.to);
  if (jobCardFilter) params.set("jc", jobCardFilter);
  for (const [field, value] of Object.entries(listFilters || {})) {
    if (value) params.set(`${FILTER_PARAM_PREFIX}${field}`, value);
  }
  if (deepLink?.open) {
    params.set("open", deepLink.open);
    if (deepLink.id) params.set("id", deepLink.id);
    if (deepLink.queryId) params.set("queryId", deepLink.queryId);
  }
  return params;
}

/**
 * @param {{ search: string, dateRange: { from: string, to: string }, jobCardFilter: string, listFilters: Record<string, string> }} state
 * @param {Array<{ field: string }>} filterConfig
 * @param {{ preserveDeepLink?: boolean, searchParams?: URLSearchParams }} options
 */
export function serializeUrlFilterState(state, filterConfig = [], options = {}) {
  const deepLink =
    options.preserveDeepLink && options.searchParams
      ? {
          open: options.searchParams.get("open") || undefined,
          id: options.searchParams.get("id") || undefined,
          queryId: options.searchParams.get("queryId") || undefined,
        }
      : null;
  const allowed = new Set(filterConfig.map((def) => def.field));
  const listFilters = {};
  for (const [field, value] of Object.entries(state.listFilters || {})) {
    if (value && (!allowed.size || allowed.has(field))) {
      listFilters[field] = value;
    }
  }
  return serializePortalFilterParams({
    search: state.search,
    dateRange: state.dateRange,
    jobCardFilter: state.jobCardFilter,
    listFilters,
    deepLink: deepLink?.open ? deepLink : null,
  });
}

export function buildFilterUrl(pathname, state, deepLink = null) {
  const params = serializePortalFilterParams({ ...state, deepLink });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function hasAnyFilterState({ search, dateRange, jobCardFilter, listFilters }) {
  if ((search || "").trim()) return true;
  if (jobCardFilter) return true;
  if (dateRange?.from || dateRange?.to) return true;
  return Object.values(listFilters || {}).some(Boolean);
}
