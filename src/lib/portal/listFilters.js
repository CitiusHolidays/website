/**
 * Client-side list filters for portal views (AND composition).
 */

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

export function hasListFilterValues(filterValues, config = []) {
  return config.some((def) => Boolean(filterValues?.[def.field]));
}

export const hasActiveListFilters = hasListFilterValues;

export function filterEmptyMessage({ filtersActive = false, defaultMessage = "" } = {}) {
  if (filtersActive) {
    return "No matches — adjust or clear filters.";
  }
  return defaultMessage;
}
