import { VIEWS_WITH_JOB_CARD_FILTER as JOB_CARD_FILTER_VIEWS } from "@/lib/portal/listFilterConfig";
import { applyListFilters } from "@/lib/portal/listFilters";
import { attachPassportExpiryUrgency } from "@/lib/portal/passportExpiry";
import { filterByDateRange } from "@/lib/portal/periodFilter";

export const VIEWS_WITH_JOB_CARD_FILTER = new Set(JOB_CARD_FILTER_VIEWS);

function filterByJobCard(rows, jobCardFilter) {
  if (!jobCardFilter || !rows?.length) return rows || [];
  return rows.filter((row) => row.jobCardId === jobCardFilter);
}

export function filterRows(rows, search, keys) {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
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

export function pipeViewRows(
  rows,
  {
    view,
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig,
    search,
    searchKeys,
    dateField = "createdAt",
  },
) {
  let result = filterByDateRange(rows || [], dateRange, dateField);
  if (VIEWS_WITH_JOB_CARD_FILTER.has(view)) {
    result = filterByJobCard(result, jobCardFilter);
  }
  if (view === "travellers" || view === "passport") {
    result = attachPassportExpiryUrgency(result);
  }
  if (filterConfig?.length) {
    result = applyListFilters(result, listFilters, filterConfig);
  }
  if (search?.trim() && searchKeys?.length) {
    result = filterRows(result, search, searchKeys);
  }
  return result;
}
