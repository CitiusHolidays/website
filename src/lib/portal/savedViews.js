import { serializeUrlFilterState } from "./urlFilterState";

const PORTAL_PATH_RE = /^\/portal(?:\/|$)/;

function hasUnsafePathCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127;
  });
}

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

export function isSafePortalPathname(pathname) {
  return (
    typeof pathname === "string" &&
    pathname.length > 0 &&
    PORTAL_PATH_RE.test(pathname) &&
    !hasUnsafePathCharacters(pathname) &&
    !pathname.includes("?") &&
    !pathname.includes("#")
  );
}

export function isSafePortalHref(href) {
  return typeof href === "string" && PORTAL_PATH_RE.test(href) && !hasUnsafePathCharacters(href);
}

export function savedViewToUrl(pathname, savedView, filterConfig = []) {
  const state = normalizeSavedViewState(savedView?.filterState ?? savedView ?? {}, filterConfig);
  const query = serializeUrlFilterState(state, filterConfig).toString();
  const safePathname = isSafePortalPathname(pathname) ? pathname : "/portal";
  return query ? `${safePathname}?${query}` : safePathname;
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
