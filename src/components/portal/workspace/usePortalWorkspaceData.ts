import { api } from "@convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import {
  type CursorPaginationStatus,
  shouldContinueCursorPage,
} from "@/lib/portal/cursorPagination";
import { fiscalYearForDate } from "@/lib/portal/leavePolicy";
import { resolveLinkedProposalForQuery } from "@/lib/portal/modalLifecycle";
import { mergeFocusedRow } from "@/lib/portal/paginatedRows";
import { endOfDateOnly, parseDateOnly } from "@/lib/portal/periodFilter";
import { canUseTeamPicker } from "@/lib/portal/permissions";
import { getPortalDataDependencies } from "@/lib/portal/portalDataDependencies";
import type { AnyRecord, ListFiltersState } from "./workspaceStateTypes";

const P = PORTAL_PERMISSIONS;

interface UsePortalWorkspaceDataInput {
  access: AnyRecord | null | undefined;
  canFetch: boolean | undefined;
  dateRangeArg: { from?: string; to?: string } | undefined;
  deepLinkId: null | string;
  deepLinkOpen: null | string;
  deepLinkQueryId: null | string;
  form: AnyRecord;
  has: (permission: string) => boolean;
  jobCardFilter: string;
  listFilters: ListFiltersState;
  modal: null | string;
  search: string;
  view: string;
}

const PAGE_SIZE = 50;
const MAX_AUTOMATIC_CURSOR_LOADS = 2;

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

function combinePaginationControls(...controls: Array<ReturnType<typeof usePaginationControl>>) {
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

export function usePortalWorkspaceData({
  access,
  canFetch,
  dateRangeArg,
  deepLinkId,
  deepLinkOpen,
  deepLinkQueryId,
  form,
  has,
  jobCardFilter,
  listFilters,
  modal,
  search,
  view,
}: UsePortalWorkspaceDataInput) {
  const dependencies = getPortalDataDependencies({ deepLinkOpen, modal, view });
  const needs = (dependency: Parameters<typeof dependencies.has>[0]) =>
    dependencies.has(dependency);
  const normalizedSearch = search.trim();
  const [referenceNow] = useState(() => Date.now());
  const searchReadiness = useQuery(
    api.crm.listSearch.getReadiness,
    canFetch ? { referenceNow } : "skip"
  );
  const isQueryListView = ["accounts-job-cards", "contracting", "pipeline", "queries"].includes(
    view
  );
  const isJobCardSearchView = view === "job-cards";
  const isProposalSearchView = view === "proposals";
  const isTravellerSearchView = ["hotels", "passport", "travellers"].includes(view);
  const querySearchPreparing = Boolean(
    normalizedSearch && isQueryListView && searchReadiness?.tables.queries !== true
  );
  const jobCardSearchPreparing = Boolean(
    normalizedSearch && isJobCardSearchView && searchReadiness?.tables.jobCards !== true
  );
  const proposalSearchPreparing = Boolean(
    normalizedSearch && isProposalSearchView && searchReadiness?.tables.proposals !== true
  );
  const travellerSearchPreparing = Boolean(
    normalizedSearch && isTravellerSearchView && searchReadiness?.tables.travellers !== true
  );
  const searchPreparing =
    querySearchPreparing ||
    jobCardSearchPreparing ||
    proposalSearchPreparing ||
    travellerSearchPreparing;
  const shouldLoadQueries = Boolean(
    canFetch &&
      needs("queries") &&
      (has(P.VIEW_QUERIES) || has(P.VIEW_CONTRACTING) || has(P.MANAGE_JOB_CARDS))
  );
  const dateBounds = {
    createdAtFrom: dateRangeArg?.from ? (parseDateOnly(dateRangeArg.from) ?? undefined) : undefined,
    createdAtTo: dateRangeArg?.to ? (endOfDateOnly(dateRangeArg.to) ?? undefined) : undefined,
  };
  const queryListArgs = isQueryListView
    ? {
        ...dateBounds,
        contractingStatus: listFilters.contractingStatus || undefined,
        leadStage: listFilters.leadStage || undefined,
        queryType: listFilters.queryType || undefined,
        salesStatus: listFilters.salesStatus || undefined,
        search: normalizedSearch || undefined,
      }
    : {};
  const queryPage = usePaginatedQuery(
    api.crm.queries.listPage,
    shouldLoadQueries && !querySearchPreparing ? queryListArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const queryPagination = usePaginationControl(queryPage, JSON.stringify(queryListArgs));
  const focusedQueryId = deepLinkQueryId || (deepLinkOpen === "query" ? deepLinkId : null);
  const focusedQuery = useQuery(
    api.crm.queries.getListRow,
    shouldLoadQueries && focusedQueryId ? { queryId: focusedQueryId } : "skip"
  );
  const queries = shouldLoadQueries
    ? mergeFocusedRow(
        queryPage.status === "LoadingFirstPage" ? undefined : queryPage.results,
        focusedQuery
      )
    : undefined;
  const shouldLoadProposals = Boolean(
    canFetch &&
      needs("proposals") &&
      (has(P.VIEW_PROPOSALS) || has(P.VIEW_CONTRACTING) || has(P.MANAGE_JOB_CARDS))
  );
  const proposalListArgs =
    view === "proposals"
      ? {
          ...dateBounds,
          search: normalizedSearch || undefined,
          status: listFilters.status || undefined,
        }
      : {};
  const proposalPage = usePaginatedQuery(
    api.crm.proposals.listPage,
    shouldLoadProposals && !proposalSearchPreparing ? proposalListArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const proposalPagination = usePaginationControl(proposalPage, JSON.stringify(proposalListArgs));
  const focusedProposal = useQuery(
    api.crm.proposals.getListRow,
    shouldLoadProposals && deepLinkOpen === "proposal" && deepLinkId
      ? { proposalId: deepLinkId }
      : "skip"
  );
  const focusedJobCardProposalId = (() => {
    if (modal !== "jobCard" || form.entityId || !form.queryId) {
      return null;
    }
    if (form.proposalId) {
      return String(form.proposalId);
    }
    const loadedProposals =
      proposalPage.status === "LoadingFirstPage" ? [] : (proposalPage.results ?? []);
    const linkedProposal = resolveLinkedProposalForQuery(loadedProposals, form.queryId);
    return linkedProposal?.id ? String(linkedProposal.id) : null;
  })();
  const focusedJobCardProposal = useQuery(
    api.crm.proposals.getListRow,
    shouldLoadProposals && focusedJobCardProposalId
      ? { proposalId: focusedJobCardProposalId }
      : "skip"
  );
  const proposals = shouldLoadProposals
    ? mergeFocusedRow(
        mergeFocusedRow(
          proposalPage.status === "LoadingFirstPage" ? undefined : proposalPage.results,
          focusedProposal
        ),
        focusedJobCardProposal
      )
    : undefined;
  const shouldLoadJobCards = Boolean(canFetch && needs("jobCards") && has(P.VIEW_JOB_CARDS));
  const shouldLoadJobCardDeletionOperations = Boolean(
    canFetch && view === "job-cards" && has(P.MANAGE_JOB_CARDS)
  );
  const jobCardDeletionOperations = useQuery(
    api.crm.jobCards.listMyDeletionOperations,
    shouldLoadJobCardDeletionOperations ? {} : "skip"
  );
  const jobCardListArgs =
    view === "job-cards"
      ? {
          ...dateBounds,
          queryType: listFilters.queryType || undefined,
          search: normalizedSearch || undefined,
          status: listFilters.status || undefined,
        }
      : {};
  const jobCardPage = usePaginatedQuery(
    api.crm.jobCards.listPage,
    shouldLoadJobCards && !jobCardSearchPreparing ? jobCardListArgs : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const jobCardPagination = usePaginationControl(jobCardPage, JSON.stringify(jobCardListArgs));
  const focusedJobCard = useQuery(
    api.crm.jobCards.getListRow,
    shouldLoadJobCards && deepLinkOpen === "jobCard" && (deepLinkId || deepLinkQueryId)
      ? {
          ...(deepLinkId ? { jobCardId: deepLinkId } : {}),
          ...(deepLinkQueryId ? { queryId: deepLinkQueryId } : {}),
        }
      : "skip"
  );
  const jobCards = shouldLoadJobCards
    ? mergeFocusedRow(
        jobCardPage.status === "LoadingFirstPage" ? undefined : jobCardPage.results,
        focusedJobCard
      )
    : undefined;
  const shouldLoadTravellers = Boolean(canFetch && needs("travellers") && has(P.VIEW_TRAVELLERS));
  const travellerPage = usePaginatedQuery(
    api.crm.travellers.listPage,
    shouldLoadTravellers && !travellerSearchPreparing
      ? {
          ...(view === "travellers" || view === "passport" || view === "hotels" ? dateBounds : {}),
          callingStatus: view === "travellers" ? listFilters.callingStatus || undefined : undefined,
          jobCardId: jobCardFilter || undefined,
          passportExpiryUrgency:
            view === "passport" ? listFilters.passportExpiryUrgency || undefined : undefined,
          passportReferenceDate:
            view === "passport" && listFilters.passportExpiryUrgency
              ? new Date().toISOString().slice(0, 10)
              : undefined,
          passportStatus: view === "passport" ? listFilters.passportStatus || undefined : undefined,
          roomType: view === "hotels" ? listFilters.roomType || undefined : undefined,
          search: ["hotels", "passport", "travellers"].includes(view)
            ? normalizedSearch || undefined
            : undefined,
          ticketStatus: view === "travellers" ? listFilters.ticketStatus || undefined : undefined,
          visaStatus: view === "travellers" ? listFilters.visaStatus || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const travellerPagination = usePaginationControl(
    travellerPage,
    JSON.stringify({ dateBounds, jobCardFilter, listFilters, search, view })
  );
  const focusedTraveller = useQuery(
    api.crm.travellers.getListRow,
    shouldLoadTravellers && deepLinkOpen === "traveller" && deepLinkId
      ? { travellerId: deepLinkId }
      : "skip"
  );
  const travellers = shouldLoadTravellers
    ? mergeFocusedRow(
        travellerPage.status === "LoadingFirstPage" ? undefined : travellerPage.results,
        focusedTraveller
      )
    : undefined;
  const roomCountSummary = useQuery(
    api.crm.travellers.getRoomCountSummary,
    shouldLoadTravellers && view === "hotels"
      ? {
          dateRange: dateRangeArg,
          jobCardId: jobCardFilter || undefined,
          jobCardPageComplete:
            jobCardPagination.status === "Exhausted" && (jobCards?.length ?? 0) <= 100,
          visibleJobCardIds: (jobCards || []).slice(0, 100).map((jobCard) => jobCard.id),
        }
      : "skip"
  );
  const visaPage = usePaginatedQuery(
    api.crm.visa.list,
    canFetch && needs("visas") && has(P.VIEW_VISA)
      ? {
          jobCardId: jobCardFilter || undefined,
          status: view === "visa" ? listFilters.status || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const visaPagination = usePaginationControl(
    visaPage,
    JSON.stringify({ jobCardFilter, status: listFilters.status, view })
  );
  const visas = visaPage.status === "LoadingFirstPage" ? undefined : visaPage.results;
  const ticketDashboard = useQuery(
    api.crm.ticketing.dashboard,
    canFetch && view === "ticketing" && has(P.VIEW_TICKETING) ? { dateRange: dateRangeArg } : "skip"
  );
  const pnrPage = usePaginatedQuery(
    api.crm.ticketing.listPnrs,
    canFetch && needs("pnrs") && has(P.VIEW_TICKETING)
      ? {
          jobCardId: jobCardFilter || undefined,
          status: view === "flights" ? listFilters.status || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const pnrPagination = usePaginationControl(
    pnrPage,
    JSON.stringify({ jobCardFilter, status: listFilters.status, view })
  );
  const pnrs = pnrPage.status === "LoadingFirstPage" ? undefined : pnrPage.results;
  const ticketPage = usePaginatedQuery(
    api.crm.ticketing.listTickets,
    canFetch && needs("tickets") && has(P.VIEW_TICKETING)
      ? {
          jobCardId: jobCardFilter || undefined,
          ticketStatus: view === "tickets" ? listFilters.ticketStatus || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const ticketPagination = usePaginationControl(
    ticketPage,
    JSON.stringify({ jobCardFilter, ticketStatus: listFilters.ticketStatus, view })
  );
  const focusedTicket = useQuery(
    api.crm.ticketing.getTicketListRow,
    canFetch && deepLinkOpen === "ticket" && deepLinkId ? { ticketId: deepLinkId } : "skip"
  );
  const tickets = mergeFocusedRow(
    ticketPage.status === "LoadingFirstPage" ? undefined : ticketPage.results,
    focusedTicket
  );
  const seatPage = usePaginatedQuery(
    api.crm.ticketing.listSeatAllocations,
    canFetch && needs("seats") && has(P.VIEW_TICKETING)
      ? {
          jobCardId: jobCardFilter || undefined,
          status: view === "seat-allocation" ? listFilters.status || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const seatPagination = usePaginationControl(
    seatPage,
    JSON.stringify({ jobCardFilter, status: listFilters.status, view })
  );
  const seats = seatPage.status === "LoadingFirstPage" ? undefined : seatPage.results;
  const flightItineraryPage = usePaginatedQuery(
    api.crm.imports.listFlightItinerary,
    canFetch && needs("flightItinerary") && has(P.VIEW_TICKETING)
      ? { jobCardId: jobCardFilter || undefined }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const flightItineraryPagination = usePaginationControl(flightItineraryPage, jobCardFilter);
  const flightItinerary =
    flightItineraryPage.status === "LoadingFirstPage" ? undefined : flightItineraryPage.results;
  const hotelPage = usePaginatedQuery(
    api.crm.ops.listHotels,
    canFetch && needs("hotels") && has(P.VIEW_OPERATIONS)
      ? { jobCardId: jobCardFilter || undefined }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const hotelPagination = usePaginationControl(hotelPage, jobCardFilter);
  const hotels = hotelPage.status === "LoadingFirstPage" ? undefined : hotelPage.results;
  const tourManagerPage = usePaginatedQuery(
    api.crm.ops.listTourManagers,
    canFetch && needs("tourManagers") && has(P.VIEW_TOUR_MANAGERS)
      ? {
          callingStatus: listFilters.callingStatus || undefined,
          jobCardId: jobCardFilter || undefined,
          status: listFilters.status || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const tourManagerPagination = usePaginationControl(
    tourManagerPage,
    JSON.stringify({ jobCardFilter, listFilters, view })
  );
  const tourManagers =
    tourManagerPage.status === "LoadingFirstPage" ? undefined : tourManagerPage.results;
  const flightOperationsPagination = combinePaginationControls(
    pnrPagination,
    flightItineraryPagination
  );
  const hotelOperationsPagination = combinePaginationControls(hotelPagination, travellerPagination);
  const invoicePage = usePaginatedQuery(
    api.crm.finance.listInvoices,
    canFetch && needs("invoices") && has(P.VIEW_FINANCE)
      ? {
          jobCardId: jobCardFilter || undefined,
          status: view === "finance" ? listFilters.status || undefined : undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const invoicePagination = usePaginationControl(
    invoicePage,
    JSON.stringify({ jobCardFilter, status: listFilters.status, view })
  );
  const invoices = invoicePage.status === "LoadingFirstPage" ? undefined : invoicePage.results;
  const expensePage = usePaginatedQuery(
    api.crm.finance.listExpenses,
    canFetch && needs("expenses") && (has(P.VIEW_EXPENSES) || deepLinkOpen === "approval")
      ? {
          approvalStatus: listFilters.approvalStatus || undefined,
          category: listFilters.category || undefined,
          jobCardId: jobCardFilter || undefined,
          reimbursementStatus: listFilters.reimbursementStatus || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const expensePagination = usePaginationControl(
    expensePage,
    JSON.stringify({ jobCardFilter, listFilters, view })
  );
  const focusedApproval = useQuery(
    api.crm.approvals.getListRow,
    canFetch && deepLinkOpen === "approval" && deepLinkId ? { approvalId: deepLinkId } : "skip"
  );
  const focusedExpenseId =
    focusedApproval?.entityType === "expense"
      ? focusedApproval.entityId
      : deepLinkOpen === "expense"
        ? deepLinkId
        : null;
  const focusedExpense = useQuery(
    api.crm.finance.getExpenseListRow,
    focusedExpenseId ? { expenseId: focusedExpenseId } : "skip"
  );
  const expenses = mergeFocusedRow(
    expensePage.status === "LoadingFirstPage" ? undefined : expensePage.results,
    focusedExpense
  );
  const financeOverview = useQuery(
    api.crm.finance.getFinanceOverview,
    canFetch && has(P.VIEW_FINANCE) && view === "finance" ? { dateRange: dateRangeArg } : "skip"
  );
  const approvalPage = usePaginatedQuery(
    api.crm.approvals.list,
    canFetch && needs("approvals") && has(P.VIEW_APPROVALS)
      ? {
          status: listFilters.status || undefined,
          type: listFilters.type || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const approvalPagination = usePaginationControl(
    approvalPage,
    JSON.stringify({ listFilters, view })
  );
  const approvals = mergeFocusedRow(
    approvalPage.status === "LoadingFirstPage" ? undefined : approvalPage.results,
    focusedApproval
  );
  const reports = useQuery(
    api.crm.reports.overview,
    canFetch && has(P.VIEW_REPORTS) && view === "reports" ? { dateRange: dateRangeArg } : "skip"
  );
  const teamDirectoryPage = usePaginatedQuery(
    api.crm.staff.listDirectory,
    canFetch && needs("team") && has(P.VIEW_TEAM)
      ? { department: listFilters.department || undefined }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const teamPagination = usePaginationControl(
    teamDirectoryPage,
    JSON.stringify({ department: listFilters.department, view })
  );
  const teamDirectory =
    teamDirectoryPage.status === "LoadingFirstPage" ? undefined : teamDirectoryPage.results;
  const teamPicker = useQuery(
    api.crm.staff.listTeamOptions,
    canFetch && needs("team") && !has(P.VIEW_TEAM) && canUseTeamPicker(access) ? {} : "skip"
  );
  const team = teamDirectory ?? teamPicker ?? [];
  const activityPage = usePaginatedQuery(
    api.crm.activity.listActivity,
    canFetch && needs("activity") && has(P.VIEW_ACTIVITY)
      ? {
          action: listFilters.action || undefined,
          entityType: listFilters.entityType || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const activityPagination = usePaginationControl(
    activityPage,
    JSON.stringify({ listFilters, view })
  );
  const activity = activityPage.status === "LoadingFirstPage" ? undefined : activityPage.results;
  const leavePage = usePaginatedQuery(
    api.crm.leave.list,
    canFetch && needs("leaves") && has(P.VIEW_LEAVE)
      ? {
          staffId: listFilters.staffId || undefined,
          status: listFilters.status || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const leavePagination = usePaginationControl(leavePage, JSON.stringify({ listFilters, view }));
  const leaves = leavePage.status === "LoadingFirstPage" ? undefined : leavePage.results;
  const leaveBalanceArgs =
    canFetch && needs("leaves") && has(P.VIEW_LEAVE)
      ? {
          ...(has(P.MANAGE_LEAVE) && modal === "leave_create" && form.staffId
            ? { staffId: form.staffId }
            : {}),
          ...(modal === "leave_create" && form.startDate
            ? { fiscalYear: fiscalYearForDate(form.startDate) }
            : {}),
        }
      : null;
  const leaveBalances = useQuery(api.crm.leave.balances, leaveBalanceArgs ?? "skip");
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    canFetch ? { limit: 80 } : "skip"
  );
  const dropdowns = useQuery(
    api.crm.settings.listDropdowns,
    canFetch && view === "settings" && has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const staffPage = usePaginatedQuery(
    api.crm.staff.listStaff,
    canFetch && needs("staff") && has(P.MANAGE_STAFF)
      ? {
          active:
            listFilters.active === "true"
              ? true
              : listFilters.active === "false"
                ? false
                : undefined,
          department: listFilters.department || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE }
  );
  const staffPagination = usePaginationControl(staffPage, JSON.stringify({ listFilters, view }));
  const staff = staffPage.status === "LoadingFirstPage" ? undefined : staffPage.results;
  const accountsJobCardCreators = useQuery(
    api.crm.staff.listAccountsForJobCards,
    canFetch && view === "accounts-job-cards" && has(P.MANAGE_JOB_CARDS) ? {} : "skip"
  );
  const leaveHeadApproverCandidates = useQuery(
    api.crm.leaveApprovers.listHeadApproverCandidates,
    canFetch && view === "settings" && has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const travellersWithoutVisa = useQuery(
    api.crm.visa.listTravellersWithoutVisa,
    canFetch && has(P.VIEW_VISA) && (modal === "visa_create" || view === "visa") ? {} : "skip"
  );

  return {
    accountsJobCardCreators,
    activity,
    approvals,
    dropdowns,
    expenses,
    financeOverview,
    flightItinerary,
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
    pnrs,
    proposals,
    queries,
    reports,
    roomCountSummary,
    searchPreparing,
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
