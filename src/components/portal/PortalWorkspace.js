"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useConvexAuth, useMutation, useQuery, useAction } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  Paperclip,
  Hotel,
  Loader2,
  MoreHorizontal,
  Plane,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import {
  CABIN_CLASSES,
  CALLING_STATUSES,
  CONTRACTING_STATUSES,
  EXPENSE_CURRENCIES,
  EXPENSE_HEADS,
  FOOD_PREFERENCES,
  GUEST_TYPES,
  LEAD_STAGES,
  LEAVE_TYPES,
  LOST_REASONS,
  PAYMENT_TYPES,
  PORTAL_PERMISSIONS,
  PORTAL_ROLES,
  QUERY_SOURCES,
  QUERY_TYPES,
  ROOM_TYPES,
  SALES_STATUSES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TRAVEL_TYPES,
  VISA_STATUSES,
} from "@/lib/portal/constants";
import { getExpenseSplitTotal, getPipelineBuckets, getSalesPipelineBuckets } from "@/lib/portal/workflow";
import {
  canAssignContracting,
  canAssignOperations,
  canAssignTicketing,
  canAssignTourManagers,
  teamSelectOptions,
} from "@/lib/portal/permissions";
import {
  buildModalInitial,
  getNotificationHref,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "@/lib/portal/notificationTargets";
import { api } from "@convex/_generated/api";
import {
  parseFlightWorkbookFile,
  parsePassengerWorkbookFile,
} from "@/lib/portal/spreadsheetImports";
import {
  buildFlightWorkbook,
  buildPassengerWorkbook,
  downloadWorkbook,
} from "@/lib/portal/spreadsheetExports";
import {
  filterByPeriod,
  PORTAL_PERIOD_OPTIONS,
} from "@/lib/portal/periodFilter";

const P = PORTAL_PERMISSIONS;

const VIEW_META = {
  dashboard: { title: "Dashboard", subtitle: "Live overview across active enquiries, jobs, tickets, visas, and payments.", permission: P.VIEW_DASHBOARD },
  queries: { title: "All Sales Queries", subtitle: "Manage incoming MICE, group travel, FIT, B2B, cement, and spiritual enquiries.", permission: P.VIEW_QUERIES },
  pipeline: { title: "Pipeline View", subtitle: "Track query movement from contracting to confirmed or lost.", permission: P.VIEW_QUERIES },
  proposals: { title: "Proposals", subtitle: "Create, cost, and send proposals linked to active queries.", permission: P.VIEW_PROPOSALS },
  contracting: { title: "Contracting Dashboard", subtitle: "Assign contracting owners and move proposals through contracting statuses.", permission: P.VIEW_CONTRACTING },
  "accounts-job-cards": { title: "Accounts / Job Card Creation", subtitle: "Create Job Card numbers only after order confirmation.", permission: P.MANAGE_JOB_CARDS },
  "job-cards": { title: "Job Cards", subtitle: "Operational file control, progress, and pre-departure checklist status.", permission: P.VIEW_JOB_CARDS },
  travellers: { title: "Traveller Master Sheet", subtitle: "Guest details, hubs, food preferences, rooming, visa, ticket, and TM calling status.", permission: P.VIEW_TRAVELLERS },
  passport: { title: "Passport Documents", subtitle: "Upload, encrypt, and manage traveller passport scans.", permission: P.VIEW_VISA },
  visa: { title: "Visa Tracking", subtitle: "Checklist, appointments, submission, approval, rejection, and re-application tracking.", permission: P.VIEW_VISA },
  ticketing: { title: "Ticket Dashboard", subtitle: "Ticket status summary across active Job Cards.", permission: P.VIEW_TICKETING },
  flights: { title: "Flights & PNR", subtitle: "Manage PNRs, routes, fare types, group seats, and airline records.", permission: P.VIEW_TICKETING },
  "seat-allocation": { title: "Seat Allocation", subtitle: "Manual stored seat assignments, holds, and blocks.", permission: P.VIEW_TICKETING },
  tickets: { title: "All Tickets", subtitle: "Issue, reissue, cancellation, name correction, and refund tracking.", permission: P.VIEW_TICKETING },
  hotels: { title: "Hotel / Rooming List", subtitle: "Hotel arrangements, rooming, special instructions, and ground planning.", permission: P.VIEW_OPERATIONS },
  "tour-managers": { title: "Tour Managers", subtitle: "TM assignment, calling status, availability, and active tour visibility.", permission: P.VIEW_TOUR_MANAGERS },
  finance: { title: "Finance", subtitle: "Fund projections, invoices, received amounts, balances, and closure status.", permission: P.VIEW_FINANCE },
  expenses: { title: "Expense Management", subtitle: "Tour-wise expenses, approval, and reimbursement tracking.", permission: P.VIEW_EXPENSES },
  approvals: { title: "Approvals", subtitle: "Unified approval queue for expenses and finance handoffs.", permission: P.VIEW_APPROVALS },
  reports: { title: "Reports", subtitle: "Revenue, headcount, and conversion snapshots for leadership review.", permission: P.VIEW_REPORTS },
  team: { title: "Team Directory", subtitle: "Read-only staff directory by department, role, and location.", permission: P.VIEW_TEAM },
  "employees-on-leave": { title: "Employees on Leave", subtitle: "Leave requests, approvals, and team availability.", permission: P.VIEW_LEAVE },
  activity: { title: "Notifications / Activity Log", subtitle: "Audit trail for CRM status changes and workflow triggers.", permission: P.VIEW_ACTIVITY },
  settings: { title: "Settings / Dropdown Management", subtitle: "Staff allowlist and workflow dropdown reference values.", permission: P.MANAGE_STAFF },
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
  proposalId: "",
  landCostPerPax: "",
  airfarePerPax: "",
  sellingPrice: "",
  costPrice: "",
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

function jobCardSelectOptions(jobCards, { required = false, allowUnassigned = false } = {}) {
  const options = jobCards.map((job) => ({
    value: job.id,
    label: `${job.jobCode} - ${job.clientName}`,
  }));
  if (allowUnassigned) {
    return [{ value: "", label: "Unassigned" }, ...options];
  }
  if (required) {
    return [{ value: "", label: "Select job card…" }, ...options];
  }
  return options;
}

function linkedTravellerOptions(travellers, jobCardId) {
  const rows = jobCardId ? travellers.filter((traveller) => traveller.jobCardId === jobCardId) : travellers;
  return [
    { value: "", label: jobCardId ? "Unassigned" : "Select job card first…" },
    ...rows.map((traveller) => ({
      value: traveller.id,
      label: `${traveller.fullName} - ${traveller.jobCode}`,
    })),
  ];
}

function linkedPnrOptions(pnrs, jobCardId) {
  const rows = jobCardId ? pnrs.filter((pnr) => pnr.jobCardId === jobCardId) : pnrs;
  return [
    { value: "", label: jobCardId ? "No PNR" : "Select job card first…" },
    ...rows.map((pnr) => ({
      value: pnr.id,
      label: `${pnr.pnrCode} - ${pnr.route}`,
    })),
  ];
}

function applyJobCardLink(form, job, modal, { onlyEmpty = false } = {}) {
  if (!job) return {};

  const patch = { jobCardId: job.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  if (modal === "traveller") {
    set("travelDate", job.travelStartDate);
  }
  if (modal === "hotel") {
    set("checkInDate", job.travelStartDate);
    set("checkOutDate", job.travelEndDate);
    set("city", job.destination);
  }
  if (modal === "expense" || modal === "tourManager") {
    set("tourManagerName", job.tourManagerName);
  }

  return patch;
}

function applyTravellerLink(form, traveller, modal, { onlyEmpty = false } = {}) {
  if (!traveller) return { travellerId: "" };

  const patch = { travellerId: traveller.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  if (traveller.jobCardId) {
    set("jobCardId", traveller.jobCardId);
  }
  if (modal === "ticket") {
    set("paymentType", traveller.paymentType);
    set("foodPreference", traveller.foodPreference);
  }

  return patch;
}

function applyPnrLink(form, pnr, modal, { onlyEmpty = false } = {}) {
  if (!pnr) return { pnrId: "" };

  const patch = { pnrId: pnr.id };
  if (pnr.jobCardId && (!onlyEmpty || !form.jobCardId)) {
    patch.jobCardId = pnr.jobCardId;
  }
  return patch;
}

function applyQueryLink(form, query, { onlyEmpty = false } = {}) {
  if (!query?.id) return {};

  const patch = { queryId: query.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  set("clientName", query.clientName);
  set("destination", query.destination || "");
  set("confirmedPax", String(query.paxCount || 1));
  set("travelStartDate", query.travelStartDate || "");
  set("travelEndDate", query.travelEndDate || "");
  set("paxCount", String(query.paxCount || 1));
  set("budgetAmount", query.budgetAmount ? String(query.budgetAmount) : "");
  return patch;
}

function applyVisaRecordLink(form, visa, { onlyEmpty = false } = {}) {
  if (!visa?.id) return {};

  const patch = { visaRecordId: visa.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") return;
    if (onlyEmpty && form[field]) return;
    patch[field] = value;
  };

  set("visaStatus", visa.status);
  set("appointmentDate", visa.appointmentDate || "");
  set("notes", visa.notes || "");
  return patch;
}

function reconcileLinkedSelections(form, travellers, pnrs) {
  const patch = {};

  if (form.travellerId) {
    const traveller = travellers.find((entry) => entry.id === form.travellerId);
    if (!traveller || (form.jobCardId && traveller.jobCardId !== form.jobCardId)) {
      patch.travellerId = "";
    }
  }

  if (form.pnrId) {
    const pnr = pnrs.find((entry) => entry.id === form.pnrId);
    if (!pnr || (form.jobCardId && pnr.jobCardId !== form.jobCardId)) {
      patch.pnrId = "";
    }
  }

  return patch;
}

export default function PortalWorkspace(props) {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <PortalWorkspaceInner {...props} />
    </Suspense>
  );
}

function PortalWorkspaceInner({ view = "dashboard" }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [pendingQueryFiles, setPendingQueryFiles] = useState([]);
  const [pendingProposalFiles, setPendingProposalFiles] = useState([]);
  const [pendingExpenseProofFiles, setPendingExpenseProofFiles] = useState([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [pipelineMode, setPipelineMode] = useState("sales");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkOpen = searchParams.get("open");
  const deepLinkHandledRef = useRef("");

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const access = useQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const has = (permission) => Boolean(access?.permissions?.includes(permission));
  const meta = VIEW_META[view] || VIEW_META.dashboard;
  const allowed = access?.allowed && has(meta.permission);
  const canFetch = isAuthenticated && access?.allowed;

  const summary = useQuery(api.crm.dashboard.getPortalSummary, canFetch && allowed && view === "dashboard" ? { period } : "skip");
  const queries = useQuery(api.crm.queries.list, canFetch && (has(P.VIEW_QUERIES) || has(P.VIEW_CONTRACTING) || has(P.VIEW_JOB_CARDS)) ? {} : "skip");
  const proposals = useQuery(api.crm.proposals.list, canFetch && (has(P.VIEW_PROPOSALS) || has(P.MANAGE_JOB_CARDS)) ? {} : "skip");
  const jobCards = useQuery(api.crm.jobCards.list, canFetch && has(P.VIEW_JOB_CARDS) ? {} : "skip");
  const travellers = useQuery(api.crm.travellers.list, canFetch && has(P.VIEW_TRAVELLERS) ? {} : "skip");
  const visas = useQuery(api.crm.visa.list, canFetch && has(P.VIEW_VISA) ? {} : "skip");
  const ticketDashboard = useQuery(api.crm.ticketing.dashboard, canFetch && has(P.VIEW_TICKETING) ? { period } : "skip");
  const pnrs = useQuery(api.crm.ticketing.listPnrs, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const tickets = useQuery(api.crm.ticketing.listTickets, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const seats = useQuery(api.crm.ticketing.listSeatAllocations, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const flightItinerary = useQuery(api.crm.imports.listFlightItinerary, canFetch && has(P.VIEW_TICKETING) ? {} : "skip");
  const hotels = useQuery(api.crm.ops.listHotels, canFetch && has(P.VIEW_OPERATIONS) ? {} : "skip");
  const tourManagers = useQuery(api.crm.ops.listTourManagers, canFetch && has(P.VIEW_TOUR_MANAGERS) ? {} : "skip");
  const invoices = useQuery(api.crm.finance.listInvoices, canFetch && has(P.VIEW_FINANCE) ? {} : "skip");
  const expenses = useQuery(api.crm.finance.listExpenses, canFetch && (has(P.VIEW_EXPENSES) || deepLinkOpen === "approval") ? {} : "skip");
  const financeOverview = useQuery(api.crm.finance.getFinanceOverview, canFetch && has(P.VIEW_FINANCE) && view === "finance" ? { period } : "skip");
  const approvals = useQuery(api.crm.approvals.list, canFetch && has(P.VIEW_APPROVALS) ? {} : "skip");
  const reports = useQuery(api.crm.reports.overview, canFetch && has(P.VIEW_REPORTS) && view === "reports" ? { period } : "skip");
  const team = useQuery(
    api.crm.staff.listDirectory,
    canFetch && has(P.VIEW_TEAM) ? {} : "skip",
  );
  const activity = useQuery(api.crm.activity.listActivity, canFetch && has(P.VIEW_ACTIVITY) ? { limit: 80 } : "skip");
  const leaves = useQuery(api.crm.leave.list, canFetch && has(P.VIEW_LEAVE) ? {} : "skip");
  const notifications = useQuery(api.crm.activity.listNotifications, canFetch ? { limit: 80 } : "skip");
  const dropdowns = useQuery(api.crm.settings.listDropdowns, canFetch && view === "settings" ? {} : "skip");
  const staff = useQuery(api.crm.staff.listStaff, canFetch && has(P.MANAGE_STAFF) ? {} : "skip");

  const createQuery = useMutation(api.crm.queries.create);
  const updateQuery = useMutation(api.crm.queries.update);
  const submitToContracting = useMutation(api.crm.queries.submitToContracting);
  const assignContracting = useMutation(api.crm.queries.assignContracting);
  const assignContractingOwner = useMutation(api.crm.jobCards.assignContractingOwner);
  const assignOperationsOwner = useMutation(api.crm.jobCards.assignOperationsOwner);
  const assignTicketingOwner = useMutation(api.crm.ticketing.assignTicketingOwner);
  const updateQueryStatus = useMutation(api.crm.queries.updateStatus);
  const createProposal = useMutation(api.crm.proposals.create);
  const updateProposal = useMutation(api.crm.proposals.update);
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
  const generateFinalizedPdfUploadUrl = useAction(api.crm.proposalAttachmentActions.generateFinalizedPdfUploadUrl);
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
  const removeVisa = useMutation(api.crm.visa.remove);
  const removePnr = useMutation(api.crm.ticketing.removePnr);
  const removeTicket = useMutation(api.crm.ticketing.removeTicket);
  const removeSeatAllocation = useMutation(api.crm.ticketing.removeSeatAllocation);
  const removeHotel = useMutation(api.crm.ops.removeHotel);
  const removeTourManager = useMutation(api.crm.ops.removeTourManager);
  const removeInvoice = useMutation(api.crm.finance.removeInvoice);
  const removeExpense = useMutation(api.crm.finance.removeExpense);
  const removeStaff = useMutation(api.crm.staff.removeStaff);
  const removeNotification = useMutation(api.crm.activity.removeNotification);
  const markNotificationRead = useMutation(api.crm.activity.markNotificationRead);

  const periodFiltered = useMemo(
    () => ({
      queries: filterByPeriod(queries || [], period, "createdAt"),
      proposals: filterByPeriod(proposals || [], period, "createdAt"),
      jobCards: filterByPeriod(jobCards || [], period, "createdAt"),
      travellers: filterByPeriod(travellers || [], period, "createdAt"),
      visas: filterByPeriod(visas || [], period, "createdAt"),
      pnrs: filterByPeriod(pnrs || [], period, "createdAt"),
      tickets: filterByPeriod(tickets || [], period, "createdAt"),
      seats: filterByPeriod(seats || [], period, "createdAt"),
      flightItinerary: filterByPeriod(flightItinerary || [], period, "departureDate"),
      hotels: filterByPeriod(hotels || [], period, "createdAt"),
      tourManagers: filterByPeriod(tourManagers || [], period, "createdAt"),
      invoices: filterByPeriod(invoices || [], period, "createdAt"),
      expenses: filterByPeriod(
        (expenses || []).map((row) => ({
          ...row,
          periodDate: row.expenseDate || row.createdAt,
        })),
        period,
        "periodDate",
      ),
      approvals: filterByPeriod(approvals || [], period, "createdAt"),
      leaves: filterByPeriod(leaves || [], period, "createdAt"),
      activity: filterByPeriod(activity || [], period, "createdAt"),
      notifications: filterByPeriod(notifications || [], period, "createdAt"),
    }),
    [
      queries,
      proposals,
      jobCards,
      travellers,
      visas,
      pnrs,
      tickets,
      seats,
      flightItinerary,
      hotels,
      tourManagers,
      invoices,
      expenses,
      approvals,
      leaves,
      activity,
      notifications,
      period,
    ],
  );

  const filteredQueries = useMemo(
    () => filterRows(periodFiltered.queries, search, ["queryCode", "clientName", "destination", "queryType"]),
    [periodFiltered.queries, search],
  );
  const filteredTeam = useMemo(
    () => filterRows(team || [], search, ["name", "email", "department", "function", "location"]),
    [team, search],
  );

  useEffect(() => {
    if (!modal || !JOB_CARD_MODALS.has(modal) || jobCards?.length !== 1) {
      return;
    }
    setForm((current) => {
      if (current.jobCardId) return current;
      const job = jobCards[0];
      return {
        ...current,
        ...applyJobCardLink(current, job, modal, { onlyEmpty: true }),
      };
    });
  }, [modal, jobCards]);

  const openModal = useCallback((type, initial = {}) => {
    setError("");
    const next = { ...INITIAL_FORM, ...initial };
    if (next.queryId && (type === "jobCard" || type === "proposal")) {
      const linkedQuery = (queries || []).find((query) => query.id === next.queryId);
      if (linkedQuery) {
        Object.assign(next, applyQueryLink(next, linkedQuery, { onlyEmpty: true }));
      }
      if (type === "jobCard" && !next.proposalId) {
        const linkedProposal = (proposals || [])
          .filter((proposal) => proposal.queryId === next.queryId)
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
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
    setForm(next);
    setModal(type);
    if (type !== "query") setPendingQueryFiles([]);
    if (type !== "proposal") setPendingProposalFiles([]);
    if (type !== "expense") setPendingExpenseProofFiles([]);
  }, [queries, proposals, jobCards, travellers, travellersWithoutVisa, pnrs, visas]);

  const closeModal = useCallback(() => {
    setModal(null);
    setForm(INITIAL_FORM);
    setPendingQueryFiles([]);
    setPendingProposalFiles([]);
    setPendingExpenseProofFiles([]);
    setError("");
    if (searchParams.get("open") || searchParams.get("queryId")) {
      router.replace(pathname);
    }
  }, [pathname, router, searchParams]);

  const deepLinkCollections = useMemo(
    () => ({
      queries,
      proposals,
      jobCards,
      tickets,
      leaves,
      expenses,
      approvals,
    }),
    [queries, proposals, jobCards, tickets, leaves, expenses, approvals],
  );

  useEffect(() => {
    const open = searchParams.get("open");
    const id = searchParams.get("id");
    const queryId = searchParams.get("queryId");
    if (!open) {
      deepLinkHandledRef.current = "";
      return;
    }
    if (!allowed || !canFetch) {
      return;
    }

    const signature = `${open}:${id || ""}:${queryId || ""}`;
    if (deepLinkHandledRef.current === signature) {
      return;
    }

    const resolved = resolveDeepLink({ open, id, queryId }, deepLinkCollections);
    if (resolved.status === "none" || resolved.status === "loading") {
      return;
    }

    if (resolved.status === "missing") {
      deepLinkHandledRef.current = signature;
      setError("The linked record could not be found. It may have been deleted.");
      router.replace(pathname);
      return;
    }

    if (!isDeepLinkDataReady(resolved.modal, deepLinkCollections)) {
      return;
    }

    const initial = buildModalInitial(
      resolved.modal,
      { entityId: resolved.entityId, queryId: resolved.queryId },
      deepLinkCollections,
    );
    if (!initial) {
      deepLinkHandledRef.current = signature;
      setError("The linked record could not be found. It may have been deleted.");
      router.replace(pathname);
      return;
    }

    deepLinkHandledRef.current = signature;
    openModal(resolved.modal, initial);
    router.replace(pathname);
  }, [
    allowed,
    canFetch,
    deepLinkCollections,
    openModal,
    pathname,
    router,
    searchParams,
  ]);

  if (isAuthLoading || !isAuthenticated || access === undefined) {
    return <LoadingPanel />;
  }

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="font-heading text-xl font-semibold text-citius-blue">No access to this portal page</div>
        <p className="mt-2 text-sm text-brand-muted">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const patchForm = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const deleteItem = async (label, mutation, args) => {
    setError("");
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }
    try {
      await mutation(args);
    } catch (err) {
      setError(err?.data || err?.message || "Unable to delete this record.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    try {
      if (JOB_CARD_MODALS.has(modal) && !form.jobCardId?.trim()) {
        setError("Please select a job card.");
        return;
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
        if (has(P.MANAGE_QUERIES)) {
          payload.salesStatus = form.salesStatus;
          payload.leadStage = form.leadStage;
          payload.lostReason =
            form.salesStatus === "Order Lost" || form.contractingStatus === "Order Lost"
              ? form.lostReason
              : undefined;
          const confirmingNow = form.salesStatus === "Order Confirmed";
          const queryRow = (queries || []).find((query) => query.id === form.queryId);
          const alreadyConfirmed =
            queryRow?.salesStatus === "Order Confirmed" ||
            queryRow?.contractingStatus === "Order Confirmed";
          if (confirmingNow || alreadyConfirmed) {
            if (form.approxMargin !== "") {
              payload.approxMargin = toNumber(form.approxMargin, 0);
            }
          }
        }
        if (has(P.MANAGE_CONTRACTING) && !has(P.MANAGE_QUERIES)) {
          payload.contractingStatus = form.contractingStatus;
          payload.lostReason = form.contractingStatus === "Order Lost" ? form.lostReason : undefined;
        }
        if (has(P.MANAGE_CONTRACTING) && has(P.MANAGE_QUERIES)) {
          payload.contractingStatus = form.contractingStatus;
        }
        if (has(P.MANAGE_CONTRACTING)) {
          payload.contractingLandCost = toNumber(form.contractingLandCost, 0);
          payload.contractingAirlinesCost = toNumber(form.contractingAirlinesCost, 0);
          payload.contractingVisaCost = toNumber(form.contractingVisaCost, 0);
        }
        await updateQueryStatus(payload);
      }
      if (modal === "proposal") {
        let proposalResult = null;
        const proposalPayload = {
          queryId: form.queryId || undefined,
          clientName: form.clientName,
          landCostPerPax: toNumber(form.landCostPerPax, 0),
          airfarePerPax: toNumber(form.airfarePerPax, 0),
          sellingPrice: toNumber(form.sellingPrice, 0),
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
          expenseResult = await createExpense({ jobCardId: form.jobCardId, ...expensePayload });
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
          active: Boolean(form.staffActive),
        });
        if (result?.created) {
          alert(
            `Staff added. A verification email was sent to ${form.staffEmail}. They must verify their email before receiving a password setup link.`,
          );
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
    } catch (err) {
      setError(err?.data || err?.message || "Unable to save. Check required fields and permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title={meta.title}
        subtitle={meta.subtitle}
        search={search}
        setSearch={setSearch}
        period={period}
        setPeriod={setPeriod}
        showPeriodFilter={view !== "settings"}
      >
        {renderHeaderAction(view, openModal, has, access)}
      </PageHeader>

      {error && !modal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {view === "dashboard" && <DashboardView summary={summary} has={has} />}
      {view === "queries" && (
        <QueriesView rows={filteredQueries} openModal={openModal} has={has} deleteItem={deleteItem} removeQuery={removeQuery} submitToContracting={submitToContracting} getQueryAttachmentUrl={getQueryAttachmentUrl} />
      )}
      {view === "pipeline" && <PipelineView rows={periodFiltered.queries} mode={pipelineMode} setMode={setPipelineMode} />}
      {view === "contracting" && (
        <ContractingView rows={filteredQueries} proposals={periodFiltered.proposals} team={team || []} openModal={openModal} has={has} canAssign={canAssignContracting(access)} deleteItem={deleteItem} removeQuery={removeQuery} />
      )}
      {view === "proposals" && (
        <ProposalsView
          rows={periodFiltered.proposals}
          markProposalSent={markProposalSent}
          openModal={openModal}
          has={has}
          deleteItem={deleteItem}
          removeProposal={removeProposal}
          getProposalAttachmentUrl={getProposalAttachmentUrl}
          getFinalizedPdfUrl={getFinalizedPdfUrl}
        />
      )}
      {view === "accounts-job-cards" && (
        <AccountsJobCardView rows={periodFiltered.queries} jobCards={periodFiltered.jobCards} openModal={openModal} />
      )}
      {view === "job-cards" && (
        <JobCardsView
          rows={periodFiltered.jobCards}
          updateJobStatus={updateJobStatus}
          openModal={openModal}
          has={has}
          access={access}
          deleteItem={deleteItem}
          removeJobCard={removeJobCard}
        />
      )}
      {view === "travellers" && <TravellersView rows={periodFiltered.travellers} openModal={openModal} has={has} deleteItem={deleteItem} removeTraveller={removeTraveller} />}
      {view === "passport" && (
        <PassportDocumentsView
          travellers={periodFiltered.travellers}
          rows={periodFiltered.visas}
          has={has}
          openModal={openModal}
          deleteItem={deleteItem}
          removeVisa={removeVisa}
          generateUploadUrl={generateUploadUrl}
          encryptAndStorePassport={encryptAndStorePassport}
          getPassportDocument={getPassportDocument}
          removePassport={removePassport}
        />
      )}
      {view === "visa" && (
        <VisaTrackingView
          rows={periodFiltered.visas}
          openModal={openModal}
          has={has}
          deleteItem={deleteItem}
          removeVisa={removeVisa}
        />
      )}
      {view === "ticketing" && <TicketDashboardView summary={ticketDashboard} tickets={periodFiltered.tickets} openModal={openModal} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />}
      {view === "flights" && <PnrView rows={periodFiltered.pnrs} itinerary={periodFiltered.flightItinerary} openModal={openModal} has={has} deleteItem={deleteItem} removePnr={removePnr} />}
      {view === "seat-allocation" && <SeatView rows={periodFiltered.seats} openModal={openModal} has={has} deleteItem={deleteItem} removeSeatAllocation={removeSeatAllocation} />}
      {view === "tickets" && <TicketsView rows={periodFiltered.tickets} openModal={openModal} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />}
      {view === "hotels" && <HotelsView rows={periodFiltered.hotels} openModal={openModal} has={has} deleteItem={deleteItem} removeHotel={removeHotel} />}
      {view === "tour-managers" && (
        <TourManagersView
          rows={periodFiltered.tourManagers}
          travellers={periodFiltered.travellers}
          openModal={openModal}
          has={has}
          canAssign={canAssignTourManagers(access)}
          deleteItem={deleteItem}
          removeTourManager={removeTourManager}
          updateCallingStatus={updateCallingStatus}
        />
      )}
      {view === "finance" && <FinanceView rows={periodFiltered.invoices} overview={financeOverview} openModal={openModal} has={has} deleteItem={deleteItem} removeInvoice={removeInvoice} />}
      {view === "expenses" && (
        <ExpensesView
          rows={periodFiltered.expenses}
          openModal={openModal}
          has={has}
          deleteItem={deleteItem}
          removeExpense={removeExpense}
          submitExpenseForApproval={submitExpenseForApproval}
          getExpenseAttachmentUrl={getExpenseAttachmentUrl}
          removeExpenseProof={removeExpenseProof}
        />
      )}
      {view === "approvals" && (
        <ApprovalsView
          rows={periodFiltered.approvals}
          has={has}
          openModal={openModal}
          decideApproval={decideApproval}
          deleteItem={deleteItem}
          removeApproval={removeApproval}
        />
      )}
      {view === "reports" && <ReportsView report={reports} />}
      {view === "team" && <TeamView rows={filteredTeam} />}
      {view === "employees-on-leave" && (
        <LeaveView
          rows={periodFiltered.leaves}
          staff={staff || team || []}
          access={access}
          openModal={openModal}
          has={has}
          deleteItem={deleteItem}
          removeLeave={removeLeave}
          decideLeave={decideLeave}
        />
      )}
      {view === "activity" && (
        <ActivityView
          activity={periodFiltered.activity}
          notifications={periodFiltered.notifications}
          deleteItem={deleteItem}
          removeNotification={removeNotification}
          markNotificationRead={markNotificationRead}
        />
      )}
      {view === "settings" && (
        <SettingsView staff={staff || []} dropdowns={dropdowns || {}} openModal={openModal} deleteItem={deleteItem} removeStaff={removeStaff} startStaffOnboarding={startStaffOnboarding} />
      )}

      <EntityModal
        modal={["passengerImport", "flightImport", "passengerExport", "flightExport"].includes(modal) ? null : modal}
        form={form}
        updateForm={updateForm}
        patchForm={patchForm}
        submit={submit}
        close={closeModal}
        error={error}
        isSaving={isSaving}
        queries={queries || []}
        proposals={proposals || []}
        jobCards={jobCards || []}
        travellers={travellers || []}
        visas={visas || []}
        pnrs={pnrs || []}
        team={team || []}
        travellersWithoutVisa={travellersWithoutVisa || []}
        pendingQueryFiles={pendingQueryFiles}
        setPendingQueryFiles={setPendingQueryFiles}
        pendingProposalFiles={pendingProposalFiles}
        setPendingProposalFiles={setPendingProposalFiles}
        pendingExpenseProofFiles={pendingExpenseProofFiles}
        setPendingExpenseProofFiles={setPendingExpenseProofFiles}
        generateQueryUploadUrl={generateQueryUploadUrl}
        attachQueryFile={attachQueryFile}
        getQueryAttachmentUrl={getQueryAttachmentUrl}
        removeQueryAttachment={removeQueryAttachment}
        generateProposalUploadUrl={generateProposalUploadUrl}
        attachProposalFile={attachProposalFile}
        getProposalAttachmentUrl={getProposalAttachmentUrl}
        removeProposalAttachment={removeProposalAttachment}
        generateFinalizedPdfUploadUrl={generateFinalizedPdfUploadUrl}
        attachFinalizedPdf={attachFinalizedPdf}
        getFinalizedPdfUrl={getFinalizedPdfUrl}
        removeFinalizedPdf={removeFinalizedPdf}
        getExpenseAttachmentUrl={getExpenseAttachmentUrl}
        removeExpenseProof={removeExpenseProof}
        has={has}
        access={access}
      />
      <PassengerImportModal
        open={modal === "passengerImport"}
        close={closeModal}
        jobCards={jobCards || []}
        previewPassengerImport={previewPassengerImport}
        commitPassengerImport={commitPassengerImport}
      />
      <FlightImportModal
        open={modal === "flightImport"}
        close={closeModal}
        jobCards={jobCards || []}
        itinerary={flightItinerary || []}
        commitFlightImport={commitFlightImport}
      />
      <PassengerExportModal
        open={modal === "passengerExport"}
        close={closeModal}
        jobCards={jobCards || []}
        getPassengerExportRows={getPassengerExportRows}
      />
      <FlightExportModal
        open={modal === "flightExport"}
        close={closeModal}
        jobCards={jobCards || []}
        itinerary={flightItinerary || []}
      />
    </div>
  );
}

function renderHeaderAction(view, openModal, has, access) {
  if (view === "travellers" && has(P.MANAGE_TRAVELLERS)) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openModal("passengerExport")} className="portal-small-btn bg-white">
          <Download size={16} />
          Export Passengers
        </button>
        <button type="button" onClick={() => openModal("passengerImport")} className="portal-small-btn bg-white">
          <Upload size={16} />
          Import Passengers
        </button>
        <button type="button" onClick={() => openModal("traveller")} className="portal-primary-btn">
          <Plus size={16} />
          Add Traveller
        </button>
      </div>
    );
  }
  if (view === "flights" && has(P.MANAGE_TICKETING)) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openModal("flightExport")} className="portal-small-btn bg-white">
          <Download size={16} />
          Export Flights
        </button>
        <button type="button" onClick={() => openModal("flightImport")} className="portal-small-btn bg-white">
          <Upload size={16} />
          Import Flights
        </button>
        <button type="button" onClick={() => openModal("pnr")} className="portal-primary-btn">
          <Plus size={16} />
          Add PNR
        </button>
      </div>
    );
  }
  const actions = {
    queries: has(P.MANAGE_QUERIES) && ["query", "New Query"],
    contracting: canAssignContracting(access) && ["assignContracting", "Assign Contracting"],
    proposals: has(P.MANAGE_PROPOSALS) && ["proposal", "New Proposal"],
    tickets: has(P.MANAGE_TICKETING) && ["ticket", "Issue Ticket"],
    "seat-allocation": has(P.MANAGE_TICKETING) && ["seat", "Save Seat"],
    hotels: has(P.MANAGE_OPERATIONS) && ["hotel", "Add Hotel"],
    "tour-managers": canAssignTourManagers(access) && ["tourManager", "Add Tour Manager"],
    expenses: has(P.MANAGE_EXPENSES) && ["expense", "Add Expense"],
    settings: has(P.MANAGE_STAFF) && ["staff", "Add Staff"],
    "employees-on-leave": (has(P.REQUEST_LEAVE) || has(P.MANAGE_LEAVE)) && ["leave_create", has(P.MANAGE_LEAVE) ? "Record Leave" : "Request Leave"],
  };
  const action = actions[view];
  if (!action) return null;
  return (
    <button type="button" onClick={() => openModal(action[0])} className="portal-primary-btn">
      <Plus size={16} />
      {action[1]}
    </button>
  );
}

function PageHeader({ title, subtitle, children, search, setSearch, period, setPeriod, showPeriodFilter = true }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h1 className="max-w-5xl font-heading text-3xl font-semibold leading-tight text-citius-blue md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-muted md:text-base">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {showPeriodFilter && (
          <label className="relative">
            <span className="sr-only">Time period</span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="portal-period-select h-11 w-full appearance-none rounded-full border border-brand-border bg-white px-2 pr-10 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-44"
              aria-label="Filter by time period"
            >
              {PORTAL_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted/60" size={16} />
          </label>
        )}
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted/60" size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-full border border-brand-border bg-white pl-9 pr-4 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-72"
            placeholder="Search current data"
          />
        </label>
        {children}
      </div>
    </motion.div>
  );
}

function DashboardView({ summary, has }) {
  if (!summary) return <LoadingPanel />;

  const metrics = [
    { label: "Active Queries", value: summary.metrics.activeQueries, Icon: ClipboardList, permission: P.VIEW_QUERIES },
    { label: "Proposals Sent", value: summary.metrics.proposalsSent, Icon: FileText, permission: P.VIEW_PROPOSALS },
    { label: "Confirmed Jobs", value: summary.metrics.confirmedJobs, Icon: CheckCircle2, permission: P.VIEW_QUERIES },
    { label: "Open Job Cards", value: summary.metrics.jobCardsOpen, Icon: BriefcaseIcon, permission: P.VIEW_JOB_CARDS },
    { label: "Tickets Issued", value: summary.metrics.ticketsIssued, Icon: Ticket, permission: P.VIEW_TICKETING },
    { label: "Tickets Pending", value: summary.metrics.ticketsPending, Icon: Plane, permission: P.VIEW_TICKETING },
    { label: "Visa Pending", value: summary.metrics.visaPending, Icon: ShieldCheck, permission: P.VIEW_VISA },
    { label: "Outstanding", value: money(summary.metrics.outstandingAmount), Icon: CircleDollarSign, permission: P.VIEW_FINANCE },
    { label: "Pending Approvals", value: summary.metrics.pendingApprovals, Icon: CheckCircle2, permission: P.VIEW_APPROVALS },
    { label: "Revenue Pipeline", value: money(summary.metrics.revenuePipeline), Icon: CircleDollarSign, permission: P.VIEW_FINANCE },
  ].filter((metric) => has(metric.permission));

  const departmentWorkflow = (summary.departmentWorkflow || []).filter((item) => {
    if (item.label.startsWith("Sales")) return has(P.VIEW_QUERIES);
    if (item.label.startsWith("Contracting")) return has(P.VIEW_CONTRACTING);
    if (item.label.startsWith("Ops")) return has(P.VIEW_JOB_CARDS);
    if (item.label.startsWith("Ticketing")) return has(P.VIEW_TICKETING);
    if (item.label.startsWith("Finance")) return has(P.VIEW_FINANCE);
    return true;
  });

  const urgentActions = (summary.urgentActions || []).filter((item) => {
    if (item.type === "approvals") return has(P.VIEW_APPROVALS);
    if (item.type === "finance") return has(P.VIEW_FINANCE);
    if (item.type === "accounts") return has(P.MANAGE_JOB_CARDS);
    if (item.type === "ticketing") return has(P.VIEW_TICKETING);
    return has(P.VIEW_QUERIES);
  });

  const showOpsProgress =
    has(P.VIEW_JOB_CARDS) ||
    has(P.VIEW_TRAVELLERS) ||
    has(P.VIEW_TICKETING) ||
    has(P.VIEW_VISA) ||
    has(P.VIEW_OPERATIONS) ||
    has(P.VIEW_FINANCE);

  const emptyQueryTypeCounts = () => QUERY_TYPES.map((type) => ({ type, count: 0 }));
  const queryTypeCounts = has(P.VIEW_QUERIES)
    ? (summary.queriesByType?.length ? summary.queriesByType : emptyQueryTypeCounts())
    : [];
  const confirmedQueryTypeCounts = has(P.VIEW_QUERIES)
    ? (summary.confirmedQueriesByType?.length
        ? summary.confirmedQueriesByType
        : emptyQueryTypeCounts())
    : [];
  const closedQueryTypeCounts = has(P.VIEW_QUERIES)
    ? (summary.closedQueriesByType?.length ? summary.closedQueriesByType : emptyQueryTypeCounts())
    : [];
  const activeQueryTotal = queryTypeCounts.reduce((sum, item) => sum + item.count, 0);
  const confirmedQueryTotal = confirmedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0);
  const closedQueryTotal = closedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-8">
      {metrics.length > 0 && (
        <section className="space-y-3">
          <DashboardSectionHeading title="Overview" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, Icon }, index) => (
              <StatCard key={label} label={label} value={value} Icon={Icon} index={index} />
            ))}
          </div>
        </section>
      )}
      {(queryTypeCounts.length > 0 ||
        confirmedQueryTypeCounts.length > 0 ||
        closedQueryTypeCounts.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {queryTypeCounts.length > 0 && (
            <section className="space-y-3">
              <DashboardSectionHeading
                title="Active queries by type"
                detail={`${activeQueryTotal.toLocaleString("en-IN")} open enquiries in this period`}
              />
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-4">
                {queryTypeCounts.map((item, index) => (
                  <QueryTypeTile key={`active-${item.type}`} type={item.type} count={item.count} index={index} />
                ))}
              </div>
            </section>
          )}
          {confirmedQueryTypeCounts.length > 0 && (
            <section className="space-y-3">
              <DashboardSectionHeading
                title="Confirmed queries by type"
                detail={`${confirmedQueryTotal.toLocaleString("en-IN")} order confirmed in this period`}
              />
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-4">
                {confirmedQueryTypeCounts.map((item, index) => (
                  <QueryTypeTile
                    key={`confirmed-${item.type}`}
                    type={item.type}
                    count={item.count}
                    index={index}
                    variant="confirmed"
                  />
                ))}
              </div>
            </section>
          )}
          {closedQueryTypeCounts.length > 0 && (
            <section className="space-y-3">
              <DashboardSectionHeading
                title="Closed queries by type"
                detail={`${closedQueryTotal.toLocaleString("en-IN")} order lost in this period`}
              />
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-4">
                {closedQueryTypeCounts.map((item, index) => (
                  <QueryTypeTile
                    key={`closed-${item.type}`}
                    type={item.type}
                    count={item.count}
                    index={index}
                    variant="closed"
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]"
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Active tours">
            {(summary.activeTours || []).length === 0 ? <EmptyState label="No active tours yet." /> : (
              <div className="space-y-4">
                {summary.activeTours.map((tour, index) => (
                  <motion.div
                    key={tour.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.35 }}
                    whileHover={{ y: -2 }}
                    className="overflow-hidden rounded-xl border border-brand-border bg-brand-light p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-brand-dark">{tour.jobCode} - {tour.clientName}</div>
                        <div className="text-xs text-brand-muted">{tour.destination || "Destination pending"} - {tour.pax} pax</div>
                      </div>
                      <Badge label={tour.status} tone="blue" />
                    </div>
                    <Progress label="Tickets issued" value={tour.ticketProgress} />
                    <Progress label="Visa approved" value={tour.visaProgress} />
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>
        )}
        <Panel title="Urgent actions">
          {urgentActions.length === 0 ? <EmptyState label="No urgent actions." /> : (
            <div className="space-y-3">
              {urgentActions.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.35 }}
                  className="rounded-xl border border-brand-border bg-white p-3 text-sm"
                >
                  <div className="font-medium text-brand-dark">{item.label}</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.type}</div>
                </motion.div>
              ))}
            </div>
          )}
        </Panel>
      </motion.div>
      {showOpsProgress && (
        <Panel title="Overall progress">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {has(P.VIEW_TICKETING) && <Progress label="Tickets issued / total pax" value={summary.progress.tickets.percent} />}
            {has(P.VIEW_VISA) && <Progress label="Visa approved / total pax" value={summary.progress.visas.percent} />}
            {has(P.VIEW_TRAVELLERS) && <Progress label="Guest data completed" value={summary.progress.guestData.percent} />}
            {has(P.VIEW_OPERATIONS) && <Progress label="Rooming completed" value={summary.progress.rooming.percent} />}
            {has(P.VIEW_FINANCE) && <Progress label="Payment received" value={summary.progress.payment.percent} />}
          </div>
        </Panel>
      )}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="grid gap-5 xl:grid-cols-2"
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Upcoming departures">
            {(summary.upcomingDepartures || []).length === 0 ? <EmptyState label="No upcoming departures." /> : (
              <DataTable compact rows={summary.upcomingDepartures} empty="No upcoming departures." columns={[
                ["JC", (row) => row.jobCode],
                ["Client", (row) => strong(row.clientName)],
                ["Date", (row) => row.travelStartDate],
                ["Pax", (row) => row.pax],
                ["TM", (row) => row.tourManagerName || "-"],
                ["Readiness", (row) => <Badge label={row.readiness} tone={statusTone(row.readiness)} />],
              ]} />
            )}
          </Panel>
        )}
        {has(P.VIEW_TEAM) && (
          <Panel title="My team">
            {(summary.myTeam || []).length === 0 ? <EmptyState label="No matching team members." /> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.myTeam.map((member) => (
                  <div key={member.id} className="rounded-xl border border-brand-border bg-brand-light p-4">
                    <div className="text-sm font-semibold text-brand-dark">{member.name}</div>
                    <div className="mt-1 text-xs text-brand-muted">{member.function || member.department}</div>
                    <div className="mt-1 text-xs text-brand-muted">{member.location || member.email}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </motion.div>
      {departmentWorkflow.length > 0 && (
        <Panel title="Department workflow">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {departmentWorkflow.map((item) => (
              <Progress key={item.label} label={`${item.label}: ${typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}`} value={item.percent} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function QueriesView({ rows, openModal, has, deleteItem, removeQuery, submitToContracting, getQueryAttachmentUrl }) {
  const renderQueryActions = (row) => has(P.MANAGE_QUERIES) && (
    <>
      <button type="button" className="portal-small-btn" onClick={() => openModal("query", {
        entityId: row.id,
        clientName: row.clientName,
        contactPerson: row.contactPerson,
        contactMobile: row.contactMobile,
        destination: row.destination,
        paxCount: String(row.paxCount),
        travelStartDate: row.travelStartDate,
        travelEndDate: row.travelEndDate,
        queryType: row.queryType,
        travelType: row.travelType,
        budgetAmount: String(row.budgetAmount || ""),
        source: row.source,
        salesOwnerName: row.salesOwnerName,
        notes: row.notes,
      })}>
        Edit
      </button>
      <button type="button" className="portal-small-btn" onClick={() => openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })}>
        Reference Itinerary
      </button>
      <button type="button" className="portal-small-btn" onClick={() => submitToContracting({ queryId: row.id })}>
        Submit
      </button>
      <button type="button" className="portal-small-btn" onClick={() => openModal("queryStatus", {
        queryId: row.id,
        salesStatus: row.salesStatus,
        leadStage: row.leadStage || "Inquiry",
        contractingStatus: row.contractingStatus,
        approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
      })}>
        Update
      </button>
      <DeleteButton label={row.queryCode} onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })} />
    </>
  );

  return (
    <DataTable
      rows={rows}
      empty="No queries yet."
      mobileCardRender={(row) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-brand-dark">{row.queryCode}</div>
              <div className="text-sm text-brand-muted">{row.clientName}</div>
            </div>
            <Badge label={row.leadStage || "Inquiry"} tone={statusTone(row.leadStage)} />
          </div>
          <LifecycleDates
            compact
            items={[
              { label: "Created", value: row.createdAt },
              { label: "Submitted", value: row.submittedToContractingAt },
              { label: "Confirmed", value: row.confirmedAt },
            ]}
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-brand-muted">Destination</span><div className="font-medium">{row.destination || "TBD"}</div></div>
            <div><span className="text-brand-muted">Pax</span><div className="font-medium">{row.paxCount}</div></div>
            <div><span className="text-brand-muted">Budget</span><div className="font-medium">{money(row.budgetAmount)}</div></div>
            <div><span className="text-brand-muted">Sales</span><div className="font-medium">{row.salesOwnerName || "-"}</div></div>
          </div>
          {has(P.MANAGE_QUERIES) && (
            <QueryRowActions
              primaryAction={(
                <button type="button" className="portal-small-btn" onClick={() => openModal("query", {
                  entityId: row.id,
                  clientName: row.clientName,
                  contactPerson: row.contactPerson,
                  contactMobile: row.contactMobile,
                  destination: row.destination,
                  paxCount: String(row.paxCount),
                  travelStartDate: row.travelStartDate,
                  travelEndDate: row.travelEndDate,
                  queryType: row.queryType,
                  travelType: row.travelType,
                  budgetAmount: String(row.budgetAmount || ""),
                  source: row.source,
                  salesOwnerName: row.salesOwnerName,
                  notes: row.notes,
                })}>
                  Edit
                </button>
              )}
              overflowActions={[
                <button key="ref" type="button" className="portal-small-btn w-full" onClick={() => openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })}>
                  Reference Itinerary
                </button>,
                <button key="submit" type="button" className="portal-small-btn w-full" onClick={() => submitToContracting({ queryId: row.id })}>
                  Submit
                </button>,
                <button key="update" type="button" className="portal-small-btn w-full" onClick={() => openModal("queryStatus", {
                  queryId: row.id,
                  salesStatus: row.salesStatus,
                  leadStage: row.leadStage || "Inquiry",
                  contractingStatus: row.contractingStatus,
                  approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
                })}>
                  Update
                </button>,
                <DeleteButton key="delete" label={row.queryCode} onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })} />,
              ]}
            />
          )}
        </div>
      )}
      columns={[
        ["Query ID", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        ["Created", (row) => <span className="text-xs text-brand-muted">{formatDate(row.createdAt)}</span>],
        ["Submitted", (row) => <span className="text-xs text-brand-muted">{formatDate(row.submittedToContractingAt)}</span>],
        ["Confirmed", (row) => <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>],
        ["Destination", (row) => row.destination || "TBD"],
        ["Pax", (row) => row.paxCount],
        ["Budget", (row) => money(row.budgetAmount)],
        ["Approx. Margin", (row) => (
          isQueryConfirmed(row)
            ? row.approxMargin != null ? money(row.approxMargin) : "-"
            : "-"
        )],
        ["Stage", (row) => <Badge label={row.leadStage || "Inquiry"} tone={statusTone(row.leadStage)} />],
        ["Type", (row) => <Badge label={row.queryType} tone="blue" />],
        ["Files", (row) => (
          <QueryAttachmentSummary
            attachments={row.attachments || []}
            canManage={has(P.MANAGE_QUERIES)}
            onManage={() => openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })}
            getQueryAttachmentUrl={getQueryAttachmentUrl}
          />
        )],
        ["Sales", (row) => row.salesOwnerName || "-"],
        ["Notes", (row) => notesPreview(row.notes)],
        ["Source", (row) => row.source || "-"],
        ["Action", (row) => has(P.MANAGE_QUERIES) && (
          <motion.div className="hidden flex-wrap gap-2 md:flex">
            {renderQueryActions(row)}
          </motion.div>
        )],
      ]}
    />
  );
}

function ContractingView({ rows, proposals, team, openModal, has, canAssign, deleteItem, removeQuery }) {
  const proposalsByQueryId = useMemo(() => {
    const map = new Map();
    for (const proposal of proposals) {
      if (!proposal.queryId) continue;
      const existing = map.get(proposal.queryId);
      if (
        !existing ||
        new Date(proposal.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
      ) {
        map.set(proposal.queryId, proposal);
      }
    }
    return map;
  }, [proposals]);

  const contractingTeam = team.filter((member) =>
    member.roles.some((role) => ["Contracting", "Contracting Head"].includes(role)),
  );
  const teamRows = contractingTeam.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    location: member.location || "-",
    activeQueries: rows.filter(
      (query) =>
        query.contractingOwnerName === member.name &&
        !["Order Confirmed", "Order Lost"].includes(query.contractingStatus),
    ).length,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {canAssign && (
        <Panel title="Contracting team">
          <DataTable
            compact
            rows={teamRows}
            empty="No contracting staff in the directory yet."
            columns={[
              ["Name", (row) => strong(row.name)],
              ["Email", (row) => row.email],
              ["Location", (row) => row.location],
              ["Active queries", (row) => row.activeQueries],
            ]}
          />
        </Panel>
      )}
    <DataTable
      rows={rows}
      empty="No contracting queries yet."
      columns={[
        ["Received", (row) => <span className="text-xs text-brand-muted">{formatDate(row.submittedToContractingAt || row.createdAt)}</span>],
        ["Query", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        ["Confirmed", (row) => <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>],
        ["Sales Owner", (row) => row.salesOwnerName || "-"],
        ["Contracting Owner", (row) => row.contractingOwnerName || "Unassigned"],
        ["Notes", (row) => notesPreview(row.notes)],
        ["Status", (row) => <Badge label={row.contractingStatus} tone={statusTone(row.contractingStatus)} />],
        ["Proposal Cost", (row) => {
          const proposal = proposalsByQueryId.get(row.id);
          if (!proposal) return "-";
          return (
            <button
              type="button"
              className="font-semibold text-citius-blue underline-offset-2 hover:underline"
              onClick={() => openModal("proposal", {
                entityId: proposal.id,
                queryId: proposal.queryId || "",
                clientName: proposal.clientName,
                landCostPerPax: String(proposal.landCostPerPax ?? ""),
                airfarePerPax: String(proposal.airfarePerPax ?? ""),
                sellingPrice: String(proposal.sellingPrice ?? ""),
                paxCount: String(proposal.query?.paxCount ?? row.paxCount ?? 1),
                itinerarySummary: proposal.itinerarySummary || "",
              })}
            >
              {money(proposal.costPrice)} ({proposal.proposalCode})
            </button>
          );
        }],
        ["Approx. Margin", (row) => (
          isQueryConfirmed(row)
            ? row.approxMargin != null ? money(row.approxMargin) : "-"
            : "-"
        )],
        ["Action", (row) => (
          <div className="flex gap-2">
            {canAssign && (
              <button className="portal-small-btn" onClick={() => openModal("assignContracting", { queryId: row.id })}>Assign</button>
            )}
            {has(P.MANAGE_CONTRACTING) && (
              <>
                <button className="portal-small-btn" onClick={() => openModal("queryStatus", {
                  queryId: row.id,
                  salesStatus: row.salesStatus,
                  leadStage: row.leadStage || "Inquiry",
                  contractingStatus: row.contractingStatus,
                  budgetAmount: String(row.budgetAmount || ""),
                  contractingLandCost: String(row.contractingLandCost ?? ""),
                  contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
                  contractingVisaCost: String(row.contractingVisaCost ?? ""),
                  approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
                })}>Status</button>
                <DeleteButton label={row.queryCode} onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })} />
              </>
            )}
          </div>
        )],
      ]}
    />
    </motion.div>
  );
}

function PipelineView({ rows, mode, setMode }) {
  const buckets = mode === "sales" ? getSalesPipelineBuckets(rows) : getPipelineBuckets(rows);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-brand-border bg-white p-1 shadow-sm">
        {[
          ["sales", "Sales pipeline"],
          ["contracting", "Contracting pipeline"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              mode === value ? "bg-citius-blue text-white" : "text-brand-muted hover:text-citius-blue"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(buckets).map(([stage, items], index) => (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
            className="min-h-36 rounded-2xl border border-brand-border bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between font-heading text-sm font-semibold text-citius-blue">
              {stage}
              <span className="grid h-7 w-7 place-items-center rounded-full bg-citius-orange text-xs font-bold text-white">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-xl border border-brand-border bg-brand-light p-3">
                  <div className="text-sm font-semibold text-brand-dark">{item.clientName}</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.queryCode} - {item.destination || "TBD"} - {item.paxCount} pax</div>
                  <div className="mt-1 text-xs text-brand-muted">{item.salesOwnerName || "Unassigned"}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProposalsView({ rows, markProposalSent, openModal, has, deleteItem, removeProposal, getProposalAttachmentUrl, getFinalizedPdfUrl }) {
  const canSend = has(P.SEND_PROPOSALS) || has(P.MANAGE_PROPOSALS);
  const canManage = has(P.MANAGE_PROPOSALS);

  return (
    <DataTable
      rows={rows}
      empty="No proposals yet."
      mobileCardRender={(row) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-brand-dark">{row.proposalCode}</div>
              <div className="text-sm text-brand-muted">{row.clientName}</div>
            </div>
            <Badge label={row.status} tone={statusTone(row.status)} />
          </div>
          <LifecycleDates
            compact
            items={[
              { label: "Created", value: row.createdAt },
              { label: "Sent", value: row.sentAt },
            ]}
          />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-brand-muted">Query</span><div className="font-medium">{row.query?.queryCode || "-"}</div></div>
            <div><span className="text-brand-muted">Total</span><div className="font-medium">{money(row.costPrice)}</div></div>
          </div>
        </div>
      )}
      columns={[
        ["Proposal", (row) => row.proposalCode],
        ["Client", (row) => strong(row.clientName)],
        ["Created", (row) => <span className="text-xs text-brand-muted">{formatDate(row.createdAt)}</span>],
        ["Sent", (row) => <span className="text-xs text-brand-muted">{formatDate(row.sentAt)}</span>],
        ["Linked Query", (row) => row.query?.queryCode || "-"],
        ["Land/Pax", (row) => money(row.landCostPerPax)],
        ["Airfare/Pax", (row) => money(row.airfarePerPax)],
        ["Total Cost", (row) => money(row.costPrice)],
        ["Selling", (row) => money(row.sellingPrice)],
        ["Finalized PDF", (row) => (
          <FinalizedProposalPdfSummary
            finalizedPdf={row.finalizedPdf}
            canSend={canSend}
            onManage={() => openModal("proposalFinalizedPdf", { proposalId: row.id, queryCode: row.proposalCode })}
            onDownload={() => openFinalizedProposalPdf(row.id, getFinalizedPdfUrl)}
          />
        )],
        ...(canManage ? [[
          "Working Files",
          (row) => (
            <QueryAttachmentSummary
              attachments={row.attachments || []}
              canManage={canManage}
              onManage={() => openModal("proposalAttachments", { proposalId: row.id, queryCode: row.proposalCode })}
              getQueryAttachmentUrl={getProposalAttachmentUrl}
              attachmentKind="proposal"
            />
          ),
        ]] : []),
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => (canSend || canManage) && (
          <div className="flex flex-wrap gap-2">
            {canSend && row.status !== "Sent" && (
              <button className="portal-small-btn" onClick={() => markProposalSent({ proposalId: row.id })}>
                <Send size={13} /> Mark Sent
              </button>
            )}
            {canManage && (
              <EditButton
                onClick={() => openModal("proposal", {
                  entityId: row.id,
                  queryId: row.queryId || "",
                  clientName: row.clientName,
                  landCostPerPax: String(row.landCostPerPax ?? ""),
                  airfarePerPax: String(row.airfarePerPax ?? ""),
                  sellingPrice: String(row.sellingPrice ?? ""),
                  paxCount: String(row.query?.paxCount ?? 1),
                  itinerarySummary: row.itinerarySummary || "",
                })}
              />
            )}
            {canManage && (
              <DeleteButton label={row.proposalCode} onClick={() => deleteItem(row.proposalCode, removeProposal, { proposalId: row.id })} />
            )}
          </div>
        )],
      ]}
    />
  );
}

function AccountsJobCardView({ rows, jobCards, openModal }) {
  const confirmed = rows.filter((row) => row.salesStatus === "Order Confirmed" || row.contractingStatus === "Order Confirmed");
  const jobByQuery = new Map(jobCards.filter((job) => job.queryId).map((job) => [job.queryId, job]));
  return (
    <div className="space-y-5">
      <Panel title="Payment terms reference">
        <DataTable
          compact
          rows={[
            { id: "mice", type: "MICE / MICE Bidding", advance: "70-90%", balance: "10-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "cement", type: "Cement", advance: "70-90%", balance: "10-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "cement-bid", type: "Cement Bidding", advance: "70-100%", balance: "0-30%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "fit", type: "FIT / Family Group", advance: "90-100%", balance: "0-10%", notify: "Sales, Contracting, Operations, Finance" },
            { id: "b2b", type: "B2B", advance: "80-100%", balance: "0-20%", notify: "Sales, Contracting, Finance" },
            { id: "spiritual", type: "Spiritual", advance: "Per plan", balance: "-", notify: "Sales, Operations, Finance" },
          ]}
          empty="No payment terms configured."
          columns={[
            ["Type", (row) => strong(row.type)],
            ["Advance", (row) => row.advance],
            ["Balance", (row) => row.balance],
            ["Notification", (row) => row.notify],
          ]}
        />
      </Panel>
      <DataTable
        rows={confirmed}
        empty="No confirmed orders waiting for Job Card creation."
        columns={[
          ["Query", (row) => row.queryCode],
          ["Client", (row) => strong(row.clientName)],
          ["Confirmed", (row) => <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>],
          ["Destination", (row) => row.destination || "TBD"],
          ["Pax", (row) => row.paxCount],
          ["Payment Terms", (row) => paymentTermLabel(row.queryType)],
          ["Job Card", (row) => {
            const linkedJob = jobByQuery.get(row.id);
            return linkedJob ? (
              <div>
                <Badge label={linkedJob.jobCode} tone="green" />
                <div className="mt-1 text-xs text-brand-muted">Opened {formatDate(linkedJob.createdAt)}</div>
              </div>
            ) : <Badge label="Not opened" tone="orange" />;
          }],
          ["Action", (row) => {
            const linkedJob = jobByQuery.get(row.id);
            if (linkedJob) {
              return <span className="text-xs font-semibold text-brand-muted">Linked to {linkedJob.jobCode}</span>;
            }
            return (
              <button className="portal-small-btn" onClick={() => openModal("jobCard", { queryId: row.id, clientName: row.clientName, destination: row.destination, confirmedPax: String(row.paxCount), travelStartDate: row.travelStartDate, travelEndDate: row.travelEndDate })}>
                Open JC
              </button>
            );
          }],
        ]}
      />
    </div>
  );
}

function JobCardsView({ rows, updateJobStatus, openModal, has, access, deleteItem, removeJobCard }) {
  const showAssignContracting = canAssignContracting(access) || canAssignOperations(access);
  const showAssignOps = canAssignOperations(access);
  const showAssignTicketing = canAssignTicketing(access);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.length === 0 ? <EmptyState label="No Job Cards yet." /> : rows.map((job, index) => (
        <motion.div
          key={job.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ y: -4 }}
          className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm transition-shadow hover:shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
            <div>
              <div className="font-semibold text-brand-dark">{job.clientName}</div>
              <div className="text-xs text-brand-muted">{job.jobCode} - {job.destination || "Destination pending"}</div>
              <div className="mt-1 text-xs text-brand-muted">Opened {formatDate(job.createdAt)}</div>
            </div>
            <Badge label={job.status} tone={statusTone(job.status)} />
          </div>
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between"><span>Confirmed pax</span><strong>{job.confirmedPax}</strong></div>
            <div className="flex justify-between"><span>Rooms</span><strong>{job.roomCount || "-"}</strong></div>
            <div className="flex justify-between"><span>Query</span><strong>{job.queryId ? "Linked" : "-"}</strong></div>
            <div className="flex justify-between"><span>Proposal</span><strong>{job.proposalId ? "Linked" : "-"}</strong></div>
            <div className="flex justify-between"><span>Contracting Owner</span><strong>{job.contractingOwnerName || "Unassigned"}</strong></div>
            <div className="flex justify-between"><span>Ops Owner</span><strong>{job.operationsOwnerName || "Unassigned"}</strong></div>
            <div className="flex justify-between"><span>Ticketing Owner</span><strong>{job.ticketingOwnerName || "Unassigned"}</strong></div>
            <div className="flex justify-between"><span>Tour Manager</span><strong>{job.tourManagerName || "Unassigned"}</strong></div>
            <div className="text-xs text-brand-muted">{job.paymentTerms?.label || "Payment terms pending"}</div>
            <div className="flex flex-wrap gap-2">
              {showAssignContracting && (
                <button className="portal-small-btn" onClick={() => openModal("assignContractingOwner", { jobCardId: job.id })}>Assign Contracting</button>
              )}
              {showAssignOps && (
                <button className="portal-small-btn" onClick={() => openModal("assignOperationsOwner", { jobCardId: job.id })}>Assign Ops</button>
              )}
              {showAssignTicketing && (
                <button className="portal-small-btn" onClick={() => openModal("assignTicketingOwner", { jobCardId: job.id })}>Assign Ticketing</button>
              )}
              {has(P.MANAGE_JOB_CARDS) && (
                <>
                  <EditButton
                    onClick={() => openModal("jobCard", {
                      entityId: job.id,
                      queryId: job.queryId || "",
                      proposalId: job.proposalId || "",
                      clientName: job.clientName,
                      confirmedPax: String(job.confirmedPax),
                      roomCount: String(job.roomCount || ""),
                      destination: job.destination,
                      travelStartDate: job.travelStartDate,
                      travelEndDate: job.travelEndDate,
                      tourManagerName: job.tourManagerName,
                    })}
                  />
                  <button className="portal-small-btn" onClick={() => updateJobStatus({ jobCardId: job.id, status: job.status === "Open" ? "In Operations" : "Ready for Departure" })}>
                    <RefreshCw size={13} /> Advance Status
                  </button>
                  <DeleteButton label={job.jobCode} onClick={() => deleteItem(job.jobCode, removeJobCard, { jobCardId: job.id })} />
                </>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TravellersView({ rows, openModal, has, deleteItem, removeTraveller }) {
  return (
    <DataTable rows={rows} empty="No travellers yet." columns={[
      ["Name", (row) => strong(row.fullName)],
      ["Job", (row) => row.jobCode],
      ["Hub", (row) => row.travelHub || "-"],
      ["Room", (row) => <Badge label={row.roomType} tone="blue" />],
      ["Food", (row) => <Badge label={row.foodPreference} tone="green" />],
      ["Passport", (row) => row.passportStatus || "Pending"],
      ["Ticket", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
      ["Visa", (row) => <Badge label={row.visaStatus} tone={statusTone(row.visaStatus)} />],
      ["TM Call", (row) => row.callingStatus],
      ["Action", (row) => has(P.MANAGE_TRAVELLERS) && (
        <div className="flex flex-wrap gap-2">
          <EditButton
            onClick={() => openModal("traveller", {
              entityId: row.id,
              jobCardId: row.jobCardId,
              fullName: row.fullName,
              travelHub: row.travelHub,
              travelDate: row.travelDate,
              guestCompanions: row.guestCompanions,
              foodPreference: row.foodPreference,
              guestType: row.guestType,
              paymentType: row.paymentType,
              roomType: row.roomType,
              visaRequired: row.visaRequired ? "Yes" : "No",
              domesticTravelRequired: row.domesticTravelRequired ? "Yes" : "No",
              biometricAppointmentDate: row.biometricAppointmentDate,
              extensionOfTour: row.extensionOfTour ? "Yes" : "No",
              arrivingEarly: row.arrivingEarly ? "Yes" : "No",
              passportStatus: row.passportStatus,
              hotelAllocation: row.hotelAllocation,
              notes: row.specialRequests || "",
            })}
          />
          <DeleteButton label={row.fullName} onClick={() => deleteItem(row.fullName, removeTraveller, { travellerId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function VisaTrackingView({ rows, openModal, has, deleteItem, removeVisa }) {
  return (
    <DataTable
      rows={rows}
      empty="No visa records yet."
      columns={[
        ["Traveller", (row) => strong(row.travellerName)],
        ["Job", (row) => row.jobCode],
        ["Hub", (row) => row.travelHub || "-"],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Appointment", (row) => row.appointmentDate || "-"],
        ["Notes", (row) => row.notes || "-"],
        ["Action", (row) => has(P.MANAGE_VISA) && (
          <div className="flex flex-wrap gap-2">
            <button
              className="portal-small-btn"
              onClick={() => openModal("visa", {
                entityId: row.id,
                visaRecordId: row.id,
                visaStatus: row.status,
                appointmentDate: row.appointmentDate,
                notes: row.notes,
              })}
            >
              Edit
            </button>
            <DeleteButton label={`${row.travellerName} visa`} onClick={() => deleteItem(`${row.travellerName} visa`, removeVisa, { visaRecordId: row.id })} />
          </div>
        )],
      ]}
    />
  );
}

function PassportDocumentsView({
  travellers,
  rows,
  has,
  openModal,
  deleteItem,
  removeVisa,
  generateUploadUrl,
  encryptAndStorePassport,
  getPassportDocument,
  removePassport,
}) {
  const [activeTab, setActiveTab] = useState("passports");
  const [uploadTraveller, setUploadTraveller] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [passportForm, setPassportForm] = useState({
    number: "",
    expiryDate: "",
    nationality: "",
    dateOfBirth: "",
  });
  const [viewingTravellerId, setViewingTravellerId] = useState(null); // spinner state for view

  const MAX_PASSPORT_FILE_BYTES = 15 * 1024 * 1024;

  const inferPassportMimeType = (file) => {
    if (file.type?.trim()) {
      return file.type.trim().toLowerCase();
    }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const byExtension = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    return byExtension[extension] ?? "";
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadTraveller) return;
    const fileInput = document.getElementById("passport-file-input");
    const file = fileInput?.files?.[0];
    if (!file) {
      setUploadError("Please select a passport scan file.");
      return;
    }
    if (file.size > MAX_PASSPORT_FILE_BYTES) {
      setUploadError("Passport scans must be 15 MB or smaller.");
      return;
    }
    const mimeType = inferPassportMimeType(file);
    if (!mimeType) {
      setUploadError("Passport scans must be PDF, JPEG, PNG, or WebP files.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage server.");
      }
      const { storageId } = await uploadRes.json();

      await encryptAndStorePassport({
        travellerId: uploadTraveller.id,
        tempStorageId: storageId,
        fileName: file.name,
        mimeType,
        fileSize: file.size,
        number: passportForm.number || undefined,
        expiryDate: passportForm.expiryDate || undefined,
        nationality: passportForm.nationality || undefined,
        dateOfBirth: passportForm.dateOfBirth || undefined,
      });

      setUploadTraveller(null);
      setPassportForm({ number: "", expiryDate: "", nationality: "", dateOfBirth: "" });
      alert("Passport scan uploaded and encrypted successfully!");
    } catch (err) {
      console.error(err);
      setUploadError(formatConvexError(err, "Failed to upload passport. Please try again."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleView = async (travellerId) => {
    setViewingTravellerId(travellerId);
    try {
      void getPassportDocument;
      openPortalFile(`/api/portal/files/passport/${encodeURIComponent(travellerId)}`);
    } catch (err) {
      console.error(err);
      alert(err?.data || err?.message || "Unable to decrypt passport scan.");
    } finally {
      setViewingTravellerId(null);
    }
  };

  const handleDeletePassport = async (travellerName, travellerId) => {
    if (!window.confirm(`Delete passport scan for ${travellerName}? This cannot be undone.`)) {
      return;
    }
    try {
      await removePassport({ travellerId });
      alert("Passport scan deleted successfully.");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Failed to delete passport scan.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-brand-border">
        <button
          onClick={() => setActiveTab("passports")}
          className={`px-4 py-2 font-heading font-medium border-b-2 transition-colors ${
            activeTab === "passports"
              ? "border-citius-blue text-citius-blue"
              : "border-transparent text-brand-muted hover:text-brand-dark"
          }`}
        >
          Passport Documents
        </button>
        <button
          onClick={() => setActiveTab("visas")}
          className={`px-4 py-2 font-heading font-medium border-b-2 transition-colors ${
            activeTab === "visas"
              ? "border-citius-blue text-citius-blue"
              : "border-transparent text-brand-muted hover:text-brand-dark"
          }`}
        >
          Visa Tracking
        </button>
      </div>

      {activeTab === "visas" && (
        <div className="space-y-4">
          {has(P.MANAGE_VISA) && (
            <div className="flex justify-end">
              <button className="portal-primary-btn" onClick={() => openModal("visa_create")}>
                <Plus size={16} />
                Create Visa Record
              </button>
            </div>
          )}
          <DataTable
            rows={rows}
            empty="No visa records yet."
            columns={[
              ["Traveller", (row) => strong(row.travellerName)],
              ["Job", (row) => row.jobCode],
              ["Hub", (row) => row.travelHub || "-"],
              ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
              ["Appointment", (row) => row.appointmentDate || "-"],
              ["Notes", (row) => row.notes || "-"],
              ["Action", (row) => has(P.MANAGE_VISA) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="portal-small-btn"
                    onClick={() => openModal("visa", {
                      entityId: row.id,
                      visaRecordId: row.id,
                      visaStatus: row.status,
                      appointmentDate: row.appointmentDate,
                      notes: row.notes,
                    })}
                  >
                    Edit
                  </button>
                  <DeleteButton label={`${row.travellerName} visa`} onClick={() => deleteItem(`${row.travellerName} visa`, removeVisa, { visaRecordId: row.id })} />
                </div>
              )],
            ]}
          />
        </div>
      )}

      {activeTab === "passports" && (
        <DataTable
          rows={travellers}
          empty="No travellers on record."
          columns={[
            ["Traveller", (row) => strong(row.fullName)],
            ["Job Code", (row) => row.jobCode],
            ["Client", (row) => row.clientName],
            ["Passport Scan Status", (row) => (
              <Badge
                label={row.passportStatus || "Pending"}
                tone={row.passportStatus === "Received" ? "green" : "orange"}
              />
            )],
            ["Action", (row) => (
              <div className="flex flex-wrap gap-2">
                {row.hasPassportScan ? (
                  <>
                    <button
                      className="portal-small-btn inline-flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
                      onClick={() => handleView(row.id)}
                      disabled={viewingTravellerId !== null}
                    >
                      {viewingTravellerId === row.id ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        "Decrypt & View"
                      )}
                    </button>
                    {has(P.MANAGE_VISA) && (
                      <button
                        className="portal-small-btn border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeletePassport(row.fullName, row.id)}
                      >
                        Delete Document
                      </button>
                    )}
                  </>
                ) : (
                  has(P.MANAGE_VISA) && (
                    <button
                      className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
                      onClick={() => setUploadTraveller(row)}
                    >
                      {row.passportStatus === "Received" ? "Upload Scan" : "Upload Passport Scan"}
                    </button>
                  )
                )}
              </div>
            )],
        ]}
      />
      )}

      {/* Local Passport Upload Modal */}
      {uploadTraveller && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleUpload}
            className="w-full max-w-lg rounded-2xl border border-brand-border bg-white shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h3 className="font-heading text-lg font-semibold text-citius-blue">
                Upload & Encrypt Passport: {uploadTraveller.fullName}
              </h3>
              <button
                type="button"
                onClick={() => setUploadTraveller(null)}
                className="text-brand-muted hover:text-brand-dark"
              >
                Close
              </button>
            </div>

            {uploadError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {uploadError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-brand-dark mb-1">
                  Passport Scan File (PDF, JPEG, PNG, WebP — max 15 MB) *
                </label>
                <input
                  type="file"
                  id="passport-file-input"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-brand-dark mb-1">
                    Passport Number
                  </label>
                  <input
                    type="text"
                    value={passportForm.number}
                    onChange={(e) => setPassportForm({ ...passportForm, number: e.target.value })}
                    placeholder="e.g. Z1234567"
                    className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-dark mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={passportForm.expiryDate}
                    onChange={(e) => setPassportForm({ ...passportForm, expiryDate: e.target.value })}
                    className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-brand-dark mb-1">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={passportForm.nationality}
                    onChange={(e) => setPassportForm({ ...passportForm, nationality: e.target.value })}
                    placeholder="e.g. Indian"
                    className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-brand-dark mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={passportForm.dateOfBirth}
                    onChange={(e) => setPassportForm({ ...passportForm, dateOfBirth: e.target.value })}
                    className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-brand-border pt-4">
              <button
                type="button"
                onClick={() => setUploadTraveller(null)}
                className="portal-small-btn border-brand-border text-brand-dark"
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="portal-small-btn bg-citius-blue text-white hover:bg-citius-blue/90 flex items-center gap-1"
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Encrypting & Saving...
                  </>
                ) : (
                  "Encrypt & Upload"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TicketDashboardView({ summary, tickets, openModal, has, deleteItem, removeTicket }) {
  if (!summary) return <LoadingPanel />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Issued" value={summary.issued} Icon={Ticket} />
        <StatCard label="Pending" value={summary.pending} Icon={Plane} />
        <StatCard label="Attention" value={summary.attention} Icon={RefreshCw} />
        <StatCard label="FIT Tickets" value={summary.fitTickets ?? 0} Icon={Ticket} />
        <StatCard label="Group Tickets" value={summary.groupTickets ?? 0} Icon={Users} />
        <StatCard label="PNRs" value={summary.pnrCount} Icon={FileText} />
        <StatCard label="Issued Seats" value={`${summary.issuedSeats}/${summary.totalSeats}`} Icon={Users} />
      </div>
      <TicketsView rows={tickets.slice(0, 8)} openModal={openModal} has={has} deleteItem={deleteItem} removeTicket={removeTicket} />
    </div>
  );
}

function PnrView({ rows, itinerary, openModal, has, deleteItem, removePnr }) {
  return (
    <div className="space-y-5">
      <Panel title="Flight Itinerary">
        <FlightItineraryList rows={itinerary} />
      </Panel>
      <Panel title="PNR Records">
        <DataTable rows={rows} empty="No PNRs yet." columns={[
          ["PNR", (row) => <span className="font-mono font-bold tracking-[0.14em] text-citius-blue">{row.pnrCode}</span>],
          ["Job", (row) => row.jobCode],
          ["Client", (row) => row.clientName],
          ["Airline", (row) => row.airline],
          ["Route", (row) => row.route],
          ["Fare", (row) => row.fareType || "-"],
          ["Seats", (row) => `${row.issuedSeats}/${row.totalSeats}`],
          ["Action", (row) => has(P.MANAGE_TICKETING) && (
            <div className="flex flex-wrap gap-2">
              <EditButton
                onClick={() => openModal("pnr", {
                  entityId: row.id,
                  jobCardId: row.jobCardId,
                  pnrCode: row.pnrCode,
                  airline: row.airline,
                  route: row.route,
                  fareType: row.fareType,
                  totalSeats: String(row.totalSeats),
                })}
              />
              <DeleteButton label={row.pnrCode} onClick={() => deleteItem(row.pnrCode, removePnr, { pnrId: row.id })} />
            </div>
          )],
        ]} />
      </Panel>
    </div>
  );
}

function FlightItineraryList({ rows }) {
  if (!rows) return <LoadingPanel />;
  if (rows.length === 0) return <EmptyState label="No flight itinerary imported yet." />;
  return (
    <div className="space-y-4">
      {rows.map((group) => (
        <div key={group.id} className="rounded-lg border border-brand-border bg-brand-light/30">
          <div className="flex flex-col gap-1 border-b border-brand-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-citius-blue">{group.name}</div>
              <div className="text-xs text-brand-muted">{group.jobCode} - {group.clientName}</div>
            </div>
            <div className="text-sm font-medium text-brand-dark">{group.route}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left text-xs font-semibold text-citius-blue/80">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Flight</th>
                  <th className="px-4 py-2">Depart</th>
                  <th className="px-4 py-2">Arrive</th>
                  <th className="px-4 py-2">Duration</th>
                  <th className="px-4 py-2">Transit</th>
                </tr>
              </thead>
              <tbody>
                {group.segments.map((segment) => (
                  <tr key={segment.id} className="border-t border-brand-border text-sm">
                    <td className="px-4 py-2">{segment.dateLabel}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium">{segment.airline}</span>
                      <span className="ml-2 font-mono text-xs text-brand-muted">{segment.flightNumber}</span>
                    </td>
                    <td className="px-4 py-2">{segment.departTime || "-"} {segment.origin}</td>
                    <td className="px-4 py-2">{segment.arriveTime || "-"} {segment.destination}</td>
                    <td className="px-4 py-2">{segment.duration || "-"}</td>
                    <td className="px-4 py-2">{segment.transit || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function TicketsView({ rows, openModal, has, deleteItem, removeTicket }) {
  return (
    <DataTable rows={rows} empty="No tickets yet." columns={[
      ["Ticket", (row) => row.ticketNumber || "-"],
      ["Traveller", (row) => strong(row.travellerName || "Unassigned")],
      ["Job", (row) => row.jobCode],
      ["Type", (row) => row.ticketType || "-"],
      ["PNR", (row) => row.pnrCode || "-"],
      ["Class", (row) => row.cabinClass || "Economy"],
      ["Seat", (row) => row.seatNumber || row.seatPreference || "-"],
      ["Status", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
      ["Action", (row) => has(P.MANAGE_TICKETING) && (
        <div className="flex flex-wrap gap-2">
          <EditButton
            onClick={() => openModal("ticket", {
              entityId: row.id,
              jobCardId: row.jobCardId,
              travellerId: row.travellerId || "",
              pnrId: row.pnrId || "",
              ticketNumber: row.ticketNumber,
              ticketType: row.ticketType,
              ticketStatus: row.ticketStatus,
              paymentType: row.paymentType,
              cabinClass: row.cabinClass,
              foodPreference: row.mealPreference,
              seatPreference: row.seatPreference,
              seatNumber: row.seatNumber,
            })}
          />
          <DeleteButton label={row.ticketNumber || "ticket"} onClick={() => deleteItem(row.ticketNumber || "ticket", removeTicket, { ticketId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function SeatView({ rows, openModal, has, deleteItem, removeSeatAllocation }) {
  return (
    <DataTable rows={rows} empty="No stored seat allocations yet." columns={[
      ["Seat", (row) => <span className="font-mono font-bold">{row.seatNumber}</span>],
      ["Traveller", (row) => row.travellerName || "Unassigned"],
      ["Job", (row) => row.jobCode],
      ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
      ["Notes", (row) => row.notes || "-"],
      ["Action", (row) => has(P.MANAGE_TICKETING) && (
        <div className="flex flex-wrap gap-2">
          <EditButton
            onClick={() => openModal("seat", {
              entityId: row.id,
              jobCardId: row.jobCardId,
              travellerId: row.travellerId || "",
              pnrId: row.pnrId || "",
              seatNumber: row.seatNumber,
              seatStatus: row.status,
              notes: row.notes,
            })}
          />
          <DeleteButton label={`seat ${row.seatNumber}`} onClick={() => deleteItem(`seat ${row.seatNumber}`, removeSeatAllocation, { seatAllocationId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function HotelsView({ rows, openModal, has, deleteItem, removeHotel }) {
  return (
    <DataTable rows={rows} empty="No hotel records yet." columns={[
      ["Hotel", (row) => strong(row.name)],
      ["Job", (row) => row.jobCode],
      ["Client", (row) => row.clientName],
      ["City", (row) => row.city || "-"],
      ["Check-in", (row) => row.checkInDate || "-"],
      ["Check-out", (row) => row.checkOutDate || "-"],
      ["Instructions", (row) => row.specialInstructions || "-"],
      ["Action", (row) => has(P.MANAGE_OPERATIONS) && (
        <div className="flex flex-wrap gap-2">
          <EditButton
            onClick={() => openModal("hotel", {
              entityId: row.id,
              jobCardId: row.jobCardId,
              hotelName: row.name,
              city: row.city,
              checkInDate: row.checkInDate,
              checkOutDate: row.checkOutDate,
              notes: row.specialInstructions,
            })}
          />
          <DeleteButton label={row.name} onClick={() => deleteItem(row.name, removeHotel, { hotelId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function TourManagersView({ rows, travellers, openModal, has, canAssign, deleteItem, removeTourManager, updateCallingStatus }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pax" value={travellers.length} Icon={Users} />
        <StatCard label="Onboarded" value={travellers.filter((row) => row.fullName && row.travelHub && row.foodPreference).length} Icon={CheckCircle2} />
        <StatCard label="Docs Pending" value={travellers.filter((row) => !["Approved", "Not Required"].includes(row.visaStatus) || row.ticketStatus !== "Issued").length} Icon={ShieldCheck} />
      </div>
      <Panel title="Calling status board">
        <DataTable compact rows={travellers} empty="No travellers to call yet." columns={[
          ["Guest", (row) => strong(row.fullName)],
          ["Job", (row) => row.jobCode],
          ["Hub", (row) => row.travelHub || "-"],
          ["Type", (row) => row.guestType],
          ["Cancellation", (row) => row.cancellation || row.lastMinuteDrop ? <Badge label="Flagged" tone="red" /> : "-"],
          ["Calling", (row) => <Badge label={row.callingStatus} tone={statusTone(row.callingStatus)} />],
          ["Action", (row) => has(P.MANAGE_TOUR_MANAGERS) && (
            <div className="flex flex-wrap gap-2">
              {CALLING_STATUSES.map((status) => (
                <button key={status} type="button" className="portal-small-btn" onClick={() => updateCallingStatus({ travellerId: row.id, callingStatus: status })}>
                  {status}
                </button>
              ))}
            </div>
          )],
        ]} />
      </Panel>
      <DataTable rows={rows} empty="No Tour Managers yet." columns={[
        ["Name", (row) => strong(row.name)],
        ["Current Tour", (row) => row.currentTour || "Available"],
        ["Job", (row) => row.jobCode || "-"],
        ["Calling", (row) => row.callingStatus],
        ["Available", (row) => row.availabilityDate || "-"],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => canAssign && (
          <div className="flex flex-wrap gap-2">
            <EditButton
              onClick={() => openModal("tourManager", {
                entityId: row.id,
                jobCardId: row.jobCardId || "",
                tourManagerName: row.name,
                staffEmail: row.email,
                paidBy: row.phone,
                travelStartDate: row.availabilityDate,
                notes: row.notes,
              })}
            />
            <DeleteButton label={row.name} onClick={() => deleteItem(row.name, removeTourManager, { tourManagerId: row.id })} />
          </div>
        )],
      ]} />
    </div>
  );
}

function FinanceView({ rows, overview, openModal, has, deleteItem, removeInvoice }) {
  return (
    <div className="space-y-5">
      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total Revenue" value={money(overview.summary.totalRevenue)} Icon={CircleDollarSign} />
            <StatCard label="Client Outstanding" value={money(overview.summary.clientOutstanding)} Icon={FileText} />
            <StatCard label="Approved Expenses" value={money(overview.summary.approvedExpenses)} Icon={ClipboardList} />
          </div>
          {overview.fundProjections && (
            <Panel title="Fund projections">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <StatCard label="Expected collections" value={money(overview.fundProjections.expectedCollections)} Icon={CircleDollarSign} />
                <StatCard label="Advance pipeline" value={money(overview.fundProjections.advancePipeline)} Icon={ClipboardList} />
                <StatCard label="Pending reimbursements" value={money(overview.fundProjections.pendingReimbursements)} Icon={RefreshCw} />
                <StatCard label="Expense approvals due" value={money(overview.fundProjections.pendingExpenseApprovals)} Icon={CheckCircle2} />
              </motion.div>
            </Panel>
          )}
          <Panel title="Tour-wise P&L">
            <DataTable compact rows={overview.pnl} empty="No Job Cards available." columns={[
              ["JC", (row) => row.jobCode],
              ["Group", (row) => row.clientName],
              ["Revenue", (row) => money(row.revenue)],
              ["Expense", (row) => money(row.expense)],
              ["Profit", (row) => money(row.profit)],
              ["Margin", (row) => `${row.marginPercent}%`],
            ]} />
          </Panel>
          <Panel title="Outstanding payments">
            <DataTable compact rows={overview.outstanding} empty="No outstanding balances." columns={[
              ["Client", (row) => strong(row.clientName)],
              ["JC", (row) => row.jobCode],
              ["Due", (row) => money(row.dueAmount)],
              ["Due Date", (row) => row.dueDate || "-"],
              ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
            ]} />
          </Panel>
        </>
      )}
      <DataTable rows={rows} empty="No invoices yet." columns={[
        ["Invoice", (row) => strong(row.invoiceNumber)],
        ["Job", (row) => row.jobCode],
        ["Client", (row) => row.clientName],
        ["Expected", (row) => money(row.expectedAmount)],
        ["Received", (row) => money(row.receivedAmount)],
        ["Balance", (row) => money(row.balanceAmount)],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Action", (row) => has(P.MANAGE_FINANCE) && (
          <div className="flex flex-wrap gap-2">
            <EditButton
              onClick={() => openModal("invoice", {
                entityId: row.id,
                jobCardId: row.jobCardId,
                invoiceNumber: row.invoiceNumber,
                expectedAmount: String(row.expectedAmount),
                receivedAmount: String(row.receivedAmount),
                dueDate: row.dueDate,
              })}
            />
            <DeleteButton label={row.invoiceNumber} onClick={() => deleteItem(row.invoiceNumber, removeInvoice, { invoiceId: row.id })} />
          </div>
        )],
      ]} />
    </div>
  );
}

function ExpensesView({
  rows,
  openModal,
  has,
  deleteItem,
  removeExpense,
  submitExpenseForApproval,
  getExpenseAttachmentUrl,
  removeExpenseProof,
}) {
  return (
    <DataTable rows={rows} empty="No expenses yet." columns={[
      ["Job", (row) => row.jobCode],
      ["Date", (row) => row.expenseDate || "-"],
      ["Category", (row) => strong(row.category)],
      ["Particulars", (row) => row.particulars || "-"],
      ["Currency", (row) => row.currency],
      ["Amount", (row) => money(row.amount)],
      ["Split", (row) => `Card ${money(row.cardAmount)} / Cash ${money(row.cashAmount)} / E-Pay ${money(row.epayAmount)}`],
      ["Paid By", (row) => row.paidBy],
      ["Proof", (row) => row.proofAttachment ? (
        <button
          className="portal-small-btn"
          onClick={() => openQueryAttachment(row.proofAttachment.id, getExpenseAttachmentUrl, "expense")}
        >
          {row.proofAttachment.fileName}
        </button>
      ) : "-"],
      ["Approval", (row) => <Badge label={row.approvalStatus} tone={statusTone(row.approvalStatus)} />],
      ["Reimbursement", (row) => row.reimbursementStatus],
      ["Action", (row) => has(P.MANAGE_EXPENSES) && (
        <div className="flex flex-wrap gap-2">
          {row.approvalStatus !== "Approved" && (
            <EditButton
              onClick={() => openModal("expense", {
                entityId: row.id,
                jobCardId: row.jobCardId,
                tourManagerName: row.tourManagerName,
                category: row.category,
                expenseDate: row.expenseDate,
                particulars: row.particulars,
                currency: row.currency,
                cardAmount: String(row.cardAmount),
                cashAmount: String(row.cashAmount),
                epayAmount: String(row.epayAmount),
                amount: String(row.amount),
                paidBy: row.paidBy,
                notes: row.notes,
              })}
            />
          )}
          <button className="portal-small-btn" onClick={() => submitExpenseForApproval({ expenseId: row.id })}>
            Submit
          </button>
          {row.proofAttachment && (
            <button
              className="portal-small-btn"
              onClick={() => removeExpenseProof({ attachmentId: row.proofAttachment.id }).catch((err) => {
                alert(err?.data || err?.message || "Unable to remove proof.");
              })}
            >
              Remove Proof
            </button>
          )}
          <DeleteButton label={`${row.category} expense`} onClick={() => deleteItem(`${row.category} expense`, removeExpense, { expenseId: row.id })} />
        </div>
      )],
    ]} />
  );
}

function ApprovalsView({ rows, has, openModal, decideApproval, deleteItem, removeApproval }) {
  return (
    <DataTable rows={rows} empty="No approvals in the queue." columns={[
      ["Code", (row) => strong(row.requestCode)],
      ["Type", (row) => <Badge label={row.type} tone="blue" />],
      ["Requested By", (row) => row.requestedByName],
      ["Summary", (row) => row.summary],
      ["Amount", (row) => money(row.amount)],
      ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
      ["Note", (row) => row.decisionNote || "-"],
      ["Action", (row) => has(P.APPROVE_EXPENSES) && (
        <div className="flex flex-wrap gap-2">
          {row.status === "Pending" && (
            <>
              <button className="portal-small-btn" onClick={() => decideApproval({ approvalId: row.id, status: "Approved" })}>Approve</button>
              <button className="portal-small-btn" onClick={() => openModal("approvalDecide", { approvalId: row.id, approvalStatus: "Needs Info", decisionNote: "" })}>Request Details</button>
              <button className="portal-danger-btn" onClick={() => openModal("approvalDecide", { approvalId: row.id, approvalStatus: "Rejected", decisionNote: "" })}>Reject</button>
            </>
          )}
          {row.status !== "Pending" && (
            <DeleteButton label={row.requestCode} onClick={() => deleteItem(row.requestCode, removeApproval, { approvalId: row.id })} />
          )}
        </div>
      )],
    ]} />
  );
}

function ReportsView({ report }) {
  if (!report) return <LoadingPanel />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pipeline Budget" value={money(report.summary.totalPipelineBudget)} Icon={CircleDollarSign} />
        <StatCard label="Confirmed Revenue" value={money(report.summary.confirmedRevenue)} Icon={CheckCircle2} />
        <StatCard label="Confirmed / Lost" value={`${report.summary.confirmedQueries}/${report.summary.lostQueries}`} Icon={ClipboardList} />
      </div>
      <Panel title="Revenue by query type">
        <DataTable compact rows={report.revenueByType.map((row) => ({ ...row, id: row.queryType }))} empty="No query revenue yet." columns={[
          ["Type", (row) => strong(row.queryType)],
          ["Pipeline Budget", (row) => money(row.revenue)],
          ["Queries", (row) => row.count],
        ]} />
      </Panel>
      <Panel title="Location-wise headcount">
        <DataTable compact rows={report.locationHeadcount} empty="No staff locations yet." columns={[
          ["Location", (row) => strong(row.location)],
          ["Headcount", (row) => row.count],
        ]} />
      </Panel>
    </div>
  );
}

function TeamView({ rows }) {
  return (
    <DataTable rows={rows} empty="No active staff records." columns={[
      ["Name", (row) => <span className={row.isCurrentUser ? "font-semibold text-citius-blue" : "font-semibold"}>{row.name}</span>],
      ["Email", (row) => row.email],
      ["Mobile", (row) => row.mobile || "-"],
      ["Department", (row) => row.department || "-"],
      ["Function", (row) => row.function || "-"],
      ["Location", (row) => row.location || "-"],
      ["Access", (row) => row.roles.join(", ")],
    ]} />
  );
}

function ActivityView({ activity, notifications, deleteItem, removeNotification, markNotificationRead }) {
  const router = useRouter();

  const handleNotificationClick = async (item) => {
    markNotificationRead({ notificationId: item.id }).catch(() => {});
    const href = getNotificationHref({
      entityType: item.entityType,
      entityId: item.entityId,
      title: item.title,
    });
    if (item.entityType && item.entityId) {
      router.push(href);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Activity log">
        <Timeline rows={activity} />
      </Panel>
      <Panel title="Notifications">
        {notifications.length === 0 ? <EmptyState label="No notifications yet." /> : (
          <div className="space-y-3">
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`rounded-md border border-brand-border bg-brand-light p-3 ${
                  item.entityType && item.entityId ? "cursor-pointer transition hover:bg-white" : ""
                }`}
                role={item.entityType && item.entityId ? "button" : undefined}
                tabIndex={item.entityType && item.entityId ? 0 : undefined}
                onClick={() => {
                  if (item.entityType && item.entityId) {
                    handleNotificationClick(item);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && item.entityType && item.entityId) {
                    event.preventDefault();
                    handleNotificationClick(item);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{item.title}: {item.body}</div>
                    <div className="mt-1 text-xs text-brand-muted">{item.readAt ? "Read" : "Unread"} - {formatDate(item.createdAt)}</div>
                  </div>
                  <DeleteButton
                    label={item.title}
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteItem(item.title, removeNotification, { notificationId: item.id });
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function LeaveView({ rows, staff, access, openModal, has, deleteItem, removeLeave, decideLeave }) {
  const today = new Date().toISOString().split("T")[0];
  const activeCount = rows.filter((r) => r.startDate <= today && r.endDate >= today && r.status === "Approved").length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;
  const rejectedCount = rows.filter((r) => r.status === "Rejected").length;
  const upcomingCount = rows.filter((r) => r.status === "Approved" && r.startDate > today).length;
  const canManageLeave = has(P.MANAGE_LEAVE);
  const [decidingLeaveId, setDecidingLeaveId] = useState(null);

  const handleLeaveDecision = async (leaveId, status) => {
    if (decidingLeaveId) {
      return;
    }
    setDecidingLeaveId(leaveId);
    try {
      await decideLeave({ leaveId, status });
    } finally {
      setDecidingLeaveId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        <StatCard label="Active Today" value={activeCount} Icon={Users} />
        <StatCard label="Pending Approval" value={pendingCount} Icon={RefreshCw} />
        <StatCard label="Upcoming Approved" value={upcomingCount} Icon={CheckCircle2} />
        <StatCard label="Rejected" value={rejectedCount} Icon={ShieldCheck} />
        <StatCard label="Total Recorded" value={rows.length} Icon={ClipboardList} />
      </div>

      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
        <DataTable rows={rows} empty="No leave records yet." columns={[
          ["Employee Name", (row) => strong(row.staffName)],
          ["Department", (row) => <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-brand-border text-brand-text">{row.department}</span>],
          ["Leave Type", (row) => <Badge label={row.leaveType || "Casual"} tone="blue" />],
          ["Start Date", (row) => row.startDate],
          ["End Date", (row) => row.endDate],
          ["Reason", (row) => row.reason || "-"],
          ["Head Review", (row) => <Badge label={row.headReviewStatus || row.status || "Pending"} tone={statusTone(row.headReviewStatus || row.status)} />],
          ["HR Review", (row) => <Badge label={row.hrReviewStatus || row.status || "Pending"} tone={statusTone(row.hrReviewStatus || row.status)} />],
          ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
          ["Action", (row) => (
            <div className="flex flex-wrap gap-2">
              {row.canApproveHead && (
                <button
                  className="portal-small-btn"
                  disabled={decidingLeaveId === row.id}
                  onClick={() => handleLeaveDecision(row.id, "Approved")}
                >
                  {decidingLeaveId === row.id
                    ? "Saving..."
                    : row.headReviewerRole === "HR"
                      ? "Approve"
                      : "Approve (Head)"}
                </button>
              )}
              {row.canApproveHr && (
                <button
                  className="portal-small-btn"
                  disabled={decidingLeaveId === row.id}
                  onClick={() => handleLeaveDecision(row.id, "Approved")}
                >
                  {decidingLeaveId === row.id ? "Saving..." : "Approve (HR)"}
                </button>
              )}
              {row.canReject && (
                <button
                  className="portal-danger-btn"
                  disabled={decidingLeaveId === row.id}
                  onClick={() => handleLeaveDecision(row.id, "Rejected")}
                >
                  Reject
                </button>
              )}
              {(canManageLeave || (access?.staffId === row.staffId && row.status === "Pending")) && (
                <button
                  className="portal-small-btn"
                  onClick={() => openModal("leave_create", {
                    entityId: row.id,
                    staffId: row.staffId,
                    leaveType: row.leaveType || "Casual",
                    startDate: row.startDate,
                    endDate: row.endDate,
                    reason: row.reason,
                    status: row.status,
                  })}
                >
                  Edit
                </button>
              )}
              {canManageLeave && (
                <DeleteButton label={`leave for ${row.staffName}`} onClick={() => deleteItem(`leave for ${row.staffName}`, removeLeave, { leaveId: row.id })} />
              )}
            </div>
          )],
        ]} />
      </div>
    </div>
  );
}

function SettingsView({ staff, dropdowns, openModal, deleteItem, removeStaff, startStaffOnboarding }) {
  const [onboardingSending, setOnboardingSending] = useState({});

  const handleSendOnboarding = async (row) => {
    setOnboardingSending((prev) => ({ ...prev, [row.id]: true }));
    try {
      const result = await startStaffOnboarding({ staffId: row.id });
      alert(result?.message || `Onboarding email sent to ${row.email}.`);
    } catch (err) {
      console.error(err);
      alert(err?.data || err?.message || "Failed to send onboarding email.");
    } finally {
      setOnboardingSending((prev) => ({ ...prev, [row.id]: false }));
    }
  };
  const onboardingActionLabel = (row) => {
    if (row.onboardingStatus === "ready") return "Send password reset";
    if (row.onboardingStatus === "pending") return "Resend verification";
    return "Send verification";
  };

  return (
    <div className="space-y-5">
      <Panel title="Staff allowlist">
        <DataTable rows={staff} empty="No staff records yet." columns={[
          ["Name", (row) => strong(row.name)],
          ["Email", (row) => row.email],
          ["Department", (row) => row.department || "-"],
          ["Function", (row) => row.function || "-"],
          ["Location", (row) => row.location || "-"],
          ["Roles", (row) => row.roles.join(", ")],
          ["Onboarding", (row) => (
            <Badge
              label={
                row.onboardingStatus === "ready"
                  ? "Ready"
                  : row.onboardingStatus === "pending"
                    ? "Pending"
                    : "Not started"
              }
              tone={
                row.onboardingStatus === "ready"
                  ? "green"
                  : row.onboardingStatus === "pending"
                    ? "blue"
                    : "gray"
              }
            />
          )],
          ["Active", (row) => <Badge label={row.active ? "Active" : "Inactive"} tone={row.active ? "green" : "red"} />],
          ["Action", (row) => (
            <div className="flex flex-wrap gap-2">
              <button className="portal-small-btn" onClick={() => openModal("staff", { staffId: row.id, staffName: row.name, staffEmail: row.email, staffRoles: row.roles, department: row.department, staffFunction: row.function, mobile: row.mobile, location: row.location, staffActive: row.active })}>
                Edit
              </button>
              <button
                className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
                onClick={() => handleSendOnboarding(row)}
                disabled={onboardingSending[row.id]}
              >
                {onboardingSending[row.id] ? "Sending..." : onboardingActionLabel(row)}
              </button>
              <DeleteButton label={row.email} onClick={() => deleteItem(row.email, removeStaff, { staffId: row.id })} />
            </div>
          )],
        ]} compact />
      </Panel>
      <Panel title="Workflow dropdowns">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(dropdowns).map(([category, values]) => (
            <div key={category} className="rounded-md border border-brand-border bg-brand-light p-4">
              <div className="mb-2 text-sm font-semibold capitalize">{category}</div>
              <div className="flex flex-wrap gap-2">
                {values.map((value) => <Badge key={value} label={value} tone="gray" />)}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function toPassengerImportInput(row) {
  return {
    id: row.id,
    sourceSheet: row.sourceSheet,
    sourceRowNumber: row.sourceRowNumber,
    importKey: row.importKey,
    fullName: row.fullName,
    travelHub: row.travelHub,
    foodPreference: row.foodPreference,
    guestType: row.guestType,
    paymentType: row.paymentType,
    roomType: row.roomType,
    visaRequired: row.visaRequired,
    domesticTravelRequired: row.domesticTravelRequired,
    passportStatus: row.passportStatus,
    specialRequests: row.specialRequests,
    sourceDealerCode: row.sourceDealerCode,
    sourceDealerName: row.sourceDealerName,
    sourceDescription: row.sourceDescription,
    sourceSoName: row.sourceSoName,
    sourceRsoName: row.sourceRsoName,
    sourceGroup: row.sourceGroup,
    gender: row.gender,
    contactNo: row.contactNo,
    passport: {
      number: row.passport?.number,
      dateOfBirth: row.passport?.dateOfBirth,
      issueDate: row.passport?.issueDate,
      expiryDate: row.passport?.expiryDate,
      nationality: row.passport?.nationality,
    },
  };
}

function PassengerImportModal({ open, close, jobCards, previewPassengerImport, commitPassengerImport }) {
  const [jobCardId, setJobCardId] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const rows = useMemo(() => parsed?.rows || [], [parsed]);
  const importRows = useMemo(() => rows.map(toPassengerImportInput), [rows]);
  const skipped = parsed?.skipped || [];
  const errors = parsed?.errors || [];
  const previewRows = useMemo(() => preview?.rows || [], [preview]);
  const previewById = useMemo(() => new Map(previewRows.map((row) => [row.id, row])), [previewRows]);
  const createCount = previewRows.filter((row) => row.action === "create").length;
  const updateCount = previewRows.filter((row) => row.action === "update").length;

  const reset = useCallback(() => {
    setJobCardId("");
    setFileName("");
    setParsed(null);
    setPreview(null);
    setError("");
    setIsParsing(false);
    setIsPreviewing(false);
    setIsSaving(false);
  }, []);

  const closeAndReset = useCallback(() => {
    reset();
    close();
  }, [close, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    let cancelled = false;
    async function runPreview() {
      if (!open || !jobCardId || importRows.length === 0) {
        setPreview(null);
        return;
      }
      setIsPreviewing(true);
      setError("");
      try {
        const result = await previewPassengerImport({ jobCardId, rows: importRows });
        if (!cancelled) setPreview(result);
      } catch (err) {
        if (!cancelled) {
          setPreview(null);
          setError(err?.data || err?.message || "Unable to preview passenger import.");
        }
      } finally {
        if (!cancelled) setIsPreviewing(false);
      }
    }
    runPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, importRows, previewPassengerImport]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setPreview(null);
    setError("");
    setIsParsing(true);
    try {
      setParsed(await parsePassengerWorkbookFile(file));
    } catch (err) {
      setError(err?.message || "Unable to read passenger spreadsheet.");
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  };

  const handleCommit = async () => {
    if (!jobCardId || rows.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await commitPassengerImport({ jobCardId, rows: importRows });
      alert(`Passenger import complete. Created ${result.created}, updated ${result.updated}.`);
      closeAndReset();
    } catch (err) {
      setError(err?.data || err?.message || "Passenger import failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ImportModalShell open={open} close={closeAndReset} title="Import Passengers">
      <div className="space-y-4">
        <Select label="Job Card" value={jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={setJobCardId} required />
        <ImportFileInput label="Passenger spreadsheet" fileName={fileName} accept=".xlsx,.xls" onChange={handleFile} />
        <ImportSummary
          isBusy={isParsing || isPreviewing}
          totals={[
            ["Ready", rows.length],
            ["Create", preview ? createCount : "-"],
            ["Update", preview ? updateCount : "-"],
            ["Skipped", skipped.length],
            ["Errors", errors.length],
          ]}
        />
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {errors.length > 0 && <ImportIssueList title="Rows needing correction" rows={errors} />}
        {skipped.length > 0 && <ImportIssueList title="Skipped rows" rows={skipped.slice(0, 8)} />}
        {rows.length > 0 && (
          <DataTable
            compact
            rows={rows.slice(0, 25).map((row) => ({
              ...row,
              action: previewById.get(row.id)?.action || (isPreviewing ? "checking" : "upsert"),
            }))}
            empty="No confirmed passengers found."
            columns={[
              ["Action", (row) => <Badge label={row.action} tone={row.action === "update" ? "blue" : row.action === "create" ? "green" : "orange"} />],
              ["Passenger", (row) => strong(row.fullName)],
              ["Hub", (row) => row.travelHub || "-"],
              ["Food", (row) => row.foodPreference],
              ["Passport", (row) => row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending"],
              ["Source", (row) => `${row.sourceSheet} row ${row.sourceRowNumber}`],
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70" onClick={closeAndReset}>Cancel</button>
          <button type="button" className="portal-primary-btn disabled:opacity-60" disabled={!jobCardId || rows.length === 0 || isPreviewing || isSaving} onClick={handleCommit}>
            {isSaving ? "Uploading..." : "Upload Passengers"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function FlightImportModal({ open, close, jobCards, itinerary, commitFlightImport }) {
  const [jobCardId, setJobCardId] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const groups = parsed?.groups || [];
  const errors = parsed?.errors || [];
  const existingSegmentKeys = new Set(
    (itinerary || [])
      .filter((group) => !jobCardId || group.jobCardId === jobCardId)
      .flatMap((group) => group.segments || [])
      .map((segment) => segment.importKey)
      .filter(Boolean),
  );
  const segmentCount = groups.reduce((sum, group) => sum + group.segments.length, 0);
  const updateCount = groups.reduce(
    (sum, group) => sum + group.segments.filter((segment) => existingSegmentKeys.has(segment.importKey)).length,
    0,
  );

  const reset = useCallback(() => {
    setJobCardId("");
    setFileName("");
    setParsed(null);
    setError("");
    setIsParsing(false);
    setIsSaving(false);
  }, []);

  const closeAndReset = useCallback(() => {
    reset();
    close();
  }, [close, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setError("");
    setIsParsing(true);
    try {
      setParsed(await parseFlightWorkbookFile(file));
    } catch (err) {
      setError(err?.message || "Unable to read flight spreadsheet.");
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  };

  const handleCommit = async () => {
    if (!jobCardId || groups.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await commitFlightImport({ jobCardId, groups });
      alert(`Flight import complete. Created ${result.createdSegments}, updated ${result.updatedSegments} segments.`);
      closeAndReset();
    } catch (err) {
      setError(err?.data || err?.message || "Flight import failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ImportModalShell open={open} close={closeAndReset} title="Import Flights">
      <div className="space-y-4">
        <Select label="Job Card" value={jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={setJobCardId} required />
        <ImportFileInput label="Flight spreadsheet" fileName={fileName} accept=".xlsx,.xls" onChange={handleFile} />
        <ImportSummary
          isBusy={isParsing}
          totals={[
            ["Groups", groups.length],
            ["Segments", segmentCount],
            ["Create", segmentCount - updateCount],
            ["Update", updateCount],
            ["Errors", errors.length],
          ]}
        />
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {errors.length > 0 && <ImportIssueList title="Rows needing correction" rows={errors} />}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group) => (
              <div key={group.id} className="rounded-lg border border-brand-border bg-white">
                <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
                  <div className="font-semibold text-citius-blue">{group.name}</div>
                  <div className="text-xs text-brand-muted">{group.segments.length} segment{group.segments.length === 1 ? "" : "s"}</div>
                </div>
                <DataTable
                  compact
                  rows={group.segments.map((segment) => ({
                    ...segment,
                    action: existingSegmentKeys.has(segment.importKey) ? "update" : "create",
                  }))}
                  empty="No segments in this group."
                  columns={[
                    ["Action", (row) => <Badge label={row.action} tone={row.action === "update" ? "blue" : "green"} />],
                    ["Date", (row) => row.dateLabel],
                    ["Flight", (row) => `${row.airline} ${row.flightNumber}`],
                    ["Depart", (row) => `${row.departTime || "-"} ${row.origin}`],
                    ["Arrive", (row) => `${row.arriveTime || "-"} ${row.destination}`],
                    ["Transit", (row) => row.transit || "-"],
                  ]}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70" onClick={closeAndReset}>Cancel</button>
          <button type="button" className="portal-primary-btn disabled:opacity-60" disabled={!jobCardId || groups.length === 0 || isSaving} onClick={handleCommit}>
            {isSaving ? "Uploading..." : "Upload Flights"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function PassengerExportModal({ open, close, jobCards, getPassengerExportRows }) {
  const [jobCardId, setJobCardId] = useState("");
  const [exportData, setExportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setJobCardId("");
    setExportData(null);
    setError("");
    setIsLoading(false);
    setIsExporting(false);
  }, []);

  const closeAndReset = useCallback(() => {
    reset();
    close();
  }, [close, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    let cancelled = false;
    async function loadExportPreview() {
      if (!open || !jobCardId) {
        setExportData(null);
        return;
      }
      setIsLoading(true);
      setError("");
      try {
        const result = await getPassengerExportRows({ jobCardId });
        if (!cancelled) setExportData(result);
      } catch (err) {
        if (!cancelled) {
          setExportData(null);
          setError(err?.data || err?.message || "Unable to load passengers for export.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadExportPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, getPassengerExportRows]);

  const handleExport = async () => {
    if (!exportData?.rows?.length) return;
    setIsExporting(true);
    setError("");
    try {
      const workbook = buildPassengerWorkbook(exportData.rows, { sheetName: exportData.jobCode });
      downloadWorkbook(workbook, `${exportData.jobCode}-passengers.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(err?.message || "Passenger export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  const rows = exportData?.rows || [];

  return (
    <ImportModalShell
      open={open}
      close={closeAndReset}
      title="Export Passengers"
      subtitle="Select a job card to download a passenger spreadsheet compatible with the import template."
    >
      <div className="space-y-4">
        <Select label="Job Card" value={jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={setJobCardId} required />
        <ImportSummary
          isBusy={isLoading}
          totals={[
            ["Passengers", jobCardId ? (isLoading ? "-" : rows.length) : "-"],
            ["Confirmed", rows.filter((row) => row.willingToGo === "CONFIRMED").length],
            ["Unable", rows.filter((row) => row.willingToGo !== "CONFIRMED").length],
            ["Job", exportData?.jobCode || "-"],
            ["Client", exportData?.clientName || "-"],
          ]}
        />
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {jobCardId && !isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-sm text-brand-muted">
            No passengers found for this job card.
          </div>
        )}
        {rows.length > 0 && (
          <DataTable
            compact
            rows={rows.slice(0, 25)}
            empty="No passengers to export."
            columns={[
              ["Passenger", (row) => strong(row.fullName)],
              ["Status", (row) => row.willingToGo],
              ["Hub", (row) => row.travelHub || "-"],
              ["Food", (row) => row.foodPreference],
              ["Passport", (row) => row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending"],
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70" onClick={closeAndReset}>Cancel</button>
          <button type="button" className="portal-primary-btn disabled:opacity-60" disabled={!jobCardId || isLoading || rows.length === 0 || isExporting} onClick={handleExport}>
            {isExporting ? "Exporting..." : "Download Spreadsheet"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function FlightExportModal({ open, close, jobCards, itinerary }) {
  const [jobCardId, setJobCardId] = useState("");
  const [error, setError] = useState("");

  const selectedJob = useMemo(
    () => jobCards.find((job) => job.id === jobCardId) || null,
    [jobCards, jobCardId],
  );
  const groups = useMemo(
    () => (itinerary || []).filter((group) => group.jobCardId === jobCardId),
    [itinerary, jobCardId],
  );
  const segmentCount = groups.reduce((sum, group) => sum + (group.segments?.length || 0), 0);

  const reset = useCallback(() => {
    setJobCardId("");
    setError("");
  }, []);

  const closeAndReset = useCallback(() => {
    reset();
    close();
  }, [close, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleExport = () => {
    if (!selectedJob || groups.length === 0) return;
    setError("");
    try {
      const workbook = buildFlightWorkbook(groups, { defaultSheetName: selectedJob.jobCode });
      downloadWorkbook(workbook, `${selectedJob.jobCode}-flights.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(err?.message || "Flight export failed.");
    }
  };

  return (
    <ImportModalShell
      open={open}
      close={closeAndReset}
      title="Export Flights"
      subtitle="Select a job card to download a flight itinerary spreadsheet compatible with the import template."
    >
      <div className="space-y-4">
        <Select label="Job Card" value={jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={setJobCardId} required />
        <ImportSummary
          isBusy={false}
          totals={[
            ["Groups", jobCardId ? groups.length : "-"],
            ["Segments", jobCardId ? segmentCount : "-"],
            ["Job", selectedJob?.jobCode || "-"],
            ["Client", selectedJob?.clientName || "-"],
            ["Sheets", jobCardId ? new Set(groups.map((group) => group.sourceSheet || selectedJob.jobCode)).size : "-"],
          ]}
        />
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {jobCardId && groups.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-sm text-brand-muted">
            No flight itinerary found for this job card.
          </div>
        )}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group) => (
              <div key={group.id} className="rounded-lg border border-brand-border bg-white">
                <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
                  <div className="font-semibold text-citius-blue">{group.name}</div>
                  <div className="text-xs text-brand-muted">{group.segments.length} segment{group.segments.length === 1 ? "" : "s"}</div>
                </div>
                <DataTable
                  compact
                  rows={group.segments}
                  empty="No segments in this group."
                  columns={[
                    ["Date", (row) => row.dateLabel],
                    ["Flight", (row) => `${row.airline} ${row.flightNumber}`],
                    ["Depart", (row) => `${row.departTime || "-"} ${row.origin}`],
                    ["Arrive", (row) => `${row.arriveTime || "-"} ${row.destination}`],
                  ]}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70" onClick={closeAndReset}>Cancel</button>
          <button type="button" className="portal-primary-btn disabled:opacity-60" disabled={!jobCardId || groups.length === 0} onClick={handleExport}>
            Download Spreadsheet
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function ImportModalShell({ open, close, title, subtitle = "Upload a spreadsheet, review the parsed rows, then commit the import.", children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-citius-blue/35 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-brand-border bg-white p-5 shadow-2xl md:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold text-citius-blue">{title}</h2>
                <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>
              </div>
              <button type="button" className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70" onClick={close}>
                Close
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImportFileInput({ label, fileName, accept, onChange }) {
  return (
    <label className="block rounded-lg border border-dashed border-brand-border bg-brand-light/40 p-4">
      <span className="text-sm font-semibold text-citius-blue">{label}</span>
      <input type="file" accept={accept} onChange={onChange} className="mt-2 block w-full text-sm text-brand-dark file:mr-3 file:rounded-md file:border-0 file:bg-citius-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
      {fileName && <span className="mt-2 block text-xs text-brand-muted">{fileName}</span>}
    </label>
  );
}

function ImportSummary({ isBusy, totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {totals.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-brand-border bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-citius-blue">{isBusy && value === "-" ? "..." : value}</div>
        </div>
      ))}
    </div>
  );
}

function ImportIssueList({ title, rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-900">{title}</div>
      <div className="mt-2 space-y-1 text-sm text-amber-800">
        {rows.map((row) => (
          <div key={row.id}>{row.sourceSheet} row {row.sourceRowNumber}: {row.message || row.reason}</div>
        ))}
      </div>
    </div>
  );
}

function EntityModal({
  modal,
  form,
  updateForm,
  patchForm,
  submit,
  close,
  error,
  isSaving,
  queries,
  proposals,
  jobCards,
  travellers,
  visas,
  pnrs,
  team,
  travellersWithoutVisa,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  pendingExpenseProofFiles,
  setPendingExpenseProofFiles,
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  removeQueryAttachment,
  generateProposalUploadUrl,
  attachProposalFile,
  getProposalAttachmentUrl,
  removeProposalAttachment,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
  getExpenseAttachmentUrl,
  removeExpenseProof,
  has,
  access,
}) {
  const contractingTeamOptions = teamSelectOptions(team, ["Contracting", "Contracting Head"]);
  const operationsTeamOptions = teamSelectOptions(team, ["Operations", "Operations Head"]);
  const ticketingTeamOptions = teamSelectOptions(team, ["Ticketing", "Head of Ticketing"]);
  const tourManagerOptions = teamSelectOptions(team, ["Tour Manager"]);
  const travellerOptions = linkedTravellerOptions(travellers, form.jobCardId);
  const pnrOptions = linkedPnrOptions(pnrs, form.jobCardId);

  const handleStaffSelect = (field, staffId) => {
    updateForm(field, staffId);
    const member = team.find((entry) => entry.id === staffId);
    if (!member) return;
    if (field === "staffId" && modal === "tourManager") {
      updateForm("tourManagerName", member.name);
      updateForm("staffEmail", member.email || "");
      updateForm("paidBy", member.mobile || "");
    }
  };

  const handleProposalQuerySelect = (queryId) => {
    if (!queryId) {
      patchForm({ queryId: "" });
      return;
    }
    const linkedQuery = queries.find((query) => query.id === queryId);
    patchForm(applyQueryLink(form, linkedQuery));
  };

  const handleJobQuerySelect = (queryId) => {
    if (!queryId) {
      patchForm({ queryId: "", proposalId: "" });
      return;
    }
    const linkedQuery = queries.find((query) => query.id === queryId);
    const patch = applyQueryLink(form, linkedQuery);
    const linkedProposal = proposals
      .filter((proposal) => proposal.queryId === queryId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    patch.proposalId = linkedProposal?.id || "";
    patchForm(patch);
  };

  const handleJobCardSelect = (jobCardId) => {
    const linkedJob = jobCards.find((job) => job.id === jobCardId);
    const patch = linkedJob
      ? applyJobCardLink({ ...form, jobCardId }, linkedJob, modal)
      : { jobCardId: jobCardId || "" };
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs),
    });
  };

  const handleTravellerSelect = (travellerId) => {
    const linkedTraveller =
      travellers.find((traveller) => traveller.id === travellerId) ||
      travellersWithoutVisa.find((traveller) => traveller.id === travellerId);
    const patch = applyTravellerLink(form, linkedTraveller, modal);
    if (linkedTraveller?.jobCardId) {
      const linkedJob = jobCards.find((job) => job.id === linkedTraveller.jobCardId);
      Object.assign(patch, applyJobCardLink({ ...form, ...patch }, linkedJob, modal));
    }
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs),
    });
  };

  const handlePnrSelect = (pnrId) => {
    const linkedPnr = pnrs.find((pnr) => pnr.id === pnrId);
    const patch = applyPnrLink(form, linkedPnr, modal);
    if (linkedPnr?.jobCardId) {
      const linkedJob = jobCards.find((job) => job.id === linkedPnr.jobCardId);
      Object.assign(patch, applyJobCardLink({ ...form, ...patch }, linkedJob, modal));
    }
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs),
    });
  };

  const handleVisaRecordSelect = (visaRecordId) => {
    const linkedVisa = visas.find((visa) => visa.id === visaRecordId);
    patchForm(linkedVisa ? applyVisaRecordLink(form, linkedVisa) : { visaRecordId: visaRecordId || "" });
  };

  const title = modal
    ? {
        query: form.entityId ? "Edit Query" : "New Query / Enquiry",
        queryAttachments: `Attachments — ${form.queryCode || "Query"}`,
        proposalAttachments: `Working Files — ${form.queryCode || "Proposal"}`,
        proposalFinalizedPdf: `Finalized Proposal PDF — ${form.queryCode || "Proposal"}`,
        assignContracting: "Assign Contracting Owner",
        assignContractingOwner: "Assign Contracting Job Owner",
        assignOperationsOwner: "Assign Operations Owner",
        assignTicketingOwner: "Assign Ticketing Owner",
        queryStatus: "Update Query Status",
        proposal: form.entityId ? "Edit Proposal" : "Create Proposal",
        jobCard: form.entityId ? "Edit Job Card" : "Open Job Card",
        traveller: form.entityId ? "Edit Traveller" : "Add Traveller",
        visa: form.entityId ? "Edit Visa Record" : "Update Visa Status",
        visa_create: "Create Visa Record",
        pnr: form.entityId ? "Edit PNR" : "Add PNR",
        ticket: form.entityId ? "Edit Ticket" : "Issue Ticket",
        seat: form.entityId ? "Edit Seat Allocation" : "Save Seat Allocation",
        hotel: form.entityId ? "Edit Hotel" : "Add Hotel",
        tourManager: form.entityId ? "Edit Tour Manager" : "Add Tour Manager",
        invoice: form.entityId ? "Edit Invoice" : "Generate Invoice",
        expense: form.entityId ? "Edit Expense" : "Add Expense",
        staff: "Staff Allowlist Entry",
        leave_create: form.entityId ? "Edit Leave" : has(P.MANAGE_LEAVE) ? "Record Employee Leave" : "Request Leave",
        approvalDecide: form.approvalStatus === "Needs Info" ? "Request More Details" : "Reject Approval",
      }[modal]
    : "";

  const lifecycleQuery = queries?.find((entry) => entry.id === (form.entityId || form.queryId));
  const lifecycleProposal = proposals?.find((entry) => entry.id === form.entityId);
  const lifecycleJobCard = jobCards?.find((entry) => entry.id === form.entityId);

  return (
    <AnimatePresence>
      {modal && (
        <motion.div
          key={modal}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-brand-border bg-white shadow-2xl"
          >
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <div className="font-heading text-lg font-semibold text-citius-blue">{title}</div>
          <button type="button" onClick={close} className="rounded-full p-2 text-brand-muted hover:bg-brand-light">Close</button>
        </div>
        <div className="max-h-[calc(90vh-130px)] overflow-y-auto p-5">
          {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {(modal === "query" || modal === "queryStatus") && lifecycleQuery && (
            <LifecycleDates
              items={[
                { label: "Created", value: lifecycleQuery.createdAt },
                { label: "Submitted to Contracting", value: lifecycleQuery.submittedToContractingAt },
                { label: "Confirmed", value: lifecycleQuery.confirmedAt },
              ]}
            />
          )}
          {modal === "proposal" && lifecycleProposal && (
            <LifecycleDates
              items={[
                { label: "Created", value: lifecycleProposal.createdAt },
                { label: "Sent", value: lifecycleProposal.sentAt },
                { label: "Finalized PDF", value: lifecycleProposal.finalizedPdf?.uploadedAt },
              ]}
            />
          )}
          {modal === "jobCard" && lifecycleJobCard && (
            <LifecycleDates
              items={[
                { label: "Opened", value: lifecycleJobCard.createdAt },
                { label: "Last updated", value: lifecycleJobCard.updatedAt },
              ]}
            />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {modal === "query" && <>
              <Input label="Client / Company" value={form.clientName} onChange={(v) => updateForm("clientName", v)} required />
              <Input label="Contact Person" value={form.contactPerson} onChange={(v) => updateForm("contactPerson", v)} />
              <Input label="Mobile" value={form.contactMobile} onChange={(v) => updateForm("contactMobile", v)} />
              <Input label="No. of Pax" type="number" value={form.paxCount} onChange={(v) => updateForm("paxCount", v)} />
              <Input label="Destination" value={form.destination} onChange={(v) => updateForm("destination", v)} />
              <Input label="Travel Date From" type="date" value={form.travelStartDate} onChange={(v) => updateForm("travelStartDate", v)} />
              <Input label="Travel Date To" type="date" value={form.travelEndDate} onChange={(v) => updateForm("travelEndDate", v)} />
              <Select label="Query Type" value={form.queryType} options={QUERY_TYPES} onChange={(v) => updateForm("queryType", v)} />
              <Select label="Travel Type" value={form.travelType} options={TRAVEL_TYPES} onChange={(v) => updateForm("travelType", v)} />
              <Input label="Budget INR" type="number" value={form.budgetAmount} onChange={(v) => updateForm("budgetAmount", v)} />
              <Select label="Source" value={form.source} options={QUERY_SOURCES} onChange={(v) => updateForm("source", v)} />
              <Select label="Sales Rep" value={form.salesOwnerName} options={[{ value: "", label: "Current user" }, ...team.filter((member) => member.roles.some((role) => ["Sales", "Sales Head"].includes(role))).map((member) => ({ value: member.name, label: member.name }))]} onChange={(v) => updateForm("salesOwnerName", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} maxWords={MAX_QUERY_NOTES_WORDS} />
              <div className="md:col-span-2">
                <QueryFilePicker
                  files={pendingQueryFiles}
                  onChange={setPendingQueryFiles}
                  inputId="new-query-files"
                />
              </div>
            </>}
            {modal === "queryAttachments" && (
              <div className="md:col-span-2">
                <QueryAttachmentsPanel
                  queryId={form.queryId}
                  attachments={(queries.find((q) => q.id === form.queryId)?.attachments) || []}
                  canManage={has(P.MANAGE_QUERIES)}
                  generateQueryUploadUrl={generateQueryUploadUrl}
                  attachQueryFile={attachQueryFile}
                  getQueryAttachmentUrl={getQueryAttachmentUrl}
                  removeQueryAttachment={removeQueryAttachment}
                />
              </div>
            )}
            {modal === "proposalAttachments" && (
              <div className="md:col-span-2">
                <QueryAttachmentsPanel
                  entityId={form.proposalId}
                  idField="proposalId"
                  attachments={(proposals.find((proposal) => proposal.id === form.proposalId)?.attachments) || []}
                  canManage={has(P.MANAGE_PROPOSALS)}
                  uploadLabel="Upload Working File"
                  generateQueryUploadUrl={generateProposalUploadUrl}
                  attachQueryFile={attachProposalFile}
                  getQueryAttachmentUrl={getProposalAttachmentUrl}
                  attachmentKind="proposal"
                  removeQueryAttachment={removeProposalAttachment}
                />
              </div>
            )}
            {modal === "proposalFinalizedPdf" && (
              <div className="md:col-span-2">
                <FinalizedProposalPdfPanel
                  proposalId={form.proposalId}
                  finalizedPdf={(proposals.find((proposal) => proposal.id === form.proposalId)?.finalizedPdf) || null}
                  canSend={has(P.SEND_PROPOSALS) || has(P.MANAGE_PROPOSALS)}
                  generateFinalizedPdfUploadUrl={generateFinalizedPdfUploadUrl}
                  attachFinalizedPdf={attachFinalizedPdf}
                  getFinalizedPdfUrl={getFinalizedPdfUrl}
                  removeFinalizedPdf={removeFinalizedPdf}
                />
              </div>
            )}
            {modal === "assignContracting" && <>
              <Select label="Query" value={form.queryId} options={queries.map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))} onChange={(v) => updateForm("queryId", v)} required />
              <Select label="Contracting Owner" value={form.staffId} options={[{ value: "", label: "Select team member…" }, ...contractingTeamOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={(v) => updateForm("staffId", v)} required />
            </>}
            {modal === "assignContractingOwner" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Select label="Contracting Owner" value={form.staffId} options={[{ value: "", label: "Select team member…" }, ...contractingTeamOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={(v) => updateForm("staffId", v)} required />
            </>}
            {modal === "assignOperationsOwner" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Select label="Operations Owner" value={form.staffId} options={[{ value: "", label: "Select team member…" }, ...operationsTeamOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={(v) => updateForm("staffId", v)} required />
            </>}
            {modal === "assignTicketingOwner" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <div className="md:col-span-2 flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <Select label="Ticketing Owner" value={form.staffId} options={[{ value: "", label: "Select team member…" }, ...ticketingTeamOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={(v) => updateForm("staffId", v)} required />
                </div>
                {canAssignTicketing(access) && access?.staffId && (
                  <button
                    type="button"
                    className="portal-outline-btn mb-1"
                    onClick={() => updateForm("staffId", access.staffId)}
                  >
                    Assign to me
                  </button>
                )}
              </div>
            </>}
            {modal === "queryStatus" && <>
              {has(P.MANAGE_QUERIES) && (
                <>
                  <Select label="Sales Status" value={form.salesStatus} options={SALES_STATUSES} onChange={(v) => updateForm("salesStatus", v)} />
                  <Select label="Lead Stage" value={form.leadStage} options={LEAD_STAGES} onChange={(v) => updateForm("leadStage", v)} />
                  <Select label="Lost Reason" value={form.lostReason} options={LOST_REASONS} onChange={(v) => updateForm("lostReason", v)} />
                  {(form.salesStatus === "Order Confirmed" || isQueryConfirmed(form)) && (
                    <Input
                      label="Approx. Margin (INR)"
                      type="number"
                      value={form.approxMargin}
                      onChange={(v) => updateForm("approxMargin", v)}
                      placeholder="Enter margin after confirmation"
                    />
                  )}
                </>
              )}
              {has(P.MANAGE_CONTRACTING) && (
                <Select
                  label="Contracting Status"
                  value={form.contractingStatus}
                  options={has(P.MANAGE_QUERIES) ? CONTRACTING_STATUSES : CONTRACTING_STATUSES.filter((status) => !["Order Confirmed", "Order Lost"].includes(status))}
                  onChange={(v) => updateForm("contractingStatus", v)}
                />
              )}
              {has(P.MANAGE_CONTRACTING) && (
                <Select label="Lost Reason" value={form.lostReason} options={LOST_REASONS} onChange={(v) => updateForm("lostReason", v)} />
              )}
              {has(P.MANAGE_CONTRACTING) && (
                <ContractingCostFields
                  form={form}
                  updateForm={updateForm}
                />
              )}
            </>}
            {modal === "proposal" && <>
              <Select label="Linked Query" value={form.queryId} options={[{ value: "", label: "Unlinked" }, ...queries.map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))]} onChange={handleProposalQuerySelect} />
              <Input label="Client Name" value={form.clientName} onChange={(v) => updateForm("clientName", v)} />
              <Input label="Land Cost/Pax" type="number" value={form.landCostPerPax} onChange={(v) => updateForm("landCostPerPax", v)} />
              <Input label="Airfare/Pax" type="number" value={form.airfarePerPax} onChange={(v) => updateForm("airfarePerPax", v)} />
              <Input label="Selling Price" type="number" value={form.sellingPrice} onChange={(v) => updateForm("sellingPrice", v)} />
              <div className="rounded-lg border border-brand-border bg-brand-light/60 px-3 py-2 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Total cost</div>
                <div className="mt-1 font-semibold text-brand-dark">
                  {money(proposalTotalCost(form.landCostPerPax, form.airfarePerPax, form.paxCount))}
                </div>
                <div className="mt-1 text-xs text-brand-muted">
                  Auto-calculated from land + airfare × {Math.max(Number(form.paxCount) || 1, 1)} pax
                </div>
              </div>
              <Textarea label="Itinerary Summary" value={form.itinerarySummary} onChange={(v) => updateForm("itinerarySummary", v)} />
              <div className="md:col-span-2">
                <QueryFilePicker
                  files={pendingProposalFiles}
                  onChange={setPendingProposalFiles}
                  inputId="proposal-files"
                />
              </div>
            </>}
            {modal === "jobCard" && <>
              <Select label="Confirmed Query" value={form.queryId} options={[{ value: "", label: "Select confirmed query…" }, ...queries.filter((q) => q.salesStatus === "Order Confirmed" || q.contractingStatus === "Order Confirmed").map((q) => ({ value: q.id, label: `${q.queryCode} - ${q.clientName}` }))]} onChange={handleJobQuerySelect} required={!form.entityId} />
              <Select label="Linked Proposal" value={form.proposalId} options={[{ value: "", label: "Select proposal…" }, ...proposals.filter((proposal) => !form.queryId || proposal.queryId === form.queryId).map((proposal) => ({ value: proposal.id, label: `${proposal.proposalCode} - ${proposal.status}` }))]} onChange={(v) => updateForm("proposalId", v)} required={!form.entityId} />
              <Input label="Client" value={form.clientName} onChange={(v) => updateForm("clientName", v)} />
              <Input label="Confirmed Pax" type="number" value={form.confirmedPax} onChange={(v) => updateForm("confirmedPax", v)} />
              <Input label="Room Count" type="number" value={form.roomCount} onChange={(v) => updateForm("roomCount", v)} />
              <Input label="Destination" value={form.destination} onChange={(v) => updateForm("destination", v)} />
              <Input label="Travel Start" type="date" value={form.travelStartDate} onChange={(v) => updateForm("travelStartDate", v)} />
              <Input label="Travel End" type="date" value={form.travelEndDate} onChange={(v) => updateForm("travelEndDate", v)} />
              <Input label="Tour Manager" value={form.tourManagerName} onChange={(v) => updateForm("tourManagerName", v)} />
            </>}
            {modal === "traveller" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Input label="Full Name" value={form.fullName} onChange={(v) => updateForm("fullName", v)} required />
              <Input label="Travel Hub" value={form.travelHub} onChange={(v) => updateForm("travelHub", v)} />
              <Input label="Travel Date" type="date" value={form.travelDate} onChange={(v) => updateForm("travelDate", v)} />
              <Input label="Guests travelling with" value={form.guestCompanions} onChange={(v) => updateForm("guestCompanions", v)} placeholder="Spouse, children, friends..." />
              <Select label="Food Preference" value={form.foodPreference} options={FOOD_PREFERENCES} onChange={(v) => updateForm("foodPreference", v)} />
              <Select label="Guest Type" value={form.guestType} options={GUEST_TYPES} onChange={(v) => updateForm("guestType", v)} />
              <Select label="Payment Type" value={form.paymentType} options={PAYMENT_TYPES} onChange={(v) => updateForm("paymentType", v)} />
              <Select label="Room Type" value={form.roomType} options={ROOM_TYPES} onChange={(v) => updateForm("roomType", v)} />
              <Select label="Visa Required" value={form.visaRequired} options={["Yes", "No"]} onChange={(v) => updateForm("visaRequired", v)} />
              <Select label="Domestic Travel Required" value={form.domesticTravelRequired} options={["Yes", "No"]} onChange={(v) => updateForm("domesticTravelRequired", v)} />
              <Input label="Biometric Date" type="date" value={form.biometricAppointmentDate} onChange={(v) => updateForm("biometricAppointmentDate", v)} />
              <Select label="Extension of Tour" value={form.extensionOfTour} options={["No", "Yes"]} onChange={(v) => updateForm("extensionOfTour", v)} />
              <Select label="Arriving Early" value={form.arrivingEarly} options={["No", "Yes"]} onChange={(v) => updateForm("arrivingEarly", v)} />
              <Input label="Passport Status" value={form.passportStatus} onChange={(v) => updateForm("passportStatus", v)} />
              <Input label="Hotel Allocation" value={form.hotelAllocation} onChange={(v) => updateForm("hotelAllocation", v)} />
              <Textarea label="Special Requests" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "visa" && <>
              <Select label="Visa Record" value={form.visaRecordId} options={visas.map((v) => ({ value: v.id, label: `${v.travellerName} - ${v.jobCode}` }))} onChange={handleVisaRecordSelect} required />
              <Select label="Visa Status" value={form.visaStatus} options={VISA_STATUSES} onChange={(v) => updateForm("visaStatus", v)} />
              <Input label="Appointment Date" type="date" value={form.appointmentDate} onChange={(v) => updateForm("appointmentDate", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "visa_create" && <>
              <Select label="Traveller" value={form.travellerId} options={[{ value: "", label: "Select Traveller" }, ...travellersWithoutVisa.map((t) => ({ value: t.id, label: `${t.fullName} (${t.jobCode} - ${t.clientName})` }))]} onChange={handleTravellerSelect} required />
              <Select label="Visa Status" value={form.visaStatus} options={VISA_STATUSES} onChange={(v) => updateForm("visaStatus", v)} />
            </>}
            {modal === "pnr" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Input label="PNR" value={form.pnrCode} onChange={(v) => updateForm("pnrCode", v)} required />
              <Input label="Airline" value={form.airline} onChange={(v) => updateForm("airline", v)} />
              <Input label="Route" value={form.route} onChange={(v) => updateForm("route", v)} />
              <Input label="Fare Type" value={form.fareType} onChange={(v) => updateForm("fareType", v)} />
              <Input label="Total Seats" type="number" value={form.totalSeats} onChange={(v) => updateForm("totalSeats", v)} />
            </>}
            {modal === "ticket" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Select label="Traveller" value={form.travellerId} options={travellerOptions} onChange={handleTravellerSelect} />
              <Select label="PNR" value={form.pnrId} options={pnrOptions} onChange={handlePnrSelect} />
              <Input label="Ticket Number" value={form.ticketNumber} onChange={(v) => updateForm("ticketNumber", v)} />
              <Select label="Ticket Type" value={form.ticketType} options={TICKET_TYPES} onChange={(v) => updateForm("ticketType", v)} />
              <Select label="Ticket Status" value={form.ticketStatus} options={TICKET_STATUSES} onChange={(v) => updateForm("ticketStatus", v)} />
              <Select label="Payment Type" value={form.paymentType} options={PAYMENT_TYPES} onChange={(v) => updateForm("paymentType", v)} />
              <Select label="Cabin Class" value={form.cabinClass} options={CABIN_CLASSES} onChange={(v) => updateForm("cabinClass", v)} />
              <Select label="Meal Preference" value={form.foodPreference} options={FOOD_PREFERENCES} onChange={(v) => updateForm("foodPreference", v)} />
              <Input label="Seat Preference" value={form.seatPreference} onChange={(v) => updateForm("seatPreference", v)} />
              <Input label="Seat Number" value={form.seatNumber} onChange={(v) => updateForm("seatNumber", v)} />
            </>}
            {modal === "seat" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Select label="Traveller" value={form.travellerId} options={travellerOptions} onChange={handleTravellerSelect} />
              <Select label="PNR" value={form.pnrId} options={pnrOptions} onChange={handlePnrSelect} />
              <Input label="Seat Number" value={form.seatNumber} onChange={(v) => updateForm("seatNumber", v)} required />
              <Select label="Status" value={form.seatStatus} options={["Available", "Held", "Assigned", "Blocked"]} onChange={(v) => updateForm("seatStatus", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "hotel" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Input label="Hotel Name" value={form.hotelName} onChange={(v) => updateForm("hotelName", v)} required />
              <Input label="City" value={form.city} onChange={(v) => updateForm("city", v)} />
              <Input label="Check-in" type="date" value={form.checkInDate} onChange={(v) => updateForm("checkInDate", v)} />
              <Input label="Check-out" type="date" value={form.checkOutDate} onChange={(v) => updateForm("checkOutDate", v)} />
              <Textarea label="Special Instructions" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "tourManager" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { allowUnassigned: true })} onChange={handleJobCardSelect} />
              <Select label="Tour Manager" value={form.staffId} options={[{ value: "", label: "Select tour manager…" }, ...tourManagerOptions.map((o) => ({ value: o.value, label: o.label }))]} onChange={(v) => handleStaffSelect("staffId", v)} required />
              <Input label="Email" value={form.staffEmail} onChange={(v) => updateForm("staffEmail", v)} />
              <Input label="Phone" value={form.paidBy} onChange={(v) => updateForm("paidBy", v)} />
              <Input label="Available Date" type="date" value={form.travelStartDate} onChange={(v) => updateForm("travelStartDate", v)} />
              <Textarea label="Notes" value={form.notes} onChange={(v) => updateForm("notes", v)} />
            </>}
            {modal === "invoice" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Input label="Invoice Number" value={form.invoiceNumber} onChange={(v) => updateForm("invoiceNumber", v)} required />
              <Input label="Expected Amount" type="number" value={form.expectedAmount} onChange={(v) => updateForm("expectedAmount", v)} />
              <Input label="Received Amount" type="number" value={form.receivedAmount} onChange={(v) => updateForm("receivedAmount", v)} />
              <Input label="Due Date" type="date" value={form.dueDate} onChange={(v) => updateForm("dueDate", v)} />
            </>}
            {modal === "expense" && <>
              <Select label="Job Card" value={form.jobCardId} options={jobCardSelectOptions(jobCards, { required: true })} onChange={handleJobCardSelect} required />
              <Input label="Tour Manager" value={form.tourManagerName} onChange={(v) => updateForm("tourManagerName", v)} />
              <Input label="Expense Date" type="date" value={form.expenseDate} onChange={(v) => updateForm("expenseDate", v)} />
              <Select label="Expense Head" value={form.category} options={EXPENSE_HEADS} onChange={(v) => updateForm("category", v)} required />
              <Select label="Currency" value={form.currency} options={EXPENSE_CURRENCIES} onChange={(v) => updateForm("currency", v)} />
              <Input label="Card Amount" type="number" value={form.cardAmount} onChange={(v) => updateForm("cardAmount", v)} />
              <Input label="Cash Amount" type="number" value={form.cashAmount} onChange={(v) => updateForm("cashAmount", v)} />
              <Input label="E-Pay Amount" type="number" value={form.epayAmount} onChange={(v) => updateForm("epayAmount", v)} />
              <div className="rounded-xl border border-brand-border bg-brand-light px-3 py-2">
                <span className="mb-1 block text-xs font-semibold text-brand-muted">Total Amount</span>
                <div className="text-sm font-semibold text-brand-text">
                  {money(getExpenseSplitTotal({
                    cardAmount: form.cardAmount,
                    cashAmount: form.cashAmount,
                    epayAmount: form.epayAmount,
                  }))}
                </div>
              </div>
              <Input label="Paid By" value={form.paidBy} onChange={(v) => updateForm("paidBy", v)} required />
              <Textarea label="Particulars" value={form.particulars} onChange={(v) => updateForm("particulars", v)} />
              <div className="md:col-span-2">
                <QueryFilePicker
                  files={pendingExpenseProofFiles}
                  onChange={(files) => setPendingExpenseProofFiles(files.slice(-1))}
                  inputId="expense-proof-files"
                />
              </div>
            </>}
            {modal === "staff" && <>
              <Input label="Name" value={form.staffName} onChange={(v) => updateForm("staffName", v)} required />
              <Input label="Email" type="email" value={form.staffEmail} onChange={(v) => updateForm("staffEmail", v)} required />
              <Input label="Mobile" value={form.mobile} onChange={(v) => updateForm("mobile", v)} />
              <Input label="Department" value={form.department} onChange={(v) => updateForm("department", v)} />
              <Input label="Function" value={form.staffFunction} onChange={(v) => updateForm("staffFunction", v)} />
              <Input label="Location" value={form.location} onChange={(v) => updateForm("location", v)} />
              <MultiSelect label="Roles" value={form.staffRoles} options={PORTAL_ROLES} onChange={(v) => updateForm("staffRoles", v)} />
              <Select label="Active" value={form.staffActive ? "Active" : "Inactive"} options={["Active", "Inactive"]} onChange={(v) => updateForm("staffActive", v === "Active")} />
            </>}
            {modal === "leave_create" && <>
              {has(P.MANAGE_LEAVE) && (
                <Select label="Employee" value={form.staffId} options={team.map((t) => ({ value: t.id, label: `${t.name} (${t.department || "General"})` }))} onChange={(v) => updateForm("staffId", v)} required={!form.entityId} />
              )}
              <Select label="Leave Type" value={form.leaveType} options={LEAVE_TYPES} onChange={(v) => updateForm("leaveType", v)} />
              <Input label="Start Date" type="date" value={form.startDate} onChange={(v) => updateForm("startDate", v)} required />
              <Input label="End Date" type="date" value={form.endDate} onChange={(v) => updateForm("endDate", v)} required />
              <Input label="Reason for Leave" value={form.reason} onChange={(v) => updateForm("reason", v)} required placeholder="e.g. Annual Leave, Medical, Personal" />
              {has(P.MANAGE_LEAVE) && !form.entityId && (
                <Select label="Status" value={form.status || "Pending"} options={["Approved", "Pending", "Rejected"]} onChange={(v) => updateForm("status", v)} />
              )}
            </>}
            {modal === "approvalDecide" && <>
              <Textarea label="Decision Note" value={form.decisionNote} onChange={(v) => updateForm("decisionNote", v)} required placeholder="Explain what details are needed or why this is rejected" />
            </>}
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-brand-border px-5 py-4">
          <button type="button" onClick={close} className="portal-outline-btn">
            {["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(modal) ? "Close" : "Cancel"}
          </button>
          {!["queryAttachments", "proposalAttachments", "proposalFinalizedPdf"].includes(modal) && (
            <button type="submit" disabled={isSaving} className="portal-primary-btn disabled:opacity-60">
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              Save
            </button>
          )}
        </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DataTable({ rows, columns, empty, compact = false, mobileCardRender }) {
  if (!rows) return <LoadingPanel />;
  if (rows.length === 0) return <EmptyState label={empty} />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm"
    >
      {mobileCardRender && (
        <div className="divide-y divide-brand-border md:hidden">
          {rows.map((row, rowIndex) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
              className="p-4"
            >
              {mobileCardRender(row)}
            </motion.div>
          ))}
        </div>
      )}
      <div className={`overflow-x-auto ${mobileCardRender ? "hidden md:block" : ""}`}>
        <table className="min-w-full border-collapse">
          <thead className="bg-brand-light/80">
            <tr>
              {columns.map(([label]) => (
                <th key={label} className="border-b border-brand-border px-4 py-3 text-left text-xs font-semibold text-citius-blue/80">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
                className="transition-colors hover:bg-citius-blue/[0.03]"
              >
                {columns.map(([label, render]) => (
                  <td key={label} className={`border-b border-brand-border px-4 ${compact ? "py-2" : "py-3"} text-sm text-brand-dark last:border-b-0`}>
                    {render(row) || "-"}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function EditButton({ onClick, label = "Edit" }) {
  return (
    <button type="button" className="portal-small-btn" onClick={onClick}>
      {label}
    </button>
  );
}

function DeleteButton({ label, onClick }) {
  return (
    <button type="button" className="portal-danger-btn" onClick={onClick} aria-label={`Delete ${label}`}>
      <Trash2 size={13} />
      Delete
    </button>
  );
}

function Panel({ title, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm md:p-6"
    >
      <h2 className="mb-4 font-heading text-lg font-semibold text-citius-blue md:text-xl">{title}</h2>
      {children}
    </motion.section>
  );
}

function DashboardSectionHeading({ title, detail }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h3 className="font-heading text-sm font-semibold tracking-wide text-brand-dark">{title}</h3>
      {detail ? <p className="text-xs text-brand-muted">{detail}</p> : null}
    </div>
  );
}

function QueryTypeTile({ type, count, index = 0, variant = "active" }) {
  const tone =
    type.includes("Cement")
      ? "from-stone-500/10 to-stone-500/5 border-stone-200"
      : type.startsWith("MICE")
        ? "from-citius-blue/12 to-citius-blue/5 border-citius-blue/15"
        : type === "FIT" || type === "Family Group"
          ? "from-emerald-500/12 to-emerald-500/5 border-emerald-200"
          : "from-citius-orange/12 to-citius-orange/5 border-citius-orange/20";
  const valueTone =
    variant === "confirmed"
      ? "text-emerald-700"
      : variant === "closed"
        ? "text-stone-600"
        : "text-citius-blue";
  const ringTone =
    variant === "confirmed"
      ? "ring-1 ring-emerald-500/15"
      : variant === "closed"
        ? "ring-1 ring-stone-400/20"
        : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
      className={`rounded-xl border bg-linear-to-br p-4 shadow-sm transition-shadow hover:shadow-md ${tone} ${ringTone}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{type}</div>
      <div className={`mt-2 font-heading text-2xl font-semibold tabular-nums ${valueTone}`}>{count}</div>
    </motion.div>
  );
}

function StatCard({ label, value, Icon, index = 0, featured = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`group overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-lg ${
        featured ? "sm:col-span-2 bg-linear-to-br from-citius-blue to-citius-blue/90 text-white" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${featured ? "text-white/80" : "text-brand-muted"}`}>{label}</div>
        <div className={`rounded-full p-2 ${featured ? "bg-white/15" : "bg-citius-orange/10"}`}>
          <Icon size={18} className={featured ? "text-citius-orange" : "text-citius-orange"} />
        </div>
      </div>
      <div className={`mt-3 font-heading text-3xl font-semibold tabular-nums ${featured ? "text-white" : "text-citius-blue"}`}>
        {value}
      </div>
    </motion.div>
  );
}

function Progress({ label, value }) {
  return (
    <div>
      <div className="mt-3 flex justify-between text-xs text-brand-muted">
        <span>{label}</span>
        <strong className="text-citius-blue">{Math.min(value || 0, 100)}%</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-border">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value || 0, 100)}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full bg-linear-to-r from-citius-orange to-citius-blue"
        />
      </div>
    </div>
  );
}

function Timeline({ rows }) {
  if (!rows.length) return <EmptyState label="No records yet." />;
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-md border border-brand-border bg-brand-light p-3">
          <div className="text-sm font-semibold">{row.message}</div>
          <div className="mt-1 text-xs text-brand-muted">{row.actorName} - {formatDate(row.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10" />
    </label>
  );
}

function Select({ label, value, options, onChange, required = false }) {
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10">
        {normalized.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block text-xs font-semibold text-brand-muted">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(option)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option);
                else next.delete(option);
                onChange(Array.from(next));
              }}
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange, maxWords }) {
  const wordCount = countWords(value);
  const handleChange = (event) => {
    let next = event.target.value;
    if (maxWords) {
      next = truncateToMaxWords(next, maxWords);
    }
    onChange(next);
  };

  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <textarea value={value} onChange={handleChange} rows={4} className="w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10" />
      {maxWords ? (
        <span className={`mt-1 block text-xs ${wordCount >= maxWords ? "text-amber-700" : "text-brand-muted"}`}>
          {wordCount}/{maxWords} words
        </span>
      ) : null}
    </label>
  );
}

function Badge({ label, tone = "gray" }) {
  const tones = {
    blue: "bg-citius-blue/10 text-citius-blue",
    green: "bg-citius-green/15 text-emerald-700",
    amber: "bg-citius-orange/15 text-amber-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-violet-50 text-violet-700",
    gray: "bg-brand-light text-brand-muted",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone] || tones.gray}`}>{label}</span>;
}

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-border bg-white p-8 text-center text-sm text-brand-muted">
      {label}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid min-h-60 place-items-center rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center gap-2 text-sm text-brand-muted">
        <Loader2 className="animate-spin text-citius-orange" size={18} />
        Loading portal data
      </div>
    </div>
  );
}

function strong(value) {
  return <strong className="font-semibold">{value}</strong>;
}

function filterRows(rows, search, keys) {
  const term = search.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((row) =>
    keys.some((key) => String(row[key] || "").toLowerCase().includes(term)),
  );
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatConvexError(error, fallback) {
  if (!error) return fallback;
  if (typeof error.data === "string" && error.data.trim()) {
    return error.data;
  }
  if (error.message && !/server error called by client/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}

function LifecycleDates({ items, compact = false }) {
  const visible = (items || []).filter((item) => item.value);
  if (visible.length === 0) return null;
  return (
    <div className={compact ? "" : "mb-4 rounded-lg border border-brand-border bg-brand-light/50 px-4 py-3"}>
      <div className={`flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-xs text-brand-muted" : "text-xs text-brand-muted"}`}>
        {visible.map((item) => (
          <span key={item.label}>
            <span className="font-semibold text-brand-dark">{item.label}:</span>{" "}
            {formatDate(item.value)}
          </span>
        ))}
      </div>
    </div>
  );
}

function QueryRowActions({ primaryAction, overflowActions = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 md:hidden">
      {primaryAction}
      {overflowActions.length > 0 && (
        <div className="relative">
          <button
            type="button"
            className="portal-small-btn inline-flex items-center gap-1"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="More actions"
          >
            <MoreHorizontal size={14} />
            More
          </button>
          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-transparent"
                aria-label="Close actions menu"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-2 min-w-[180px] rounded-xl border border-brand-border bg-white p-2 shadow-lg">
                <div className="flex flex-col gap-2">
                  {overflowActions.map((action, index) => (
                    <div key={index} onClick={() => setOpen(false)}>
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function money(value) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

const MAX_QUERY_NOTES_WORDS = 30;

function countWords(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function truncateToMaxWords(value, maxWords) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return value;
  }
  return words.slice(0, maxWords).join(" ");
}

function formatNotesPreview(value, maxWords = MAX_QUERY_NOTES_WORDS) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const words = text.split(/\s+/).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <span
      className="block max-w-[220px] whitespace-normal break-words text-xs leading-snug text-brand-muted"
      title={text}
    >
      {display}
    </span>
  );
}

function notesPreview(value) {
  return formatNotesPreview(value);
}

function contractingTotalCost(rowOrForm) {
  return (
    Number(rowOrForm?.contractingLandCost || 0)
    + Number(rowOrForm?.contractingAirlinesCost || 0)
    + Number(rowOrForm?.contractingVisaCost || 0)
  );
}

function proposalTotalCost(landCostPerPax, airfarePerPax, paxCount) {
  const pax = Math.max(Number(paxCount) || 1, 1);
  return (
    (Math.max(Number(landCostPerPax) || 0, 0) + Math.max(Number(airfarePerPax) || 0, 0)) * pax
  );
}

function isQueryConfirmed(rowOrForm) {
  return (
    rowOrForm?.salesStatus === "Order Confirmed" ||
    rowOrForm?.contractingStatus === "Order Confirmed"
  );
}

function ContractingCostFields({ form, updateForm }) {
  const totalCost = contractingTotalCost(form);

  return (
    <>
      <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/60 p-4">
        <div className="mb-3 font-heading text-sm font-semibold text-citius-blue">Contracting cost</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Land Cost (INR)" type="number" value={form.contractingLandCost} onChange={(v) => updateForm("contractingLandCost", v)} />
          <Input label="Airlines Cost (INR)" type="number" value={form.contractingAirlinesCost} onChange={(v) => updateForm("contractingAirlinesCost", v)} />
          <Input label="Visa Cost (INR)" type="number" value={form.contractingVisaCost} onChange={(v) => updateForm("contractingVisaCost", v)} />
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Total cost</div>
            <div className="mt-1 font-semibold text-brand-dark">{money(totalCost)}</div>
          </div>
        </div>
      </div>
    </>
  );
}

const MAX_QUERY_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const QUERY_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";

async function uploadQueryFiles({ queryId, files, generateUploadUrl, attachQueryFile }) {
  for (const file of files) {
    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} exceeds the 15 MB limit.`);
    }
    const uploadUrl = await generateUploadUrl({});
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`Failed to upload ${file.name}.`);
    }
    const { storageId } = await uploadRes.json();
    await attachQueryFile({
      queryId,
      storageId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    });
  }
}

async function uploadEntityFiles({ entityId, idField, files, generateUploadUrl, attachFile }) {
  for (const file of files) {
    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} exceeds the 15 MB limit.`);
    }
    const uploadUrl = await generateUploadUrl({});
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`Failed to upload ${file.name}.`);
    }
    const { storageId } = await uploadRes.json();
    await attachFile({
      [idField]: entityId,
      storageId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    });
  }
}

async function uploadExpenseProofFiles({ expenseId, files, generateUploadUrl, attachExpenseProof }) {
  for (const file of files) {
    await uploadEntityFiles({
      entityId: expenseId,
      idField: "expenseId",
      files: [file],
      generateUploadUrl,
      attachFile: attachExpenseProof,
    });
  }
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openPortalFile(url) {
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

async function openQueryAttachment(attachmentId, getQueryAttachmentUrl, kind = "query") {
  void getQueryAttachmentUrl;
  const routeKind =
    kind === "proposal" ? "proposal" : kind === "expense" ? "expense" : "query";
  openPortalFile(`/api/portal/files/${routeKind}/${encodeURIComponent(attachmentId)}`);
}

async function openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl) {
  void getFinalizedPdfUrl;
  openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
}

function FinalizedProposalPdfSummary({ finalizedPdf, canSend, onManage, onDownload }) {
  if (!finalizedPdf) {
    return canSend ? (
      <button type="button" className="portal-small-btn" onClick={onManage}>
        Upload PDF
      </button>
    ) : (
      <span className="text-xs text-brand-muted">Not uploaded</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="inline-flex max-w-[180px] items-center gap-1 truncate text-left text-xs font-medium text-citius-blue hover:underline"
        onClick={() => onDownload().catch((err) => {
          alert(err?.data || err?.message || "Unable to open file.");
        })}
      >
        <FileText size={12} className="shrink-0" />
        <span className="truncate">{finalizedPdf.fileName}</span>
      </button>
      {finalizedPdf.uploadedAt && (
        <span className="text-[11px] text-brand-muted">{formatDate(finalizedPdf.uploadedAt)}</span>
      )}
      {canSend && (
        <button type="button" className="portal-small-btn mt-1 w-fit" onClick={onManage}>
          Replace PDF
        </button>
      )}
    </div>
  );
}

function FinalizedProposalPdfPanel({
  proposalId,
  finalizedPdf,
  canSend,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !proposalId) return;

    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      setUploadError(`${file.name} exceeds the 15 MB limit.`);
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateFinalizedPdfUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!uploadRes.ok) {
        throw new Error(`Failed to upload ${file.name}.`);
      }
      const { storageId } = await uploadRes.json();
      await attachFinalizedPdf({
        proposalId,
        storageId,
        fileName: file.name,
        mimeType: file.type || "application/pdf",
        fileSize: file.size,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Remove the finalized proposal PDF?")) return;
    try {
      await removeFinalizedPdf({ proposalId });
    } catch (err) {
      alert(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      <p className="text-sm text-brand-muted">
        Upload the client-ready proposal PDF here. Sales can download it and send it to the client, then mark the proposal as sent.
      </p>
      {canSend && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label htmlFor="finalized-proposal-pdf-upload" className="mb-2 block text-sm font-medium text-brand-text">
            {finalizedPdf ? "Replace Finalized Proposal PDF" : "Upload Finalized Proposal PDF"}
          </label>
          <p className="mb-3 text-xs text-brand-muted">PDF only, up to 15 MB.</p>
          <input
            id="finalized-proposal-pdf-upload"
            type="file"
            accept=".pdf,application/pdf"
            disabled={isUploading}
            className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={handleUpload}
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {!finalizedPdf ? (
        <p className="text-sm text-brand-muted">No finalized proposal PDF uploaded yet.</p>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-text">{finalizedPdf.fileName}</div>
            {finalizedPdf.uploadedAt && (
              <div className="text-xs text-brand-muted">Uploaded {formatDate(finalizedPdf.uploadedAt)}</div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="portal-small-btn"
              onClick={() => openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl).catch((err) => {
                alert(err?.data || err?.message || "Unable to open file.");
              })}
            >
              Download
            </button>
            {canSend && (
              <button type="button" className="portal-danger-btn" onClick={handleRemove}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function QueryAttachmentSummary({ attachments, canManage, onManage, getQueryAttachmentUrl, attachmentKind = "query" }) {
  if (!attachments.length) {
    return canManage ? (
      <button type="button" className="portal-small-btn" onClick={onManage}>
        Add files
      </button>
    ) : (
      <span className="text-xs text-brand-muted">—</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {attachments.slice(0, 2).map((file) => (
        <button
          key={file.id}
          type="button"
          className="inline-flex max-w-[180px] items-center gap-1 truncate text-left text-xs font-medium text-citius-blue hover:underline"
          onClick={() => openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch((err) => {
            alert(err?.data || err?.message || "Unable to open file.");
          })}
        >
          <Paperclip size={12} className="shrink-0" />
          <span className="truncate">{file.fileName}</span>
        </button>
      ))}
      {attachments.length > 2 && (
        <span className="text-[11px] text-brand-muted">+{attachments.length - 2} more</span>
      )}
      {canManage && (
        <button type="button" className="portal-small-btn mt-1 w-fit" onClick={onManage}>
          Manage
        </button>
      )}
    </div>
  );
}

function QueryFilePicker({ files, onChange, inputId }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
      <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-brand-text">
        Attachments
      </label>
      <p className="mb-3 text-xs text-brand-muted">
        PDF, Office documents, images, or text files up to 15 MB each.
      </p>
      <input
        id={inputId}
        type="file"
        multiple
        accept={QUERY_ATTACHMENT_ACCEPT}
        className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-blue file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-citius-blue/90"
        onChange={(event) => {
          const picked = Array.from(event.target.files || []);
          if (!picked.length) return;
          onChange([...files, ...picked]);
          event.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.name}</div>
                <div className="text-xs text-brand-muted">{formatFileSize(file.size)}</div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-red-600 hover:underline"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QueryAttachmentsPanel({
  queryId,
  entityId,
  idField = "queryId",
  attachments,
  canManage,
  uploadLabel = "Upload Reference Itinerary",
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  attachmentKind = "query",
  removeQueryAttachment,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    const targetId = entityId || queryId;
    if (!picked.length || !targetId) return;

    setIsUploading(true);
    setUploadError("");
    try {
      await uploadEntityFiles({
        entityId: targetId,
        idField,
        files: picked,
        generateUploadUrl: generateQueryUploadUrl,
        attachFile: attachQueryFile,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (attachment) => {
    if (!window.confirm(`Remove ${attachment.fileName}?`)) return;
    try {
      await removeQueryAttachment({ attachmentId: attachment.id });
    } catch (err) {
      alert(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label htmlFor="query-attachment-upload" className="mb-2 block text-sm font-medium text-brand-text">
            {uploadLabel}
          </label>
          <input
            id="query-attachment-upload"
            type="file"
            multiple
            accept={QUERY_ATTACHMENT_ACCEPT}
            disabled={isUploading}
            className="block w-full text-sm text-brand-text file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
            onChange={handleUpload}
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-sm text-red-600">{uploadError}</p>}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-sm text-brand-muted">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.fileName}</div>
                <div className="text-xs text-brand-muted">
                  {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() => openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch((err) => {
                    alert(err?.data || err?.message || "Unable to open file.");
                  })}
                >
                  Open
                </button>
                {canManage && (
                  <button type="button" className="portal-small-btn text-red-600" onClick={() => handleRemove(file)}>
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  );
}

function paymentTermLabel(queryType) {
  if (queryType === "Spiritual") return "100% advance";
  if (queryType === "B2B") return "80%-100% advance";
  if (["FIT", "Family Group"].includes(queryType)) return "90%-100% advance";
  if (queryType === "Cement Bidding") return "70%-100% advance";
  return "70%-90% advance";
}

function statusTone(status) {
  if (["Issued", "Approved", "Paid", "Active", "Available", "Done", "Order Confirmed", "Sent", "Assigned", "Confirmation", "Ready"].includes(status)) return "green";
  if (["Pending Issue", "Pending", "Awaiting", "Part Paid", "Proposal in progress", "Proposal in discussion", "Open", "Held", "Inquiry", "Proposal", "Ticketing", "Docs pending"].includes(status)) return "amber";
  if (["Cancelled", "Rejected", "Order Lost", "Lost", "Overdue", "Inactive", "Blocked", "Closed"].includes(status)) return "red";
  if (["Reissue Required", "Name Change Required", "Re-applied", "Negotiation"].includes(status)) return "purple";
  return "blue";
}

function BriefcaseIcon(props) {
  return <Settings {...props} />;
}
