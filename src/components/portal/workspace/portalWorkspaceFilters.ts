import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { hasActiveListFilters } from "@/lib/portal/listFilters";
import { EMPTY_DATE_RANGE } from "@/lib/portal/periodFilter";
import { VIEWS_WITH_JOB_CARD_FILTER } from "@/lib/portal/pipeViewRows";
import { runMutation } from "@/lib/portal/runMutation";
import {
  currentFiltersToSavedViewInput,
  normalizeSavedViewState,
  savedViewToUrl,
} from "@/lib/portal/savedViews";
import { serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import type {
  AnyRecord,
  DateRangeState,
  ListFiltersState,
  MutationLike,
  SaveCurrentViewOptions,
  SavedViewRecord,
  StateUpdate,
} from "./workspaceStateTypes";
import { resolveUpdate } from "./workspaceStateTypes";

interface FilterSnapshot {
  dateRange: DateRangeState;
  jobCardFilter: string;
  listFilters: ListFiltersState;
  search: string;
}

interface ToastLike {
  error: (message: string) => void;
  success: (message: string) => void;
}

interface BuildPortalWorkspaceFiltersInput extends FilterSnapshot {
  allowed: boolean | undefined;
  createSavedView: unknown;
  listFilterConfig: any[] | undefined;
  modal: string | null;
  pathname: string;
  removeSavedView: MutationLike;
  router: AppRouterInstance;
  savedViews: readonly SavedViewRecord[] | null | undefined;
  searchParams: URLSearchParams;
  setDateRange: (value: StateUpdate<DateRangeState>) => void;
  setJobCardFilter: (value: StateUpdate<string>) => void;
  setListFilters: (value: StateUpdate<ListFiltersState>) => void;
  setSearch: (value: StateUpdate<string>) => void;
  showToast: ToastLike;
  updateSavedView: MutationLike;
  view: string;
}

const currentWorkspaceFiltersToSavedViewInput = currentFiltersToSavedViewInput as unknown as (
  input: AnyRecord
) => AnyRecord;
const normalizeWorkspaceSavedViewState = normalizeSavedViewState as (
  filterState: unknown,
  filterConfig: any[] | undefined
) => FilterSnapshot;
const serializeWorkspaceUrlFilterState = serializeUrlFilterState as (
  filters: FilterSnapshot,
  filterConfig: any[] | undefined,
  options?: AnyRecord
) => URLSearchParams;

export function buildPortalWorkspaceFilters({
  allowed,
  createSavedView,
  dateRange,
  jobCardFilter,
  listFilterConfig,
  listFilters,
  modal,
  pathname,
  removeSavedView,
  router,
  savedViews,
  search,
  searchParams,
  setDateRange,
  setJobCardFilter,
  setListFilters,
  setSearch,
  showToast,
  updateSavedView,
  view,
}: BuildPortalWorkspaceFiltersInput) {
  const replaceFilterUrl = (nextFilters: FilterSnapshot) => {
    if (!allowed) {
      return;
    }
    const params = serializeWorkspaceUrlFilterState(nextFilters, listFilterConfig, {
      preserveDeepLink: Boolean(modal),
      searchParams,
    });
    const qs = params.toString();
    const nextUrl = qs ? `${pathname}?${qs}` : pathname;
    const currentQs = searchParams.toString();
    const currentUrl = currentQs ? `${pathname}?${currentQs}` : pathname;
    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const filterUrlForState = (nextFilters: FilterSnapshot) => {
    const params = serializeWorkspaceUrlFilterState(nextFilters, listFilterConfig);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const showJobCardFilter = VIEWS_WITH_JOB_CARD_FILTER.has(view);
  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(jobCardFilter) ||
    Boolean(dateRange.from || dateRange.to) ||
    hasActiveListFilters(listFilters, listFilterConfig);

  const clearAllFilters = () => {
    const clearedFilters = {
      dateRange: EMPTY_DATE_RANGE,
      jobCardFilter: "",
      listFilters: {},
      search: "",
    };
    setSearch(clearedFilters.search);
    setJobCardFilter(clearedFilters.jobCardFilter);
    setListFilters(clearedFilters.listFilters);
    setDateRange(clearedFilters.dateRange);
    replaceFilterUrl(clearedFilters);
  };

  const setSearchWithUrl = (value: StateUpdate<string>) => {
    const nextSearch = resolveUpdate(value, search);
    setSearch(nextSearch);
    replaceFilterUrl({ dateRange, jobCardFilter, listFilters, search: nextSearch });
  };

  const setDateRangeWithUrl = (value: StateUpdate<DateRangeState>) => {
    const nextDateRange = resolveUpdate(value, dateRange);
    setDateRange(nextDateRange);
    replaceFilterUrl({ dateRange: nextDateRange, jobCardFilter, listFilters, search });
  };

  const setJobCardFilterWithUrl = (value: StateUpdate<string>) => {
    const nextJobCardFilter = resolveUpdate(value, jobCardFilter);
    setJobCardFilter(nextJobCardFilter);
    replaceFilterUrl({ dateRange, jobCardFilter: nextJobCardFilter, listFilters, search });
  };

  const setListFilterValue = (field: string, value: string) => {
    setListFilters((current) => {
      const next = { ...current };
      if (value) {
        next[field] = value;
      } else {
        delete next[field];
      }
      replaceFilterUrl({ dateRange, jobCardFilter, listFilters: next, search });
      return next;
    });
  };

  const applySavedView = (savedView: SavedViewRecord) => {
    const normalized = normalizeWorkspaceSavedViewState(savedView.filterState, listFilterConfig);
    setSearch(normalized.search);
    setDateRange(normalized.dateRange);
    setJobCardFilter(normalized.jobCardFilter);
    setListFilters(normalized.listFilters);
    replaceFilterUrl(normalized);
  };

  const saveCurrentView = async (name: string, options: SaveCurrentViewOptions = {}) => {
    const input = currentWorkspaceFiltersToSavedViewInput({
      dateRange,
      filterConfig: listFilterConfig,
      jobCardFilter,
      listFilters,
      pathname,
      search,
      view,
    });
    return await runMutation({ showToast, successMessage: "Saved view created." }, () =>
      (createSavedView as unknown as MutationLike)({
        ...input,
        isFavorite: options.isFavorite ?? true,
        isPinnedToDashboard: options.isPinnedToDashboard ?? false,
        name,
        sharedRole: options.sharedRole || undefined,
      })
    );
  };

  const deleteSavedView = async (savedViewId: string) =>
    await runMutation({ showToast, successMessage: "Saved view deleted." }, () =>
      removeSavedView({ savedViewId })
    );

  const toggleSavedViewFavorite = async (savedView: SavedViewRecord) =>
    await runMutation({ showToast }, () =>
      updateSavedView({
        isFavorite: !savedView.isFavorite,
        savedViewId: savedView.id,
      })
    );

  const toggleSavedViewPinned = async (savedView: SavedViewRecord) =>
    await runMutation({ showToast }, () =>
      updateSavedView({
        isPinnedToDashboard: !savedView.isPinnedToDashboard,
        savedViewId: savedView.id,
      })
    );

  const savedViewLinks = (savedViews ?? []).map((savedView) => ({
    ...savedView,
    href: savedViewToUrl(savedView.pathname || pathname, savedView, listFilterConfig),
  }));

  return {
    applySavedView,
    clearAllFilters,
    deleteSavedView,
    filtersActive,
    filterUrlForState,
    replaceFilterUrl,
    saveCurrentView,
    savedViewLinks,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    showJobCardFilter,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
  };
}
