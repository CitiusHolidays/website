"use client";

import { ChevronDown, Filter, Search } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
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
}) {
  const filterControlCount = countFilterControls({
    showPeriodFilter,
    listFilterConfig,
    showJobCardFilter,
  });
  const collapsibleFilters = filterControlCount > 3;
  const [filtersOpen, setFiltersOpen] = useState(!collapsibleFilters);
  const showFilterRow = filterControlCount > 0 && (!collapsibleFilters || filtersOpen);
  const filterSearchKeys = getViewFilterSearchKeys(view);
  const scopedFilterRows = filterScopeRows(filterSourceRows, {
    view,
    jobCardFilter: "",
    search,
    searchKeys: filterSearchKeys,
  });
  const jobCardOptions = showJobCardFilter
    ? enrichJobCardFilterOptions({
        options: jobCardFilterOptions(jobCards),
        rows: scopedFilterRows,
        filterValues: listFilters,
        config: listFilterConfig,
      })
    : [];

  const hasFilterControls =
    showPeriodFilter ||
    showJobCardFilter ||
    listFilterConfig.length > 0 ||
    Boolean(onClearAllFilters);

  return (
    <div
      className={`sticky top-16 ${PORTAL_Z.toolbar} mb-4 border-b border-brand-border bg-brand-light/95 py-2 backdrop-blur-sm`}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 shrink-0 items-baseline gap-2">
          <h1 className="portal-page-title shrink-0 font-heading font-semibold text-citius-blue text-balance">
            {title}
          </h1>
          {filtersActive && resultCount !== null ? (
            <span className="shrink-0 text-sm text-brand-muted tabular-nums">
              {resultCount} {resultCount === 1 ? "result" : "results"}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
          {collapsibleFilters && hasFilterControls ? (
            <button
              type="button"
              className={`portal-toolbar-btn border border-brand-border bg-white text-brand-dark transition-[transform,color,background-color,border-color] duration-150 ease-out hover:border-citius-blue/30 active:scale-[0.96] ${
                filtersOpen ? "border-citius-blue text-citius-blue" : ""
              }`}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              <Filter size={14} aria-hidden />
              Filters
              <ChevronDown
                size={14}
                aria-hidden
                className={`transition-transform duration-200 ease-out ${filtersOpen ? "rotate-180" : ""}`}
              />
            </button>
          ) : null}

          {showSearch ? (
            <label className="relative min-w-0 shrink">
              <span className="sr-only">Search this page</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted/60"
                size={16}
                aria-hidden
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="portal-toolbar-control h-11 w-full min-w-[10rem] rounded-lg border border-brand-border bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-56"
                placeholder="Search"
                aria-label="Search this page"
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
            key="filters"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-brand-border/60 pt-2">
              {showPeriodFilter ? (
                <PortalDateRangeFilter
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  compact
                  inlineError
                />
              ) : null}
              {showJobCardFilter ? (
                <label className="relative shrink-0">
                  <span className="sr-only">Job card</span>
                  <select
                    value={jobCardFilter}
                    onChange={(event) => setJobCardFilter(event.target.value)}
                    className="portal-toolbar-control portal-period-select h-9 w-44 appearance-none rounded-lg border border-brand-border bg-white px-2 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
                    aria-label="Filter by job card"
                  >
                    {jobCardOptions.map((option) => (
                      <option key={option.value || "all"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted/60"
                    size={16}
                    aria-hidden
                  />
                </label>
              ) : null}
              <PortalListFilters
                config={listFilterConfig}
                values={listFilters}
                onChange={setListFilterValue}
                rows={filterSourceRows}
                view={view}
                jobCardFilter={jobCardFilter}
                search={search}
                searchKeys={filterSearchKeys}
              />
              {onClearAllFilters ? (
                <button
                  type="button"
                  className={`portal-small-btn shrink-0 whitespace-nowrap bg-white transition-transform duration-150 ease-out active:scale-[0.96] ${
                    filtersActive ? "" : "pointer-events-none invisible"
                  }`}
                  onClick={onClearAllFilters}
                  tabIndex={filtersActive ? 0 : -1}
                  disabled={!filtersActive}
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
