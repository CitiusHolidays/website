"use client";
"use no memo";

import { api } from "@convex/_generated/api";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { usePortalToast } from "@/components/portal/PortalToast";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import {
  uploadEntityFiles,
  uploadExpenseProofFiles,
  uploadQueryFiles,
} from "@/lib/portal/fileUploads";
import { fiscalYearForDate } from "@/lib/portal/leavePolicy";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { hasActiveListFilters } from "@/lib/portal/listFilters";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import { createInitialModalForm, JOB_CARD_MODALS } from "@/lib/portal/modalLifecycle";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { dateRangeQueryArg, EMPTY_DATE_RANGE, filterByDateRange } from "@/lib/portal/periodFilter";
import { canAccessPipeline, canUseTeamPicker } from "@/lib/portal/permissions";
import { filterRows, pipeViewRows, VIEWS_WITH_JOB_CARD_FILTER } from "@/lib/portal/pipeViewRows";
import { runMutation } from "@/lib/portal/runMutation";
import {
  currentFiltersToSavedViewInput,
  normalizeSavedViewState,
  savedViewToUrl,
} from "@/lib/portal/savedViews";
import { parseUrlFilterState, serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import { buildViewResultCountMap, getViewResultCount } from "@/lib/portal/viewResultCounts";
import { INITIAL_FORM, VIEW_META } from "@/lib/portal/workspaceContract";

const P = PORTAL_PERMISSIONS;
const _EMPTY_ARRAY = [];
const _EMPTY_OBJECT = {};

export function usePortalWorkspaceState(view = "dashboard", searchParams) {
  "use no memo";

  const router = useRouter();
  const pathname = usePathname();
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const bootstrapListFilterConfig = getListFilterConfig(view, { pipelineMode: "sales" });
  const initialUrlFilters = parseUrlFilterState(searchParams, bootstrapListFilterConfig);
  const [workspace, patchWorkspace, , dispatchWorkspace] = usePatchReducer({
    dateRange: initialUrlFilters.dateRange,
    error: "",
    form: INITIAL_FORM,
    isSaving: false,
    jobCardFilter: initialUrlFilters.jobCardFilter,
    listFilters: initialUrlFilters.listFilters,
    modal: null,
    passportExpiryByTraveller: {},
    pendingExpenseProofFiles: [],
    pendingProposalFiles: [],
    pendingQueryFiles: [],
    pipelineMode: "sales",
    search: initialUrlFilters.search,
  });
  const {
    modal,
    form,
    pendingQueryFiles,
    pendingProposalFiles,
    pendingExpenseProofFiles,
    error,
    isSaving,
    pipelineMode,
    search,
    dateRange,
    jobCardFilter,
    listFilters,
    passportExpiryByTraveller,
  } = workspace;
  const patchState = (patch) => patchWorkspace(patch);
  const setModal = (value) =>
    patchState({ modal: typeof value === "function" ? value(modal) : value });
  const setForm = (value) =>
    patchState({ form: typeof value === "function" ? value(form) : value });
  const setPendingQueryFiles = (value) =>
    patchState({
      pendingQueryFiles: typeof value === "function" ? value(pendingQueryFiles) : value,
    });
  const setPendingProposalFiles = (value) =>
    patchState({
      pendingProposalFiles: typeof value === "function" ? value(pendingProposalFiles) : value,
    });
  const setPendingExpenseProofFiles = (value) =>
    patchState({
      pendingExpenseProofFiles:
        typeof value === "function" ? value(pendingExpenseProofFiles) : value,
    });
  const setError = (value) =>
    patchState({ error: typeof value === "function" ? value(error) : value });
  const setIsSaving = (value) =>
    patchState({ isSaving: typeof value === "function" ? value(isSaving) : value });
  const _setPipelineMode = (value) =>
    patchState({ pipelineMode: typeof value === "function" ? value(pipelineMode) : value });
  const setSearch = (value) =>
    patchState({ search: typeof value === "function" ? value(search) : value });
  const setDateRange = (value) =>
    patchState({ dateRange: typeof value === "function" ? value(dateRange) : value });
  const setJobCardFilter = (value) =>
    patchState({ jobCardFilter: typeof value === "function" ? value(jobCardFilter) : value });
  const setListFilters = (value) =>
    patchState({ listFilters: typeof value === "function" ? value(listFilters) : value });
  const listFilterConfig = getListFilterConfig(view, { pipelineMode });
  const dateRangeArg = dateRangeQueryArg(dateRange);
  const deepLinkOpen = searchParams.get("open");
  const deepLinkHandledRef = useRef("");

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const access = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const has = (permission) => Boolean(access?.permissions?.includes(permission));
  const meta = VIEW_META[view] || VIEW_META.dashboard;
  const allowed =
    access?.allowed && (view === "pipeline" ? canAccessPipeline(access) : has(meta.permission));
  const canFetch = isAuthenticated && access?.allowed;

  const summary = useQuery(
    api.crm.dashboard.getPortalSummary,
    canFetch && allowed && view === "dashboard" ? { dateRange: dateRangeArg } : "skip"
  );
  const savedViews = useQuery(
    api.crm.savedViews.listForPortal,
    canFetch && allowed ? { view } : "skip"
  );
  const createSavedView = useMutation(api.crm.savedViews.create);
  const updateSavedView = useMutation(api.crm.savedViews.update);
  const removeSavedView = useMutation(api.crm.savedViews.remove);
  const queries = useQuery(
    api.crm.queries.list,
    canFetch && (has(P.VIEW_QUERIES) || has(P.VIEW_CONTRACTING) || has(P.MANAGE_JOB_CARDS))
      ? {}
      : "skip"
  );
  const proposals = useQuery(
    api.crm.proposals.list,
    canFetch && (has(P.VIEW_PROPOSALS) || has(P.VIEW_CONTRACTING)) ? {} : "skip"
  );
  const jobCards = useQuery(api.crm.jobCards.list, canFetch && has(P.VIEW_JOB_CARDS) ? {} : "skip");
  const travellers = useQuery(
    api.crm.travellers.list,
    canFetch && has(P.VIEW_TRAVELLERS) ? {} : "skip"
  );
  const visas = useQuery(api.crm.visa.list, canFetch && has(P.VIEW_VISA) ? {} : "skip");
  const ticketDashboard = useQuery(
    api.crm.ticketing.dashboard,
    canFetch && has(P.VIEW_TICKETING) ? { dateRange: dateRangeArg } : "skip"
  );
  const pnrs = useQuery(
    api.crm.ticketing.listPnrs,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const tickets = useQuery(
    api.crm.ticketing.listTickets,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const seats = useQuery(
    api.crm.ticketing.listSeatAllocations,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const flightItinerary = useQuery(
    api.crm.imports.listFlightItinerary,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const hotels = useQuery(api.crm.ops.listHotels, canFetch && has(P.VIEW_OPERATIONS) ? {} : "skip");
  const tourManagers = useQuery(
    api.crm.ops.listTourManagers,
    canFetch && has(P.VIEW_TOUR_MANAGERS) ? {} : "skip"
  );
  const invoices = useQuery(
    api.crm.finance.listInvoices,
    canFetch && has(P.VIEW_FINANCE) ? {} : "skip"
  );
  const expenses = useQuery(
    api.crm.finance.listExpenses,
    canFetch && (has(P.VIEW_EXPENSES) || deepLinkOpen === "approval") ? {} : "skip"
  );
  const financeOverview = useQuery(
    api.crm.finance.getFinanceOverview,
    canFetch && has(P.VIEW_FINANCE) && view === "finance" ? { dateRange: dateRangeArg } : "skip"
  );
  const approvals = useQuery(
    api.crm.approvals.list,
    canFetch && has(P.VIEW_APPROVALS) ? {} : "skip"
  );
  const reports = useQuery(
    api.crm.reports.overview,
    canFetch && has(P.VIEW_REPORTS) && view === "reports" ? { dateRange: dateRangeArg } : "skip"
  );
  const teamDirectory = useQuery(
    api.crm.staff.listDirectory,
    canFetch && has(P.VIEW_TEAM) ? {} : "skip"
  );
  const teamPicker = useQuery(
    api.crm.staff.listTeamOptions,
    canFetch && !has(P.VIEW_TEAM) && canUseTeamPicker(access) ? {} : "skip"
  );
  const team = teamDirectory ?? teamPicker ?? [];
  const activity = useQuery(
    api.crm.activity.listActivity,
    canFetch && has(P.VIEW_ACTIVITY) ? { limit: 80 } : "skip"
  );
  const leaves = useQuery(api.crm.leave.list, canFetch && has(P.VIEW_LEAVE) ? {} : "skip");
  const leaveBalanceArgs =
    canFetch && has(P.VIEW_LEAVE)
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
  const staff = useQuery(api.crm.staff.listStaff, canFetch && has(P.MANAGE_STAFF) ? {} : "skip");
  const accountsJobCardCreators = useQuery(
    api.crm.staff.listAccountsForJobCards,
    canFetch && view === "accounts-job-cards" && has(P.MANAGE_JOB_CARDS) ? {} : "skip"
  );
  const leaveHeadApproverCandidates = useQuery(
    api.crm.leaveApprovers.listHeadApproverCandidates,
    canFetch && has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const createQuery = useMutation(api.crm.queries.create);
  const updateQuery = useMutation(api.crm.queries.update);
  const submitToContractingMutation = useMutation(api.crm.queries.submitToContracting);
  const assignContracting = useMutation(api.crm.queries.assignContracting);
  const assignQueryTicketing = useMutation(api.crm.queries.assignQueryTicketing);
  const assignQueryTeams = useMutation(api.crm.queries.assignQueryTeams);
  const assignJobCardCreator = useMutation(api.crm.queries.assignJobCardCreator);
  const setJobCardCreatorAccess = useMutation(api.crm.staff.setJobCardCreatorAccess);
  const assignContractingOwner = useMutation(api.crm.jobCards.assignContractingOwner);
  const assignOperationsOwner = useMutation(api.crm.jobCards.assignOperationsOwner);
  const assignTicketingOwner = useMutation(api.crm.ticketing.assignTicketingOwner);
  const updateQueryStatus = useMutation(api.crm.queries.updateStatus);
  const createProposal = useMutation(api.crm.proposals.create);
  const updateProposal = useMutation(api.crm.proposals.update);
  const addProposalCollaborator = useMutation(api.crm.proposals.addCollaborator);
  const removeProposalCollaborator = useMutation(api.crm.proposals.removeCollaborator);
  const sendProposalToSales = useMutation(api.crm.proposals.sendToSales);
  const markProposalSent = useMutation(api.crm.proposals.markSent);
  const createJobCard = useMutation(api.crm.jobCards.createFromQuery);
  const updateJobCard = useMutation(api.crm.jobCards.update);
  const updateJobStatus = useMutation(api.crm.jobCards.updateStatus);
  const addJobCardCollaborator = useMutation(api.crm.jobCards.addCollaborator);
  const removeJobCardCollaborator = useMutation(api.crm.jobCards.removeCollaborator);
  const createTraveller = useMutation(api.crm.travellers.create);
  const updateTraveller = useMutation(api.crm.travellers.update);
  const updateCallingStatus = useMutation(api.crm.travellers.updateCallingStatus);
  const updateVisaRecord = useMutation(api.crm.visa.updateRecord);
  const createVisa = useMutation(api.crm.visa.create);
  const createLeave = useMutation(api.crm.leave.create);
  const updateLeave = useMutation(api.crm.leave.update);
  const decideLeave = useMutation(api.crm.leave.decide);
  const removeLeave = useMutation(api.crm.leave.remove);
  const generateUploadUrl = useAction(api.crm.passportActions.generateUploadUrl);
  const encryptAndStorePassport = useAction(api.crm.passportActions.encryptAndStorePassport);
  const getPassportDocument = useAction(api.crm.passportActions.getPassportDocument);
  const removePassport = useAction(api.crm.passportActions.removePassport);
  const generateQueryUploadUrl = useAction(api.crm.queryAttachmentActions.generateUploadUrl);
  const attachQueryFile = useAction(api.crm.queryAttachmentActions.attachFile);
  const getQueryAttachmentUrl = useAction(api.crm.queryAttachmentActions.getDownloadUrl);
  const removeQueryAttachment = useAction(api.crm.queryAttachmentActions.removeAttachment);
  const generateProposalUploadUrl = useAction(api.crm.proposalAttachmentActions.generateUploadUrl);
  const attachProposalFile = useAction(api.crm.proposalAttachmentActions.attachFile);
  const getProposalAttachmentUrl = useAction(api.crm.proposalAttachmentActions.getDownloadUrl);
  const removeProposalAttachment = useAction(api.crm.proposalAttachmentActions.removeAttachment);
  const generateFinalizedPdfUploadUrl = useAction(
    api.crm.proposalAttachmentActions.generateFinalizedPdfUploadUrl
  );
  const attachFinalizedPdf = useAction(api.crm.proposalAttachmentActions.attachFinalizedPdf);
  const getFinalizedPdfUrl = useAction(api.crm.proposalAttachmentActions.getFinalizedPdfUrl);
  const removeFinalizedPdf = useAction(api.crm.proposalAttachmentActions.removeFinalizedPdf);
  const generateExpenseUploadUrl = useAction(api.crm.expenseAttachmentActions.generateUploadUrl);
  const attachExpenseProof = useAction(api.crm.expenseAttachmentActions.attachProof);
  const getExpenseAttachmentUrl = useAction(api.crm.expenseAttachmentActions.getDownloadUrl);
  const removeExpenseProof = useAction(api.crm.expenseAttachmentActions.removeProof);
  const startStaffOnboarding = useAction(api.crm.staffAction.startStaffOnboarding);
  const travellersWithoutVisa = useQuery(
    api.crm.visa.listTravellersWithoutVisa,
    canFetch && has(P.VIEW_VISA) && (modal === "visa_create" || view === "visa") ? {} : "skip"
  );
  const createPnr = useMutation(api.crm.ticketing.createPnr);
  const updatePnr = useMutation(api.crm.ticketing.updatePnr);
  const previewPassengerImport = useAction(api.crm.importActions.previewPassengerImport);
  const commitPassengerImport = useAction(api.crm.importActions.commitPassengerImport);
  const getPassengerExportRows = useAction(api.crm.importActions.getPassengerExportRows);
  const getTravellerPassportExpiryDates = useAction(
    api.crm.passportActions.getTravellerPassportExpiryDates
  );

  const canViewTravellers = Boolean(access?.permissions?.includes(P.VIEW_TRAVELLERS));

  useEffect(() => {
    if (!(canFetch && canViewTravellers)) {
      return;
    }
    if (view !== "travellers" && view !== "passport") {
      return;
    }

    let cancelled = false;
    getTravellerPassportExpiryDates({ jobCardId: jobCardFilter || undefined })
      .then((dates) => {
        if (!cancelled) {
          dispatchWorkspace({
            patch: { passportExpiryByTraveller: dates || {} },
            type: "patch",
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatchWorkspace({
            patch: { passportExpiryByTraveller: {} },
            type: "patch",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    canFetch,
    canViewTravellers,
    view,
    jobCardFilter,
    getTravellerPassportExpiryDates,
    dispatchWorkspace,
  ]);

  const travellerRows = travellers || [];
  const travellersWithPassportExpiry = Object.keys(passportExpiryByTraveller).length
    ? travellerRows.map((row) => ({
        ...row,
        passportExpiryDate: passportExpiryByTraveller[row.id] ?? row.passportExpiryDate ?? "",
      }))
    : travellerRows;
  const commitFlightImport = useMutation(api.crm.imports.commitFlightImport);
  const createTicket = useMutation(api.crm.ticketing.createTicket);
  const updateTicket = useMutation(api.crm.ticketing.updateTicket);
  const saveSeat = useMutation(api.crm.ticketing.saveSeatAllocation);
  const updateSeatAllocation = useMutation(api.crm.ticketing.updateSeatAllocation);
  const createHotel = useMutation(api.crm.ops.createHotel);
  const updateHotel = useMutation(api.crm.ops.updateHotel);
  const createTourManager = useMutation(api.crm.ops.createTourManager);
  const updateTourManager = useMutation(api.crm.ops.updateTourManager);
  const createInvoice = useMutation(api.crm.finance.createInvoice);
  const updateInvoice = useMutation(api.crm.finance.updateInvoice);
  const createExpense = useMutation(api.crm.finance.createExpense);
  const updateExpense = useMutation(api.crm.finance.updateExpense);
  const submitExpenseForApproval = useMutation(api.crm.finance.submitExpenseForApproval);
  const decideExpenseManager = useMutation(api.crm.finance.decideExpenseManager);
  const decideExpenseFinance = useMutation(api.crm.finance.decideExpenseFinance);
  const decideApproval = useMutation(api.crm.approvals.decide);
  const removeApproval = useMutation(api.crm.approvals.remove);
  const upsertStaff = useMutation(api.crm.staff.upsertStaff);
  const removeQuery = useMutation(api.crm.queries.remove);
  const removeProposal = useMutation(api.crm.proposals.remove);
  const removeJobCard = useMutation(api.crm.jobCards.remove);
  const removeTraveller = useMutation(api.crm.travellers.remove);
  const removeManyTravellers = useMutation(api.crm.travellers.removeMany);
  const removeVisa = useMutation(api.crm.visa.remove);
  const removeManyVisas = useMutation(api.crm.visa.removeMany);
  const removePnr = useMutation(api.crm.ticketing.removePnr);
  const removeManyPnrs = useMutation(api.crm.ticketing.removeManyPnrs);
  const removeTicket = useMutation(api.crm.ticketing.removeTicket);
  const removeManyTickets = useMutation(api.crm.ticketing.removeManyTickets);
  const removeSeatAllocation = useMutation(api.crm.ticketing.removeSeatAllocation);
  const removeManySeatAllocations = useMutation(api.crm.ticketing.removeManySeatAllocations);
  const removeHotel = useMutation(api.crm.ops.removeHotel);
  const removeManyHotels = useMutation(api.crm.ops.removeManyHotels);
  const removeTourManager = useMutation(api.crm.ops.removeTourManager);
  const removeManyTourManagers = useMutation(api.crm.ops.removeManyTourManagers);
  const removeInvoice = useMutation(api.crm.finance.removeInvoice);
  const removeExpense = useMutation(api.crm.finance.removeExpense);
  const removeStaff = useMutation(api.crm.staff.removeStaff);
  const removeNotification = useMutation(api.crm.activity.removeNotification);
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);

  const periodFiltered = {
    activity: filterByDateRange(activity || [], dateRange, "createdAt"),
    approvals: filterByDateRange(approvals || [], dateRange, "createdAt"),
    expenses: filterByDateRange(
      (expenses || []).map((row) => ({
        ...row,
        periodDate: row.expenseDate || row.createdAt,
      })),
      dateRange,
      "periodDate"
    ),
    flightItinerary: filterByDateRange(flightItinerary || [], dateRange, "departureDate"),
    hotels: filterByDateRange(hotels || [], dateRange, "createdAt"),
    invoices: filterByDateRange(invoices || [], dateRange, "createdAt"),
    jobCards: filterByDateRange(jobCards || [], dateRange, "createdAt"),
    leaves: filterByDateRange(leaves || [], dateRange, "createdAt"),
    notifications: filterByDateRange(notifications || [], dateRange, "createdAt"),
    pnrs: filterByDateRange(pnrs || [], dateRange, "createdAt"),
    proposals: filterByDateRange(proposals || [], dateRange, "createdAt"),
    queries: filterByDateRange(queries || [], dateRange, "createdAt"),
    seats: filterByDateRange(seats || [], dateRange, "createdAt"),
    tickets: filterByDateRange(tickets || [], dateRange, "createdAt"),
    tourManagers: filterByDateRange(tourManagers || [], dateRange, "createdAt"),
    travellers: filterByDateRange(travellersWithPassportExpiry, dateRange, "createdAt"),
    visas: filterByDateRange(visas || [], dateRange, "createdAt"),
  };

  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(jobCardFilter) ||
    Boolean(dateRange.from || dateRange.to) ||
    hasActiveListFilters(listFilters, listFilterConfig);

  const filteredQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: listFilterConfig,
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
    view: "queries",
  });
  const filteredPipelineQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: listFilterConfig,
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
    view: "pipeline",
  });
  const filteredContractingQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: getListFilterConfig("contracting"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType"],
    view: "contracting",
  });
  const filteredProposals = pipeViewRows(periodFiltered.proposals, {
    dateRange,
    filterConfig: getListFilterConfig("proposals"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["proposalCode", "clientName", "preparedBy"],
    view: "proposals",
  });
  const filteredAccountsQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: getListFilterConfig("accounts-job-cards"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination"],
    view: "accounts-job-cards",
  });
  const filteredJobCards = pipeViewRows(periodFiltered.jobCards, {
    dateRange,
    filterConfig: getListFilterConfig("job-cards"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["jobCode", "clientName", "destination"],
    view: "job-cards",
  });
  const filteredTravellers = pipeViewRows(periodFiltered.travellers, {
    dateRange,
    filterConfig: getListFilterConfig("travellers"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "sourceDealerName", "travelBatchReference"],
    view: "travellers",
  });
  const filteredPassportTravellers = pipeViewRows(periodFiltered.travellers, {
    dateRange,
    filterConfig: getListFilterConfig("passport"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "passportStatus", "travelBatchReference"],
    view: "passport",
  });
  const filteredVisas = pipeViewRows(periodFiltered.visas, {
    dateRange,
    filterConfig: getListFilterConfig("visa"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["travellerName", "jobCode", "travelHub", "status"],
    view: "visa",
  });
  const filteredTickets = pipeViewRows(periodFiltered.tickets, {
    dateRange,
    filterConfig: getListFilterConfig("ticketing"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["travellerName", "jobCode", "ticketNumber", "pnrCode"],
    view: "ticketing",
  });
  const filteredPnrs = pipeViewRows(periodFiltered.pnrs, {
    dateRange,
    filterConfig: getListFilterConfig("flights"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["pnrCode", "airline", "route", "jobCode"],
    view: "flights",
  });
  const filteredAllTickets = pipeViewRows(periodFiltered.tickets, {
    dateRange,
    filterConfig: getListFilterConfig("tickets"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["ticketNumber", "travellerName", "jobCode", "pnrCode"],
    view: "tickets",
  });
  const filteredSeats = pipeViewRows(periodFiltered.seats, {
    dateRange,
    filterConfig: getListFilterConfig("seat-allocation"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["seatNumber", "jobCode"],
    view: "seat-allocation",
  });
  const filteredHotels = pipeViewRows(periodFiltered.hotels, {
    dateRange,
    filterConfig: [],
    jobCardFilter,
    listFilters: {},
    search,
    searchKeys: ["name", "city", "jobCode"],
    view: "hotels",
  });
  const filteredRoomingTravellers = pipeViewRows(
    periodFiltered.travellers.filter((row) => row.roomType || row.hotelAllocation),
    {
      dateRange,
      filterConfig: getListFilterConfig("hotels"),
      jobCardFilter,
      listFilters,
      search,
      searchKeys: [
        "fullName",
        "jobCode",
        "travelHub",
        "hotelAllocation",
        "roomType",
        "travelBatchReference",
      ],
      view: "hotels",
    }
  );
  const filteredTourManagers = pipeViewRows(periodFiltered.tourManagers, {
    dateRange,
    filterConfig: getListFilterConfig("tour-managers"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["name", "email", "phone", "jobCode"],
    view: "tour-managers",
  });
  const filteredInvoices = pipeViewRows(periodFiltered.invoices, {
    dateRange,
    filterConfig: getListFilterConfig("finance"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["invoiceNumber", "jobCode"],
    view: "finance",
  });
  const filteredExpenses = pipeViewRows(periodFiltered.expenses, {
    dateRange,
    filterConfig: getListFilterConfig("expenses"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["particulars", "paidBy", "tourManagerName", "jobCode"],
    view: "expenses",
  });
  const filteredApprovals = pipeViewRows(periodFiltered.approvals, {
    dateRange,
    filterConfig: getListFilterConfig("approvals"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["requestCode", "summary", "requestedByName", "type"],
    view: "approvals",
  });
  const filteredLeaves = pipeViewRows(periodFiltered.leaves, {
    dateRange,
    filterConfig: getListFilterConfig("employees-on-leave"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["staffName", "staffEmail", "department", "reason", "leaveType", "status"],
    view: "employees-on-leave",
  });
  const filteredActivity = pipeViewRows(periodFiltered.activity, {
    dateRange,
    filterConfig: getListFilterConfig("activity"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["action", "summary", "entityType", "actorName"],
    view: "activity",
  });
  const filteredTeam = pipeViewRows(team || [], {
    dateRange: EMPTY_DATE_RANGE,
    filterConfig: getListFilterConfig("team"),
    jobCardFilter: "",
    listFilters,
    search,
    searchKeys: ["name", "email", "department", "function", "location", "mobile", "roles"],
    view: "team",
  });
  const filteredStaff = staff
    ? filterRows(staff, search, [
        "name",
        "email",
        "department",
        "function",
        "location",
        "mobile",
        "roles",
        "onboardingStatus",
      ])
    : staff;

  const viewResultCountMap = buildViewResultCountMap({
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
  });
  const viewResultCount = getViewResultCount(view, viewResultCountMap);

  const replaceFilterUrl = (nextFilters) => {
    if (!allowed) {
      return;
    }
    const params = serializeUrlFilterState(nextFilters, listFilterConfig, {
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

  const showJobCardFilter = VIEWS_WITH_JOB_CARD_FILTER.has(view);

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

  const setSearchWithUrl = (value) => {
    const nextSearch = typeof value === "function" ? value(search) : value;
    setSearch(nextSearch);
    replaceFilterUrl({ dateRange, jobCardFilter, listFilters, search: nextSearch });
  };

  const setDateRangeWithUrl = (value) => {
    const nextDateRange = typeof value === "function" ? value(dateRange) : value;
    setDateRange(nextDateRange);
    replaceFilterUrl({ dateRange: nextDateRange, jobCardFilter, listFilters, search });
  };

  const setJobCardFilterWithUrl = (value) => {
    const nextJobCardFilter = typeof value === "function" ? value(jobCardFilter) : value;
    setJobCardFilter(nextJobCardFilter);
    replaceFilterUrl({ dateRange, jobCardFilter: nextJobCardFilter, listFilters, search });
  };

  const setListFilterValue = (field, value) => {
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

  const applySavedView = (savedView) => {
    const normalized = normalizeSavedViewState(savedView.filterState, listFilterConfig);
    setSearch(normalized.search);
    setDateRange(normalized.dateRange);
    setJobCardFilter(normalized.jobCardFilter);
    setListFilters(normalized.listFilters);
    replaceFilterUrl(normalized);
  };

  const saveCurrentView = async (name, options = {}) => {
    const input = currentFiltersToSavedViewInput({
      dateRange,
      filterConfig: listFilterConfig,
      jobCardFilter,
      listFilters,
      pathname,
      search,
      view,
    });
    return await runMutation({ showToast: toast, successMessage: "Saved view created." }, () =>
      createSavedView({
        ...input,
        isFavorite: options.isFavorite ?? true,
        isPinnedToDashboard: options.isPinnedToDashboard ?? false,
        name,
        sharedRole: options.sharedRole || undefined,
      })
    );
  };

  const deleteSavedView = async (savedViewId) =>
    await runMutation({ showToast: toast, successMessage: "Saved view deleted." }, () =>
      removeSavedView({ savedViewId })
    );

  const toggleSavedViewFavorite = async (savedView) =>
    await runMutation({ showToast: toast }, () =>
      updateSavedView({
        isFavorite: !savedView.isFavorite,
        savedViewId: savedView.id,
      })
    );

  const toggleSavedViewPinned = async (savedView) =>
    await runMutation({ showToast: toast }, () =>
      updateSavedView({
        isPinnedToDashboard: !savedView.isPinnedToDashboard,
        savedViewId: savedView.id,
      })
    );

  const savedViewLinks = (savedViews ?? []).map((savedView) => ({
    ...savedView,
    href: savedViewToUrl(savedView.pathname || pathname, savedView, listFilterConfig),
  }));

  const openModal = (type, initial = {}) => {
    setError("");
    const next = createInitialModalForm({
      access,
      initial,
      initialForm: INITIAL_FORM,
      jobCards: jobCards || [],
      pnrs: pnrs || [],
      proposals: proposals || [],
      queries: queries || [],
      travellers: travellers || [],
      travellersWithoutVisa: travellersWithoutVisa || [],
      type,
      visas: visas || [],
    });
    setForm(next);
    setModal(type);
    if (type !== "query") {
      setPendingQueryFiles([]);
    }
    if (type !== "proposal") {
      setPendingProposalFiles([]);
    }
    if (type !== "expense") {
      setPendingExpenseProofFiles([]);
    }
  };

  const closeModal = () => {
    setModal(null);
    setForm(INITIAL_FORM);
    setPendingQueryFiles([]);
    setPendingProposalFiles([]);
    setPendingExpenseProofFiles([]);
    setError("");
    const params = serializeUrlFilterState(
      { dateRange, jobCardFilter, listFilters, search },
      listFilterConfig
    );
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const patchForm = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const submitToContracting = async ({ queryId }) => {
    try {
      await runMutation({ showToast: toast, successMessage: "Submitted to Contracting" }, () =>
        submitToContractingMutation({ queryId })
      );
    } catch {
      // Toast already shown by runMutation
    }
  };

  const deleteItem = async (label, mutation, args, options = {}) => {
    setError("");
    const confirmMessage = options.confirmMessage || `Delete ${label}? This cannot be undone.`;
    const ok = await confirm({
      confirmLabel: "Delete",
      danger: true,
      message: confirmMessage,
      title: "Delete record",
    });
    if (!ok) {
      return;
    }
    try {
      await runMutation({ label, showToast: toast, successMessage: `${label} deleted` }, () =>
        mutation(args)
      );
    } catch {
      // Toast already shown by runMutation
    }
  };

  const deleteSelected = async (count, entityLabel, mutation, buildArgs) => {
    setError("");
    if (count === 0) {
      return false;
    }
    const noun = count === 1 ? entityLabel : `${entityLabel}s`;
    const ok = await confirm({
      confirmLabel: "Delete",
      danger: true,
      message: `Delete ${count} selected ${noun}? This cannot be undone.`,
      title: "Delete selected",
    });
    if (!ok) {
      return false;
    }
    try {
      await runMutation({ showToast: toast, successMessage: `Deleted ${count} ${noun}` }, () =>
        mutation(buildArgs())
      );
      return true;
    } catch {
      return false;
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      let saveSuccessMessage = "Saved";
      await runMutation(
        {
          label: "Save",
          onError: (message) => setError(message),
          showToast: toast,
          successMessage: () => saveSuccessMessage,
        },
        async () => {
          saveSuccessMessage = await executeModalCommand({
            deps: {
              access,
              addJobCardCollaborator,
              addProposalCollaborator,
              assignContracting,
              assignContractingOwner,
              assignJobCardCreator,
              assignOperationsOwner,
              assignQueryTeams,
              assignQueryTicketing,
              assignTicketingOwner,
              attachExpenseProof,
              attachProposalFile,
              attachQueryFile,
              createExpense,
              createHotel,
              createInvoice,
              createJobCard,
              createLeave,
              createPnr,
              createProposal,
              createQuery,
              createTicket,
              createTourManager,
              createTraveller,
              createVisa,
              decideApproval,
              generateExpenseUploadUrl,
              generateProposalUploadUrl,
              generateQueryUploadUrl,
              has,
              jobCardModals: JOB_CARD_MODALS,
              pendingExpenseProofFiles,
              pendingProposalFiles,
              pendingQueryFiles,
              queries: queries || [],
              removeJobCardCollaborator,
              removeProposalCollaborator,
              saveSeat,
              team: team || [],
              updateExpense,
              updateHotel,
              updateInvoice,
              updateJobCard,
              updateLeave,
              updatePnr,
              updateProposal,
              updateQuery,
              updateQueryStatus,
              updateSeatAllocation,
              updateTicket,
              updateTourManager,
              updateTraveller,
              updateVisaRecord,
              uploadEntityFiles,
              uploadExpenseProofFiles,
              uploadQueryFiles,
              upsertStaff,
            },
            form,
            modal,
          });
          closeModal();
        }
      );
    } catch (err) {
      setError(err?.data || err?.message || "Unable to save.");
    }
    setIsSaving(false);
  };

  const gate =
    isAuthLoading || !isAuthenticated || access === undefined
      ? "loading"
      : allowed
        ? "ready"
        : "denied";

  const session = {
    access,
    allowed,
    canFetch,
    canViewTravellers,
    gate,
    has,
  };
  const filterState = {
    clearAllFilters,
    dateRange,
    filtersActive,
    jobCardFilter,
    listFilterConfig,
    listFilters,
    periodFiltered,
    replaceFilterUrl,
    search,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    showJobCardFilter,
  };
  const workspaceRows = {
    accountsQueries: filteredAccountsQueries,
    activity: filteredActivity,
    allTickets: filteredAllTickets,
    approvals: filteredApprovals,
    contractingQueries: filteredContractingQueries,
    expenses: filteredExpenses,
    hotels: filteredHotels,
    invoices: filteredInvoices,
    jobCards: filteredJobCards,
    leaves: filteredLeaves,
    passportTravellers: filteredPassportTravellers,
    pipelineQueries: filteredPipelineQueries,
    pnrs: filteredPnrs,
    proposals: filteredProposals,
    queries: filteredQueries,
    roomingTravellers: filteredRoomingTravellers,
    seats: filteredSeats,
    staff: filteredStaff,
    team: filteredTeam,
    tickets: filteredTickets,
    tourManagers: filteredTourManagers,
    travellers: filteredTravellers,
    visas: filteredVisas,
  };
  const modalControls = {
    closeModal,
    error,
    form,
    isSaving,
    modal,
    openModal,
    patchForm,
    submit,
    updateForm,
  };
  const commands = {
    applySavedView,
    clearAllFilters,
    closeModal,
    deleteItem,
    deleteSavedView,
    deleteSelected,
    openModal,
    saveCurrentView,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setSearchWithUrl,
    submit,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
  };
  const workspaceFacade = {
    commands,
    filters: filterState,
    modal: modalControls,
    rows: workspaceRows,
    savedViews: savedViewLinks,
    session,
  };

  return {
    access,
    accountsJobCardCreators,
    activity,
    addJobCardCollaborator,
    addProposalCollaborator,
    allowed,
    applySavedView,
    approvals,
    assignContracting,
    assignJobCardCreator,
    assignQueryTeams,
    assignQueryTicketing,
    attachExpenseProof,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    canFetch,
    canViewTravellers,
    clearAllFilters,
    closeModal,
    commands,
    commitFlightImport,
    commitPassengerImport,
    createExpense,
    createHotel,
    createInvoice,
    createJobCard,
    createLeave,
    createPnr,
    createProposal,
    createQuery,
    createTicket,
    createTourManager,
    createTraveller,
    createVisa,
    dateRange,
    decideApproval,
    decideExpenseFinance,
    decideExpenseManager,
    decideLeave,
    deepLinkHandledRef,
    deleteItem,
    deleteSavedView,
    deleteSelected,
    dropdowns,
    encryptAndStorePassport,
    error,
    expenses,
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredHotels,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredStaff,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
    filters: filterState,
    filtersActive,
    financeOverview,
    flightItinerary,
    form,
    gate,
    generateExpenseUploadUrl,
    generateFinalizedPdfUploadUrl,
    generateProposalUploadUrl,
    generateQueryUploadUrl,
    generateUploadUrl,
    getExpenseAttachmentUrl,
    getFinalizedPdfUrl,
    getPassengerExportRows,
    getPassportDocument,
    getProposalAttachmentUrl,
    getQueryAttachmentUrl,
    getTravellerPassportExpiryDates,
    has,
    hotels,
    invoices,
    isSaving,
    jobCardFilter,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    listFilterConfig,
    listFilters,
    markNotificationRead,
    markProposalSent,
    meta,
    modal,
    notifications,
    openModal,
    passportExpiryByTraveller,
    patchForm,
    pathname,
    pendingExpenseProofFiles,
    pendingProposalFiles,
    pendingQueryFiles,
    periodFiltered,
    pipelineMode,
    pnrs,
    previewPassengerImport,
    proposals,
    queries,
    removeApproval,
    removeExpense,
    removeExpenseProof,
    removeFinalizedPdf,
    removeHotel,
    removeInvoice,
    removeJobCard,
    removeJobCardCollaborator,
    removeLeave,
    removeManyHotels,
    removeManyPnrs,
    removeManySeatAllocations,
    removeManyTickets,
    removeManyTourManagers,
    removeManyTravellers,
    removeManyVisas,
    removeNotification,
    removePassport,
    removePnr,
    removeProposal,
    removeProposalAttachment,
    removeProposalCollaborator,
    removeQuery,
    removeQueryAttachment,
    removeSeatAllocation,
    removeStaff,
    removeTicket,
    removeTourManager,
    removeTraveller,
    removeVisa,
    replaceFilterUrl,
    reports,
    router,
    rows: workspaceRows,
    saveCurrentView,
    savedViews: savedViewLinks,
    saveSeat,
    search,
    searchParams,
    seats,
    sendProposalToSales,
    session,
    setDateRangeWithUrl,
    setJobCardCreatorAccess,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setPendingExpenseProofFiles,
    setPendingProposalFiles,
    setPendingQueryFiles,
    setPipelineMode: _setPipelineMode,
    setSearchWithUrl,
    showJobCardFilter,
    staff,
    startStaffOnboarding,
    submit,
    submitExpenseForApproval,
    submitToContracting,
    summary,
    team,
    ticketDashboard,
    tickets,
    toast,
    toggleSavedViewFavorite,
    toggleSavedViewPinned,
    tourManagers,
    travellerRows,
    travellers,
    travellersWithoutVisa,
    travellersWithPassportExpiry,
    updateCallingStatus,
    updateExpense,
    updateForm,
    updateHotel,
    updateInvoice,
    updateJobCard,
    updateJobStatus,
    updateLeave,
    updatePnr,
    updateProposal,
    updateQuery,
    updateQueryStatus,
    updateSeatAllocation,
    updateTicket,
    updateTourManager,
    updateTraveller,
    updateVisaRecord,
    upsertStaff,
    view,
    viewResultCount,
    visas,
    workspace: workspaceFacade,
  };
}
