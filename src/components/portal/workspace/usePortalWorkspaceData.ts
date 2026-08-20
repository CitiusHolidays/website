import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useEffect, useRef, useState } from "react";
import type { PortalAccessSnapshot } from "@/components/portal/PortalAccessContext";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import {
  type CursorPaginationStatus,
  shouldContinueCursorPage,
} from "@/lib/portal/cursorPagination";
import { propertiesWhen } from "../../../lib/runtimeValues";

interface FocusedJobCardArgs {
  jobCardId?: string;
  queryId?: string;
}

import { fiscalYearForDate } from "@/lib/portal/leavePolicy";
import {
  measurePortalNavigationWorkload,
  PORTAL_PERFORMANCE_TARGETS,
  type PortalPerformanceSubscription,
  type PortalPerformanceTarget,
  recordPortalNavigationWorkload,
} from "@/lib/portal/navigationPerformance";
import { mergeFocusedRow } from "@/lib/portal/paginatedRows";
import { endOfDateOnly, parseDateOnly } from "@/lib/portal/periodFilter";
import { canUseTeamPicker } from "@/lib/portal/permissions";
import {
  getPortalDataDependencies,
  type PortalDataDependency,
} from "@/lib/portal/portalDataDependencies";
import {
  useTrackedPaginatedQuery as usePaginatedQuery,
  usePortalSubscriptionSummary,
  useTrackedQuery as useQuery,
} from "@/lib/portal/trackedConvexSubscriptions";
import {
  useActiveLocalReferenceDate,
  useActiveOperationReferenceNow,
} from "./usePortalReferenceClock";
import type { ListFiltersState, PortalWorkspaceForm } from "./workspaceStateTypes";

const P = PORTAL_PERMISSIONS;

interface UsePortalWorkspaceDataInput {
  access: PortalAccessSnapshot | null | undefined;
  canFetch: boolean | undefined;
  dateRangeArg: { from?: string; to?: string } | undefined;
  deepLinkId: null | string;
  deepLinkOpen: null | string;
  deepLinkQueryId: null | string;
  form: PortalWorkspaceForm;
  has: (permission: string) => boolean;
  jobCardFilter: string;
  listFilters: ListFiltersState;
  modal: null | string;
  search: string;
  view: string;
}

const PAGE_SIZE = 50;
const MAX_AUTOMATIC_CURSOR_LOADS = 2;
const PASSENGER_IMPORT_MODALS = [
  "passengerImport",
  "passportImport",
  "roomingImport",
  "travellerImport",
  "visaImport",
];
const PASSENGER_EXPORT_MODALS = [
  "passengerExport",
  "passportExport",
  "roomingExport",
  "travellerExport",
  "visaExport",
];

const PASSPORT_EXPIRY_URGENCIES = ["critical", "expired", "ok", "unknown", "warning"] as const;
const ROOM_TYPES = ["Twin", "Single", "Double", "Triple", "Child with Bed", "Family Room"] as const;
const VISA_STATUSES = [
  "Rejected",
  "Checklist Shared",
  "Approved",
  "Not Required",
  "Not Started",
  "Documents Pending",
  "Documents Verified",
  "Appointment Scheduled",
  "Submitted",
  "Awaiting",
  "Re-applied",
] as const;
const LEAVE_STATUSES = ["Rejected", "Pending", "Approved"] as const;

function matchingOption<const Options extends readonly string[]>(
  value: string | undefined,
  options: Options
): Options[number] | undefined {
  return options.find((option) => option === value);
}

function usePaginationControl(
  result: {
    loadMore: (count: number) => void;
    results: readonly unknown[];
    status: CursorPaginationStatus;
  },
  signature: string
) {
  const [cursorTarget, setCursorTarget] = useState({ signature, targetCount: PAGE_SIZE });
  const automaticLoadsRef = useRef({ count: 0, signature });
  const { loadMore: loadMorePage, results, status } = result;
  const sameSignature = cursorTarget.signature === signature;
  const targetCount = sameSignature ? cursorTarget.targetCount : PAGE_SIZE;

  useEffect(() => {
    const automaticLoads =
      automaticLoadsRef.current.signature === signature ? automaticLoadsRef.current.count : 0;
    if (
      shouldContinueCursorPage({
        automaticLoads,
        loadedCount: results.length,
        maxAutomaticLoads: MAX_AUTOMATIC_CURSOR_LOADS,
        status,
        targetCount,
      })
    ) {
      automaticLoadsRef.current = { count: automaticLoads + 1, signature };
      loadMorePage(PAGE_SIZE);
    }
  }, [loadMorePage, results.length, signature, status, targetCount]);

  const loadMore = () => {
    automaticLoadsRef.current = { count: 0, signature };
    setCursorTarget((current) => ({
      signature,
      targetCount: (current.signature === signature ? current.targetCount : PAGE_SIZE) + PAGE_SIZE,
    }));
    if (status === "CanLoadMore") {
      loadMorePage(PAGE_SIZE);
    }
  };

  return {
    canLoadMore: status === "CanLoadMore",
    isLoadingMore: status === "LoadingMore",
    loadedCount: results.length,
    loadMore,
    status,
  };
}

function combinePaginationControls(...controls: ReturnType<typeof usePaginationControl>[]) {
  return {
    canLoadMore: controls.some((control) => control.canLoadMore),
    isLoadingMore: controls.some((control) => control.isLoadingMore),
    loadedCount: controls.reduce((total, control) => total + control.loadedCount, 0),
    loadMore: () => {
      for (const control of controls) {
        if (control.canLoadMore) {
          control.loadMore();
        }
      }
    },
  };
}

function parseOptionalBoolean(value: string | undefined) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
}

interface DateBounds {
  createdAtFrom?: number;
  createdAtTo?: number;
}

interface WorkspaceRuntimeState {
  dateBounds: DateBounds;
  isJobCardSearchView: boolean;
  isProposalSearchView: boolean;
  isQueryListView: boolean;
  isTravellerSearchView: boolean;
  jobCardSearchPreparing: boolean;
  navigationReferenceNow: number;
  needs: (dependency: PortalDataDependency) => boolean;
  normalizedSearch: string;
  operationReferenceNow: number;
  passengerExportModalActive: boolean;
  passengerImportModalActive: boolean;
  portalSubscriptionSummary: ReturnType<typeof usePortalSubscriptionSummary>;
  proposalSearchPreparing: boolean;
  querySearchPreparing: boolean;
  referenceDate: string;
  searchPreparing: boolean;
  searchReadiness: (typeof api.crm.listSearch.getReadiness)["_returnType"] | undefined;
  shouldLoadSearchReadiness: boolean;
  travellerSearchPreparing: boolean;
}

type WorkspaceQueryContext = UsePortalWorkspaceDataInput & WorkspaceRuntimeState;

function buildDateBounds(dateRangeArg: UsePortalWorkspaceDataInput["dateRangeArg"]): DateBounds {
  return {
    createdAtFrom: dateRangeArg?.from ? (parseDateOnly(dateRangeArg.from) ?? undefined) : undefined,
    createdAtTo: dateRangeArg?.to ? (endOfDateOnly(dateRangeArg.to) ?? undefined) : undefined,
  };
}

function isPassengerModalActive(
  canFetch: boolean | undefined,
  modal: null | string,
  modals: string[]
) {
  return Boolean(canFetch && modals.includes(modal ?? ""));
}

function shouldActivateReferenceDate(
  input: UsePortalWorkspaceDataInput,
  needs: WorkspaceRuntimeState["needs"]
) {
  if (!input.canFetch) {
    return false;
  }
  if (needs("financeOverview") && input.has(P.VIEW_FINANCE)) {
    return true;
  }
  if (needs("leaves") && input.has(P.VIEW_LEAVE)) {
    return true;
  }
  return Boolean(
    input.view === "passport" &&
      input.has(P.VIEW_TRAVELLERS) &&
      input.listFilters.passportExpiryUrgency
  );
}

function searchViewState(view: string) {
  const isQueryListView = ["accounts-job-cards", "contracting", "pipeline", "queries"].includes(
    view
  );
  const isJobCardSearchView = view === "job-cards";
  const isProposalSearchView = view === "proposals";
  const isTravellerSearchView = ["hotels", "passport", "travellers"].includes(view);
  return {
    isJobCardSearchView,
    isProposalSearchView,
    isQueryListView,
    isSearchableListView:
      isQueryListView || isJobCardSearchView || isProposalSearchView || isTravellerSearchView,
    isTravellerSearchView,
  };
}

function searchPreparationState({
  isJobCardSearchView,
  isProposalSearchView,
  isQueryListView,
  isTravellerSearchView,
  searchReadiness,
  shouldLoadSearchReadiness,
}: {
  isJobCardSearchView: boolean;
  isProposalSearchView: boolean;
  isQueryListView: boolean;
  isTravellerSearchView: boolean;
  searchReadiness: WorkspaceRuntimeState["searchReadiness"];
  shouldLoadSearchReadiness: boolean;
}) {
  const querySearchPreparing = Boolean(
    shouldLoadSearchReadiness && isQueryListView && searchReadiness?.tables.queries !== true
  );
  const jobCardSearchPreparing = Boolean(
    shouldLoadSearchReadiness && isJobCardSearchView && searchReadiness?.tables.jobCards !== true
  );
  const proposalSearchPreparing = Boolean(
    shouldLoadSearchReadiness && isProposalSearchView && searchReadiness?.tables.proposals !== true
  );
  const travellerSearchPreparing = Boolean(
    shouldLoadSearchReadiness &&
      isTravellerSearchView &&
      searchReadiness?.tables.travellers !== true
  );
  return {
    jobCardSearchPreparing,
    proposalSearchPreparing,
    querySearchPreparing,
    searchPreparing:
      querySearchPreparing ||
      jobCardSearchPreparing ||
      proposalSearchPreparing ||
      travellerSearchPreparing,
    travellerSearchPreparing,
  };
}

function useWorkspaceRuntimeState(input: UsePortalWorkspaceDataInput): WorkspaceRuntimeState {
  const portalSubscriptionSummary = usePortalSubscriptionSummary();
  const dependencies = getPortalDataDependencies({
    deepLinkOpen: input.deepLinkOpen,
    modal: input.modal,
    view: input.view,
  });
  const needs = (dependency: PortalDataDependency) => dependencies.has(dependency);
  const normalizedSearch = input.search.trim();
  const [navigationReferenceNow] = useState(() => Date.now());
  const passengerImportModalActive = isPassengerModalActive(
    input.canFetch,
    input.modal,
    PASSENGER_IMPORT_MODALS
  );
  const passengerExportModalActive = isPassengerModalActive(
    input.canFetch,
    input.modal,
    PASSENGER_EXPORT_MODALS
  );
  const jobCardDeletionClockActive = Boolean(
    input.canFetch && needs("jobCardDeletionOperations") && input.has(P.MANAGE_JOB_CARDS)
  );
  const operationReferenceNow = useActiveOperationReferenceNow(
    passengerImportModalActive || passengerExportModalActive || jobCardDeletionClockActive
  );
  const referenceDate = useActiveLocalReferenceDate(shouldActivateReferenceDate(input, needs));
  const views = searchViewState(input.view);
  const shouldLoadSearchReadiness = Boolean(
    input.canFetch && normalizedSearch && views.isSearchableListView
  );
  const searchReadiness = useQuery(
    api.crm.listSearch.getReadiness,
    shouldLoadSearchReadiness ? { referenceNow: navigationReferenceNow } : "skip"
  );
  const preparation = searchPreparationState({
    ...views,
    searchReadiness,
    shouldLoadSearchReadiness,
  });
  return {
    dateBounds: buildDateBounds(input.dateRangeArg),
    ...views,
    ...preparation,
    navigationReferenceNow,
    needs,
    normalizedSearch,
    operationReferenceNow,
    passengerExportModalActive,
    passengerImportModalActive,
    portalSubscriptionSummary,
    referenceDate,
    searchReadiness,
    shouldLoadSearchReadiness,
  };
}

function resolveFocusedQueryId(context: WorkspaceQueryContext) {
  if (context.deepLinkQueryId) {
    return context.deepLinkQueryId;
  }
  if (context.deepLinkOpen === "query") {
    return context.deepLinkId;
  }
  if (context.modal === "query" && context.form.focusedDetailType === "query") {
    return String(context.form.entityId || "");
  }
  if (context.modal === "jobCard" && !context.form.entityId) {
    return String(context.form.queryId || "");
  }
  return null;
}

function useQueryWorkspaceData(context: WorkspaceQueryContext) {
  const shouldLoad = Boolean(
    context.canFetch &&
      context.needs("queries") &&
      (context.has(P.VIEW_QUERIES) ||
        context.has(P.VIEW_CONTRACTING) ||
        context.has(P.MANAGE_JOB_CARDS))
  );
  const listArgs = context.isQueryListView
    ? {
        ...context.dateBounds,
        contractingStatus: context.listFilters.contractingStatus || undefined,
        leadStage: context.listFilters.leadStage || undefined,
        queryType: context.listFilters.queryType || undefined,
        salesStatus: context.listFilters.salesStatus || undefined,
        search: context.normalizedSearch || undefined,
      }
    : {};
  const page = usePaginatedQuery(
    api.crm.queries.listPage,
    shouldLoad && !context.querySearchPreparing ? listArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(page, JSON.stringify(listArgs));
  const focusedId = resolveFocusedQueryId(context);
  const focused = useQuery(
    api.crm.queries.getDetail,
    shouldLoad && focusedId ? { queryId: focusedId } : "skip"
  );
  const rows = shouldLoad
    ? mergeFocusedRow(page.status === "LoadingFirstPage" ? undefined : page.results, focused)
    : undefined;
  return { focused, focusedId, page, pagination, rows, shouldLoad };
}

function resolveFocusedProposalId(context: WorkspaceQueryContext) {
  if (context.deepLinkOpen === "proposal") {
    return context.deepLinkId;
  }
  if (context.modal === "proposal" && context.form.focusedDetailType === "proposal") {
    return String(context.form.entityId || "");
  }
  if (
    context.modal &&
    ["addProposalCollaborator", "removeProposalCollaborator"].includes(context.modal)
  ) {
    return String(context.form.proposalId || context.form.entityId || "");
  }
  return null;
}

function hydrateFocusedProposal(
  focused: (typeof api.crm.proposals.getDetail)["_returnType"] | undefined,
  focusedId: null | string,
  linkedQueries: (typeof api.crm.proposals.listLinkedQueriesPage)["_returnType"]["page"],
  linksStatus: CursorPaginationStatus
) {
  if (focused === undefined || focused === null) {
    return focused;
  }
  if (focusedId && linksStatus !== "Exhausted") {
    return;
  }
  return {
    ...focused,
    queries: linkedQueries,
    query: linkedQueries[0] ?? null,
    queryId: linkedQueries[0]?.id ?? null,
    queryIds: linkedQueries.map((query) => query.id),
  };
}

function resolveJobCardProposalId(
  context: WorkspaceQueryContext,
  focusedQuery: ReturnType<typeof useQueryWorkspaceData>["focused"]
) {
  if (context.modal !== "jobCard" || context.form.entityId || !context.form.queryId) {
    return null;
  }
  if (context.form.proposalId) {
    return String(context.form.proposalId);
  }
  const proposalId = focusedQuery?.confirmedOffer?.proposalId;
  return proposalId ? String(proposalId) : null;
}

function useProposalWorkspaceData(
  context: WorkspaceQueryContext,
  queryData: ReturnType<typeof useQueryWorkspaceData>
) {
  const shouldLoad = Boolean(
    context.canFetch &&
      context.needs("proposals") &&
      (context.has(P.VIEW_PROPOSALS) ||
        context.has(P.VIEW_CONTRACTING) ||
        context.has(P.MANAGE_JOB_CARDS))
  );
  const listArgs =
    context.view === "proposals"
      ? {
          ...context.dateBounds,
          search: context.normalizedSearch || undefined,
          status: context.listFilters.status || undefined,
        }
      : {};
  const page = usePaginatedQuery(
    api.crm.proposals.listPage,
    shouldLoad && !context.proposalSearchPreparing ? listArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(page, JSON.stringify(listArgs));
  const focusedId = resolveFocusedProposalId(context);
  const focused = useQuery(
    api.crm.proposals.getDetail,
    shouldLoad && focusedId ? { proposalId: focusedId } : "skip"
  );
  const linksPage = usePaginatedQuery(
    api.crm.proposals.listLinkedQueriesPage,
    shouldLoad && focusedId ? { proposalId: focusedId } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const { loadMore, results: linkedQueries, status: linksStatus } = linksPage;
  useEffect(() => {
    if (focusedId && linksStatus === "CanLoadMore") {
      loadMore(PAGE_SIZE);
    }
  }, [focusedId, linksStatus, loadMore]);
  const hydratedFocused = hydrateFocusedProposal(focused, focusedId, linkedQueries, linksStatus);
  const jobCardProposalId = resolveJobCardProposalId(context, queryData.focused);
  const jobCardProposal = useQuery(
    api.crm.proposals.getDetail,
    shouldLoad && jobCardProposalId ? { proposalId: jobCardProposalId } : "skip"
  );
  const rows = shouldLoad
    ? mergeFocusedRow(
        mergeFocusedRow(
          page.status === "LoadingFirstPage" ? undefined : page.results,
          hydratedFocused
        ),
        jobCardProposal
      )
    : undefined;
  return {
    focusedId,
    hydratedFocused,
    jobCardProposal,
    jobCardProposalId,
    linkedQueries,
    linksStatus,
    page,
    pagination,
    rows,
    shouldLoad,
  };
}

function resolveFocusedJobCardId(context: WorkspaceQueryContext) {
  if (context.deepLinkOpen === "jobCard") {
    return context.deepLinkId;
  }
  if (context.modal === "jobCard" && context.form.focusedDetailType === "jobCard") {
    return String(context.form.entityId || "");
  }
  if (
    context.modal &&
    ["addJobCardCollaborator", "removeJobCardCollaborator"].includes(context.modal)
  ) {
    return String(context.form.jobCardId || context.form.entityId || "");
  }
  return null;
}

function focusedJobCardArguments(context: WorkspaceQueryContext, focusedId: null | string) {
  const args: FocusedJobCardArgs = {};
  if (focusedId) {
    args.jobCardId = focusedId;
  }
  if (context.deepLinkOpen === "jobCard" && context.deepLinkQueryId) {
    args.queryId = context.deepLinkQueryId;
  }
  return args;
}

function useJobCardWorkspaceData(context: WorkspaceQueryContext) {
  const shouldLoad = Boolean(
    context.canFetch && context.needs("jobCards") && context.has(P.VIEW_JOB_CARDS)
  );
  const shouldLoadDeletionOperations = Boolean(
    context.canFetch &&
      context.needs("jobCardDeletionOperations") &&
      context.has(P.MANAGE_JOB_CARDS)
  );
  const deletionOperations = useQuery(
    api.crm.jobCards.listMyDeletionOperations,
    shouldLoadDeletionOperations ? { referenceNow: context.operationReferenceNow } : "skip"
  );
  const listArgs =
    context.view === "job-cards"
      ? {
          ...context.dateBounds,
          queryType: context.listFilters.queryType || undefined,
          search: context.normalizedSearch || undefined,
          status: context.listFilters.status || undefined,
        }
      : {};
  const page = usePaginatedQuery(
    api.crm.jobCards.listPage,
    shouldLoad && !context.jobCardSearchPreparing ? listArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(page, JSON.stringify(listArgs));
  const focusedId = resolveFocusedJobCardId(context);
  const focusedArgs = focusedJobCardArguments(context, focusedId);
  const hasFocusedTarget = Boolean(
    (context.deepLinkOpen === "jobCard" && context.deepLinkQueryId) || focusedId
  );
  const focused = useQuery(
    api.crm.jobCards.getDetail,
    shouldLoad && hasFocusedTarget ? focusedArgs : "skip"
  );
  const rows = shouldLoad
    ? mergeFocusedRow(page.status === "LoadingFirstPage" ? undefined : page.results, focused)
    : undefined;
  return {
    deletionOperations,
    focused,
    focusedId,
    page,
    pagination,
    rows,
    shouldLoad,
    shouldLoadDeletionOperations,
  };
}

function travellerListArguments(context: WorkspaceQueryContext) {
  const isTravellerView = ["hotels", "passport", "travellers"].includes(context.view);
  return {
    ...propertiesWhen(isTravellerView, () => context.dateBounds),
    callingStatus:
      context.view === "travellers" ? context.listFilters.callingStatus || undefined : undefined,
    jobCardId: context.jobCardFilter || undefined,
    passportExpiryUrgency:
      context.view === "passport"
        ? matchingOption(context.listFilters.passportExpiryUrgency, PASSPORT_EXPIRY_URGENCIES)
        : undefined,
    passportReferenceDate:
      context.view === "passport" && context.listFilters.passportExpiryUrgency
        ? context.referenceDate
        : undefined,
    passportStatus:
      context.view === "passport" ? context.listFilters.passportStatus || undefined : undefined,
    roomType:
      context.view === "hotels"
        ? matchingOption(context.listFilters.roomType, ROOM_TYPES)
        : undefined,
    search: isTravellerView ? context.normalizedSearch || undefined : undefined,
    ticketStatus:
      context.view === "travellers" ? context.listFilters.ticketStatus || undefined : undefined,
    visaStatus:
      context.view === "travellers" ? context.listFilters.visaStatus || undefined : undefined,
  };
}

function useTravellerWorkspaceData(
  context: WorkspaceQueryContext,
  jobCardData: ReturnType<typeof useJobCardWorkspaceData>
) {
  const shouldLoad = Boolean(
    context.canFetch && context.needs("travellers") && context.has(P.VIEW_TRAVELLERS)
  );
  const listArgs = travellerListArguments(context);
  const page = usePaginatedQuery(
    api.crm.travellers.listPage,
    shouldLoad && !context.travellerSearchPreparing ? listArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    page,
    JSON.stringify({
      dateBounds: context.dateBounds,
      jobCardFilter: context.jobCardFilter,
      listFilters: context.listFilters,
      search: context.search,
      view: context.view,
    })
  );
  const shouldLoadFocused = Boolean(
    shouldLoad && context.deepLinkOpen === "traveller" && context.deepLinkId
  );
  const focused = useQuery(
    api.crm.travellers.getListRow,
    shouldLoadFocused ? { travellerId: context.deepLinkId ?? "" } : "skip"
  );
  const rows = shouldLoad
    ? mergeFocusedRow(page.status === "LoadingFirstPage" ? undefined : page.results, focused)
    : undefined;
  const roomCountSummary = useQuery(
    api.crm.travellers.getRoomCountSummary,
    shouldLoad && context.view === "hotels"
      ? {
          dateRange: context.dateRangeArg,
          jobCardId: context.jobCardFilter || undefined,
          jobCardPageComplete:
            jobCardData.pagination.status === "Exhausted" && (jobCardData.rows?.length ?? 0) <= 100,
          visibleJobCardIds: (jobCardData.rows || []).slice(0, 100).map((jobCard) => jobCard.id),
        }
      : "skip"
  );
  return { focused, page, pagination, roomCountSummary, rows, shouldLoad };
}

function useVisaWorkspaceData(context: WorkspaceQueryContext) {
  const shouldLoad = Boolean(
    context.canFetch && context.needs("visas") && context.has(P.VIEW_VISA)
  );
  const page = usePaginatedQuery(
    api.crm.visa.list,
    shouldLoad
      ? {
          jobCardId: context.jobCardFilter || undefined,
          status:
            context.view === "visa"
              ? matchingOption(context.listFilters.status, VISA_STATUSES)
              : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    page,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      status: context.listFilters.status,
      view: context.view,
    })
  );
  const rows = page.status === "LoadingFirstPage" ? undefined : page.results;
  return { page, pagination, rows, shouldLoad };
}

function ticketingArguments<Arguments>(
  context: WorkspaceQueryContext,
  dependency: PortalDataDependency,
  args: Arguments
) {
  if (!(context.canFetch && context.needs(dependency) && context.has(P.VIEW_TICKETING))) {
    return "skip" as const;
  }
  return args;
}

function focusedTicketArguments(context: WorkspaceQueryContext) {
  if (!(context.canFetch && context.deepLinkOpen === "ticket" && context.deepLinkId)) {
    return "skip" as const;
  }
  return { ticketId: context.deepLinkId };
}

function useTicketWorkspaceData(context: WorkspaceQueryContext) {
  const dashboard = useQuery(
    api.crm.ticketing.dashboard,
    ticketingArguments(context, "ticketDashboard", {
      dateRange: context.dateRangeArg,
      referenceNow: context.navigationReferenceNow,
    })
  );
  const pnrPage = usePaginatedQuery(
    api.crm.ticketing.listPnrs,
    ticketingArguments(context, "pnrs", {
      jobCardId: context.jobCardFilter || undefined,
      status: context.view === "flights" ? context.listFilters.status || undefined : undefined,
    }),
    { initialNumItems: PAGE_SIZE }
  );
  const pnrPagination = usePaginationControl(
    pnrPage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      status: context.listFilters.status,
      view: context.view,
    })
  );
  const ticketPage = usePaginatedQuery(
    api.crm.ticketing.listTickets,
    ticketingArguments(context, "tickets", {
      jobCardId: context.jobCardFilter || undefined,
      ticketStatus:
        context.view === "tickets" ? context.listFilters.ticketStatus || undefined : undefined,
    }),
    { initialNumItems: PAGE_SIZE }
  );
  const ticketPagination = usePaginationControl(
    ticketPage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      ticketStatus: context.listFilters.ticketStatus,
      view: context.view,
    })
  );
  const focusedTicket = useQuery(
    api.crm.ticketing.getTicketListRow,
    focusedTicketArguments(context)
  );
  const seatPage = usePaginatedQuery(
    api.crm.ticketing.listSeatAllocations,
    ticketingArguments(context, "seats", {
      jobCardId: context.jobCardFilter || undefined,
      status:
        context.view === "seat-allocation" ? context.listFilters.status || undefined : undefined,
    }),
    { initialNumItems: PAGE_SIZE }
  );
  const seatPagination = usePaginationControl(
    seatPage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      status: context.listFilters.status,
      view: context.view,
    })
  );
  return {
    dashboard,
    focusedTicket,
    pnrPage,
    pnrPagination,
    pnrs: pnrPage.status === "LoadingFirstPage" ? undefined : pnrPage.results,
    seatPage,
    seatPagination,
    seats: seatPage.status === "LoadingFirstPage" ? undefined : seatPage.results,
    ticketPage,
    ticketPagination,
    tickets: mergeFocusedRow(
      ticketPage.status === "LoadingFirstPage" ? undefined : ticketPage.results,
      focusedTicket
    ),
  };
}

function useTravelOperationsWorkspaceData(context: WorkspaceQueryContext) {
  const flightItineraryPage = usePaginatedQuery(
    api.crm.imports.listFlightItinerary,
    context.canFetch && context.needs("flightItinerary") && context.has(P.VIEW_TICKETING)
      ? {
          // SAFETY: jobCardFilter can only be selected from IDs returned by the jobCards query.
          jobCardId: (context.jobCardFilter || undefined) as Id<"jobCards"> | undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const flightItineraryPagination = usePaginationControl(
    flightItineraryPage,
    context.jobCardFilter
  );
  const hotelPage = usePaginatedQuery(
    api.crm.ops.listHotels,
    context.canFetch && context.needs("hotels") && context.has(P.VIEW_OPERATIONS)
      ? { jobCardId: context.jobCardFilter || undefined }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const hotelPagination = usePaginationControl(hotelPage, context.jobCardFilter);
  const tourManagerPage = usePaginatedQuery(
    api.crm.ops.listTourManagers,
    context.canFetch && context.needs("tourManagers") && context.has(P.VIEW_TOUR_MANAGERS)
      ? {
          callingStatus: context.listFilters.callingStatus || undefined,
          jobCardId: context.jobCardFilter || undefined,
          status: matchingOption(context.listFilters.status, LEAVE_STATUSES),
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const tourManagerPagination = usePaginationControl(
    tourManagerPage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      listFilters: context.listFilters,
      view: context.view,
    })
  );
  return {
    flightItinerary:
      flightItineraryPage.status === "LoadingFirstPage" ? undefined : flightItineraryPage.results,
    flightItineraryPage,
    flightItineraryPagination,
    hotelPage,
    hotelPagination,
    hotels: hotelPage.status === "LoadingFirstPage" ? undefined : hotelPage.results,
    tourManagerPage,
    tourManagerPagination,
    tourManagers:
      tourManagerPage.status === "LoadingFirstPage" ? undefined : tourManagerPage.results,
  };
}

function resolveFocusedExpenseId(
  context: WorkspaceQueryContext,
  focusedApproval: (typeof api.crm.approvals.getListRow)["_returnType"] | undefined
) {
  if (focusedApproval?.entityType === "expense") {
    return focusedApproval.entityId;
  }
  if (context.deepLinkOpen === "expense") {
    return context.deepLinkId;
  }
  return null;
}

function useInvoiceExpenseWorkspaceData(context: WorkspaceQueryContext) {
  const invoicePage = usePaginatedQuery(
    api.crm.finance.listInvoices,
    context.canFetch && context.needs("invoices") && context.has(P.VIEW_FINANCE)
      ? {
          jobCardId: context.jobCardFilter || undefined,
          status: context.view === "finance" ? context.listFilters.status || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const invoicePagination = usePaginationControl(
    invoicePage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      status: context.listFilters.status,
      view: context.view,
    })
  );
  const expensePage = usePaginatedQuery(
    api.crm.finance.listExpenses,
    context.canFetch &&
      context.needs("expenses") &&
      (context.has(P.VIEW_EXPENSES) || context.deepLinkOpen === "approval")
      ? {
          approvalStatus: context.listFilters.approvalStatus || undefined,
          category: context.listFilters.category || undefined,
          jobCardId: context.jobCardFilter || undefined,
          reimbursementStatus: context.listFilters.reimbursementStatus || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const expensePagination = usePaginationControl(
    expensePage,
    JSON.stringify({
      jobCardFilter: context.jobCardFilter,
      listFilters: context.listFilters,
      view: context.view,
    })
  );
  const focusedApproval = useQuery(
    api.crm.approvals.getListRow,
    context.canFetch && context.deepLinkOpen === "approval" && context.deepLinkId
      ? { approvalId: context.deepLinkId }
      : "skip"
  );
  const focusedExpenseId = resolveFocusedExpenseId(context, focusedApproval);
  const focusedExpense = useQuery(
    api.crm.finance.getExpenseListRow,
    focusedExpenseId ? { expenseId: focusedExpenseId } : "skip"
  );
  return {
    expensePage,
    expensePagination,
    expenses: mergeFocusedRow(
      expensePage.status === "LoadingFirstPage" ? undefined : expensePage.results,
      focusedExpense
    ),
    focusedApproval,
    invoicePage,
    invoicePagination,
    invoices: invoicePage.status === "LoadingFirstPage" ? undefined : invoicePage.results,
  };
}

function useFinanceOverviewWorkspaceData(context: WorkspaceQueryContext) {
  const summary = useQuery(
    api.crm.finance.getFinanceOverview,
    context.canFetch && context.has(P.VIEW_FINANCE) && context.needs("financeOverview")
      ? { dateRange: context.dateRangeArg }
      : "skip"
  );
  const detailsReady = Boolean(summary?.aggregateCoverage.complete);
  const shouldLoadDetails = Boolean(
    context.canFetch &&
      context.has(P.VIEW_FINANCE) &&
      context.needs("financeOverview") &&
      detailsReady
  );
  const pnlPage = usePaginatedQuery(
    api.crm.finance.listFinancePnl,
    shouldLoadDetails ? { dateRange: context.dateRangeArg } : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pnlPagination = usePaginationControl(
    pnlPage,
    JSON.stringify({ dateRangeArg: context.dateRangeArg, detail: "pnl", view: context.view })
  );
  const outstandingPage = usePaginatedQuery(
    api.crm.finance.listFinanceOutstanding,
    shouldLoadDetails
      ? { dateRange: context.dateRangeArg, referenceDate: context.referenceDate }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const outstandingPagination = usePaginationControl(
    outstandingPage,
    JSON.stringify({
      dateRangeArg: context.dateRangeArg,
      detail: "outstanding",
      view: context.view,
    })
  );
  const overview = summary
    ? {
        ...summary,
        outstanding:
          outstandingPage.status === "LoadingFirstPage" ? undefined : outstandingPage.results,
        outstandingPagination,
        pnl: pnlPage.status === "LoadingFirstPage" ? undefined : pnlPage.results,
        pnlPagination,
      }
    : undefined;
  return { detailsReady, outstandingPage, overview, pnlPage, summary };
}

function useApprovalReportWorkspaceData(
  context: WorkspaceQueryContext,
  focusedApproval: ReturnType<typeof useInvoiceExpenseWorkspaceData>["focusedApproval"]
) {
  const page = usePaginatedQuery(
    api.crm.approvals.list,
    context.canFetch && context.needs("approvals") && context.has(P.VIEW_APPROVALS)
      ? {
          status: context.listFilters.status || undefined,
          type: context.listFilters.type || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    page,
    JSON.stringify({ listFilters: context.listFilters, view: context.view })
  );
  const reports = useQuery(
    api.crm.reports.overview,
    context.canFetch && context.has(P.VIEW_REPORTS) && context.needs("reports")
      ? { dateRange: context.dateRangeArg }
      : "skip"
  );
  return {
    approvals: mergeFocusedRow(
      page.status === "LoadingFirstPage" ? undefined : page.results,
      focusedApproval
    ),
    page,
    pagination,
    reports,
  };
}

function useTeamWorkspaceData(context: WorkspaceQueryContext) {
  const directoryPage = usePaginatedQuery(
    api.crm.staff.listDirectory,
    context.canFetch && context.needs("team") && context.has(P.VIEW_TEAM)
      ? { department: context.listFilters.department || undefined }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    directoryPage,
    JSON.stringify({ department: context.listFilters.department, view: context.view })
  );
  const directory = directoryPage.status === "LoadingFirstPage" ? undefined : directoryPage.results;
  const picker = useQuery(
    api.crm.staff.listTeamOptions,
    context.canFetch &&
      context.needs("team") &&
      !context.has(P.VIEW_TEAM) &&
      canUseTeamPicker(context.access)
      ? {}
      : "skip"
  );
  return { directoryPage, pagination, picker, team: directory ?? picker ?? [] };
}

function useActivityWorkspaceData(context: WorkspaceQueryContext) {
  const page = usePaginatedQuery(
    api.crm.activity.listActivity,
    context.canFetch && context.needs("activity") && context.has(P.VIEW_ACTIVITY)
      ? {
          action: context.listFilters.action || undefined,
          entityType: context.listFilters.entityType || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    page,
    JSON.stringify({ listFilters: context.listFilters, view: context.view })
  );
  const emailDeliverySummaries = useQuery(
    api.crm.notificationEmailLedger.listDeliverySummary,
    context.canFetch && context.needs("activity") && context.has(P.VIEW_EMAIL_DELIVERY_STATUS)
      ? { limit: 25 }
      : "skip"
  );
  return {
    activity: page.status === "LoadingFirstPage" ? undefined : page.results,
    emailDeliverySummaries,
    page,
    pagination,
  };
}

function usePassengerOperationWorkspaceData(context: WorkspaceQueryContext) {
  const importOperations = useQuery(
    api.crm.imports.listMyPassengerImportOperations,
    context.passengerImportModalActive ? { referenceNow: context.operationReferenceNow } : "skip"
  );
  const exportOperations = useQuery(
    api.crm.imports.listMyPassengerExportOperations,
    context.passengerExportModalActive ? { referenceNow: context.operationReferenceNow } : "skip"
  );
  return { exportOperations, importOperations };
}

function leaveBalanceArguments(context: WorkspaceQueryContext) {
  if (!(context.canFetch && context.needs("leaves") && context.has(P.VIEW_LEAVE))) {
    return null;
  }
  return {
    referenceDate: context.referenceDate,
    ...propertiesWhen(
      context.has(P.MANAGE_LEAVE) && context.modal === "leave_create" && context.form.staffId,
      () => ({ staffId: context.form.staffId })
    ),
    ...propertiesWhen(context.modal === "leave_create" && context.form.startDate, () => ({
      fiscalYear: fiscalYearForDate(context.form.startDate),
    })),
  };
}

function useLeaveWorkspaceData(context: WorkspaceQueryContext) {
  const page = usePaginatedQuery(
    api.crm.leave.list,
    context.canFetch && context.needs("leaves") && context.has(P.VIEW_LEAVE)
      ? {
          staffId: context.listFilters.staffId || undefined,
          status: matchingOption(context.listFilters.status, LEAVE_STATUSES),
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pagination = usePaginationControl(
    page,
    JSON.stringify({ listFilters: context.listFilters, view: context.view })
  );
  const balances = useQuery(api.crm.leave.balances, leaveBalanceArguments(context) ?? "skip");
  return {
    balances,
    leaves: page.status === "LoadingFirstPage" ? undefined : page.results,
    page,
    pagination,
  };
}

function useStaffSupportWorkspaceData(context: WorkspaceQueryContext) {
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    context.canFetch && context.needs("activity") && context.has(P.VIEW_ACTIVITY)
      ? { limit: 80 }
      : "skip"
  );
  const dropdowns = useQuery(
    api.crm.settings.listDropdowns,
    context.canFetch && context.needs("dropdowns") && context.has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const staffPage = usePaginatedQuery(
    api.crm.staff.listStaff,
    context.canFetch && context.needs("staff") && context.has(P.MANAGE_STAFF)
      ? {
          active: parseOptionalBoolean(context.listFilters.active),
          department: context.listFilters.department || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const staffPagination = usePaginationControl(
    staffPage,
    JSON.stringify({ listFilters: context.listFilters, view: context.view })
  );
  const accountsJobCardCreators = useQuery(
    api.crm.staff.listAccountsForJobCards,
    context.canFetch && context.needs("accountsJobCardCreators") && context.has(P.MANAGE_JOB_CARDS)
      ? {}
      : "skip"
  );
  const leaveHeadApproverCandidates = useQuery(
    api.crm.leaveApprovers.listHeadApproverCandidates,
    context.canFetch && context.needs("leaveHeadApproverCandidates") && context.has(P.MANAGE_STAFF)
      ? {}
      : "skip"
  );
  const travellersWithoutVisa = useQuery(
    api.crm.visa.listTravellersWithoutVisa,
    context.canFetch && context.has(P.VIEW_VISA) && context.needs("travellersWithoutVisa")
      ? {}
      : "skip"
  );
  return {
    accountsJobCardCreators,
    dropdowns,
    leaveHeadApproverCandidates,
    notifications,
    staff: staffPage.status === "LoadingFirstPage" ? undefined : staffPage.results,
    staffPage,
    staffPagination,
    travellersWithoutVisa,
  };
}

function commercialPerformanceSubscriptions(
  context: WorkspaceQueryContext,
  queryData: ReturnType<typeof useQueryWorkspaceData>,
  proposalData: ReturnType<typeof useProposalWorkspaceData>
): PortalPerformanceSubscription[] {
  return [
    {
      active: context.shouldLoadSearchReadiness,
      name: "crm.listSearch.getReadiness",
      payload: context.searchReadiness,
      ready: context.searchReadiness !== undefined,
    },
    {
      active: queryData.shouldLoad && !context.querySearchPreparing,
      name: "crm.queries.listPage",
      payload: queryData.page.results,
      ready: queryData.page.status !== "LoadingFirstPage",
    },
    {
      active: queryData.shouldLoad && Boolean(queryData.focusedId),
      name: "crm.queries.getDetail",
      payload: queryData.focused,
      ready: queryData.focused !== undefined,
    },
    {
      active: proposalData.shouldLoad && !context.proposalSearchPreparing,
      name: "crm.proposals.listPage",
      payload: proposalData.page.results,
      ready: proposalData.page.status !== "LoadingFirstPage",
    },
    {
      active: proposalData.shouldLoad && Boolean(proposalData.focusedId),
      name: "crm.proposals.getDetail",
      payload: proposalData.hydratedFocused,
      ready: proposalData.hydratedFocused !== undefined,
    },
    {
      active: proposalData.shouldLoad && Boolean(proposalData.focusedId),
      name: "crm.proposals.listLinkedQueriesPage",
      payload: proposalData.linkedQueries,
      ready: proposalData.linksStatus === "Exhausted",
    },
    {
      active: proposalData.shouldLoad && Boolean(proposalData.jobCardProposalId),
      name: "crm.proposals.getDetail",
      payload: proposalData.jobCardProposal,
      ready: proposalData.jobCardProposal !== undefined,
    },
  ];
}

function travellerPerformanceSubscriptions(
  context: WorkspaceQueryContext,
  jobCardData: ReturnType<typeof useJobCardWorkspaceData>,
  travellerData: ReturnType<typeof useTravellerWorkspaceData>,
  visaData: ReturnType<typeof useVisaWorkspaceData>
): PortalPerformanceSubscription[] {
  return [
    {
      active: jobCardData.shouldLoad && !context.jobCardSearchPreparing,
      name: "crm.jobCards.listPage",
      payload: jobCardData.page.results,
      ready: jobCardData.page.status !== "LoadingFirstPage",
    },
    {
      active: jobCardData.shouldLoad && Boolean(jobCardData.focusedId),
      name: "crm.jobCards.getDetail",
      payload: jobCardData.focused,
      ready: jobCardData.focused !== undefined,
    },
    {
      active: jobCardData.shouldLoadDeletionOperations,
      name: "crm.jobCards.listMyDeletionOperations",
      payload: jobCardData.deletionOperations,
      ready: jobCardData.deletionOperations !== undefined,
    },
    {
      active: travellerData.shouldLoad && !context.travellerSearchPreparing,
      name: "crm.travellers.listPage",
      payload: travellerData.page.results,
      ready: travellerData.page.status !== "LoadingFirstPage",
    },
    {
      active: travellerData.shouldLoad && context.view === "hotels",
      name: "crm.travellers.getRoomCountSummary",
      payload: travellerData.roomCountSummary,
      ready: travellerData.roomCountSummary !== undefined,
    },
    {
      active: visaData.shouldLoad,
      name: "crm.visa.list",
      payload: visaData.page.results,
      ready: visaData.page.status !== "LoadingFirstPage",
    },
  ];
}

function operationsPerformanceSubscriptions(
  context: WorkspaceQueryContext,
  ticketData: ReturnType<typeof useTicketWorkspaceData>,
  travelOperationsData: ReturnType<typeof useTravelOperationsWorkspaceData>
): PortalPerformanceSubscription[] {
  return [
    {
      active: Boolean(
        context.canFetch && context.needs("tickets") && context.has(P.VIEW_TICKETING)
      ),
      name: "crm.ticketing.listTickets",
      payload: ticketData.ticketPage.results,
      ready: ticketData.ticketPage.status !== "LoadingFirstPage",
    },
    {
      active: Boolean(context.canFetch && context.deepLinkOpen === "ticket" && context.deepLinkId),
      name: "crm.ticketing.getTicketListRow",
      payload: ticketData.focusedTicket,
      ready: ticketData.focusedTicket !== undefined,
    },
    {
      active: Boolean(
        context.canFetch && context.needs("hotels") && context.has(P.VIEW_OPERATIONS)
      ),
      name: "crm.ops.listHotels",
      payload: travelOperationsData.hotelPage.results,
      ready: travelOperationsData.hotelPage.status !== "LoadingFirstPage",
    },
  ];
}

function financePerformanceSubscriptions(
  context: WorkspaceQueryContext,
  invoiceExpenseData: ReturnType<typeof useInvoiceExpenseWorkspaceData>,
  financeData: ReturnType<typeof useFinanceOverviewWorkspaceData>
): PortalPerformanceSubscription[] {
  const financeActive = Boolean(
    context.canFetch && context.has(P.VIEW_FINANCE) && context.needs("financeOverview")
  );
  const financeDetailsActive = financeActive && financeData.detailsReady;
  return [
    {
      active: Boolean(context.canFetch && context.needs("invoices") && context.has(P.VIEW_FINANCE)),
      name: "crm.finance.listInvoices",
      payload: invoiceExpenseData.invoicePage.results,
      ready: invoiceExpenseData.invoicePage.status !== "LoadingFirstPage",
    },
    {
      active: financeActive,
      name: "crm.finance.getFinanceOverview",
      payload: financeData.summary,
      ready: financeData.summary !== undefined,
    },
    {
      active: financeDetailsActive,
      name: "crm.finance.listFinancePnl",
      payload: financeData.pnlPage.results,
      ready: financeData.pnlPage.status !== "LoadingFirstPage",
    },
    {
      active: financeDetailsActive,
      name: "crm.finance.listFinanceOutstanding",
      payload: financeData.outstandingPage.results,
      ready: financeData.outstandingPage.status !== "LoadingFirstPage",
    },
  ];
}

function teamPerformanceSubscriptions(
  context: WorkspaceQueryContext,
  teamData: ReturnType<typeof useTeamWorkspaceData>,
  staffSupportData: ReturnType<typeof useStaffSupportWorkspaceData>
): PortalPerformanceSubscription[] {
  return [
    {
      active: Boolean(context.canFetch && context.needs("team") && context.has(P.VIEW_TEAM)),
      name: "crm.staff.listDirectory",
      payload: teamData.directoryPage.results,
      ready: teamData.directoryPage.status !== "LoadingFirstPage",
    },
    {
      active: Boolean(
        context.canFetch &&
          context.needs("team") &&
          !context.has(P.VIEW_TEAM) &&
          canUseTeamPicker(context.access)
      ),
      name: "crm.staff.listTeamOptions",
      payload: teamData.picker,
      ready: teamData.picker !== undefined,
    },
    {
      active: Boolean(
        context.canFetch && context.has(P.VIEW_VISA) && context.needs("travellersWithoutVisa")
      ),
      name: "crm.visa.listTravellersWithoutVisa",
      payload: staffSupportData.travellersWithoutVisa,
      ready: staffSupportData.travellersWithoutVisa !== undefined,
    },
  ];
}

function usePortalWorkspacePerformance(
  context: WorkspaceQueryContext,
  data: {
    finance: ReturnType<typeof useFinanceOverviewWorkspaceData>;
    invoiceExpense: ReturnType<typeof useInvoiceExpenseWorkspaceData>;
    jobCard: ReturnType<typeof useJobCardWorkspaceData>;
    proposal: ReturnType<typeof useProposalWorkspaceData>;
    query: ReturnType<typeof useQueryWorkspaceData>;
    staffSupport: ReturnType<typeof useStaffSupportWorkspaceData>;
    team: ReturnType<typeof useTeamWorkspaceData>;
    ticket: ReturnType<typeof useTicketWorkspaceData>;
    travelOperations: ReturnType<typeof useTravelOperationsWorkspaceData>;
    traveller: ReturnType<typeof useTravellerWorkspaceData>;
    visa: ReturnType<typeof useVisaWorkspaceData>;
  }
) {
  const target: PortalPerformanceTarget | null =
    PORTAL_PERFORMANCE_TARGETS.find((candidate) => candidate === context.view) ?? null;
  const subscriptions = [
    ...commercialPerformanceSubscriptions(context, data.query, data.proposal),
    ...travellerPerformanceSubscriptions(context, data.jobCard, data.traveller, data.visa),
    ...operationsPerformanceSubscriptions(context, data.ticket, data.travelOperations),
    ...financePerformanceSubscriptions(context, data.invoiceExpense, data.finance),
    ...teamPerformanceSubscriptions(context, data.team, data.staffSupport),
  ];
  const workload = target ? measurePortalNavigationWorkload(subscriptions) : null;
  useEffect(() => {
    if (!(target && workload) || context.portalSubscriptionSummary.logicalSubscriptions === 0) {
      return;
    }
    recordPortalNavigationWorkload({
      applicationPayloadBytes: workload.applicationPayloadBytes,
      duplicateSubscriptions: context.portalSubscriptionSummary.duplicateSubscriptions,
      logicalSubscriptions: context.portalSubscriptionSummary.logicalSubscriptions,
      subscriptions: [...context.portalSubscriptionSummary.subscriptions],
      target,
    });
  }, [context.portalSubscriptionSummary, target, workload]);
}

export function usePortalWorkspaceData(input: UsePortalWorkspaceDataInput) {
  const context = { ...input, ...useWorkspaceRuntimeState(input) };
  const queryData = useQueryWorkspaceData(context);
  const { focused: focusedQuery, pagination: queryPagination, rows: queries } = queryData;
  const proposalData = useProposalWorkspaceData(context, queryData);
  const {
    hydratedFocused: hydratedFocusedProposal,
    pagination: proposalPagination,
    rows: proposals,
  } = proposalData;
  const jobCardData = useJobCardWorkspaceData(context);
  const {
    deletionOperations: jobCardDeletionOperations,
    focused: focusedJobCard,
    pagination: jobCardPagination,
    rows: jobCards,
  } = jobCardData;
  const travellerData = useTravellerWorkspaceData(context, jobCardData);
  const { pagination: travellerPagination, roomCountSummary, rows: travellers } = travellerData;
  const visaData = useVisaWorkspaceData(context);
  const { pagination: visaPagination, rows: visas } = visaData;
  const ticketData = useTicketWorkspaceData(context);
  const {
    dashboard: ticketDashboard,
    pnrPagination,
    pnrs,
    seatPagination,
    seats,
    ticketPagination,
    tickets,
  } = ticketData;
  const travelOperationsData = useTravelOperationsWorkspaceData(context);
  const {
    flightItinerary,
    flightItineraryPagination,
    hotelPagination,
    hotels,
    tourManagerPagination,
    tourManagers,
  } = travelOperationsData;
  const flightOperationsPagination = combinePaginationControls(
    pnrPagination,
    flightItineraryPagination
  );
  const hotelOperationsPagination = combinePaginationControls(hotelPagination, travellerPagination);
  const invoiceExpenseData = useInvoiceExpenseWorkspaceData(context);
  const { expensePagination, expenses, focusedApproval, invoicePagination, invoices } =
    invoiceExpenseData;
  const financeOverviewData = useFinanceOverviewWorkspaceData(context);
  const { overview: financeOverview } = financeOverviewData;
  const approvalReportData = useApprovalReportWorkspaceData(context, focusedApproval);
  const { approvals, pagination: approvalPagination, reports } = approvalReportData;
  const teamData = useTeamWorkspaceData(context);
  const { pagination: teamPagination, team } = teamData;
  const activityData = useActivityWorkspaceData(context);
  const { activity, emailDeliverySummaries, pagination: activityPagination } = activityData;
  const passengerOperationData = usePassengerOperationWorkspaceData(context);
  const {
    exportOperations: passengerExportOperations,
    importOperations: passengerImportOperations,
  } = passengerOperationData;
  const leaveData = useLeaveWorkspaceData(context);
  const { balances: leaveBalances, leaves, pagination: leavePagination } = leaveData;
  const staffSupportData = useStaffSupportWorkspaceData(context);
  const {
    accountsJobCardCreators,
    dropdowns,
    leaveHeadApproverCandidates,
    notifications,
    staff,
    staffPagination,
    travellersWithoutVisa,
  } = staffSupportData;
  usePortalWorkspacePerformance(context, {
    finance: financeOverviewData,
    invoiceExpense: invoiceExpenseData,
    jobCard: jobCardData,
    proposal: proposalData,
    query: queryData,
    staffSupport: staffSupportData,
    team: teamData,
    ticket: ticketData,
    traveller: travellerData,
    travelOperations: travelOperationsData,
    visa: visaData,
  });

  return {
    accountsJobCardCreators,
    activity,
    approvals,
    dropdowns,
    emailDeliverySummaries,
    expenses,
    financeOverview,
    flightItinerary,
    focusedJobCard,
    focusedProposal: hydratedFocusedProposal,
    focusedQuery,
    hotels,
    invoices,
    jobCardDeletionOperations,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    notifications,
    pagination: {
      activity: activityPagination,
      approvals: approvalPagination,
      expenses: expensePagination,
      flightItinerary: flightItineraryPagination,
      flightOperations: flightOperationsPagination,
      hotelOperations: hotelOperationsPagination,
      hotels: hotelPagination,
      invoices: invoicePagination,
      jobCards: jobCardPagination,
      leaves: leavePagination,
      pnrs: pnrPagination,
      proposals: proposalPagination,
      queries: queryPagination,
      seats: seatPagination,
      staff: staffPagination,
      team: teamPagination,
      tickets: ticketPagination,
      tourManagers: tourManagerPagination,
      travellers: travellerPagination,
      visas: visaPagination,
    },
    passengerExportOperations,
    passengerImportOperations,
    pnrs,
    proposals,
    queries,
    reports,
    roomCountSummary,
    searchPreparing: context.searchPreparing,
    seats,
    staff,
    team,
    ticketDashboard,
    tickets,
    tourManagers,
    travellers,
    travellersWithoutVisa,
    visas,
  };
}
