/**
 * Client-side list filters for portal views (AND composition).
 */

import { VIEWS_WITH_JOB_CARD_FILTER } from "@/lib/portal/jobCardFilterViews";

function filterByJobCard(rows, jobCardFilter) {
  if (!jobCardFilter || !rows?.length) return rows || [];
  return rows.filter((row) => row.jobCardId === jobCardFilter);
}

function filterBySearch(rows, search, keys) {
  const term = search.trim().toLowerCase();
  if (!term) return rows || [];
  return (rows || []).filter((row) =>
    keys.some((key) => {
      const value = row[key];
      if (Array.isArray(value)) {
        return value.join(", ").toLowerCase().includes(term);
      }
      return String(value ?? "")
        .toLowerCase()
        .includes(term);
    }),
  );
}

export function filterScopeRows(
  rows,
  { view, jobCardFilter, search, searchKeys } = {},
) {
  let result = rows || [];
  if (view && VIEWS_WITH_JOB_CARD_FILTER.includes(view)) {
    result = filterByJobCard(result, jobCardFilter);
  }
  if (search?.trim() && searchKeys?.length) {
    result = filterBySearch(result, search, searchKeys);
  }
  return result;
}

export function applyListFiltersExcept(rows, filterValues, config = [], exceptField) {
  if (!rows?.length || !config?.length) return rows || [];
  let result = rows;
  for (const def of config) {
    if (def.field === exceptField) continue;
    const value = filterValues?.[def.field];
    if (!value) continue;
    if (def.filterFn) {
      result = def.filterFn(result, value);
      continue;
    }
    result = filterByField(result, def.field, value);
  }
  return result;
}

function rowMatchesFilterValue(row, field, value, filterFn) {
  if (filterFn) {
    return filterFn([row], value).length > 0;
  }
  if (field === "passportExpiryUrgency") {
    return row._passportExpiryUrgency === value;
  }
  return String(row[field] ?? "") === value;
}

export function countRowsForFilterValue(rows, field, value, filterFn) {
  if (!value) return rows?.length ?? 0;
  let count = 0;
  for (const row of rows || []) {
    if (rowMatchesFilterValue(row, field, value, filterFn)) {
      count += 1;
    }
  }
  return count;
}

export function formatFilterOptionLabel(label, count) {
  return `${label} (${count})`;
}

export function enrichJobCardFilterOptions({ options, rows, filterValues, config }) {
  const scopedRows = applyListFiltersExcept(rows, filterValues, config, "__jobCard__");
  const countsByJob = new Map();
  for (const row of scopedRows) {
    const jobCardId = row.jobCardId;
    if (!jobCardId) continue;
    countsByJob.set(jobCardId, (countsByJob.get(jobCardId) ?? 0) + 1);
  }
  return (options || []).map((option) => {
    const count = option.value ? (countsByJob.get(option.value) ?? 0) : scopedRows.length;
    return {
      ...option,
      label: formatFilterOptionLabel(option.label, count),
    };
  });
}

export function enrichFilterOptions({
  options,
  rows,
  field,
  filterValues,
  config,
  filterFn,
}) {
  const scopedRows = applyListFiltersExcept(rows, filterValues, config, field);
  return (options || []).map((option) => {
    const count = option.value
      ? countRowsForFilterValue(scopedRows, field, option.value, filterFn)
      : scopedRows.length;
    return {
      ...option,
      label: formatFilterOptionLabel(option.label, count),
    };
  });
}

export function filterByField(rows, field, value) {
  if (!value || !rows?.length) return rows || [];
  if (field === "passportExpiryUrgency") {
    return rows.filter((row) => row._passportExpiryUrgency === value);
  }
  return rows.filter((row) => String(row[field] ?? "") === value);
}

export function buildFilterOptions(rows, field) {
  const values = new Set();
  for (const row of rows || []) {
    const raw = field === "passportExpiryUrgency" ? row._passportExpiryUrgency : row[field];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      values.add(String(raw));
    }
  }
  return [...values].toSorted((a, b) => a.localeCompare(b));
}

export function applyListFilters(rows, filterValues, config = []) {
  if (!rows?.length || !config?.length) return rows || [];
  let result = rows;
  for (const def of config) {
    const value = filterValues?.[def.field];
    if (!value) continue;
    if (def.filterFn) {
      result = def.filterFn(result, value);
      continue;
    }
    result = filterByField(result, def.field, value);
  }
  return result;
}

function hasListFilterValues(filterValues, config = []) {
  return config.some((def) => Boolean(filterValues?.[def.field]));
}

export const hasActiveListFilters = hasListFilterValues;

export function filterEmptyMessage({ filtersActive = false, defaultMessage = "" } = {}) {
  if (filtersActive) {
    return "No matches — adjust or clear filters.";
  }
  return defaultMessage;
}
