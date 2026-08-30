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
import {
  createPortalTableLayoutState,
  type PortalTableLayoutState,
  splitPortalSavedViews,
} from "@/lib/portal/tableLayoutPresets";
import { serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import type {
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
  createSavedView: MutationLike<CreateSavedViewArgs>;
  listFilterConfig: SavedViewFilterConfig[] | undefined;
  pathname: string;
  removeSavedView: MutationLike<{ savedViewId: string }>;
  router: AppRouterInstance;
  savedViews: readonly SavedViewRecord[] | null | undefined;
  searchParams: URLSearchParams;
  setDateRange: (value: StateUpdate<DateRangeState>) => void;
  setJobCardFilter: (value: StateUpdate<string>) => void;
  setListFilters: (value: StateUpdate<ListFiltersState>) => void;
  setSearch: (value: StateUpdate<string>) => void;
  showToast: ToastLike;
  updateSavedView: MutationLike<UpdateSavedViewArgs>;
  view: string;
}

interface SavedViewFilterConfig {
  field: string;
}

interface SavedViewInput extends FilterSnapshot {
  filterConfig: SavedViewFilterConfig[] | undefined;
  pathname: string;
  view: string;
}

interface SavedViewMutationInput {
  filterState: object;
  pathname: string;
  view: string;
}

interface CreateSavedViewArgs extends SavedViewMutationInput {
  isFavorite: boolean;
  isPinnedToDashboard: boolean;
  name: string;
  sharedRole?: string;
}

interface UpdateSavedViewArgs {
  isFavorite?: boolean;
  isPinnedToDashboard?: boolean;
  savedViewId: string;
}

interface SerializeFilterOptions {
  preserveRouteContext?: boolean;
  preserveTab?: boolean;
  searchParams: URLSearchParams;
}

function currentWorkspaceFiltersToSavedViewInput(input: SavedViewInput): SavedViewMutationInput {
  // SAFETY: this intersection adds the documented checked-JS parameter contract without erasing it.
  const createInput = currentFiltersToSavedViewInput as ((
    value: SavedViewInput
  ) => SavedViewMutationInput) &
    typeof currentFiltersToSavedViewInput;
  return createInput(input);
}

function normalizeWorkspaceSavedViewState(
  filterState: SavedViewRecord["filterState"],
  filterConfig: SavedViewFilterConfig[] | undefined
): FilterSnapshot {
  const normalized = normalizeSavedViewState(filterState ?? {}, filterConfig);
  const listFilters: ListFiltersState = {};
  for (const [field, value] of Object.entries(normalized.listFilters)) {
    if (value) {
      listFilters[field] = String(value);
    }
  }
  return {
    dateRange: {
      from: normalized.dateRange.from || null,
      to: normalized.dateRange.to || null,
    },
    jobCardFilter: String(normalized.jobCardFilter ?? ""),
    listFilters,
    search: normalized.search,
  };
}

function serializeWorkspaceUrlFilterState(
  filters: FilterSnapshot,
  filterConfig: SavedViewFilterConfig[] | undefined,
  options?: SerializeFilterOptions
): URLSearchParams {
  return serializeUrlFilterState(
    {
      ...filters,
      dateRange: {
        from: filters.dateRange.from ?? "",
        to: filters.dateRange.to ?? "",
      },
    },
    filterConfig,
    options
  );
}

export function buildPortalWorkspaceFilters({
  allowed,
  createSavedView,
  dateRange,
  jobCardFilter,
  listFilterConfig,
  listFilters,
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
      preserveRouteContext: true,
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
    const params = serializeWorkspaceUrlFilterState(nextFilters, listFilterConfig, {
      preserveTab: true,
      searchParams,
    });
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
      createSavedView({
        ...input,
        isFavorite: options.isFavorite ?? true,
        isPinnedToDashboard: options.isPinnedToDashboard ?? false,
        name,
        sharedRole: options.sharedRole || undefined,
      })
    );
  };

  const saveCurrentLayout = async (
    name: string,
    layout: Pick<PortalTableLayoutState, "columns" | "scope" | "sort">,
    options: SaveCurrentViewOptions = {}
  ) =>
    await runMutation({ showToast, successMessage: "Layout preset created." }, () =>
      createSavedView({
        filterState: createPortalTableLayoutState(layout),
        isFavorite: options.isFavorite ?? false,
        isPinnedToDashboard: false,
        name,
        pathname,
        sharedRole: options.sharedRole || undefined,
        view,
      })
    );

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

  const partitionedSavedViews = splitPortalSavedViews(savedViews);
  const savedViewLinks = partitionedSavedViews.savedViews.map((savedView) => ({
    ...savedView,
    href: savedViewToUrl(savedView.pathname || pathname, savedView, listFilterConfig),
  }));

  return {
    applySavedView,
    clearAllFilters,
    deleteSavedView,
    filtersActive,
    filterUrlForState,
    layoutPresets: partitionedSavedViews.layoutPresets,
    replaceFilterUrl,
    saveCurrentLayout,
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
