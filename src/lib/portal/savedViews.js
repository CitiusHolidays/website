import { isRuntimeString } from "../runtimeValues";
import { serializeUrlFilterState } from "./urlFilterState";

const PORTAL_PATH_RE = /^\/portal(?:\/|$)/;
const HREF_DELIMITER_RE = /[?#]/;

function hasUnsafePathCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return character === "\\" || code < 32 || code === 127;
  });
}

function hasUnsafePathSegments(value) {
  return value.split("/").some((segment) => {
    let decoded = segment;
    for (let pass = 0; pass < 3; pass += 1) {
      let next;
      try {
        next = decodeURIComponent(decoded);
      } catch {
        return true;
      }
      if (next === decoded) {
        break;
      }
      decoded = next;
    }
    return (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\u0000")
    );
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
    isRuntimeString(pathname) &&
    pathname.length > 0 &&
    PORTAL_PATH_RE.test(pathname) &&
    !hasUnsafePathCharacters(pathname) &&
    !hasUnsafePathSegments(pathname) &&
    !pathname.includes("?") &&
    !pathname.includes("#")
  );
}

export function isSafePortalHref(href) {
  if (!isRuntimeString(href) || hasUnsafePathCharacters(href)) {
    return false;
  }
  const delimiter = href.search(HREF_DELIMITER_RE);
  const pathname = delimiter === -1 ? href : href.slice(0, delimiter);
  return isSafePortalPathname(pathname);
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
