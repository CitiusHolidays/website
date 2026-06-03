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
    applyLeaveMatrixDefaults,
    applyJobCardLink,
  applyPnrLink,
  applyQueryLink,
  applyTravellerLink,
  applyVisaRecordLink,
  reconcileLinkedSelections,
} from "@/lib/portal/entityModalLinks";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { hasActiveListFilters } from "@/lib/portal/listFilters";
import {
  uploadEntityFiles,
  uploadExpenseProofFiles,
  uploadQueryFiles,
} from "@/lib/portal/fileUploads";
import { toNumber } from "@/lib/portal/formUtils";
import { filterRows, pipeViewRows, VIEWS_WITH_JOB_CARD_FILTER } from "@/lib/portal/pipeViewRows";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { dateRangeQueryArg, EMPTY_DATE_RANGE, filterByDateRange } from "@/lib/portal/periodFilter";
import { isCementScopedUser } from "@/lib/portal/permissions";
import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";
import { runMutation } from "@/lib/portal/runMutation";
import { parseUrlFilterState, serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import { getExpenseSplitTotal } from "@/lib/portal/workflow";


const P = PORTAL_PERMISSIONS;
const _EMPTY_ARRAY = [];
const _EMPTY_OBJECT = {};
const _SPREADSHEET_MODALS = [
  "passengerImport",
  "flightImport",
  "passengerExport",
  "flightExport",
  "travellerImport",
  "travellerExport",
  "roomingImport",
  "roomingExport",
  "passportImport",
  "passportExport",
  "visaImport",
  "visaExport",
];

const VIEW_META = {
  dashboard: {
    title: "Dashboard",
    subtitle:
      "Your command center — act on urgent items, KPIs, and departures for the selected period.",
    permission: P.VIEW_DASHBOARD,
  },
  queries: {
    title: "All Sales Queries",
    subtitle: "Manage incoming MICE, group travel, FIT, B2B, cement, and spiritual enquiries.",
    permission: P.VIEW_QUERIES,
  },
  pipeline: {
    title: "Pipeline View",
    subtitle: "Track query movement from contracting to confirmed or lost.",
    permission: P.VIEW_QUERIES,
  },
  proposals: {
    title: "Proposals",
    subtitle: "Create, cost, and send proposals linked to active queries.",
    permission: P.VIEW_PROPOSALS,
  },
  contracting: {
    title: "Contracting Dashboard",
    subtitle: "Assign contracting SPOCs and move proposals through contracting statuses.",
    permission: P.VIEW_CONTRACTING,
  },
  "accounts-job-cards": {
    title: "Accounts / Job Card Creation",
    subtitle: "Create Job Card numbers only after order confirmation.",
    permission: P.MANAGE_JOB_CARDS,
  },
  "job-cards": {
    title: "Job Cards",
    subtitle: "Operational file control, progress, and pre-departure checklist status.",
    permission: P.VIEW_JOB_CARDS,
  },
  travellers: {
    title: "Traveller Master Sheet",
    subtitle:
      "Guest details, hubs, food preferences, rooming, visa, ticket, and TM calling status.",
    permission: P.VIEW_TRAVELLERS,
  },
  passport: {
    title: "Passport Documents",
    subtitle: "Upload, encrypt, and manage traveller passport scans.",
    permission: P.VIEW_VISA,
  },
  visa: {
    title: "Visa Tracking",
    subtitle:
      "Checklist, appointments, submission, approval, rejection, and re-application tracking.",
    permission: P.VIEW_VISA,
  },
  ticketing: {
    title: "Ticket Dashboard",
    subtitle: "Ticket status summary across active Job Cards.",
    permission: P.VIEW_TICKETING,
  },
  flights: {
    title: "Flights & PNR",
    subtitle: "Manage PNRs, routes, fare types, group seats, and airline records.",
    permission: P.VIEW_TICKETING,
  },
  "seat-allocation": {
    title: "Seat Allocation",
    subtitle: "Manual stored seat assignments, holds, and blocks.",
    permission: P.VIEW_TICKETING,
  },
  tickets: {
    title: "All Tickets",
    subtitle: "Issue, reissue, cancellation, name correction, and refund tracking.",
    permission: P.VIEW_TICKETING,
  },
  hotels: {
    title: "Hotel / Rooming List",
    subtitle: "Hotel arrangements, rooming, special instructions, and ground planning.",
    permission: P.VIEW_OPERATIONS,
  },
  "tour-managers": {
    title: "Tour Managers",
    subtitle: "TM assignment, calling status, availability, and active tour visibility.",
    permission: P.VIEW_TOUR_MANAGERS,
  },
  finance: {
    title: "Finance",
    subtitle: "Fund projections, invoices, received amounts, balances, and closure status.",
    permission: P.VIEW_FINANCE,
  },
  expenses: {
    title: "Expense Management",
    subtitle: "Tour-wise expenses, approval, and reimbursement tracking.",
    permission: P.VIEW_EXPENSES,
  },
  approvals: {
    title: "Approvals",
    subtitle: "Unified approval queue for expenses and finance handoffs.",
    permission: P.VIEW_APPROVALS,
  },
  reports: {
    title: "Reports",
    subtitle: "Revenue, headcount, and conversion snapshots for leadership review.",
    permission: P.VIEW_REPORTS,
  },
  team: {
    title: "Team Directory",
    subtitle: "Read-only staff directory by department, role, and location.",
    permission: P.VIEW_TEAM,
  },
  "employees-on-leave": {
    title: "Employees on Leave",
    subtitle: "Leave requests, approvals, and team availability.",
    permission: P.VIEW_LEAVE,
  },
  activity: {
    title: "Notifications / Activity Log",
    subtitle: "Audit trail for CRM status changes and workflow triggers.",
    permission: P.VIEW_ACTIVITY,
  },
  settings: {
    title: "Settings / Dropdown Management",
    subtitle: "Staff allowlist and workflow dropdown reference values.",
    permission: P.MANAGE_STAFF,
  },
};

const INITIAL_FORM = {
  clientName: "",
  contactPerson: "",
  contactMobile: "",
  destination: "",
  paxCount: "1",
  travelStartDate: "",
  travelEndDate: "",
  queryType: "MICE",
  travelType: "International Travel",
  budgetAmount: "",
  source: "Client",
  leadStage: "Inquiry",
  salesOwnerName: "",
  notes: "",
  queryCode: "",
  queryId: "",
  queryIds: [],
  proposalId: "",
  landCostPerPax: "",
  airfarePerPax: "",
  visaCostPerPax: "",
  sellingPrice: "",
  costPrice: "",
  taxRate: "",
  expenseType: "jobCard",
  itinerarySummary: "",
  ownerName: "",
  salesStatus: "Proposal in discussion",
  contractingStatus: "Proposal in progress",
  lostReason: "Price",
  contractingLandCost: "",
  contractingAirlinesCost: "",
  contractingVisaCost: "",
  approxMargin: "",
  confirmedPax: "1",
  roomCount: "",
  tourManagerName: "",
  jobCardId: "",
  fullName: "",
  travelHub: "",
  travelDate: "",
  guestCompanions: "",
  foodPreference: "Veg",
  guestType: "Employee",
  paymentType: "Company Paid",
  roomType: "Twin",
  visaRequired: "Yes",
  passportStatus: "Pending",
  hotelAllocation: "",
  domesticTravelRequired: "No",
  biometricAppointmentDate: "",
  extensionOfTour: "No",
  arrivingEarly: "No",
  visaRecordId: "",
  visaStatus: "Checklist Shared",
  appointmentDate: "",
  pnrCode: "",
  airline: "",
  route: "",
  fareType: "",
  totalSeats: "1",
  travellerId: "",
  pnrId: "",
  ticketNumber: "",
  ticketType: "FIT Ticket",
  ticketStatus: "Issued",
  cabinClass: "Economy",
  seatPreference: "",
  seatNumber: "",
  seatStatus: "Assigned",
  hotelName: "",
  city: "",
  checkInDate: "",
  checkOutDate: "",
  staffId: "",
  staffName: "",
  staffEmail: "",
  staffRoles: ["Sales"],
  staffActive: true,
  joiningDate: "",
  employmentStatus: "Confirmed",
  confirmationDate: "",
  leavePolicyGroup: "",
  leaveHeadApproverId: "",
  maternityEventsUsed: "0",
  paternityEventsUsed: "0",
  marriageLeaveUsed: false,
  invoiceNumber: "",
  expectedAmount: "",
  receivedAmount: "",
  dueDate: "",
  category: "",
  expenseDate: "",
  particulars: "",
  currency: "INR",
  cardAmount: "",
  cashAmount: "",
  epayAmount: "",
  amount: "",
  paidBy: "",
  department: "",
  leaveType: "Casual",
  startDate: "",
  endDate: "",
  reason: "",
  status: "Pending",
  entityId: "",
  approvalId: "",
  approvalStatus: "Rejected",
  decisionNote: "",
  salesDecision: "Proposal in discussion",
  ticketingStaffId: "",
  staffFunction: "",
  mobile: "",
  location: "",
};

const JOB_CARD_MODALS = new Set([
  "traveller",
  "pnr",
  "ticket",
  "seat",
  "hotel",
  "invoice",
  "expense",
]);

export function usePortalWorkspaceState(view = "dashboard", searchParams) {
  "use no memo";

  const router = useRouter();
  const pathname = usePathname();
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const bootstrapListFilterConfig = getListFilterConfig(view, { pipelineMode: "sales" });
  const initialUrlFilters = parseUrlFilterState(searchParams, bootstrapListFilterConfig);
  const [workspace, patchWorkspace, , dispatchWorkspace] = usePatchReducer({
    modal: null,
    form: INITIAL_FORM,
    pendingQueryFiles: [],
    pendingProposalFiles: [],
    pendingExpenseProofFiles: [],
    error: "",
    isSaving: false,
    pipelineMode: "sales",
    search: initialUrlFilters.search,
    dateRange: initialUrlFilters.dateRange,
    jobCardFilter: initialUrlFilters.jobCardFilter,
    listFilters: initialUrlFilters.listFilters,
    passportExpiryByTraveller: {},
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
  const setPassportExpiryByTraveller = (value) =>
    patchState({
      passportExpiryByTraveller:
        typeof value === "function" ? value(passportExpiryByTraveller) : value,
    });
  const listFilterConfig = getListFilterConfig(view, { pipelineMode });
  const dateRangeArg = dateRangeQueryArg(dateRange);
  const deepLinkOpen = searchParams.get("open");
  const deepLinkHandledRef = useRef("");

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const access = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const has = (permission) => Boolean(access?.permissions?.includes(permission));
  const meta = VIEW_META[view] || VIEW_META.dashboard;
  const allowed = access?.allowed && has(meta.permission);
  const canFetch = isAuthenticated && access?.allowed;

  const summary = useQuery(
    api.crm.dashboard.getPortalSummary,
    canFetch && allowed && view === "dashboard" ? { dateRange: dateRangeArg } : "skip",
  );
  const queries = useQuery(
    api.crm.queries.list,
    canFetch && (has(P.VIEW_QUERIES) || has(P.VIEW_CONTRACTING) || has(P.VIEW_JOB_CARDS))
      ? {}
      : "skip",
  );
  const proposals = useQuery(
    api.crm.proposals.list,
    canFetch && (has(P.VIEW_PROPOSALS) || has(P.MANAGE_JOB_CARDS)) ? {} : "skip",
  );
  const jobCards = useQuery(api.crm.jobCards.list, canFetch && has(P.VIEW_JOB_CARDS) ? {} : "skip");
  const travellers = useQuery(
    api.crm.travellers.list,
    canFetch && has(P.VIEW_TRAVELLERS) ? {} : "skip",
  );
  const visas = useQuery(api.crm.visa.list, canFetch && has(P.VIEW_VISA) ? {} : "skip");
  const ticketDashboard = useQuery(
    api.crm.ticketing.dashboard,
    canFetch && has(P.VIEW_TICKETING) ? { dateRange: dateRangeArg } : "skip",
  );
  const pnrs = useQuery(
    api.crm.ticketing.listPnrs,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip",
  );
  const tickets = useQuery(
    api.crm.ticketing.listTickets,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip",
  );
  const seats = useQuery(
    api.crm.ticketing.listSeatAllocations,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip",
  );
  const flightItinerary = useQuery(
    api.crm.imports.listFlightItinerary,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip",
  );
  const hotels = useQuery(api.crm.ops.listHotels, canFetch && has(P.VIEW_OPERATIONS) ? {} : "skip");
  const tourManagers = useQuery(
    api.crm.ops.listTourManagers,
    canFetch && has(P.VIEW_TOUR_MANAGERS) ? {} : "skip",
  );
  const invoices = useQuery(
    api.crm.finance.listInvoices,
    canFetch && has(P.VIEW_FINANCE) ? {} : "skip",
  );
  const expenses = useQuery(
    api.crm.finance.listExpenses,
    canFetch && (has(P.VIEW_EXPENSES) || deepLinkOpen === "approval") ? {} : "skip",
  );
  const financeOverview = useQuery(
    api.crm.finance.getFinanceOverview,
    canFetch && has(P.VIEW_FINANCE) && view === "finance" ? { dateRange: dateRangeArg } : "skip",
  );
  const approvals = useQuery(
    api.crm.approvals.list,
    canFetch && has(P.VIEW_APPROVALS) ? {} : "skip",
  );
  const reports = useQuery(
    api.crm.reports.overview,
    canFetch && has(P.VIEW_REPORTS) && view === "reports" ? { dateRange: dateRangeArg } : "skip",
  );
  const team = useQuery(api.crm.staff.listDirectory, canFetch && has(P.VIEW_TEAM) ? {} : "skip");
  const activity = useQuery(
    api.crm.activity.listActivity,
    canFetch && has(P.VIEW_ACTIVITY) ? { limit: 80 } : "skip",
  );
  const leaves = useQuery(api.crm.leave.list, canFetch && has(P.VIEW_LEAVE) ? {} : "skip");
  const leaveBalances = useQuery(
    api.crm.leave.balances,
    canFetch && has(P.VIEW_LEAVE) ? {} : "skip",
  );
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    canFetch ? { limit: 80 } : "skip",
  );
  const dropdowns = useQuery(
    api.crm.settings.listDropdowns,
    canFetch && view === "settings" ? {} : "skip",
  );
  const staff = useQuery(api.crm.staff.listStaff, canFetch && has(P.MANAGE_STAFF) ? {} : "skip");
  const leaveHeadApproverCandidates = useQuery(
    api.crm.leaveApprovers.listHeadApproverCandidates,
    canFetch && has(P.MANAGE_STAFF) ? {} : "skip",
  );
  const applyLeaveMatrixDefaults = useMutation(api.crm.leaveApprovers.applyMatrixDefaults);

  const createQuery = useMutation(api.crm.queries.create);
  const updateQuery = useMutation(api.crm.queries.update);
  const submitToContracting = useMutation(api.crm.queries.submitToContracting);
  const assignContracting = useMutation(api.crm.queries.assignContracting);
  const assignQueryTicketing = useMutation(api.crm.queries.assignQueryTicketing);
  const assignContractingOwner = useMutation(api.crm.jobCards.assignContractingOwner);
  const assignOperationsOwner = useMutation(api.crm.jobCards.assignOperationsOwner);
  const assignTicketingOwner = useMutation(api.crm.ticketing.assignTicketingOwner);
  const updateQueryStatus = useMutation(api.crm.queries.updateStatus);
  const createProposal = useMutation(api.crm.proposals.create);
  const updateProposal = useMutation(api.crm.proposals.update);
  const sendProposalToSales = useMutation(api.crm.proposals.sendToSales);
  const markProposalSent = useMutation(api.crm.proposals.markSent);
  const createJobCard = useMutation(api.crm.jobCards.createFromQuery);
  const updateJobCard = useMutation(api.crm.jobCards.update);
  const updateJobStatus = useMutation(api.crm.jobCards.updateStatus);
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
    api.crm.proposalAttachmentActions.generateFinalizedPdfUploadUrl,
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
    canFetch && has(P.VIEW_VISA) && (modal === "visa_create" || view === "visa") ? {} : "skip",
  );
  const createPnr = useMutation(api.crm.ticketing.createPnr);
  const updatePnr = useMutation(api.crm.ticketing.updatePnr);
  const previewPassengerImport = useAction(api.crm.importActions.previewPassengerImport);
  const commitPassengerImport = useAction(api.crm.importActions.commitPassengerImport);
  const getPassengerExportRows = useAction(api.crm.importActions.getPassengerExportRows);
  const getTravellerPassportExpiryDates = useAction(
    api.crm.passportActions.getTravellerPassportExpiryDates,
  );

  const canViewTravellers = Boolean(access?.permissions?.includes(P.VIEW_TRAVELLERS));

  useEffect(() => {
    if (!canFetch || !canViewTravellers) {
      return undefined;
    }
    if (view !== "travellers" && view !== "passport") {
      return undefined;
    }

    let cancelled = false;
    getTravellerPassportExpiryDates({ jobCardId: jobCardFilter || undefined })
      .then((dates) => {
        if (!cancelled) {
          dispatchWorkspace({
            type: "patch",
            patch: { passportExpiryByTraveller: dates || {} },
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          dispatchWorkspace({
            type: "patch",
            patch: { passportExpiryByTraveller: {} },
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
  const travellersWithPassportExpiry = !Object.keys(passportExpiryByTraveller).length
    ? travellerRows
    : travellerRows.map((row) => ({
        ...row,
        passportExpiryDate: passportExpiryByTraveller[row.id] ?? row.passportExpiryDate ?? "",
      }));
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
    queries: filterByDateRange(queries || [], dateRange, "createdAt"),
    proposals: filterByDateRange(proposals || [], dateRange, "createdAt"),
    jobCards: filterByDateRange(jobCards || [], dateRange, "createdAt"),
    travellers: filterByDateRange(travellersWithPassportExpiry, dateRange, "createdAt"),
    visas: filterByDateRange(visas || [], dateRange, "createdAt"),
    pnrs: filterByDateRange(pnrs || [], dateRange, "createdAt"),
    tickets: filterByDateRange(tickets || [], dateRange, "createdAt"),
    seats: filterByDateRange(seats || [], dateRange, "createdAt"),
    flightItinerary: filterByDateRange(flightItinerary || [], dateRange, "departureDate"),
    hotels: filterByDateRange(hotels || [], dateRange, "createdAt"),
    tourManagers: filterByDateRange(tourManagers || [], dateRange, "createdAt"),
    invoices: filterByDateRange(invoices || [], dateRange, "createdAt"),
    expenses: filterByDateRange(
      (expenses || []).map((row) => ({
        ...row,
        periodDate: row.expenseDate || row.createdAt,
      })),
      dateRange,
      "periodDate",
    ),
    approvals: filterByDateRange(approvals || [], dateRange, "createdAt"),
    leaves: filterByDateRange(leaves || [], dateRange, "createdAt"),
    activity: filterByDateRange(activity || [], dateRange, "createdAt"),
    notifications: filterByDateRange(notifications || [], dateRange, "createdAt"),
  };

  const filtersActive =
    Boolean(search.trim()) ||
    Boolean(jobCardFilter) ||
    Boolean(dateRange.from || dateRange.to) ||
    hasActiveListFilters(listFilters, listFilterConfig);

  const filteredQueries = pipeViewRows(periodFiltered.queries, {
    view: "queries",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: listFilterConfig,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
  });
  const filteredPipelineQueries = pipeViewRows(periodFiltered.queries, {
    view: "pipeline",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: listFilterConfig,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
  });
  const filteredContractingQueries = pipeViewRows(periodFiltered.queries, {
    view: "contracting",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("contracting"),
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType"],
  });
  const filteredProposals = pipeViewRows(periodFiltered.proposals, {
    view: "proposals",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("proposals"),
    search,
    searchKeys: ["proposalCode", "clientName", "preparedBy"],
  });
  const filteredAccountsQueries = pipeViewRows(periodFiltered.queries, {
    view: "accounts-job-cards",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("accounts-job-cards"),
    search,
    searchKeys: ["queryCode", "clientName", "destination"],
  });
  const filteredJobCards = pipeViewRows(periodFiltered.jobCards, {
    view: "job-cards",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("job-cards"),
    search,
    searchKeys: ["jobCode", "clientName", "destination"],
  });
  const filteredTravellers = pipeViewRows(periodFiltered.travellers, {
    view: "travellers",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("travellers"),
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "sourceDealerName"],
  });
  const filteredPassportTravellers = pipeViewRows(periodFiltered.travellers, {
    view: "passport",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("passport"),
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "passportStatus"],
  });
  const filteredVisas = pipeViewRows(periodFiltered.visas, {
    view: "visa",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("visa"),
    search,
    searchKeys: ["travellerName", "jobCode", "travelHub", "status"],
  });
  const filteredTickets = pipeViewRows(periodFiltered.tickets, {
    view: "ticketing",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("ticketing"),
    search,
    searchKeys: ["travellerName", "jobCode", "ticketNumber", "pnrCode"],
  });
  const filteredPnrs = pipeViewRows(periodFiltered.pnrs, {
    view: "flights",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("flights"),
    search,
    searchKeys: ["pnrCode", "airline", "route", "jobCode"],
  });
  const filteredAllTickets = pipeViewRows(periodFiltered.tickets, {
    view: "tickets",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("tickets"),
    search,
    searchKeys: ["ticketNumber", "travellerName", "jobCode", "pnrCode"],
  });
  const filteredSeats = pipeViewRows(periodFiltered.seats, {
    view: "seat-allocation",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("seat-allocation"),
    search,
    searchKeys: ["seatNumber", "jobCode"],
  });
  const filteredHotels = pipeViewRows(periodFiltered.hotels, {
    view: "hotels",
    dateRange,
    jobCardFilter,
    listFilters: {},
    filterConfig: [],
    search,
    searchKeys: ["name", "city", "jobCode"],
  });
  const filteredRoomingTravellers = pipeViewRows(
    periodFiltered.travellers.filter((row) => row.roomType || row.hotelAllocation),
    {
      view: "hotels",
      dateRange,
      jobCardFilter,
      listFilters,
      filterConfig: getListFilterConfig("hotels"),
      search,
      searchKeys: ["fullName", "jobCode", "travelHub", "hotelAllocation", "roomType"],
    },
  );
  const filteredTourManagers = pipeViewRows(periodFiltered.tourManagers, {
    view: "tour-managers",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("tour-managers"),
    search,
    searchKeys: ["name", "email", "phone", "jobCode"],
  });
  const filteredInvoices = pipeViewRows(periodFiltered.invoices, {
    view: "finance",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("finance"),
    search,
    searchKeys: ["invoiceNumber", "jobCode"],
  });
  const filteredExpenses = pipeViewRows(periodFiltered.expenses, {
    view: "expenses",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("expenses"),
    search,
    searchKeys: ["particulars", "paidBy", "tourManagerName", "jobCode"],
  });
  const filteredApprovals = pipeViewRows(periodFiltered.approvals, {
    view: "approvals",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("approvals"),
    search,
    searchKeys: ["requestCode", "summary", "requestedByName", "type"],
  });
  const filteredLeaves = pipeViewRows(periodFiltered.leaves, {
    view: "employees-on-leave",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("employees-on-leave"),
    search,
    searchKeys: ["staffName", "staffEmail", "department", "reason", "leaveType", "status"],
  });
  const filteredActivity = pipeViewRows(periodFiltered.activity, {
    view: "activity",
    dateRange,
    jobCardFilter,
    listFilters,
    filterConfig: getListFilterConfig("activity"),
    search,
    searchKeys: ["action", "summary", "entityType", "actorName"],
  });
  const filteredTeam = pipeViewRows(team || [], {
    view: "team",
    dateRange: EMPTY_DATE_RANGE,
    jobCardFilter: "",
    listFilters,
    filterConfig: getListFilterConfig("team"),
    search,
    searchKeys: ["name", "email", "department", "function", "location", "mobile", "roles"],
  });
  const filteredStaff = !staff
    ? staff
    : filterRows(staff, search, [
        "name",
        "email",
        "department",
        "function",
        "location",
        "mobile",
        "roles",
        "onboardingStatus",
      ]);

  const replaceFilterUrl = (nextFilters) => {
    if (!allowed) return;
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
      search: "",
      dateRange: EMPTY_DATE_RANGE,
      jobCardFilter: "",
      listFilters: {},
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
    replaceFilterUrl({ search: nextSearch, dateRange, jobCardFilter, listFilters });
  };

  const setDateRangeWithUrl = (value) => {
    const nextDateRange = typeof value === "function" ? value(dateRange) : value;
    setDateRange(nextDateRange);
    replaceFilterUrl({ search, dateRange: nextDateRange, jobCardFilter, listFilters });
  };

  const setJobCardFilterWithUrl = (value) => {
    const nextJobCardFilter = typeof value === "function" ? value(jobCardFilter) : value;
    setJobCardFilter(nextJobCardFilter);
    replaceFilterUrl({ search, dateRange, jobCardFilter: nextJobCardFilter, listFilters });
  };

  const setListFilterValue = (field, value) => {
    setListFilters((current) => {
      const next = { ...current };
      if (value) {
        next[field] = value;
      } else {
        delete next[field];
      }
      replaceFilterUrl({ search, dateRange, jobCardFilter, listFilters: next });
      return next;
    });
  };

  const openModal = (type, initial = {}) => {
    setError("");
    const next = { ...INITIAL_FORM, ...initial };
    if (type === "proposal") {
      next.queryIds = Array.isArray(next.queryIds)
        ? next.queryIds
        : next.queryId
          ? [next.queryId]
          : [];
      next.queryId = next.queryIds[0] || next.queryId || "";
    }
    if (next.queryId && (type === "jobCard" || type === "proposal")) {
      const linkedQuery = (queries || []).find((query) => query.id === next.queryId);
      if (linkedQuery) {
        Object.assign(next, applyQueryLink(next, linkedQuery, { onlyEmpty: true }));
      }
      if (type === "jobCard" && !next.proposalId) {
        const linkedProposal = (proposals || []).reduce((latest, proposal) => {
          if (!proposalLinkedQueryIds(proposal).includes(next.queryId)) return latest;
          if (!latest) return proposal;
          return new Date(proposal.updatedAt) > new Date(latest.updatedAt) ? proposal : latest;
        }, null);
        next.proposalId = linkedProposal?.id || "";
      }
    }
    if (JOB_CARD_MODALS.has(type) && !next.jobCardId && jobCards?.length === 1) {
      Object.assign(next, applyJobCardLink(next, jobCards[0], type, { onlyEmpty: true }));
    }
    if (JOB_CARD_MODALS.has(type) && next.jobCardId) {
      const linkedJob = (jobCards || []).find((job) => job.id === next.jobCardId);
      if (linkedJob) {
        Object.assign(next, applyJobCardLink(next, linkedJob, type, { onlyEmpty: true }));
      }
    }
    if (next.travellerId && ["ticket", "seat", "visa_create"].includes(type)) {
      const linkedTraveller =
        (travellers || []).find((traveller) => traveller.id === next.travellerId) ||
        (travellersWithoutVisa || []).find((traveller) => traveller.id === next.travellerId);
      if (linkedTraveller) {
        Object.assign(next, applyTravellerLink(next, linkedTraveller, type, { onlyEmpty: true }));
      }
    }
    if (next.pnrId && ["ticket", "seat"].includes(type)) {
      const linkedPnr = (pnrs || []).find((pnr) => pnr.id === next.pnrId);
      if (linkedPnr) {
        Object.assign(next, applyPnrLink(next, linkedPnr, type, { onlyEmpty: true }));
      }
    }
    if (next.visaRecordId && type === "visa") {
      const linkedVisa = (visas || []).find((visa) => visa.id === next.visaRecordId);
      if (linkedVisa) {
        Object.assign(next, applyVisaRecordLink(next, linkedVisa, { onlyEmpty: true }));
      }
    }
    Object.assign(next, reconcileLinkedSelections(next, travellers || [], pnrs || []));
    if (type === "query" && !initial.queryType && isCementScopedUser(access)) {
      next.queryType = "Cement";
    }
    setForm(next);
    setModal(type);
    if (type !== "query") setPendingQueryFiles([]);
    if (type !== "proposal") setPendingProposalFiles([]);
    if (type !== "expense") setPendingExpenseProofFiles([]);
  };

  const closeModal = () => {
    setModal(null);
    setForm(INITIAL_FORM);
    setPendingQueryFiles([]);
    setPendingProposalFiles([]);
    setPendingExpenseProofFiles([]);
    setError("");
    const params = serializeUrlFilterState(
      { search, dateRange, jobCardFilter, listFilters },
      listFilterConfig,
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

  const deleteItem = async (label, mutation, args, options = {}) => {
    setError("");
    const confirmMessage = options.confirmMessage || `Delete ${label}? This cannot be undone.`;
    const ok = await confirm({
      title: "Delete record",
      message: confirmMessage,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await runMutation({ label, showToast: toast, successMessage: `${label} deleted` }, () =>
        mutation(args),
      );
    } catch {
      // Toast already shown by runMutation
    }
  };

  const deleteSelected = async (count, entityLabel, mutation, buildArgs) => {
    setError("");
    if (count === 0) return false;
    const noun = count === 1 ? entityLabel : `${entityLabel}s`;
    const ok = await confirm({
      title: "Delete selected",
      message: `Delete ${count} selected ${noun}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return false;
    try {
      await runMutation({ showToast: toast, successMessage: `Deleted ${count} ${noun}` }, () =>
        mutation(buildArgs()),
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
          showToast: toast,
          successMessage: () => saveSuccessMessage,
          onError: (message) => setError(message),
        },
        async () => {
          if (JOB_CARD_MODALS.has(modal) && !form.jobCardId?.trim()) {
            throw new Error("Please select a job card.");
          }
          if (modal === "query") {
            if (form.entityId) {
              await updateQuery({
                queryId: form.entityId,
                clientName: form.clientName,
                contactPerson: form.contactPerson,
                contactMobile: form.contactMobile,
                destination: form.destination,
                paxCount: toNumber(form.paxCount, 1),
                travelStartDate: form.travelStartDate,
                travelEndDate: form.travelEndDate,
                queryType: form.queryType,
                travelType: form.travelType,
                budgetAmount: toNumber(form.budgetAmount, 0),
                source: form.source,
                salesOwnerName: form.salesOwnerName,
                notes: form.notes,
              });
            } else {
              const created = await createQuery({
                clientName: form.clientName,
                contactPerson: form.contactPerson,
                contactMobile: form.contactMobile,
                destination: form.destination,
                paxCount: toNumber(form.paxCount, 1),
                travelStartDate: form.travelStartDate,
                travelEndDate: form.travelEndDate,
                queryType: form.queryType,
                travelType: form.travelType,
                budgetAmount: toNumber(form.budgetAmount, 0),
                source: form.source,
                salesOwnerName: form.salesOwnerName,
                notes: form.notes,
              });
              if (pendingQueryFiles.length > 0) {
                await uploadQueryFiles({
                  queryId: created.id,
                  files: pendingQueryFiles,
                  generateUploadUrl: generateQueryUploadUrl,
                  attachQueryFile,
                });
              }
            }
          }
          if (modal === "assignContracting") {
            await assignContracting({ queryId: form.queryId, staffId: form.staffId });
          }
          if (modal === "assignQueryTicketing") {
            await assignQueryTicketing({
              queryId: form.queryId,
              staffId: form.ticketingStaffId || form.staffId,
            });
          }
          if (modal === "assignQueryTeams") {
            if (!form.queryId) {
              throw new Error("Select a query.");
            }
            if (form.staffId) {
              await assignContracting({ queryId: form.queryId, staffId: form.staffId });
            }
            const ticketingStaffId = form.ticketingStaffId?.trim();
            if (ticketingStaffId) {
              await assignQueryTicketing({ queryId: form.queryId, staffId: ticketingStaffId });
            }
            if (!form.staffId && !ticketingStaffId) {
              throw new Error("Select a contracting and/or ticketing SPOC.");
            }
          }
          if (modal === "assignContractingOwner") {
            await assignContractingOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
          }
          if (modal === "assignOperationsOwner") {
            await assignOperationsOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
          }
          if (modal === "assignTicketingOwner") {
            await assignTicketingOwner({ jobCardId: form.jobCardId, staffId: form.staffId });
          }
          if (modal === "queryStatus") {
            const payload = { queryId: form.queryId };
            if (has(P.MANAGE_CONTRACTING)) {
              payload.contractingStatus = form.contractingStatus;
              payload.contractingLandCost = toNumber(form.contractingLandCost, 0);
              payload.contractingAirlinesCost = toNumber(form.contractingAirlinesCost, 0);
              payload.contractingVisaCost = toNumber(form.contractingVisaCost, 0);
            }
            await updateQueryStatus(payload);
          }
          if (modal === "salesDecision") {
            const decision = form.salesDecision || form.salesStatus || "Proposal in discussion";
            const payload = {
              queryId: form.queryId,
              salesStatus: decision,
              leadStage:
                decision === "Order Confirmed"
                  ? "Confirmation"
                  : decision === "Order Lost"
                    ? "Lost"
                    : decision === "Date/Destination Change Required"
                      ? "Negotiation"
                      : "Proposal",
              lostReason: decision === "Order Lost" ? form.lostReason : undefined,
            };
            const queryRow = (queries || []).find((query) => query.id === form.queryId);
            const confirmingNow = decision === "Order Confirmed";
            const alreadyConfirmed =
              queryRow?.salesStatus === "Order Confirmed" ||
              queryRow?.contractingStatus === "Order Confirmed";
            if ((confirmingNow || alreadyConfirmed) && form.approxMargin !== "") {
              payload.approxMargin = toNumber(form.approxMargin, 0);
            }
            await updateQueryStatus(payload);
          }
          if (modal === "proposal") {
            let proposalResult = null;
            const proposalQueryIds =
              Array.isArray(form.queryIds) && form.queryIds.length > 0
                ? form.queryIds
                : form.queryId
                  ? [form.queryId]
                  : [];
            const proposalPayload = {
              queryIds: proposalQueryIds,
              clientName: form.clientName,
              landCostPerPax: toNumber(form.landCostPerPax, 0),
              airfarePerPax: toNumber(form.airfarePerPax, 0),
              visaCostPerPax: toNumber(form.visaCostPerPax, 0),
              sellingPrice: toNumber(form.sellingPrice, 0),
              ...(form.taxRate !== ""
                ? { taxRate: toNumber(form.taxRate, 0) }
                : form.entityId
                  ? { taxRate: null }
                  : {}),
              itinerarySummary: form.itinerarySummary,
            };
            if (form.entityId) {
              proposalResult = await updateProposal({
                proposalId: form.entityId,
                ...proposalPayload,
              });
            } else {
              proposalResult = await createProposal(proposalPayload);
            }
            const proposalId = form.entityId || proposalResult?.id;
            if (proposalId && pendingProposalFiles.length > 0) {
              await uploadEntityFiles({
                entityId: proposalId,
                idField: "proposalId",
                files: pendingProposalFiles,
                generateUploadUrl: generateProposalUploadUrl,
                attachFile: attachProposalFile,
              });
            }
          }
          if (modal === "jobCard") {
            if (form.entityId) {
              await updateJobCard({
                jobCardId: form.entityId,
                clientName: form.clientName,
                destination: form.destination,
                confirmedPax: toNumber(form.confirmedPax, 1),
                roomCount: toNumber(form.roomCount, 0),
                travelStartDate: form.travelStartDate,
                travelEndDate: form.travelEndDate,
                tourManagerName: form.tourManagerName,
              });
            } else {
              await createJobCard({
                queryId: form.queryId,
                proposalId: form.proposalId || undefined,
                clientName: form.clientName,
                destination: form.destination,
                confirmedPax: toNumber(form.confirmedPax, 1),
                roomCount: toNumber(form.roomCount, 0),
                travelStartDate: form.travelStartDate,
                travelEndDate: form.travelEndDate,
                tourManagerName: form.tourManagerName,
              });
            }
          }
          if (modal === "traveller") {
            const travellerPayload = {
              fullName: form.fullName,
              travelHub: form.travelHub,
              foodPreference: form.foodPreference,
              guestType: form.guestType,
              paymentType: form.paymentType,
              roomType: form.roomType,
              visaRequired: form.visaRequired === "Yes",
              domesticTravelRequired: form.domesticTravelRequired === "Yes",
              biometricAppointmentDate: form.biometricAppointmentDate,
              travelDate: form.travelDate,
              guestCompanions: form.guestCompanions,
              extensionOfTour: form.extensionOfTour === "Yes",
              arrivingEarly: form.arrivingEarly === "Yes",
              passportStatus: form.passportStatus,
              hotelAllocation: form.hotelAllocation,
              specialRequests: form.notes,
            };
            if (form.entityId) {
              await updateTraveller({ travellerId: form.entityId, ...travellerPayload });
            } else {
              await createTraveller({ jobCardId: form.jobCardId, ...travellerPayload });
            }
          }
          if (modal === "visa") {
            await updateVisaRecord({
              visaRecordId: form.visaRecordId,
              status: form.visaStatus,
              appointmentDate: form.appointmentDate,
              notes: form.notes,
            });
          }
          if (modal === "visa_create") {
            await createVisa({
              travellerId: form.travellerId,
              status: form.visaStatus,
            });
          }
          if (modal === "pnr") {
            if (form.entityId) {
              await updatePnr({
                pnrId: form.entityId,
                pnrCode: form.pnrCode,
                airline: form.airline,
                route: form.route,
                fareType: form.fareType,
                totalSeats: toNumber(form.totalSeats, 1),
              });
            } else {
              await createPnr({
                jobCardId: form.jobCardId,
                pnrCode: form.pnrCode,
                airline: form.airline,
                route: form.route,
                fareType: form.fareType,
                totalSeats: toNumber(form.totalSeats, 1),
              });
            }
          }
          if (modal === "ticket") {
            const ticketPayload = {
              travellerId: form.travellerId || undefined,
              pnrId: form.pnrId || undefined,
              ticketNumber: form.ticketNumber,
              ticketType: form.ticketType,
              ticketStatus: form.ticketStatus,
              paymentType: form.paymentType,
              cabinClass: form.cabinClass,
              mealPreference: form.foodPreference,
              seatPreference: form.seatPreference,
              seatNumber: form.seatNumber,
            };
            if (form.entityId) {
              await updateTicket({ ticketId: form.entityId, ...ticketPayload });
            } else {
              await createTicket({ jobCardId: form.jobCardId, ...ticketPayload });
            }
          }
          if (modal === "seat") {
            if (form.entityId) {
              await updateSeatAllocation({
                seatAllocationId: form.entityId,
                travellerId: form.travellerId || undefined,
                pnrId: form.pnrId || undefined,
                seatNumber: form.seatNumber,
                status: form.seatStatus,
                notes: form.notes,
              });
            } else {
              await saveSeat({
                jobCardId: form.jobCardId,
                travellerId: form.travellerId || undefined,
                pnrId: form.pnrId || undefined,
                seatNumber: form.seatNumber,
                status: form.seatStatus,
                notes: form.notes,
              });
            }
          }
          if (modal === "hotel") {
            if (form.entityId) {
              await updateHotel({
                hotelId: form.entityId,
                name: form.hotelName,
                city: form.city,
                checkInDate: form.checkInDate,
                checkOutDate: form.checkOutDate,
                specialInstructions: form.notes,
              });
            } else {
              await createHotel({
                jobCardId: form.jobCardId,
                name: form.hotelName,
                city: form.city,
                checkInDate: form.checkInDate,
                checkOutDate: form.checkOutDate,
                specialInstructions: form.notes,
              });
            }
          }
          if (modal === "tourManager") {
            const selectedTm = team.find((member) => member.id === form.staffId);
            if (form.entityId) {
              await updateTourManager({
                tourManagerId: form.entityId,
                jobCardId: form.jobCardId || undefined,
                name: selectedTm?.name || form.tourManagerName,
                email: form.staffEmail,
                phone: form.paidBy,
                availabilityDate: form.travelStartDate,
                notes: form.notes,
              });
            } else {
              await createTourManager({
                jobCardId: form.jobCardId || undefined,
                staffId: form.staffId || undefined,
                name: selectedTm?.name || form.tourManagerName,
                email: form.staffEmail,
                phone: form.paidBy,
                availabilityDate: form.travelStartDate,
                notes: form.notes,
              });
            }
          }
          if (modal === "invoice") {
            if (form.entityId) {
              await updateInvoice({
                invoiceId: form.entityId,
                invoiceNumber: form.invoiceNumber,
                expectedAmount: toNumber(form.expectedAmount, 0),
                receivedAmount: toNumber(form.receivedAmount, 0),
                dueDate: form.dueDate,
              });
            } else {
              await createInvoice({
                jobCardId: form.jobCardId,
                invoiceNumber: form.invoiceNumber,
                expectedAmount: toNumber(form.expectedAmount, 0),
                receivedAmount: toNumber(form.receivedAmount, 0),
                dueDate: form.dueDate,
              });
            }
          }
          if (modal === "expense") {
            const expenseTotal = getExpenseSplitTotal({
              cardAmount: form.cardAmount,
              cashAmount: form.cashAmount,
              epayAmount: form.epayAmount,
            });
            const expensePayload = {
              tourManagerName: form.tourManagerName,
              category: form.category,
              expenseDate: form.expenseDate,
              particulars: form.particulars,
              currency: form.currency,
              cardAmount: toNumber(form.cardAmount, 0),
              cashAmount: toNumber(form.cashAmount, 0),
              epayAmount: toNumber(form.epayAmount, 0),
              amount: expenseTotal,
              paidBy: form.paidBy,
              notes: form.notes,
            };
            let expenseResult = null;
            if (form.entityId) {
              expenseResult = await updateExpense({ expenseId: form.entityId, ...expensePayload });
            } else {
              expenseResult = await createExpense({
                jobCardId: form.expenseType === "jobCard" ? form.jobCardId : undefined,
                ...expensePayload,
              });
            }
            const expenseId = form.entityId || expenseResult?.id;
            if (expenseId && pendingExpenseProofFiles.length > 0) {
              await uploadExpenseProofFiles({
                expenseId,
                files: pendingExpenseProofFiles.slice(0, 1),
                generateUploadUrl: generateExpenseUploadUrl,
                attachExpenseProof,
              });
            }
          }
          if (modal === "staff") {
            const result = await upsertStaff({
              staffId: form.staffId || undefined,
              email: form.staffEmail,
              name: form.staffName,
              roles: form.staffRoles,
              department: form.department,
              function: form.staffFunction,
              mobile: form.mobile,
              location: form.location,
              joiningDate: form.joiningDate,
              employmentStatus: form.employmentStatus,
              confirmationDate: form.confirmationDate,
              leavePolicyGroup: form.leavePolicyGroup,
              leaveHeadApproverId: form.leaveHeadApproverId || undefined,
              maternityEventsUsed: toNumber(form.maternityEventsUsed, 0),
              paternityEventsUsed: toNumber(form.paternityEventsUsed, 0),
              marriageLeaveUsed: Boolean(form.marriageLeaveUsed),
              active: Boolean(form.staffActive),
            });
            if (result?.created) {
              saveSuccessMessage = `Staff added. A verification email was sent to ${form.staffEmail}. They must verify their email before receiving a password setup link.`;
            }
          }
          if (modal === "leave_create") {
            const leavePayload = {
              leaveType: form.leaveType,
              startDate: form.startDate,
              endDate: form.endDate,
              reason: form.reason,
            };
            if (form.entityId) {
              await updateLeave({ leaveId: form.entityId, ...leavePayload });
            } else if (has(P.MANAGE_LEAVE)) {
              await createLeave({
                staffId: form.staffId,
                ...leavePayload,
                status: form.status || "Pending",
              });
            } else {
              await createLeave(leavePayload);
            }
          }
          if (modal === "approvalDecide") {
            await decideApproval({
              approvalId: form.approvalId,
              status: form.approvalStatus,
              decisionNote: form.decisionNote,
            });
          }
          closeModal();
        },
      );
    } catch (err) {
      setError(err?.data || err?.message || "Unable to save.");
    }
    setIsSaving(false);
  };

  const gate =
    isAuthLoading || !isAuthenticated || access === undefined
      ? "loading"
      : !allowed
        ? "denied"
        : "ready";

  return {
    access,
    activity,
    allowed,
    approvals,
    assignContracting,
    assignQueryTicketing,
    attachExpenseProof,
    attachFinalizedPdf,
    attachProposalFile,
    attachQueryFile,
    applyLeaveMatrixDefaults,
    canFetch,
    canViewTravellers,
    clearAllFilters,
    closeModal,
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
    deepLinkHandledRef,
    deleteItem,
    decideApproval,
    decideLeave,
    flightItinerary,
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
    filtersActive,
    financeOverview,
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
    saveSeat,
    search,
    searchParams,
    seats,
    sendProposalToSales,
    setDateRangeWithUrl,
    setJobCardFilterWithUrl,
    setListFilterValue,
    setPendingExpenseProofFiles,
    setPendingProposalFiles,
    setPendingQueryFiles,
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
    visas,
    setPipelineMode: _setPipelineMode,
  };
}
