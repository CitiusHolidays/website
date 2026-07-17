"use client";

import { ChevronDown, Filter, Search } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { PortalListFilters } from "@/components/portal/PortalListFilters";
import { getViewFilterSearchKeys } from "@/lib/portal/listFilterConfig";
import { enrichJobCardFilterOptions, filterScopeRows } from "@/lib/portal/listFilters";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const EMPTY_JOB_CARDS = [];
const EMPTY_LIST_FILTER_CONFIG = [];
const EMPTY_LIST_FILTERS = {};
const EMPTY_FILTER_SOURCE_ROWS = [];

function countFilterControls({ showPeriodFilter, listFilterConfig, showJobCardFilter }) {
  return (showPeriodFilter ? 2 : 0) + listFilterConfig.length + (showJobCardFilter ? 1 : 0);
}

export default function PortalListToolbar({
  title,
  search,
  setSearch,
  showSearch = true,
  dateRange,
  setDateRange,
  showPeriodFilter = true,
  listFilterConfig = EMPTY_LIST_FILTER_CONFIG,
  listFilters = EMPTY_LIST_FILTERS,
  setListFilterValue,
  filterSourceRows = EMPTY_FILTER_SOURCE_ROWS,
  showJobCardFilter = false,
  jobCardFilter = "",
  setJobCardFilter,
  jobCards = EMPTY_JOB_CARDS,
  jobCardFilterOptions,
  filtersActive = false,
  onClearAllFilters,
  commandPalette,
  actions,
  view = "",
  resultCount = null,
  resultsPartial = false,
  defaultFiltersOpen = false,
}) {
  const shouldReduceMotion = useReducedMotion();
  const filterControlCount = countFilterControls({
    listFilterConfig,
    showJobCardFilter,
    showPeriodFilter,
  });
  const collapsibleFilters = filterControlCount > 3;
  const [filtersOpen, setFiltersOpen] = useState(defaultFiltersOpen || !collapsibleFilters);
  const showFilterRow = filterControlCount > 0 && (!collapsibleFilters || filtersOpen);
  const filterSearchKeys = getViewFilterSearchKeys(view);
  const scopedFilterRows = filterScopeRows(filterSourceRows, {
    jobCardFilter: "",
    search,
    searchKeys: filterSearchKeys,
    view,
  });
  const jobCardOptions = showJobCardFilter
    ? enrichJobCardFilterOptions({
        config: listFilterConfig,
        filterValues: listFilters,
        options: jobCardFilterOptions(jobCards),
        rows: scopedFilterRows,
      })
    : [];

  const hasFilterControls =
    showPeriodFilter ||
    showJobCardFilter ||
    listFilterConfig.length > 0 ||
    Boolean(onClearAllFilters);

  return (
    <div
      className={`sticky top-16 ${PORTAL_Z.toolbar} mb-4 border-brand-border border-b bg-brand-light/95 py-2 backdrop-blur-sm`}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 shrink-0 items-baseline gap-2">
          <h1 className="portal-page-title shrink-0 text-balance font-heading font-semibold text-citius-blue">
            {title}
          </h1>
          {filtersActive && resultCount !== null ? (
            <span className="shrink-0 text-brand-muted text-sm tabular-nums">
              {resultCount} loaded {resultCount === 1 ? "result" : "results"}
              {resultsPartial ? "; more available" : ""}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
          {collapsibleFilters && hasFilterControls ? (
            <button
              aria-expanded={filtersOpen}
              className={`portal-toolbar-btn h-11 border border-brand-border bg-white text-brand-dark transition-[scale,color,background-color,border-color] duration-150 ease-[var(--portal-ease-out)] hover:border-citius-blue/30 active:scale-[0.96] ${
                filtersOpen ? "border-citius-blue text-citius-blue" : ""
              }`}
              onClick={() => setFiltersOpen((open) => !open)}
              type="button"
            >
              <Filter aria-hidden size={14} />
              Filters
              <ChevronDown
                aria-hidden
                className={`transition-transform duration-200 ease-[var(--portal-ease-out)] ${filtersOpen ? "rotate-180" : ""}`}
                size={14}
              />
            </button>
          ) : null}

          {showSearch ? (
            <label className="relative min-w-0 shrink">
              <span className="sr-only">Search this page</span>
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-brand-muted/60"
                size={16}
              />
              <input
                aria-label="Search this page"
                className="portal-toolbar-control h-11 w-full min-w-[10rem] rounded-lg border border-brand-border bg-white pr-3 pl-9 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-56"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                value={search}
              />
            </label>
          ) : null}

          {commandPalette}
          {actions ? (
            <div className="flex shrink-0 flex-nowrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showFilterRow ? (
          <m.div
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 1, transform: "scaleY(1)" }
            }
            className="overflow-hidden"
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: "scaleY(0.96)" }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: "scaleY(0.96)" }
            }
            key="filters"
            style={{ transformOrigin: "top" }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 border-brand-border/60 border-t pt-2">
              {showPeriodFilter ? (
                <PortalDateRangeFilter
                  compact
                  dateRange={dateRange}
                  inlineError
                  setDateRange={setDateRange}
                />
              ) : null}
              {showJobCardFilter ? (
                <label className="relative shrink-0">
                  <span className="sr-only">Job Card</span>
                  <select
                    aria-label="Filter by job card"
                    className="portal-toolbar-control portal-period-select h-11 min-w-[11rem] w-auto max-w-full appearance-none rounded-lg border border-brand-border bg-white px-2 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
                    onChange={(event) => setJobCardFilter(event.target.value)}
                    value={jobCardFilter}
                  >
                    {jobCardOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-brand-muted/60"
                    size={16}
                  />
                </label>
              ) : null}
              <PortalListFilters
                config={listFilterConfig}
                jobCardFilter={jobCardFilter}
                onChange={setListFilterValue}
                rows={filterSourceRows}
                search={search}
                searchKeys={filterSearchKeys}
                values={listFilters}
                view={view}
              />
              {onClearAllFilters ? (
                <button
                  className={`portal-small-btn h-11 shrink-0 whitespace-nowrap bg-white transition-transform duration-150 ease-[var(--portal-ease-out)] active:scale-[0.96] ${
                    filtersActive ? "" : "pointer-events-none invisible"
                  }`}
                  disabled={!filtersActive}
                  onClick={onClearAllFilters}
                  tabIndex={filtersActive ? 0 : -1}
                  type="button"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
