"use client";

import { ChevronDown, Filter } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useState } from "react";
import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { PortalListFilters } from "@/components/portal/PortalListFilters";
import { PortalSearchField } from "@/components/portal/PortalSearchField";
import { Button } from "@/components/ui/application-button";
import { Select } from "@/components/ui/application-select";
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

function ToolbarHeader({
  actions,
  collapsibleFilters,
  commandPalette,
  filtersActive,
  filtersOpen,
  hasFilterControls,
  onSearchChange,
  onToggleFilters,
  resultCount,
  resultsPartial,
  search,
  showSearch,
  title,
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 shrink-0 items-baseline gap-2">
        <h2 className="portal-page-title shrink-0 text-balance font-heading font-semibold text-citius-blue">
          {title}
        </h2>
        {filtersActive && resultCount !== null ? (
          <span className="shrink-0 text-brand-muted text-sm tabular-nums">
            {resultCount} loaded {resultCount === 1 ? "result" : "results"}
            {resultsPartial ? "; more available" : ""}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
        {collapsibleFilters && hasFilterControls ? (
          <Button
            aria-expanded={filtersOpen}
            className={`portal-toolbar-btn h-11 border border-brand-border bg-white text-brand-dark transition-[scale,color,background-color,border-color] duration-150 ease-[var(--portal-ease-out)] hover:border-citius-blue/30 active:scale-[0.96] ${
              filtersOpen ? "border-citius-blue text-citius-blue" : ""
            }`}
            onClick={onToggleFilters}
            type="button"
          >
            <Filter aria-hidden size={14} />
            Filters
            <ChevronDown
              aria-hidden
              className={`transition-transform duration-200 ease-[var(--portal-ease-out)] ${filtersOpen ? "rotate-180" : ""}`}
              size={14}
            />
          </Button>
        ) : null}

        {showSearch ? (
          <PortalSearchField
            className="min-w-[10rem]"
            id="portal-list-search"
            label="Search this page"
            onChange={onSearchChange}
            placeholder="Search"
            value={search}
            wrapperClassName="min-w-0 shrink sm:w-56"
          />
        ) : null}

        {commandPalette}
        {actions ? (
          <div
            className="flex shrink-0 flex-nowrap items-center gap-2"
            data-testid="portal-list-toolbar-actions"
          >
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToolbarFilterRow({
  dateRange,
  filterSearchKeys,
  filterSourceRows,
  filtersActive,
  jobCardFilter,
  jobCardOptions,
  listFilterConfig,
  listFilters,
  onClearAllFilters,
  search,
  setDateRange,
  setJobCardFilter,
  setListFilterValue,
  shouldReduceMotion,
  showJobCardFilter,
  showPeriodFilter,
  view,
}) {
  return (
    <m.div
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, transform: "scaleY(1)" }}
      className="min-w-0 overflow-visible"
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scaleY(0.96)" }}
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, transform: "scaleY(0.96)" }}
      key="filters"
      style={{ transformOrigin: "top" }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.23, 1, 0.32, 1] }
      }
    >
      <div className="mt-3 flex min-w-0 flex-wrap items-start gap-3 rounded-xl bg-brand-light/70 p-3">
        {showPeriodFilter ? (
          <PortalDateRangeFilter
            compact
            dateRange={dateRange}
            inlineError
            setDateRange={setDateRange}
          />
        ) : null}
        {showJobCardFilter ? (
          <div className="relative shrink-0">
            <label className="sr-only" htmlFor="portal-list-job-card-filter">
              Job Card
            </label>
            <Select
              aria-label="Filter by job card"
              className="portal-toolbar-control portal-period-select h-11 w-auto min-w-[11rem] max-w-full appearance-none rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
              id="portal-list-job-card-filter"
              onValueChange={setJobCardFilter}
              options={jobCardOptions}
              value={jobCardFilter}
            />
          </div>
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
        {onClearAllFilters && filtersActive ? (
          <Button
            className="portal-small-btn h-11 shrink-0 whitespace-nowrap bg-white transition-transform duration-150 ease-[var(--portal-ease-out)] active:scale-[0.96]"
            onClick={onClearAllFilters}
            type="button"
          >
            Clear filters
          </Button>
        ) : null}
      </div>
    </m.div>
  );
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
  resultCount = /** @type {number | null} */ (null),
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
  const toggleFilters = () => setFiltersOpen((open) => !open);
  const handleSearchChange = (event) => setSearch(event.target.value);

  return (
    <div
      className={`material-structural sticky top-[var(--portal-chrome-height)] ${PORTAL_Z.toolbar} mb-4 rounded-2xl border border-brand-border/80 bg-white/95 p-3 shadow-[0_12px_32px_rgba(16,42,131,0.06)] backdrop-blur-xl`}
    >
      <ToolbarHeader
        actions={actions}
        collapsibleFilters={collapsibleFilters}
        commandPalette={commandPalette}
        filtersActive={filtersActive}
        filtersOpen={filtersOpen}
        hasFilterControls={hasFilterControls}
        onSearchChange={handleSearchChange}
        onToggleFilters={toggleFilters}
        resultCount={resultCount}
        resultsPartial={resultsPartial}
        search={search}
        showSearch={showSearch}
        title={title}
      />

      <AnimatePresence initial={false}>
        {showFilterRow ? (
          <ToolbarFilterRow
            dateRange={dateRange}
            filterSearchKeys={filterSearchKeys}
            filterSourceRows={filterSourceRows}
            filtersActive={filtersActive}
            jobCardFilter={jobCardFilter}
            jobCardOptions={jobCardOptions}
            listFilterConfig={listFilterConfig}
            listFilters={listFilters}
            onClearAllFilters={onClearAllFilters}
            search={search}
            setDateRange={setDateRange}
            setJobCardFilter={setJobCardFilter}
            setListFilterValue={setListFilterValue}
            shouldReduceMotion={shouldReduceMotion}
            showJobCardFilter={showJobCardFilter}
            showPeriodFilter={showPeriodFilter}
            view={view}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
