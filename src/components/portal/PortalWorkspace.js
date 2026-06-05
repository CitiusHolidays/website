"use client";
"use no memo";

import { api } from "@convex/_generated/api";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  Hotel,
  Loader2,
  MoreHorizontal,
  Paperclip,
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
import { AnimatePresence, m as motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardView } from "@/components/portal/dashboard/DashboardView";
import { EntityModal } from "@/components/portal/EntityModal";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { PortalListFilters } from "@/components/portal/PortalListFilters";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { usePortalNotificationDeepLink } from "@/components/portal/usePortalNotificationDeepLink";
import { usePortalWorkspaceState } from "@/components/portal/usePortalWorkspaceState";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  CABIN_CLASSES,
  CALLING_STATUSES,
  CONTRACTING_STATUS_SELECT_OPTIONS,
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
  ROOM_TYPES,
  SALES_STATUSES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TRAVEL_TYPES,
  VISA_STATUSES,
} from "@/lib/portal/constants";
import {
  uploadEntityFiles,
  uploadExpenseProofFiles,
  uploadQueryFiles,
} from "@/lib/portal/fileUploads";
import { toNumber } from "@/lib/portal/formUtils";
import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import {
  applyListFilters,
  filterEmptyMessage,
  hasActiveListFilters,
} from "@/lib/portal/listFilters";
import {
  buildModalInitial,
  getNotificationHref,
  isDeepLinkDataReady,
  resolveDeepLink,
} from "@/lib/portal/notificationTargets";
import { toPassengerImportInput } from "@/lib/portal/passengerImportRows";
import {
  attachPassportExpiryUrgency,
  formatPassportExpiryLabel,
  getPassportExpiryInfo,
  passportExpiryTone,
} from "@/lib/portal/passportExpiry";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { dateRangeQueryArg, EMPTY_DATE_RANGE, filterByDateRange } from "@/lib/portal/periodFilter";
import {
  canAssignContracting,
  canAssignOperations,
  canAssignQueryTicketing,
  canAssignTicketing,
  canAssignTourManagers,
  getQueryTypeOptions,
  isCementScopedUser,
  teamSelectOptions,
} from "@/lib/portal/permissions";
import { filterRows } from "@/lib/portal/pipeViewRows";
import {
  proposalLinkedQueryIds,
  proposalLinkedQueryLabel,
  proposalPrimaryQuery,
} from "@/lib/portal/proposalLinks";
import { runMutation } from "@/lib/portal/runMutation";
import {
  buildFlightWorkbook,
  buildPassengerWorkbook,
  buildPassportWorkbook,
  buildRoomingWorkbook,
  buildTravellerMasterWorkbook,
  buildVisaWorkbook,
  downloadWorkbook,
} from "@/lib/portal/spreadsheetExports";
import {
  formatRoomSummaryText,
  parseFlightWorkbookFile,
  parsePassengerWorkbookFile,
  parsePassportWorkbookFile,
  parseRoomingWorkbookFile,
  parseTravellerMasterWorkbookFile,
  parseVisaWorkbookFile,
  summarizeRoomTypes,
} from "@/lib/portal/spreadsheetImports";
import { parseUrlFilterState, serializeUrlFilterState } from "@/lib/portal/urlFilterState";
import {
  getExpenseSplitTotal,
  getPipelineBuckets,
  getSalesPipelineBuckets,
} from "@/lib/portal/workflow";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const P = PORTAL_PERMISSIONS;
const SPREADSHEET_MODALS = [
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

const EMPTY_JOB_CARDS = [];
const EMPTY_LIST_FILTER_CONFIG = [];
const EMPTY_LIST_FILTERS = {};
const EMPTY_FILTER_SOURCE_ROWS = [];

const PASSENGER_IMPORT_INITIAL = {
  jobCardId: "",
  fileName: "",
  parsed: null,
  preview: null,
  isParsing: false,
  isPreviewing: false,
  isSaving: false,
  importProgress: null,
  error: "",
};

const FLIGHT_IMPORT_INITIAL = {
  jobCardId: "",
  fileName: "",
  parsed: null,
  isParsing: false,
  isSaving: false,
  error: "",
};

const PASSENGER_EXPORT_INITIAL = {
  jobCardId: "",
  exportData: null,
  isLoading: false,
  isExporting: false,
  error: "",
};

const VIEW_META = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Live overview across active enquiries, jobs, tickets, visas, and payments.",
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

function jobCardFilterOptions(jobCards) {
  return [
    { value: "", label: "All job cards" },
    ...(jobCards || []).map((job) => ({
      value: job.id,
      label: job.jobCode,
    })),
  ];
}

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
  const rows = jobCardId
    ? travellers.filter((traveller) => traveller.jobCardId === jobCardId)
    : travellers;
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
      <PortalWorkspaceInner key={props.view || "dashboard"} {...props} />
    </Suspense>
  );
}

function PortalWorkspaceInner({ view = "dashboard" }) {
  const searchParams = useSearchParams();
  const workspace = usePortalWorkspaceState(view, searchParams);
  usePortalNotificationDeepLink(workspace);
  if (workspace.gate === "loading") {
    return <LoadingPanel />;
  }
  if (workspace.gate === "denied") {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm">
        <div className="font-heading text-xl font-semibold text-citius-blue">
          No access to this portal page
        </div>
        <p className="mt-2 text-sm text-brand-muted">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }
  return <PortalWorkspaceLayout workspace={workspace} />;
}

function PortalWorkspaceHeader({ workspace: w }) {
  return (
    <>
      <PageHeader
        title={w.meta.title}
        subtitle={w.meta.subtitle}
        search={w.search}
        setSearch={w.setSearchWithUrl}
        dateRange={w.dateRange}
        setDateRange={w.setDateRangeWithUrl}
        showSearch={w.view !== "dashboard"}
        showPeriodFilter={!["settings", "team", "dashboard"].includes(w.view)}
        showJobCardFilter={w.showJobCardFilter}
        jobCardFilter={w.jobCardFilter}
        setJobCardFilter={w.setJobCardFilterWithUrl}
        jobCards={w.jobCards || []}
        listFilterConfig={w.listFilterConfig}
        listFilters={w.listFilters}
        setListFilterValue={w.setListFilterValue}
        filterSourceRows={
          {
            proposals: w.periodFiltered.proposals,
            "job-cards": w.periodFiltered.jobCards,
            travellers: w.periodFiltered.travellers,
            passport: w.periodFiltered.travellers,
            visa: w.periodFiltered.visas,
            ticketing: w.periodFiltered.tickets,
            flights: w.periodFiltered.pnrs,
            tickets: w.periodFiltered.tickets,
            "seat-allocation": w.periodFiltered.seats,
            hotels: w.periodFiltered.travellers,
            "tour-managers": w.periodFiltered.tourManagers,
            finance: w.periodFiltered.invoices,
            expenses: w.periodFiltered.expenses,
            approvals: w.periodFiltered.approvals,
            "employees-on-leave": w.periodFiltered.leaves,
            team: w.team || [],
            activity: w.periodFiltered.activity,
          }[w.view] ?? w.periodFiltered.queries
        }
        filtersActive={w.filtersActive}
        onClearAllFilters={w.clearAllFilters}
      >
        <HeaderActions view={w.view} openModal={w.openModal} has={w.has} access={w.access} />
      </PageHeader>

      {w.error && !w.modal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {w.error}
        </div>
      )}
    </>
  );
}

function PortalWorkspaceViews({ workspace: w }) {
  return (
    <>
      {w.view === "dashboard" && (
        <DashboardView
          summary={w.summary}
          has={w.has}
          access={w.access}
          dateRange={w.dateRange}
          setDateRange={w.setDateRangeWithUrl}
          openModal={w.openModal}
          loading={w.summary === undefined}
        />
      )}
      {w.view === "queries" && (
        <QueriesView
          rows={w.filteredQueries}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          canAssign={canAssignContracting(w.access) || canAssignQueryTicketing(w.access)}
          deleteItem={w.deleteItem}
          removeQuery={w.removeQuery}
          submitToContracting={w.submitToContracting}
          getQueryAttachmentUrl={w.getQueryAttachmentUrl}
        />
      )}
      {w.view === "pipeline" && (
        <PipelineView
          rows={w.filteredPipelineQueries}
          mode={w.pipelineMode}
          setMode={w.setPipelineMode}
        />
      )}
      {w.view === "contracting" && (
        <ContractingView
          rows={w.filteredContractingQueries}
          proposals={w.filteredProposals}
          filtersActive={w.filtersActive}
          team={w.team || []}
          openModal={w.openModal}
          has={w.has}
          canAssign={canAssignContracting(w.access) || canAssignQueryTicketing(w.access)}
          deleteItem={w.deleteItem}
          removeQuery={w.removeQuery}
        />
      )}
      {w.view === "proposals" && (
        <ProposalsView
          rows={w.filteredProposals}
          filtersActive={w.filtersActive}
          markProposalSent={w.markProposalSent}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          removeProposal={w.removeProposal}
          getProposalAttachmentUrl={w.getProposalAttachmentUrl}
          getFinalizedPdfUrl={w.getFinalizedPdfUrl}
        />
      )}
      {w.view === "accounts-job-cards" && (
        <AccountsJobCardView
          rows={w.filteredAccountsQueries}
          filtersActive={w.filtersActive}
          jobCards={w.filteredJobCards}
          openModal={w.openModal}
        />
      )}
      {w.view === "job-cards" && (
        <JobCardsView
          rows={w.filteredJobCards}
          filtersActive={w.filtersActive}
          updateJobStatus={w.updateJobStatus}
          openModal={w.openModal}
          has={w.has}
          access={w.access}
          deleteItem={w.deleteItem}
          removeJobCard={w.removeJobCard}
        />
      )}
      {w.view === "travellers" && (
        <TravellersView
          rows={w.filteredTravellers}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeTraveller={w.removeTraveller}
          removeManyTravellers={w.removeManyTravellers}
        />
      )}
      {w.view === "passport" && (
        <PassportDocumentsView
          travellers={w.filteredPassportTravellers}
          filtersActive={w.filtersActive}
          has={w.has}
          generateUploadUrl={w.generateUploadUrl}
          encryptAndStorePassport={w.encryptAndStorePassport}
          getPassportDocument={w.getPassportDocument}
          removePassport={w.removePassport}
        />
      )}
      {w.view === "visa" && (
        <VisaTrackingView
          rows={w.filteredVisas}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeVisa={w.removeVisa}
          removeManyVisas={w.removeManyVisas}
        />
      )}
      {w.view === "ticketing" && (
        <TicketDashboardView
          summary={w.ticketDashboard}
          tickets={w.filteredTickets}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeTicket={w.removeTicket}
          removeManyTickets={w.removeManyTickets}
        />
      )}
      {w.view === "flights" && (
        <PnrView
          rows={w.filteredPnrs}
          filtersActive={w.filtersActive}
          itinerary={w.periodFiltered.flightItinerary}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removePnr={w.removePnr}
          removeManyPnrs={w.removeManyPnrs}
        />
      )}
      {w.view === "seat-allocation" && (
        <SeatView
          rows={w.filteredSeats}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeSeatAllocation={w.removeSeatAllocation}
          removeManySeatAllocations={w.removeManySeatAllocations}
        />
      )}
      {w.view === "tickets" && (
        <TicketsView
          rows={w.filteredAllTickets}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeTicket={w.removeTicket}
          removeManyTickets={w.removeManyTickets}
        />
      )}
      {w.view === "hotels" && (
        <div className="space-y-5">
          <Panel
            title="Hotel Properties"
            subtitle="Manual hotel records for ground planning and check-in/out dates."
          >
            <HotelsView
              rows={w.filteredHotels}
              filtersActive={w.filtersActive}
              openModal={w.openModal}
              has={w.has}
              deleteItem={w.deleteItem}
              deleteSelected={w.deleteSelected}
              removeHotel={w.removeHotel}
              removeManyHotels={w.removeManyHotels}
            />
          </Panel>
          <Panel
            title="Rooming Assignments"
            subtitle="Passenger room types and allocations from traveller master or rooming import."
          >
            <RoomingListView rows={w.filteredRoomingTravellers} filtersActive={w.filtersActive} />
          </Panel>
        </div>
      )}
      {w.view === "tour-managers" && (
        <TourManagersView
          rows={w.filteredTourManagers}
          filtersActive={w.filtersActive}
          travellers={w.periodFiltered.travellers}
          openModal={w.openModal}
          has={w.has}
          canAssign={canAssignTourManagers(w.access)}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          removeTourManager={w.removeTourManager}
          removeManyTourManagers={w.removeManyTourManagers}
          updateCallingStatus={w.updateCallingStatus}
        />
      )}
      {w.view === "finance" && (
        <FinanceView
          rows={w.filteredInvoices}
          filtersActive={w.filtersActive}
          overview={w.financeOverview}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          removeInvoice={w.removeInvoice}
        />
      )}
      {w.view === "expenses" && (
        <ExpensesView
          rows={w.filteredExpenses}
          filtersActive={w.filtersActive}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          removeExpense={w.removeExpense}
          submitExpenseForApproval={w.submitExpenseForApproval}
          getExpenseAttachmentUrl={w.getExpenseAttachmentUrl}
          removeExpenseProof={w.removeExpenseProof}
        />
      )}
      {w.view === "approvals" && (
        <ApprovalsView
          rows={w.filteredApprovals}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          decideApproval={w.decideApproval}
          deleteItem={w.deleteItem}
          removeApproval={w.removeApproval}
        />
      )}
      {w.view === "reports" && <ReportsView report={w.reports} />}
      {w.view === "team" && <TeamView rows={w.filteredTeam} />}
      {w.view === "employees-on-leave" && (
        <LeaveView
          rows={w.filteredLeaves}
          filtersActive={w.filtersActive}
          staff={w.staff || w.team || []}
          access={w.access}
          leaveBalances={w.leaveBalances}
          openModal={w.openModal}
          has={w.has}
          deleteItem={w.deleteItem}
          removeLeave={w.removeLeave}
          decideLeave={w.decideLeave}
        />
      )}
      {w.view === "activity" && (
        <ActivityView
          activity={w.filteredActivity}
          filtersActive={w.filtersActive}
          notifications={w.periodFiltered.notifications}
          deleteItem={w.deleteItem}
          removeNotification={w.removeNotification}
          markNotificationRead={w.markNotificationRead}
        />
      )}
      {w.view === "settings" && (
        <SettingsView
          staff={w.filteredStaff}
          dropdowns={w.dropdowns || {}}
          search={w.search}
          openModal={w.openModal}
          deleteItem={w.deleteItem}
          removeStaff={w.removeStaff}
          startStaffOnboarding={w.startStaffOnboarding}
        />
      )}
    </>
  );
}

const PASSENGER_IMPORT_MODAL_CONFIGS = [
  {
    modal: "passengerImport",
    title: "Import Ticketing Passenger List",
    fileLabel: "Ticketing passenger spreadsheet",
    successLabel: "Ticketing passenger import complete",
    uploadLabel: "Upload Ticketing List",
  },
  {
    modal: "travellerImport",
    title: "Import Traveller Master",
    fileLabel: "Traveller master spreadsheet",
    parseWorkbookFile: parseTravellerMasterWorkbookFile,
    emptyLabel: "No traveller master rows found.",
    successLabel: "Traveller master import complete",
    uploadLabel: "Upload Traveller Master",
    importKind: "traveller",
  },
  {
    modal: "roomingImport",
    title: "Import Rooming List",
    fileLabel: "Rooming spreadsheet",
    parseWorkbookFile: parseRoomingWorkbookFile,
    emptyLabel: "No rooming rows found.",
    successLabel: "Rooming import complete",
    uploadLabel: "Upload Rooming",
    importKind: "rooming",
  },
  {
    modal: "passportImport",
    title: "Import Passport List",
    fileLabel: "Passport spreadsheet",
    parseWorkbookFile: parsePassportWorkbookFile,
    emptyLabel: "No passport rows found.",
    successLabel: "Passport import complete",
    uploadLabel: "Upload Passports",
  },
  {
    modal: "visaImport",
    title: "Import Visa List",
    fileLabel: "Visa spreadsheet",
    parseWorkbookFile: parseVisaWorkbookFile,
    emptyLabel: "No visa rows found.",
    successLabel: "Visa import complete",
    uploadLabel: "Upload Visa Rows",
  },
];

const PASSENGER_EXPORT_MODAL_CONFIGS = [
  {
    modal: "passengerExport",
    title: "Export Ticketing Passenger List",
    subtitle: "Select a job card to download the ticketing passenger spreadsheet.",
    filenameSuffix: "ticketing-passengers",
    exportKind: "passenger",
  },
  {
    modal: "travellerExport",
    title: "Export Traveller Master",
    subtitle: "Select a job card to download the Master list sheet in the traveller master format.",
    buildWorkbook: buildTravellerMasterWorkbook,
    filenameSuffix: "traveller-master",
    sheetName: "Master list",
    exportKind: "traveller",
  },
  {
    modal: "roomingExport",
    title: "Export Rooming List",
    subtitle: "Select a job card to download the Rooming sheet in the master-list format.",
    buildWorkbook: buildRoomingWorkbook,
    filenameSuffix: "rooming",
    sheetName: "Rooming",
    exportKind: "rooming",
  },
  {
    modal: "passportExport",
    title: "Export Passport List",
    subtitle: "Select a job card to download the Passport sheet in the master-list format.",
    buildWorkbook: buildPassportWorkbook,
    filenameSuffix: "passport",
    sheetName: "Passport",
    exportKind: "passport",
  },
  {
    modal: "visaExport",
    title: "Export Visa List",
    subtitle: "Select a job card to download the Visa sheet in the master-list format.",
    buildWorkbook: buildVisaWorkbook,
    filenameSuffix: "visa",
    sheetName: "Visa",
    exportKind: "visa",
  },
];

function PortalWorkspaceSpreadsheetModals({ workspace: w }) {
  return (
    <>
      <EntityModal
        modal={SPREADSHEET_MODALS.includes(w.modal) ? null : w.modal}
        form={w.form}
        updateForm={w.updateForm}
        patchForm={w.patchForm}
        submit={w.submit}
        close={w.closeModal}
        error={w.error}
        isSaving={w.isSaving}
        queries={w.queries || []}
        proposals={w.proposals || []}
        jobCards={w.jobCards || []}
        travellers={w.travellers || []}
        visas={w.visas || []}
        pnrs={w.pnrs || []}
        team={w.team || []}
        leaveBalances={w.leaveBalances}
        travellersWithoutVisa={w.travellersWithoutVisa || []}
        pendingQueryFiles={w.pendingQueryFiles}
        setPendingQueryFiles={w.setPendingQueryFiles}
        pendingProposalFiles={w.pendingProposalFiles}
        setPendingProposalFiles={w.setPendingProposalFiles}
        pendingExpenseProofFiles={w.pendingExpenseProofFiles}
        setPendingExpenseProofFiles={w.setPendingExpenseProofFiles}
        generateQueryUploadUrl={w.generateQueryUploadUrl}
        attachQueryFile={w.attachQueryFile}
        getQueryAttachmentUrl={w.getQueryAttachmentUrl}
        removeQueryAttachment={w.removeQueryAttachment}
        generateProposalUploadUrl={w.generateProposalUploadUrl}
        attachProposalFile={w.attachProposalFile}
        getProposalAttachmentUrl={w.getProposalAttachmentUrl}
        removeProposalAttachment={w.removeProposalAttachment}
        generateFinalizedPdfUploadUrl={w.generateFinalizedPdfUploadUrl}
        attachFinalizedPdf={w.attachFinalizedPdf}
        getFinalizedPdfUrl={w.getFinalizedPdfUrl}
        removeFinalizedPdf={w.removeFinalizedPdf}
        getExpenseAttachmentUrl={w.getExpenseAttachmentUrl}
        removeExpenseProof={w.removeExpenseProof}
        has={w.has}
        access={w.access}
        leaveHeadApproverCandidates={w.leaveHeadApproverCandidates || []}
      />
      {PASSENGER_IMPORT_MODAL_CONFIGS.map((config) => (
        <PassengerImportModal
          key={config.modal}
          open={w.modal === config.modal}
          close={w.closeModal}
          jobCards={w.jobCards || []}
          previewPassengerImport={w.previewPassengerImport}
          commitPassengerImport={w.commitPassengerImport}
          {...config}
        />
      ))}
      <FlightImportModal
        open={w.modal === "flightImport"}
        close={w.closeModal}
        jobCards={w.jobCards || []}
        itinerary={w.flightItinerary || []}
        commitFlightImport={w.commitFlightImport}
      />
      {PASSENGER_EXPORT_MODAL_CONFIGS.map((config) => (
        <PassengerExportModal
          key={config.modal}
          open={w.modal === config.modal}
          close={w.closeModal}
          jobCards={w.jobCards || []}
          getPassengerExportRows={w.getPassengerExportRows}
          {...config}
        />
      ))}
      <FlightExportModal
        open={w.modal === "flightExport"}
        close={w.closeModal}
        jobCards={w.jobCards || []}
        itinerary={w.flightItinerary || []}
      />
    </>
  );
}

function PortalWorkspaceLayout({ workspace: w }) {
  return (
    <div className="mx-auto max-w-[1500px]">
      <PortalWorkspaceHeader workspace={w} />
      <PortalWorkspaceViews workspace={w} />
      <PortalWorkspaceSpreadsheetModals workspace={w} />
    </div>
  );
}

function HeaderActions({ view, openModal, has, access }) {
  if (view === "travellers" && has(P.MANAGE_TRAVELLERS)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("travellerExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Traveller Master
        </button>
        <button
          type="button"
          onClick={() => openModal("travellerImport")}
          className="portal-small-btn bg-white"
        >
          <Upload size={16} />
          Import Traveller Master
        </button>
        <button type="button" onClick={() => openModal("traveller")} className="portal-primary-btn">
          <Plus size={16} />
          Add Traveller
        </button>
      </div>
    );
  }
  if (view === "ticketing" && has(P.MANAGE_TICKETING)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("passengerExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Passengers
        </button>
        <button
          type="button"
          onClick={() => openModal("passengerImport")}
          className="portal-small-btn bg-white"
        >
          <Upload size={16} />
          Import Passengers
        </button>
        <button type="button" onClick={() => openModal("ticket")} className="portal-primary-btn">
          <Plus size={16} />
          Issue Ticket
        </button>
      </div>
    );
  }
  if (view === "flights" && has(P.MANAGE_TICKETING)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("flightExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Flights
        </button>
        <button
          type="button"
          onClick={() => openModal("flightImport")}
          className="portal-small-btn bg-white"
        >
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
  if (view === "hotels" && has(P.MANAGE_OPERATIONS)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("roomingExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Rooming
        </button>
        <button
          type="button"
          onClick={() => openModal("roomingImport")}
          className="portal-small-btn bg-white"
        >
          <Upload size={16} />
          Import Rooming
        </button>
        <button type="button" onClick={() => openModal("hotel")} className="portal-primary-btn">
          <Plus size={16} />
          Add Hotel
        </button>
      </div>
    );
  }
  if (view === "passport" && has(P.MANAGE_VISA)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("passportExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Passport
        </button>
        <button
          type="button"
          onClick={() => openModal("passportImport")}
          className="portal-small-btn bg-white"
        >
          <Upload size={16} />
          Import Passport
        </button>
      </div>
    );
  }
  if (view === "visa" && has(P.MANAGE_VISA)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          type="button"
          onClick={() => openModal("visaExport")}
          className="portal-small-btn bg-white"
        >
          <Download size={16} />
          Export Visa
        </button>
        <button
          type="button"
          onClick={() => openModal("visaImport")}
          className="portal-small-btn bg-white"
        >
          <Upload size={16} />
          Import Visa
        </button>
        <button
          type="button"
          onClick={() => openModal("visa_create")}
          className="portal-primary-btn"
        >
          <Plus size={16} />
          Create Visa Record
        </button>
      </div>
    );
  }
  const actions = {
    queries: has(P.MANAGE_QUERIES) && ["query", "New Query"],
    contracting: (canAssignContracting(access) || canAssignQueryTicketing(access)) && [
      "assignQueryTeams",
      "Assign teams",
    ],
    proposals: has(P.MANAGE_PROPOSALS) && ["proposal", "New Proposal"],
    tickets: has(P.MANAGE_TICKETING) && ["ticket", "Issue Ticket"],
    "seat-allocation": has(P.MANAGE_TICKETING) && ["seat", "Save Seat"],
    "tour-managers": canAssignTourManagers(access) && ["tourManager", "Add Tour Manager"],
    expenses: has(P.CREATE_EXPENSES) && ["expense", "Add Expense"],
    settings: has(P.MANAGE_STAFF) && ["staff", "Add Staff"],
    "employees-on-leave": (has(P.REQUEST_LEAVE) || has(P.MANAGE_LEAVE)) && [
      "leave_create",
      has(P.MANAGE_LEAVE) ? "Record Leave" : "Request Leave",
    ],
  };
  const action = actions[view];
  if (!action) return null;
  return (
    <button
      type="button"
      onClick={() => openModal(action[0])}
      className="portal-primary-btn shrink-0 whitespace-nowrap"
    >
      <Plus size={16} />
      {action[1]}
    </button>
  );
}

function PageHeader({
  title,
  subtitle,
  children,
  search,
  setSearch,
  dateRange,
  setDateRange,
  showPeriodFilter = true,
  showSearch = true,
  showJobCardFilter = false,
  jobCardFilter = "",
  setJobCardFilter,
  jobCards = EMPTY_JOB_CARDS,
  listFilterConfig = EMPTY_LIST_FILTER_CONFIG,
  listFilters = EMPTY_LIST_FILTERS,
  setListFilterValue,
  filterSourceRows = EMPTY_FILTER_SOURCE_ROWS,
  filtersActive = false,
  onClearAllFilters,
}) {
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
      <div className="flex w-full flex-col gap-3 lg:max-w-3xl xl:max-w-none">
        {(showPeriodFilter ||
          showJobCardFilter ||
          listFilterConfig.length > 0 ||
          onClearAllFilters) && (
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {showPeriodFilter && (
              <PortalDateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />
            )}
            {showJobCardFilter && (
              <label className="relative shrink-0">
                <span className="sr-only">Job card</span>
                <select
                  value={jobCardFilter}
                  onChange={(event) => setJobCardFilter(event.target.value)}
                  className="portal-period-select h-11 w-44 appearance-none rounded-full border border-brand-border bg-white px-2 pr-10 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
                  aria-label="Filter by job card"
                >
                  {jobCardFilterOptions(jobCards).map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted/60"
                  size={16}
                />
              </label>
            )}
            <PortalListFilters
              config={listFilterConfig}
              values={listFilters}
              onChange={setListFilterValue}
              rows={filterSourceRows}
            />
            {onClearAllFilters ? (
              <button
                type="button"
                className={`portal-small-btn shrink-0 whitespace-nowrap bg-white ${
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
        )}
        {(showSearch || children) && (
          <div className="flex flex-nowrap items-center justify-end gap-2">
            {showSearch && (
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
                  className="h-11 w-full min-w-[12rem] rounded-full border border-brand-border bg-white pl-9 pr-4 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 sm:w-72"
                  placeholder="Search current data"
                  aria-label="Search this page"
                />
              </label>
            )}
            {children ? <div className="flex shrink-0 flex-nowrap items-center gap-2">{children}</div> : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DashboardQueryTypeBreakdown({
  queryTypeCounts,
  confirmedQueryTypeCounts,
  closedQueryTypeCounts,
  activeQueryTotal,
  confirmedQueryTotal,
  closedQueryTotal,
}) {
  if (
    queryTypeCounts.length === 0 &&
    confirmedQueryTypeCounts.length === 0 &&
    closedQueryTypeCounts.length === 0
  ) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {queryTypeCounts.length > 0 && (
        <section className="space-y-3">
          <DashboardSectionHeading
            title="Active queries by type"
            detail={`${activeQueryTotal.toLocaleString("en-IN")} open enquiries in this period`}
          />
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-4">
            {queryTypeCounts.map((item, index) => (
              <QueryTypeTile
                key={`active-${item.type}`}
                type={item.type}
                count={item.count}
                index={index}
              />
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
            title="Lost queries by type"
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
  );
}

function DashboardSecondaryPanels({
  summary,
  has,
  urgentActions,
  departmentWorkflow,
  showOpsProgress,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]"
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Active tours">
            {(summary.activeTours || []).length === 0 ? (
              <EmptyState label="No active tours yet." />
            ) : (
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
                        <div className="text-sm font-semibold text-brand-dark">
                          {tour.jobCode} - {tour.clientName}
                        </div>
                        <div className="text-xs text-brand-muted">
                          {tour.destination || "Destination pending"} - {tour.pax} pax
                        </div>
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
          {urgentActions.length === 0 ? (
            <EmptyState label="No urgent actions." />
          ) : (
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
            {has(P.VIEW_TICKETING) && (
              <Progress
                label="Tickets issued / total pax"
                value={summary.progress.tickets.percent}
              />
            )}
            {has(P.VIEW_VISA) && (
              <Progress label="Visa approved / total pax" value={summary.progress.visas.percent} />
            )}
            {has(P.VIEW_TRAVELLERS) && (
              <Progress label="Guest data completed" value={summary.progress.guestData.percent} />
            )}
            {has(P.VIEW_OPERATIONS) && (
              <Progress label="Rooming completed" value={summary.progress.rooming.percent} />
            )}
            {has(P.VIEW_FINANCE) && (
              <Progress label="Payment received" value={summary.progress.payment.percent} />
            )}
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
            {(summary.upcomingDepartures || []).length === 0 ? (
              <EmptyState label="No upcoming departures." />
            ) : (
              <DataTable
                compact
                rows={summary.upcomingDepartures}
                empty="No upcoming departures."
                columns={[
                  ["JC", (row) => row.jobCode],
                  ["Client", (row) => strong(row.clientName)],
                  ["Date", (row) => formatDisplayDate(row.travelStartDate)],
                  ["Pax", (row) => row.pax],
                  ["TM", (row) => row.tourManagerName || "-"],
                  [
                    "Readiness",
                    (row) => <Badge label={row.readiness} tone={statusTone(row.readiness)} />,
                  ],
                ]}
              />
            )}
          </Panel>
        )}
        {has(P.VIEW_TEAM) && (
          <Panel title="My team">
            {(summary.myTeam || []).length === 0 ? (
              <EmptyState label="No matching team members." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {summary.myTeam.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-brand-border bg-brand-light p-4"
                  >
                    <div className="text-sm font-semibold text-brand-dark">{member.name}</div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {member.function || member.department}
                    </div>
                    <div className="mt-1 text-xs text-brand-muted">
                      {member.location || member.email}
                    </div>
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
              <Progress
                key={item.label}
                label={`${item.label}: ${typeof item.value === "number" ? item.value.toLocaleString("en-IN") : item.value}`}
                value={item.percent}
              />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function queryStatusModalForAccess(row, has) {
  const isContractingUpdate = has(P.MANAGE_CONTRACTING) && !has(P.MANAGE_QUERIES);
  return {
    modal: isContractingUpdate ? "queryStatus" : "salesDecision",
    label: isContractingUpdate ? "Update" : "Sales Decision",
    initial: {
      queryId: row.id,
      salesStatus: row.salesStatus,
      salesDecision: row.salesStatus || "Proposal in discussion",
      leadStage: row.leadStage || "Inquiry",
      contractingStatus: row.contractingStatus,
      approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
    },
  };
}

function QueryManageActions({ row, openModal, has, deleteItem, removeQuery, submitToContracting }) {
  if (!has(P.MANAGE_QUERIES)) return null;
  const statusAction = queryStatusModalForAccess(row, has);
  const alreadySubmitted = Boolean(row.submittedToContractingAt);
  return (
    <>
      <button
        type="button"
        className="portal-small-btn"
        onClick={() =>
          openModal("query", {
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
          })
        }
      >
        Edit
      </button>
      <button
        type="button"
        className="portal-small-btn"
        onClick={() => openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })}
      >
        Reference Itinerary
      </button>
      {!alreadySubmitted && (
        <button
          type="button"
          className="portal-small-btn"
          onClick={() => submitToContracting({ queryId: row.id })}
        >
          Submit to Contracting
        </button>
      )}
      <button
        type="button"
        className="portal-small-btn"
        onClick={() => openModal(statusAction.modal, statusAction.initial)}
      >
        {statusAction.label}
      </button>
      <DeleteButton
        label={row.queryCode}
        onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })}
      />
    </>
  );
}

function QueriesView({
  rows,
  filtersActive = false,
  openModal,
  has,
  canAssign = false,
  deleteItem,
  removeQuery,
  submitToContracting,
  getQueryAttachmentUrl,
}) {
  return (
    <DataTable
      rows={rows}
      empty="No queries yet."
      filtersActive={filtersActive}
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
            <div>
              <span className="text-brand-muted">Destination</span>
              <div className="font-medium">{row.destination || "TBD"}</div>
            </div>
            <div>
              <span className="text-brand-muted">Pax</span>
              <div className="font-medium">{row.paxCount}</div>
            </div>
            <div>
              <span className="text-brand-muted">Budget</span>
              <div className="font-medium">{money(row.budgetAmount)}</div>
            </div>
            <div>
              <span className="text-brand-muted">Sales</span>
              <div className="font-medium">{row.salesOwnerName || "-"}</div>
            </div>
          </div>
          {has(P.MANAGE_QUERIES) && (
            <QueryRowActions
              primaryAction={
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() =>
                    openModal("query", {
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
                    })
                  }
                >
                  Edit
                </button>
              }
              overflowActions={[
                <button
                  key="ref"
                  type="button"
                  className="portal-small-btn w-full"
                  onClick={() =>
                    openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })
                  }
                >
                  Reference Itinerary
                </button>,
                !row.submittedToContractingAt ? (
                  <button
                    key="submit"
                    type="button"
                    className="portal-small-btn w-full"
                    onClick={() => submitToContracting({ queryId: row.id })}
                  >
                    Submit to Contracting
                  </button>
                ) : null,
                <button
                  key="update"
                  type="button"
                  className="portal-small-btn w-full"
                  onClick={() => {
                    const statusAction = queryStatusModalForAccess(row, has);
                    openModal(statusAction.modal, statusAction.initial);
                  }}
                >
                  {queryStatusModalForAccess(row, has).label}
                </button>,
                <DeleteButton
                  key="delete"
                  label={row.queryCode}
                  onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })}
                />,
              ]}
            />
          )}
          {!has(P.MANAGE_QUERIES) && canAssign && row.submittedToContractingAt && (
            <button
              type="button"
              className="portal-small-btn"
              onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
            >
              Assign teams
            </button>
          )}
        </div>
      )}
      columns={[
        ["Query ID", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        [
          "Created",
          (row) => <span className="text-xs text-brand-muted">{formatDate(row.createdAt)}</span>,
        ],
        [
          "Submitted",
          (row) => (
            <span className="text-xs text-brand-muted">
              {formatDate(row.submittedToContractingAt)}
            </span>
          ),
        ],
        [
          "Confirmed",
          (row) => <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>,
        ],
        ["Destination", (row) => row.destination || "TBD"],
        ["Pax", (row) => row.paxCount],
        ["Budget", (row) => money(row.budgetAmount)],
        [
          "Approx. Margin",
          (row) =>
            isQueryConfirmed(row)
              ? row.approxMargin != null
                ? money(row.approxMargin)
                : "-"
              : "-",
        ],
        [
          "Stage",
          (row) => <Badge label={row.leadStage || "Inquiry"} tone={statusTone(row.leadStage)} />,
        ],
        ["Type", (row) => <Badge label={row.queryType} tone="blue" />],
        [
          "Files",
          (row) => (
            <QueryAttachmentSummary
              attachments={row.attachments || []}
              canManage={has(P.MANAGE_QUERIES)}
              onManage={() =>
                openModal("queryAttachments", { queryId: row.id, queryCode: row.queryCode })
              }
              getQueryAttachmentUrl={getQueryAttachmentUrl}
            />
          ),
        ],
        ["Sales", (row) => row.salesOwnerName || "-"],
        ["Notes", (row) => notesPreview(row.notes)],
        ["Source", (row) => row.source || "-"],
        [
          "Action",
          (row) => (
            <motion.div className="hidden flex-wrap gap-2 md:flex">
              {has(P.MANAGE_QUERIES) && (
                <QueryManageActions
                  row={row}
                  openModal={openModal}
                  has={has}
                  deleteItem={deleteItem}
                  removeQuery={removeQuery}
                  submitToContracting={submitToContracting}
                />
              )}
              {!has(P.MANAGE_QUERIES) && canAssign && row.submittedToContractingAt && (
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
                >
                  Assign teams
                </button>
              )}
            </motion.div>
          ),
        ],
      ]}
    />
  );
}

function ContractingView({
  rows,
  proposals,
  filtersActive = false,
  team,
  openModal,
  has,
  canAssign,
  deleteItem,
  removeQuery,
}) {
  const proposalsByQueryId = (() => {
    const map = new Map();
    for (const proposal of proposals) {
      const queryIds = proposalLinkedQueryIds(proposal);
      if (queryIds.length === 0) continue;
      for (const queryId of queryIds) {
        const existing = map.get(queryId);
        if (
          !existing ||
          new Date(proposal.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
        ) {
          map.set(queryId, proposal);
        }
      }
    }
    return map;
  })();

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
        filtersActive={filtersActive}
        columns={[
          [
            "Received",
            (row) => (
              <span className="text-xs text-brand-muted">
                {formatDate(row.submittedToContractingAt || row.createdAt)}
              </span>
            ),
          ],
          ["Query", (row) => row.queryCode],
          ["Client", (row) => strong(row.clientName)],
          [
            "Confirmed",
            (row) => (
              <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>
            ),
          ],
          ["Sales SPOC", (row) => row.salesOwnerName || "-"],
          ["Contracting SPOC", (row) => row.contractingOwnerName || "Unassigned"],
          ["Notes", (row) => notesPreview(row.notes)],
          [
            "Status",
            (row) => (
              <Badge label={row.contractingStatus} tone={statusTone(row.contractingStatus)} />
            ),
          ],
          [
            "Proposal Cost",
            (row) => {
              const proposal = proposalsByQueryId.get(row.id);
              if (!proposal) return "-";
              return (
                <button
                  type="button"
                  className="font-semibold text-citius-blue underline-offset-2 hover:underline"
                  onClick={() =>
                    openModal("proposal", {
                      entityId: proposal.id,
                      queryId: proposal.queryId || "",
                      queryIds: proposalLinkedQueryIds(proposal),
                      clientName: proposal.clientName,
                      landCostPerPax: String(proposal.landCostPerPax ?? ""),
                      airfarePerPax: String(proposal.airfarePerPax ?? ""),
                      visaCostPerPax: String(proposal.visaCostPerPax ?? ""),
                      sellingPrice: String(proposal.sellingPrice ?? ""),
                      paxCount: String(
                        proposalPrimaryQuery(proposal)?.paxCount ?? row.paxCount ?? 1,
                      ),
                      taxRate: proposal.taxRate != null ? String(proposal.taxRate) : "",
                      itinerarySummary: proposal.itinerarySummary || "",
                    })
                  }
                >
                  {money(proposal.costPrice)}/pax ({proposal.proposalCode})
                </button>
              );
            },
          ],
          [
            "Approx. Margin",
            (row) =>
              isQueryConfirmed(row)
                ? row.approxMargin != null
                  ? money(row.approxMargin)
                  : "-"
                : "-",
          ],
          [
            "Action",
            (row) => (
              <div className="flex gap-2">
                {canAssign && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
                  >
                    Assign
                  </button>
                )}
                {has(P.MANAGE_CONTRACTING) && (
                  <>
                    <button
                      type="button"
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("queryStatus", {
                          queryId: row.id,
                          salesStatus: row.salesStatus,
                          leadStage: row.leadStage || "Inquiry",
                          contractingStatus: row.contractingStatus,
                          budgetAmount: String(row.budgetAmount || ""),
                          contractingLandCost: String(row.contractingLandCost ?? ""),
                          contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
                          contractingVisaCost: String(row.contractingVisaCost ?? ""),
                          approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
                        })
                      }
                    >
                      Status
                    </button>
                    <DeleteButton
                      label={row.queryCode}
                      onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })}
                    />
                  </>
                )}
              </div>
            ),
          ],
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
              mode === value
                ? "bg-citius-blue text-white"
                : "text-brand-muted hover:text-citius-blue"
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
              <span className="grid size-7 place-items-center rounded-full bg-citius-orange text-xs font-bold text-white">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-brand-border bg-brand-light p-3"
                >
                  <div className="text-sm font-semibold text-brand-dark">{item.clientName}</div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {item.queryCode} - {item.destination || "TBD"} - {item.paxCount} pax
                  </div>
                  <div className="mt-1 text-xs text-brand-muted">
                    {item.salesOwnerName || "Unassigned"}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ProposalsView({
  rows,
  markProposalSent,
  openModal,
  has,
  deleteItem,
  removeProposal,
  getProposalAttachmentUrl,
  getFinalizedPdfUrl,
}) {
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
            <div>
              <span className="text-brand-muted">Queries</span>
              <div className="font-medium">{proposalLinkedQueryLabel(row)}</div>
            </div>
            <div>
              <span className="text-brand-muted">CP/Pax</span>
              <div className="font-medium">{money(row.costPrice)}</div>
            </div>
          </div>
        </div>
      )}
      columns={[
        ["Proposal", (row) => row.proposalCode],
        ["Client", (row) => strong(row.clientName)],
        [
          "Created",
          (row) => <span className="text-xs text-brand-muted">{formatDate(row.createdAt)}</span>,
        ],
        [
          "Sent",
          (row) => <span className="text-xs text-brand-muted">{formatDate(row.sentAt)}</span>,
        ],
        ["Linked Queries", (row) => proposalLinkedQueryLabel(row)],
        ["Land/Pax", (row) => money(row.landCostPerPax)],
        ["Airfare/Pax", (row) => money(row.airfarePerPax)],
        ["Visa/Pax", (row) => money(row.visaCostPerPax)],
        ["CP/Pax", (row) => money(row.costPrice)],
        ["Tax", (row) => (row.taxRate != null ? `${row.taxRate}%` : "-")],
        ["Selling", (row) => money(row.sellingPrice)],
        [
          "Finalized PDF",
          (row) => (
            <FinalizedProposalPdfSummary
              finalizedPdf={row.finalizedPdf}
              canSend={canSend}
              onManage={() =>
                openModal("proposalFinalizedPdf", {
                  proposalId: row.id,
                  queryCode: row.proposalCode,
                })
              }
              onDownload={() => openFinalizedProposalPdf(row.id, getFinalizedPdfUrl)}
            />
          ),
        ],
        ...(canManage
          ? [
              [
                "Working Files",
                (row) => (
                  <QueryAttachmentSummary
                    attachments={row.attachments || []}
                    canManage={canManage}
                    onManage={() =>
                      openModal("proposalAttachments", {
                        proposalId: row.id,
                        queryCode: row.proposalCode,
                      })
                    }
                    getQueryAttachmentUrl={getProposalAttachmentUrl}
                    attachmentKind="proposal"
                  />
                ),
              ],
            ]
          : []),
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        [
          "Action",
          (row) =>
            (canSend || canManage) && (
              <div className="flex flex-wrap gap-2">
                {canSend && row.status !== "Sent" && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() => markProposalSent({ proposalId: row.id })}
                  >
                    <Send size={13} /> Mark Sent
                  </button>
                )}
                {canManage && (
                  <EditButton
                    onClick={() =>
                      openModal("proposal", {
                        entityId: row.id,
                        queryId: row.queryId || "",
                        queryIds: proposalLinkedQueryIds(row),
                        clientName: row.clientName,
                        landCostPerPax: String(row.landCostPerPax ?? ""),
                        airfarePerPax: String(row.airfarePerPax ?? ""),
                        visaCostPerPax: String(row.visaCostPerPax ?? ""),
                        sellingPrice: String(row.sellingPrice ?? ""),
                        paxCount: String(proposalPrimaryQuery(row)?.paxCount ?? 1),
                        taxRate: row.taxRate != null ? String(row.taxRate) : "",
                        itinerarySummary: row.itinerarySummary || "",
                      })
                    }
                  />
                )}
                {canManage && (
                  <DeleteButton
                    label={row.proposalCode}
                    onClick={() =>
                      deleteItem(row.proposalCode, removeProposal, { proposalId: row.id })
                    }
                  />
                )}
              </div>
            ),
        ],
      ]}
    />
  );
}

function AccountsJobCardView({ rows, jobCards, openModal }) {
  const confirmed = rows.filter(
    (row) => row.salesStatus === "Order Confirmed" || row.contractingStatus === "Order Confirmed",
  );
  const jobByQuery = jobCards.reduce((map, job) => {
    if (job.queryId) map.set(job.queryId, job);
    return map;
  }, new Map());
  return (
    <div className="space-y-5">
      <Panel title="Payment terms reference">
        <DataTable
          compact
          rows={[
            {
              id: "mice",
              type: "MICE / MICE Bidding",
              advance: "70-90%",
              balance: "10-30%",
              notify: "Sales, Contracting, Operations, Finance",
            },
            {
              id: "cement",
              type: "Cement",
              advance: "70-90%",
              balance: "10-30%",
              notify: "Sales, Contracting, Operations, Finance",
            },
            {
              id: "cement-bid",
              type: "Cement Bidding",
              advance: "70-100%",
              balance: "0-30%",
              notify: "Sales, Contracting, Operations, Finance",
            },
            {
              id: "fit",
              type: "FIT / Family Group",
              advance: "90-100%",
              balance: "0-10%",
              notify: "Sales, Contracting, Operations, Finance",
            },
            {
              id: "b2b",
              type: "B2B",
              advance: "80-100%",
              balance: "0-20%",
              notify: "Sales, Contracting, Finance",
            },
            {
              id: "spiritual",
              type: "Spiritual",
              advance: "Per plan",
              balance: "-",
              notify: "Sales, Operations, Finance",
            },
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
          [
            "Confirmed",
            (row) => (
              <span className="text-xs text-brand-muted">{formatDate(row.confirmedAt)}</span>
            ),
          ],
          ["Destination", (row) => row.destination || "TBD"],
          ["Pax", (row) => row.paxCount],
          ["Payment Terms", (row) => paymentTermLabel(row.queryType)],
          [
            "Job Card",
            (row) => {
              const linkedJob = jobByQuery.get(row.id);
              return linkedJob ? (
                <div>
                  <Badge label={linkedJob.jobCode} tone="green" />
                  <div className="mt-1 text-xs text-brand-muted">
                    Opened {formatDate(linkedJob.createdAt)}
                  </div>
                </div>
              ) : (
                <Badge label="Not opened" tone="orange" />
              );
            },
          ],
          [
            "Action",
            (row) => {
              const linkedJob = jobByQuery.get(row.id);
              if (linkedJob) {
                return (
                  <span className="text-xs font-semibold text-brand-muted">
                    Linked to {linkedJob.jobCode}
                  </span>
                );
              }
              return (
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() =>
                    openModal("jobCard", {
                      queryId: row.id,
                      clientName: row.clientName,
                      destination: row.destination,
                      confirmedPax: String(row.paxCount),
                      travelStartDate: row.travelStartDate,
                      travelEndDate: row.travelEndDate,
                    })
                  }
                >
                  Open JC
                </button>
              );
            },
          ],
        ]}
      />
    </div>
  );
}

function JobCardsView({
  rows,
  updateJobStatus,
  openModal,
  has,
  access,
  deleteItem,
  removeJobCard,
  filtersActive = false,
}) {
  const showAssignContracting = canAssignContracting(access) || canAssignOperations(access);
  const showAssignOps = canAssignOperations(access);
  const showAssignTicketing = canAssignTicketing(access);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.length === 0 ? (
        <EmptyState
          label={filterEmptyMessage({
            filtersActive,
            defaultMessage: "No Job Cards yet.",
          })}
        />
      ) : (
        rows.map((job, index) => (
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
                <div className="text-xs text-brand-muted">
                  {job.jobCode} - {job.destination || "Destination pending"}
                </div>
                <div className="mt-1 text-xs text-brand-muted">
                  Opened {formatDate(job.createdAt)}
                </div>
              </div>
              <Badge label={job.status} tone={statusTone(job.status)} />
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex justify-between">
                <span>Confirmed pax</span>
                <strong>{job.confirmedPax}</strong>
              </div>
              <div className="flex justify-between">
                <span>Rooms</span>
                <strong>{job.roomCount || "-"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Query</span>
                <strong>{job.queryId ? "Linked" : "-"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Proposal</span>
                <strong>{job.proposalId ? "Linked" : "-"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Contracting SPOC</span>
                <strong>{job.contractingOwnerName || "Unassigned"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ops Owner</span>
                <strong>{job.operationsOwnerName || "Unassigned"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ticketing Owner</span>
                <strong>{job.ticketingOwnerName || "Unassigned"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tour Manager</span>
                <strong>{job.tourManagerName || "Unassigned"}</strong>
              </div>
              <div className="text-xs text-brand-muted">
                {job.paymentTerms?.label || "Payment terms pending"}
              </div>
              <div className="flex flex-wrap gap-2">
                {showAssignContracting && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() => openModal("assignContractingOwner", { jobCardId: job.id })}
                  >
                    Assign Contracting
                  </button>
                )}
                {showAssignOps && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() => openModal("assignOperationsOwner", { jobCardId: job.id })}
                  >
                    Assign Ops
                  </button>
                )}
                {showAssignTicketing && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() => openModal("assignTicketingOwner", { jobCardId: job.id })}
                  >
                    Assign Ticketing
                  </button>
                )}
                {has(P.MANAGE_JOB_CARDS) && (
                  <>
                    <EditButton
                      onClick={() =>
                        openModal("jobCard", {
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
                        })
                      }
                    />
                    <button
                      type="button"
                      className="portal-small-btn"
                      onClick={() =>
                        updateJobStatus({
                          jobCardId: job.id,
                          status: job.status === "Open" ? "In Operations" : "Ready for Departure",
                        })
                      }
                    >
                      <RefreshCw size={13} /> Advance Status
                    </button>
                    <DeleteButton
                      label={job.jobCode}
                      onClick={() =>
                        deleteItem(
                          job.jobCode,
                          removeJobCard,
                          { jobCardId: job.id },
                          {
                            confirmMessage: `Delete ${job.jobCode}? This will also delete linked travellers, passport records, visa records, flight groups and segments, PNRs, tickets, seats, hotels, rooming entries, tour manager assignments, vendors, itineraries, event flows, checklist tasks, invoices, additional services, expenses, proof attachments, approvals, and notifications. This cannot be undone.`,
                          },
                        )
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

function TravellersView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
  filtersActive = false,
}) {
  const canManage = has(P.MANAGE_TRAVELLERS);
  return (
    <SelectableDataTable
      rows={rows}
      empty="No travellers yet."
      filtersActive={filtersActive}
      rowLabel={(row) => row.fullName}
      selectable={canManage}
      entityLabel="traveller"
      mobileCardRender={(row) => {
        const expiry = getPassportExpiryInfo({
          expiryDate: row.passportExpiryDate,
          travelDate: row.travelStartDate || row.travelDate,
        });
        return (
          <div className="space-y-1">
            <div className="font-semibold text-brand-dark">{row.fullName}</div>
            <div className="text-xs text-brand-muted">
              {row.jobCode} · {row.travelHub || "No hub"}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge label={row.visaStatus} tone={statusTone(row.visaStatus)} />
              <Badge label={formatPassportExpiryLabel(expiry)} tone={passportExpiryTone(expiry)} />
            </div>
          </div>
        );
      }}
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
                travellerIds: ids,
              }))
          : undefined
      }
      columns={[
        ["Name", (row) => strong(row.fullName)],
        ["Job", (row) => row.jobCode],
        ["Hub", (row) => row.travelHub || "-"],
        ["Room", (row) => <Badge label={row.roomType} tone="blue" />],
        ["Food", (row) => <Badge label={row.foodPreference} tone="green" />],
        ["Passport", (row) => row.passportStatus || "Pending"],
        [
          "Passport expiry",
          (row) => {
            const info = getPassportExpiryInfo({
              expiryDate: row.passportExpiryDate,
              travelDate: row.travelStartDate || row.travelDate,
            });
            return (
              <Badge label={formatPassportExpiryLabel(info)} tone={passportExpiryTone(info)} />
            );
          },
        ],
        ["Ticket", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
        ["Visa", (row) => <Badge label={row.visaStatus} tone={statusTone(row.visaStatus)} />],
        ["TM Call", (row) => row.callingStatus],
        [
          "Action",
          (row) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <EditButton
                  onClick={() =>
                    openModal("traveller", {
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
                    })
                  }
                />
                <DeleteButton
                  label={row.fullName}
                  onClick={() => deleteItem(row.fullName, removeTraveller, { travellerId: row.id })}
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function VisaTrackingView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeVisa,
  removeManyVisas,
  filtersActive = false,
}) {
  const canManage = has(P.MANAGE_VISA);
  return (
    <SelectableDataTable
      rows={rows}
      empty="No visa records yet."
      filtersActive={filtersActive}
      rowLabel={(row) => row.travellerName}
      mobileCardRender={(row) => (
        <div className="space-y-1">
          <div className="font-semibold text-brand-dark">{row.travellerName}</div>
          <div className="text-xs text-brand-muted">
            {row.jobCode} · {row.travelHub || "No hub"}
          </div>
          <Badge label={row.status} tone={statusTone(row.status)} />
        </div>
      )}
      selectable={canManage}
      entityLabel="visa record"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "visa record", removeManyVisas, () => ({
                visaRecordIds: ids,
              }))
          : undefined
      }
      columns={[
        ["Traveller", (row) => strong(row.travellerName)],
        ["Job", (row) => row.jobCode],
        ["Hub", (row) => row.travelHub || "-"],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Appointment", (row) => formatDisplayDate(row.appointmentDate)],
        ["Notes", (row) => row.notes || "-"],
        [
          "Action",
          (row) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() =>
                    openModal("visa", {
                      entityId: row.id,
                      visaRecordId: row.id,
                      visaStatus: row.status,
                      appointmentDate: row.appointmentDate,
                      notes: row.notes,
                    })
                  }
                >
                  Edit
                </button>
                <DeleteButton
                  label={`${row.travellerName} visa`}
                  onClick={() =>
                    deleteItem(`${row.travellerName} visa`, removeVisa, { visaRecordId: row.id })
                  }
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function PassportUploadModal({
  uploadTraveller,
  passportForm,
  setPassportForm,
  uploadError,
  isUploading,
  onClose,
  onSubmit,
}) {
  if (!uploadTraveller) return null;

  return (
    <div
      className={`fixed inset-0 ${PORTAL_Z.nestedModal} grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm`}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-2xl border border-brand-border bg-white shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <h3 className="font-heading text-lg font-semibold text-citius-blue">
            Upload & Encrypt Passport: {uploadTraveller.fullName}
          </h3>
          <button
            type="button"
            onClick={onClose}
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
            <label
              htmlFor="passport-file-input"
              className="block text-xs font-medium text-brand-dark mb-1"
            >
              Passport Scan File (PDF, JPEG, PNG, WebP , max 15 MB) *
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
              <label
                htmlFor="passport-number"
                className="block text-xs font-medium text-brand-dark mb-1"
              >
                Passport Number
              </label>
              <input
                id="passport-number"
                type="text"
                value={passportForm.number}
                onChange={(e) => setPassportForm({ ...passportForm, number: e.target.value })}
                placeholder="e.g. Z1234567"
                className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="passport-expiry"
                className="block text-xs font-medium text-brand-dark mb-1"
              >
                Expiry Date
              </label>
              <PortalDateInput
                id="passport-expiry"
                value={passportForm.expiryDate}
                onChange={(iso) => setPassportForm({ ...passportForm, expiryDate: iso })}
                inputClassName="!h-9 !rounded-md !text-sm"
                className="w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="passport-nationality"
                className="block text-xs font-medium text-brand-dark mb-1"
              >
                Nationality
              </label>
              <input
                id="passport-nationality"
                type="text"
                value={passportForm.nationality}
                onChange={(e) => setPassportForm({ ...passportForm, nationality: e.target.value })}
                placeholder="e.g. Indian"
                className="w-full text-sm border border-brand-border rounded-md p-2 focus:ring-1 focus:ring-citius-blue focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="passport-dob"
                className="block text-xs font-medium text-brand-dark mb-1"
              >
                Date of Birth
              </label>
              <PortalDateInput
                id="passport-dob"
                value={passportForm.dateOfBirth}
                onChange={(iso) => setPassportForm({ ...passportForm, dateOfBirth: iso })}
                inputClassName="!h-9 !rounded-md !text-sm"
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-brand-border pt-4">
          <button
            type="button"
            onClick={onClose}
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
                <Loader2 className="size-4 animate-spin" />
                Encrypting & Saving…
              </>
            ) : (
              "Encrypt & Upload"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function PassportDocumentsView({
  travellers,
  has,
  generateUploadUrl,
  encryptAndStorePassport,
  getPassportDocument,
  removePassport,
  filtersActive = false,
}) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const [passportState, patchPassportState] = usePatchReducer({
    uploadTraveller: null,
    isUploading: false,
    uploadError: "",
    passportForm: {
      number: "",
      expiryDate: "",
      nationality: "",
      dateOfBirth: "",
    },
    viewingTravellerId: null,
  });
  const { uploadTraveller, isUploading, uploadError, passportForm, viewingTravellerId } =
    passportState;
  const setUploadTraveller = (value) => patchPassportState({ uploadTraveller: value });
  const setIsUploading = (value) => patchPassportState({ isUploading: value });
  const setUploadError = (value) => patchPassportState({ uploadError: value });
  const setPassportForm = (value) =>
    patchPassportState({
      passportForm: typeof value === "function" ? value(passportForm) : value,
    });
  const setViewingTravellerId = (value) => patchPassportState({ viewingTravellerId: value });

  const MAX_PASSPORT_FILE_BYTES = 15 * 1024 * 1024;

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
        setUploadError("Failed to upload file to storage server.");
        setIsUploading(false);
        return;
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
      toast.success("Passport scan uploaded and encrypted successfully.");
    } catch (err) {
      console.error(err);
      setUploadError(formatConvexError(err, "Failed to upload passport. Please try again."));
    }
    setIsUploading(false);
  };

  const handleView = async (travellerId) => {
    setViewingTravellerId(travellerId);
    try {
      void getPassportDocument;
      openPortalFile(`/api/portal/files/passport/${encodeURIComponent(travellerId)}`);
    } catch (err) {
      console.error(err);
      toast.error(err?.data || err?.message || "Unable to open passport scan.");
    }
    setViewingTravellerId(null);
  };

  const handleDeletePassport = async (travellerName, travellerId) => {
    const ok = await confirm({
      title: "Delete passport scan",
      message: `Delete passport scan for ${travellerName}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await runMutation({ showToast: toast, successMessage: "Passport scan deleted." }, () =>
        removePassport({ travellerId }),
      );
    } catch {
      // runMutation surfaces toast
    }
  };

  return (
    <div className="space-y-6">
      <DataTable
        rows={travellers}
        empty="No travellers on record."
        filtersActive={filtersActive}
        columns={[
          ["Traveller", (row) => strong(row.fullName)],
          ["Job Code", (row) => row.jobCode],
          ["Client", (row) => row.clientName],
          [
            "Passport Scan Status",
            (row) => (
              <Badge
                label={row.passportStatus || "Pending"}
                tone={row.passportStatus === "Received" ? "green" : "orange"}
              />
            ),
          ],
          [
            "Action",
            (row) => (
              <div className="flex flex-wrap gap-2">
                {row.hasPassportScan ? (
                  <>
                    <button
                      type="button"
                      className="portal-small-btn inline-flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
                      onClick={() => handleView(row.id)}
                      disabled={viewingTravellerId !== null}
                    >
                      {viewingTravellerId === row.id ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Decrypting…
                        </>
                      ) : (
                        "Decrypt & View"
                      )}
                    </button>
                    {has(P.MANAGE_VISA) && (
                      <button
                        type="button"
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
                      type="button"
                      className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
                      onClick={() => setUploadTraveller(row)}
                    >
                      {row.passportStatus === "Received" ? "Upload Scan" : "Upload Passport Scan"}
                    </button>
                  )
                )}
              </div>
            ),
          ],
        ]}
      />

      <PassportUploadModal
        uploadTraveller={uploadTraveller}
        passportForm={passportForm}
        setPassportForm={setPassportForm}
        uploadError={uploadError}
        isUploading={isUploading}
        onClose={() => setUploadTraveller(null)}
        onSubmit={handleUpload}
      />
    </div>
  );
}

function TicketDashboardView({
  summary,
  tickets,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTicket,
  removeManyTickets,
}) {
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
        <StatCard
          label="Issued Seats"
          value={`${summary.issuedSeats}/${summary.totalSeats}`}
          Icon={Users}
        />
      </div>
      <TicketsView
        rows={tickets.slice(0, 8)}
        openModal={openModal}
        has={has}
        deleteItem={deleteItem}
        deleteSelected={deleteSelected}
        removeTicket={removeTicket}
        removeManyTickets={removeManyTickets}
      />
    </div>
  );
}

function PnrView({
  rows,
  itinerary,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removePnr,
  removeManyPnrs,
}) {
  const canManage = has(P.MANAGE_TICKETING);
  return (
    <div className="space-y-5">
      <Panel title="Flight Itinerary">
        <FlightItineraryList rows={itinerary} />
      </Panel>
      <Panel title="PNR Records">
        <SelectableDataTable
          rows={rows}
          empty="No PNRs yet."
          selectable={canManage}
          entityLabel="PNR"
          onBulkDelete={
            canManage
              ? (ids) =>
                  deleteSelected(ids.length, "PNR", removeManyPnrs, () => ({
                    pnrIds: ids,
                  }))
              : undefined
          }
          columns={[
            [
              "PNR",
              (row) => (
                <span className="font-mono font-bold tracking-[0.14em] text-citius-blue">
                  {row.pnrCode}
                </span>
              ),
            ],
            ["Job", (row) => row.jobCode],
            ["Client", (row) => row.clientName],
            ["Airline", (row) => row.airline],
            ["Route", (row) => row.route],
            ["Fare", (row) => row.fareType || "-"],
            ["Seats", (row) => `${row.issuedSeats}/${row.totalSeats}`],
            [
              "Action",
              (row) =>
                canManage && (
                  <div className="flex flex-wrap gap-2">
                    <EditButton
                      onClick={() =>
                        openModal("pnr", {
                          entityId: row.id,
                          jobCardId: row.jobCardId,
                          pnrCode: row.pnrCode,
                          airline: row.airline,
                          route: row.route,
                          fareType: row.fareType,
                          totalSeats: String(row.totalSeats),
                        })
                      }
                    />
                    <DeleteButton
                      label={row.pnrCode}
                      onClick={() => deleteItem(row.pnrCode, removePnr, { pnrId: row.id })}
                    />
                  </div>
                ),
            ],
          ]}
        />
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
              <div className="text-xs text-brand-muted">
                {group.jobCode} - {group.clientName}
              </div>
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
                      <span className="ml-2 font-mono text-xs text-brand-muted">
                        {segment.flightNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {segment.departTime || "-"} {segment.origin}
                    </td>
                    <td className="px-4 py-2">
                      {segment.arriveTime || "-"} {segment.destination}
                    </td>
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

function TicketsView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTicket,
  removeManyTickets,
}) {
  const canManage = has(P.MANAGE_TICKETING);
  return (
    <SelectableDataTable
      rows={rows}
      empty="No tickets yet."
      selectable={canManage}
      entityLabel="ticket"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "ticket", removeManyTickets, () => ({
                ticketIds: ids,
              }))
          : undefined
      }
      columns={[
        ["Ticket", (row) => row.ticketNumber || "-"],
        ["Traveller", (row) => strong(row.travellerName || "Unassigned")],
        ["Job", (row) => row.jobCode],
        ["Type", (row) => row.ticketType || "-"],
        ["PNR", (row) => row.pnrCode || "-"],
        ["Class", (row) => row.cabinClass || "Economy"],
        ["Seat", (row) => row.seatNumber || row.seatPreference || "-"],
        ["Status", (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />],
        [
          "Action",
          (row) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <EditButton
                  onClick={() =>
                    openModal("ticket", {
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
                    })
                  }
                />
                <DeleteButton
                  label={row.ticketNumber || "ticket"}
                  onClick={() =>
                    deleteItem(row.ticketNumber || "ticket", removeTicket, { ticketId: row.id })
                  }
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function SeatView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeSeatAllocation,
  removeManySeatAllocations,
}) {
  const canManage = has(P.MANAGE_TICKETING);
  return (
    <SelectableDataTable
      rows={rows}
      empty="No stored seat allocations yet."
      selectable={canManage}
      entityLabel="seat"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "seat", removeManySeatAllocations, () => ({
                seatAllocationIds: ids,
              }))
          : undefined
      }
      columns={[
        ["Seat", (row) => <span className="font-mono font-bold">{row.seatNumber}</span>],
        ["Traveller", (row) => row.travellerName || "Unassigned"],
        ["Job", (row) => row.jobCode],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Notes", (row) => row.notes || "-"],
        [
          "Action",
          (row) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <EditButton
                  onClick={() =>
                    openModal("seat", {
                      entityId: row.id,
                      jobCardId: row.jobCardId,
                      travellerId: row.travellerId || "",
                      pnrId: row.pnrId || "",
                      seatNumber: row.seatNumber,
                      seatStatus: row.status,
                      notes: row.notes,
                    })
                  }
                />
                <DeleteButton
                  label={`seat ${row.seatNumber}`}
                  onClick={() =>
                    deleteItem(`seat ${row.seatNumber}`, removeSeatAllocation, {
                      seatAllocationId: row.id,
                    })
                  }
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function HotelsView({
  rows,
  filtersActive = false,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeHotel,
  removeManyHotels,
}) {
  const canManage = has(P.MANAGE_OPERATIONS);
  return (
    <SelectableDataTable
      rows={rows}
      empty="No hotel records yet. Add a hotel property or use Import Rooming for passenger assignments below."
      filtersActive={filtersActive}
      selectable={canManage}
      entityLabel="hotel"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "hotel", removeManyHotels, () => ({
                hotelIds: ids,
              }))
          : undefined
      }
      columns={[
        ["Hotel", (row) => strong(row.name)],
        ["Job", (row) => row.jobCode],
        ["Client", (row) => row.clientName],
        ["City", (row) => row.city || "-"],
        ["Check-in", (row) => formatDisplayDate(row.checkInDate)],
        ["Check-out", (row) => formatDisplayDate(row.checkOutDate)],
        ["Instructions", (row) => row.specialInstructions || "-"],
        [
          "Action",
          (row) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <EditButton
                  onClick={() =>
                    openModal("hotel", {
                      entityId: row.id,
                      jobCardId: row.jobCardId,
                      hotelName: row.name,
                      city: row.city,
                      checkInDate: row.checkInDate,
                      checkOutDate: row.checkOutDate,
                      notes: row.specialInstructions,
                    })
                  }
                />
                <DeleteButton
                  label={row.name}
                  onClick={() => deleteItem(row.name, removeHotel, { hotelId: row.id })}
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function RoomingListView({ rows, filtersActive = false }) {
  return (
    <DataTable
      rows={rows}
      empty="No rooming assignments yet. Import traveller master or rooming spreadsheet for this job card."
      filtersActive={filtersActive}
      columns={[
        ["Name", (row) => strong(row.fullName)],
        ["Job", (row) => row.jobCode],
        ["Hub", (row) => row.travelHub || "-"],
        ["Room Type", (row) => <Badge label={row.roomType || "-"} tone="blue" />],
        ["Hotel Allocation", (row) => row.hotelAllocation || "-"],
        ["Food", (row) => <Badge label={row.foodPreference} tone="green" />],
        ["Special Requests", (row) => row.specialRequests || "-"],
      ]}
    />
  );
}

function TourManagersView({
  rows,
  travellers,
  openModal,
  has,
  canAssign,
  deleteItem,
  deleteSelected,
  removeTourManager,
  removeManyTourManagers,
  updateCallingStatus,
}) {
  const toast = usePortalToast();
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Pax" value={travellers.length} Icon={Users} />
        <StatCard
          label="Onboarded"
          value={
            travellers.filter((row) => row.fullName && row.travelHub && row.foodPreference).length
          }
          Icon={CheckCircle2}
        />
        <StatCard
          label="Docs Pending"
          value={
            travellers.filter(
              (row) =>
                !["Approved", "Not Required"].includes(row.visaStatus) ||
                row.ticketStatus !== "Issued",
            ).length
          }
          Icon={ShieldCheck}
        />
      </div>
      <Panel title="Calling status board">
        <DataTable
          compact
          rows={travellers}
          empty="No travellers to call yet."
          columns={[
            ["Guest", (row) => strong(row.fullName)],
            ["Job", (row) => row.jobCode],
            ["Hub", (row) => row.travelHub || "-"],
            ["Type", (row) => row.guestType],
            [
              "Cancellation",
              (row) =>
                row.cancellation || row.lastMinuteDrop ? <Badge label="Flagged" tone="red" /> : "-",
            ],
            [
              "Calling",
              (row) => <Badge label={row.callingStatus} tone={statusTone(row.callingStatus)} />,
            ],
            [
              "Action",
              (row) =>
                has(P.MANAGE_TOUR_MANAGERS) && (
                  <div className="flex flex-wrap gap-2">
                    {CALLING_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className="portal-small-btn"
                        onClick={() =>
                          runMutation(
                            {
                              label: "Calling status",
                              showToast: toast,
                              successMessage: `Calling status set to ${status}`,
                            },
                            () =>
                              updateCallingStatus({ travellerId: row.id, callingStatus: status }),
                          ).catch(() => {})
                        }
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                ),
            ],
          ]}
        />
      </Panel>
      <SelectableDataTable
        rows={rows}
        empty="No Tour Managers yet."
        selectable={canAssign}
        entityLabel="tour manager"
        onBulkDelete={
          canAssign
            ? (ids) =>
                deleteSelected(ids.length, "tour manager", removeManyTourManagers, () => ({
                  tourManagerIds: ids,
                }))
            : undefined
        }
        columns={[
          ["Name", (row) => strong(row.name)],
          ["Current Tour", (row) => row.currentTour || "Available"],
          ["Job", (row) => row.jobCode || "-"],
          ["Calling", (row) => row.callingStatus],
          ["Available", (row) => formatDisplayDate(row.availabilityDate)],
          ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
          [
            "Action",
            (row) =>
              canAssign && (
                <div className="flex flex-wrap gap-2">
                  <EditButton
                    onClick={() =>
                      openModal("tourManager", {
                        entityId: row.id,
                        jobCardId: row.jobCardId || "",
                        tourManagerName: row.name,
                        staffEmail: row.email,
                        paidBy: row.phone,
                        travelStartDate: row.availabilityDate,
                        notes: row.notes,
                      })
                    }
                  />
                  <DeleteButton
                    label={row.name}
                    onClick={() =>
                      deleteItem(row.name, removeTourManager, { tourManagerId: row.id })
                    }
                  />
                </div>
              ),
          ],
        ]}
      />
    </div>
  );
}

function FinanceView({ rows, overview, openModal, has, deleteItem, removeInvoice }) {
  return (
    <div className="space-y-5">
      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Revenue"
              value={money(overview.summary.totalRevenue)}
              Icon={CircleDollarSign}
            />
            <StatCard
              label="Client Outstanding"
              value={money(overview.summary.clientOutstanding)}
              Icon={FileText}
            />
            <StatCard
              label="Approved Expenses"
              value={money(overview.summary.approvedExpenses)}
              Icon={ClipboardList}
            />
          </div>
          {overview.fundProjections && (
            <Panel title="Fund projections">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                <StatCard
                  label="Expected collections"
                  value={money(overview.fundProjections.expectedCollections)}
                  Icon={CircleDollarSign}
                />
                <StatCard
                  label="Advance pipeline"
                  value={money(overview.fundProjections.advancePipeline)}
                  Icon={ClipboardList}
                />
                <StatCard
                  label="Pending reimbursements"
                  value={money(overview.fundProjections.pendingReimbursements)}
                  Icon={RefreshCw}
                />
                <StatCard
                  label="Expense approvals due"
                  value={money(overview.fundProjections.pendingExpenseApprovals)}
                  Icon={CheckCircle2}
                />
              </motion.div>
            </Panel>
          )}
          <Panel title="Tour-wise P&L">
            <DataTable
              compact
              rows={overview.pnl}
              empty="No Job Cards available."
              columns={[
                ["JC", (row) => row.jobCode],
                ["Group", (row) => row.clientName],
                ["Revenue", (row) => money(row.revenue)],
                ["Expense", (row) => money(row.expense)],
                ["Profit", (row) => money(row.profit)],
                ["Margin", (row) => `${row.marginPercent}%`],
              ]}
            />
          </Panel>
          <Panel title="Outstanding payments">
            <DataTable
              compact
              rows={overview.outstanding}
              empty="No outstanding balances."
              columns={[
                ["Client", (row) => strong(row.clientName)],
                ["JC", (row) => row.jobCode],
                ["Due", (row) => money(row.dueAmount)],
                ["Due Date", (row) => formatDisplayDate(row.dueDate)],
                ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
              ]}
            />
          </Panel>
        </>
      )}
      <DataTable
        rows={rows}
        empty="No invoices yet."
        columns={[
          ["Invoice", (row) => strong(row.invoiceNumber)],
          ["Job", (row) => row.jobCode],
          ["Client", (row) => row.clientName],
          ["Expected", (row) => money(row.expectedAmount)],
          ["Received", (row) => money(row.receivedAmount)],
          ["Balance", (row) => money(row.balanceAmount)],
          ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
          [
            "Action",
            (row) =>
              has(P.MANAGE_FINANCE) && (
                <div className="flex flex-wrap gap-2">
                  <EditButton
                    onClick={() =>
                      openModal("invoice", {
                        entityId: row.id,
                        jobCardId: row.jobCardId,
                        invoiceNumber: row.invoiceNumber,
                        expectedAmount: String(row.expectedAmount),
                        receivedAmount: String(row.receivedAmount),
                        dueDate: row.dueDate,
                      })
                    }
                  />
                  <DeleteButton
                    label={row.invoiceNumber}
                    onClick={() =>
                      deleteItem(row.invoiceNumber, removeInvoice, { invoiceId: row.id })
                    }
                  />
                </div>
              ),
          ],
        ]}
      />
    </div>
  );
}

function ExpensesView({
  rows,
  filtersActive = false,
  openModal,
  has,
  deleteItem,
  removeExpense,
  submitExpenseForApproval,
  getExpenseAttachmentUrl,
  removeExpenseProof,
}) {
  const toast = usePortalToast();
  return (
    <DataTable
      rows={rows}
      empty="No expenses yet."
      filtersActive={filtersActive}
      columns={[
        ["Job", (row) => row.jobCode],
        ["Date", (row) => formatDisplayDate(row.expenseDate)],
        ["Category", (row) => strong(row.category)],
        ["Particulars", (row) => row.particulars || "-"],
        ["Currency", (row) => row.currency],
        ["Amount", (row) => money(row.amount)],
        [
          "Split",
          (row) =>
            `Card ${money(row.cardAmount)} / Cash ${money(row.cashAmount)} / E-Pay ${money(row.epayAmount)}`,
        ],
        ["Paid By", (row) => row.paidBy],
        [
          "Proof",
          (row) =>
            row.proofAttachment ? (
              <button
                type="button"
                className="portal-small-btn"
                onClick={() =>
                  openQueryAttachment(row.proofAttachment.id, getExpenseAttachmentUrl, "expense")
                }
              >
                {row.proofAttachment.fileName}
              </button>
            ) : (
              "-"
            ),
        ],
        [
          "Approval",
          (row) => <Badge label={row.approvalStatus} tone={statusTone(row.approvalStatus)} />,
        ],
        ["Reimbursement", (row) => row.reimbursementStatus],
        [
          "Action",
          (row) =>
            has(P.MANAGE_EXPENSES) && (
              <div className="flex flex-wrap gap-2">
                {row.approvalStatus !== "Approved" && (
                  <EditButton
                    onClick={() =>
                      openModal("expense", {
                        entityId: row.id,
                        expenseType: row.jobCardId ? "jobCard" : "office",
                        jobCardId: row.jobCardId || "",
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
                      })
                    }
                  />
                )}
                <button
                  type="button"
                  className="portal-small-btn"
                  onClick={() =>
                    runMutation(
                      {
                        label: "Expense approval",
                        showToast: toast,
                        successMessage: "Expense submitted for approval.",
                      },
                      () => submitExpenseForApproval({ expenseId: row.id }),
                    ).catch(() => {})
                  }
                >
                  Submit for approval
                </button>
                {row.proofAttachment && (
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() =>
                      runMutation(
                        {
                          label: "Expense proof",
                          showToast: toast,
                          successMessage: "Expense proof removed.",
                        },
                        () => removeExpenseProof({ attachmentId: row.proofAttachment.id }),
                      ).catch(() => {})
                    }
                  >
                    Remove expense proof
                  </button>
                )}
                <DeleteButton
                  label={`${row.category} expense`}
                  onClick={() =>
                    deleteItem(`${row.category} expense`, removeExpense, { expenseId: row.id })
                  }
                />
              </div>
            ),
        ],
      ]}
    />
  );
}

function ApprovalsView({ rows, has, openModal, decideApproval, deleteItem, removeApproval }) {
  const toast = usePortalToast();
  return (
    <DataTable
      rows={rows}
      empty="No approvals in the queue."
      columns={[
        ["Code", (row) => strong(row.requestCode)],
        ["Type", (row) => <Badge label={row.type} tone="blue" />],
        ["Requested By", (row) => row.requestedByName],
        ["Summary", (row) => row.summary],
        ["Amount", (row) => money(row.amount)],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        ["Note", (row) => row.decisionNote || "-"],
        [
          "Action",
          (row) =>
            has(P.APPROVE_EXPENSES) && (
              <div className="flex flex-wrap gap-2">
                {row.status === "Pending" && (
                  <>
                    <button
                      type="button"
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Approval",
                            showToast: toast,
                            successMessage: "Approval approved.",
                          },
                          () => decideApproval({ approvalId: row.id, status: "Approved" }),
                        ).catch(() => {})
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("approvalDecide", {
                          approvalId: row.id,
                          approvalStatus: "Needs Info",
                          decisionNote: "",
                        })
                      }
                    >
                      Request Details
                    </button>
                    <button
                      type="button"
                      className="portal-danger-btn"
                      onClick={() =>
                        openModal("approvalDecide", {
                          approvalId: row.id,
                          approvalStatus: "Rejected",
                          decisionNote: "",
                        })
                      }
                    >
                      Reject
                    </button>
                  </>
                )}
                {row.status !== "Pending" && (
                  <DeleteButton
                    label={row.requestCode}
                    onClick={() =>
                      deleteItem(row.requestCode, removeApproval, { approvalId: row.id })
                    }
                  />
                )}
              </div>
            ),
        ],
      ]}
    />
  );
}

function ReportsView({ report }) {
  if (!report) return <LoadingPanel />;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pipeline Budget"
          value={money(report.summary.totalPipelineBudget)}
          Icon={CircleDollarSign}
        />
        <StatCard
          label="Confirmed Revenue"
          value={money(report.summary.confirmedRevenue)}
          Icon={CheckCircle2}
        />
        <StatCard
          label="Confirmed / Lost"
          value={`${report.summary.confirmedQueries}/${report.summary.lostQueries}`}
          Icon={ClipboardList}
        />
      </div>
      <Panel title="Revenue by query type">
        <DataTable
          compact
          rows={report.revenueByType.map((row) => ({ ...row, id: row.queryType }))}
          empty="No query revenue yet."
          columns={[
            ["Type", (row) => strong(row.queryType)],
            ["Pipeline Budget", (row) => money(row.revenue)],
            ["Queries", (row) => row.count],
          ]}
        />
      </Panel>
      <Panel title="Location-wise headcount">
        <DataTable
          compact
          rows={report.locationHeadcount}
          empty="No staff locations yet."
          columns={[
            ["Location", (row) => strong(row.location)],
            ["Headcount", (row) => row.count],
          ]}
        />
      </Panel>
    </div>
  );
}

function TeamView({ rows }) {
  return (
    <DataTable
      rows={rows}
      empty="No active staff records."
      columns={[
        [
          "Name",
          (row) => (
            <span
              className={row.isCurrentUser ? "font-semibold text-citius-blue" : "font-semibold"}
            >
              {row.name}
            </span>
          ),
        ],
        ["Email", (row) => row.email],
        ["Mobile", (row) => row.mobile || "-"],
        ["Department", (row) => row.department || "-"],
        ["Function", (row) => row.function || "-"],
        ["Location", (row) => row.location || "-"],
        ["Access", (row) => row.roles.join(", ")],
      ]}
    />
  );
}

function ActivityView({
  activity,
  notifications,
  deleteItem,
  removeNotification,
  markNotificationRead,
}) {
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
        {notifications.length === 0 ? (
          <EmptyState label="No notifications yet." />
        ) : (
          <div className="space-y-3">
            {notifications.map((item) => {
              const isInteractive = Boolean(item.entityType && item.entityId);
              const itemClassName = `rounded-md border border-brand-border bg-brand-light p-3 ${
                isInteractive ? "cursor-pointer transition hover:bg-white" : ""
              }`;

              return (
                <div
                  key={item.id}
                  className={itemClassName}
                  {...(isInteractive
                    ? {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => handleNotificationClick(item),
                        onKeyDown: (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleNotificationClick(item);
                          }
                        },
                      }
                    : {})}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {item.title}: {item.body}
                      </div>
                      <div className="mt-1 text-xs text-brand-muted">
                        {item.readAt ? "Read" : "Unread"} - {formatDate(item.createdAt)}
                      </div>
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
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function leaveBalanceRowsForDisplay(leaveBalances) {
  if (!Array.isArray(leaveBalances)) {
    return null;
  }

  const rowsByType = new Map(leaveBalances.map((row) => [row.leaveType, row]));
  return LEAVE_TYPES.map((leaveType) => {
    const row = rowsByType.get(leaveType);
    if (row) {
      const availableDays = Number(row.availableDays || 0).toFixed(1);
      return {
        leaveType,
        value: availableDays,
        detail: `${row.fiscalYear || "Current year"} balance`,
      };
    }

    if (leaveType === "Leave Without Pay") {
      return {
        leaveType,
        value: "Unpaid",
        detail: "No balance limit",
      };
    }

    return {
      leaveType,
      value: "-",
      detail: "No balance row",
    };
  });
}

function LeaveView({
  rows,
  staff,
  access,
  leaveBalances,
  openModal,
  has,
  deleteItem,
  removeLeave,
  decideLeave,
}) {
  const today = new Date().toISOString().split("T")[0];
  const activeCount = rows.filter(
    (r) => r.startDate <= today && r.endDate >= today && r.status === "Approved",
  ).length;
  const pendingCount = rows.filter((r) => r.status === "Pending").length;
  const rejectedCount = rows.filter((r) => r.status === "Rejected").length;
  const upcomingCount = rows.filter((r) => r.status === "Approved" && r.startDate > today).length;
  const canManageLeave = has(P.MANAGE_LEAVE);
  const balanceRows = leaveBalanceRowsForDisplay(leaveBalances);
  const [decidingLeaveId, setDecidingLeaveId] = useState(null);

  const handleLeaveDecision = async (leaveId, status) => {
    if (decidingLeaveId) {
      return;
    }
    setDecidingLeaveId(leaveId);
    try {
      await decideLeave({ leaveId, status });
    } catch (err) {
      console.error(err);
    }
    setDecidingLeaveId(null);
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

      <Panel
        title="My leave balances"
        subtitle="Current fiscal-year availability before any pending request is approved."
      >
        {balanceRows === null ? (
          <div className="rounded-xl border border-brand-border bg-brand-light px-4 py-3 text-sm text-brand-muted">
            Loading leave balances...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balanceRows.map((row) => (
              <div
                key={row.leaveType}
                className="rounded-xl border border-brand-border bg-brand-light px-4 py-3"
              >
                <div className="text-xs font-medium text-brand-muted">{row.leaveType}</div>
                <div className="mt-1 text-xl font-semibold text-brand-dark">{row.value}</div>
                <div className="mt-1 text-xs text-brand-muted">{row.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="bg-brand-surface rounded-xl border border-brand-border overflow-hidden shadow-sm">
        <DataTable
          rows={rows}
          empty="No leave records yet."
          columns={[
            ["Employee Name", (row) => strong(row.staffName)],
            [
              "Department",
              (row) => (
                <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-brand-border text-brand-text">
                  {row.department}
                </span>
              ),
            ],
            ["Leave Type", (row) => <Badge label={row.leaveType || "Casual"} tone="blue" />],
            ["Start Date", (row) => formatDisplayDate(row.startDate)],
            ["End Date", (row) => formatDisplayDate(row.endDate)],
            ["Reason", (row) => row.reason || "-"],
            [
              "Head Review",
              (row) => (
                <Badge
                  label={row.headReviewStatus || row.status || "Pending"}
                  tone={statusTone(row.headReviewStatus || row.status)}
                />
              ),
            ],
            [
              "HR Review",
              (row) => (
                <Badge
                  label={row.hrReviewStatus || row.status || "Pending"}
                  tone={statusTone(row.hrReviewStatus || row.status)}
                />
              ),
            ],
            ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
            [
              "Action",
              (row) => (
                <div className="flex flex-wrap gap-2">
                  {row.canApproveHead && (
                    <button
                      type="button"
                      className="portal-small-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                    >
                      {decidingLeaveId === row.id
                        ? "Saving…"
                        : row.headReviewerRole === "HR"
                          ? "Approve"
                          : "Approve (Head)"}
                    </button>
                  )}
                  {row.canApproveHr && (
                    <button
                      type="button"
                      className="portal-small-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                    >
                      {decidingLeaveId === row.id ? "Saving…" : "Approve (HR)"}
                    </button>
                  )}
                  {row.canReject && (
                    <button
                      type="button"
                      className="portal-danger-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Rejected")}
                    >
                      Reject
                    </button>
                  )}
                  {(canManageLeave ||
                    (access?.staffId === row.staffId && row.status === "Pending")) && (
                    <button
                      type="button"
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("leave_create", {
                          entityId: row.id,
                          staffId: row.staffId,
                          leaveType: row.leaveType || "Casual",
                          startDate: row.startDate,
                          endDate: row.endDate,
                          reason: row.reason,
                          status: row.status,
                        })
                      }
                    >
                      Edit
                    </button>
                  )}
                  {canManageLeave && (
                    <DeleteButton
                      label={`leave for ${row.staffName}`}
                      onClick={() =>
                        deleteItem(`leave for ${row.staffName}`, removeLeave, { leaveId: row.id })
                      }
                    />
                  )}
                </div>
              ),
            ],
          ]}
        />
      </div>
    </div>
  );
}

function SettingsView({
  staff,
  dropdowns,
  search,
  openModal,
  deleteItem,
  removeStaff,
  startStaffOnboarding,
}) {
  const toast = usePortalToast();
  const [onboardingSending, setOnboardingSending] = useState({});

  const searchTerm = search.trim();
  const visibleDropdowns = filterDropdowns(dropdowns, search);

  const handleSendOnboarding = async (row) => {
    setOnboardingSending((prev) => ({ ...prev, [row.id]: true }));
    try {
      const result = await startStaffOnboarding({ staffId: row.id });
      toast.success(result?.message || `Onboarding email sent to ${row.email}.`);
    } catch (err) {
      console.error(err);
      toast.error(err?.data || err?.message || "Failed to send onboarding email.");
    }
    setOnboardingSending((prev) => ({ ...prev, [row.id]: false }));
  };

  return (
    <div className="space-y-5">
      <Panel title="Staff allowlist">
        <DataTable
          rows={staff}
          empty={searchTerm ? "No staff match your search." : "No staff records yet."}
          columns={[
            ["Name", (row) => strong(row.name)],
            ["Email", (row) => row.email],
            ["Leave Head Approver", (row) => row.leaveHeadApproverName || "Matrix default"],
            ["Department", (row) => row.department || "-"],
            ["Function", (row) => row.function || "-"],
            ["Location", (row) => row.location || "-"],
            ["Roles", (row) => row.roles.join(", ")],
            [
              "Onboarding",
              (row) => (
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
              ),
            ],
            [
              "Active",
              (row) => (
                <Badge
                  label={row.active ? "Active" : "Inactive"}
                  tone={row.active ? "green" : "red"}
                />
              ),
            ],
            [
              "Action",
              (row) => (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="portal-small-btn"
                    onClick={() =>
                      openModal("staff", {
                        staffId: row.id,
                        staffName: row.name,
                        staffEmail: row.email,
                        staffRoles: row.roles,
                        department: row.department,
                        staffFunction: row.function,
                        mobile: row.mobile,
                        location: row.location,
                        joiningDate: row.joiningDate || "",
                        employmentStatus: row.employmentStatus || "Confirmed",
                        confirmationDate: row.confirmationDate || "",
                        leavePolicyGroup: row.leavePolicyGroup || "",
                        leaveHeadApproverId: row.leaveHeadApproverId || "",
                        maternityEventsUsed: String(row.maternityEventsUsed ?? 0),
                        paternityEventsUsed: String(row.paternityEventsUsed ?? 0),
                        marriageLeaveUsed: Boolean(row.marriageLeaveUsed),
                        staffActive: row.active,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
                    onClick={() => handleSendOnboarding(row)}
                    disabled={onboardingSending[row.id]}
                  >
                    {onboardingSending[row.id] ? "Sending…" : onboardingActionLabel(row)}
                  </button>
                  <DeleteButton
                    label={row.email}
                    onClick={() => deleteItem(row.email, removeStaff, { staffId: row.id })}
                  />
                </div>
              ),
            ],
          ]}
          compact
        />
      </Panel>
      <Panel title="Workflow dropdowns">
        {searchTerm && Object.keys(visibleDropdowns).length === 0 ? (
          <EmptyState label="No workflow dropdown values match your search." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(visibleDropdowns).map(([category, values]) => (
              <div
                key={category}
                className="rounded-md border border-brand-border bg-brand-light p-4"
              >
                <div className="mb-2 text-sm font-semibold capitalize">{category}</div>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => (
                    <Badge key={value} label={value} tone="gray" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function RoomSummaryPanel({ summary, jobCode, title = "Passengers by room type" }) {
  const entries = Object.entries(summary || {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-brand-border bg-brand-light/60 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
        {title}
        {jobCode ? ` — ${jobCode}` : ""}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([roomType, count]) => (
          <Badge key={roomType} label={`${roomType}: ${count}`} tone="blue" />
        ))}
      </div>
    </div>
  );
}

function PassengerImportModal({
  open,
  close,
  jobCards,
  previewPassengerImport,
  commitPassengerImport,
  title = "Import Passengers",
  fileLabel = "Passenger spreadsheet",
  parseWorkbookFile = parsePassengerWorkbookFile,
  emptyLabel = "No confirmed passengers found.",
  successLabel = "Passenger import complete",
  uploadLabel = "Upload Passengers",
  importKind = "passenger",
}) {
  const toast = usePortalToast();
  const [importState, patchImportState, , dispatchImport] =
    usePatchReducer(PASSENGER_IMPORT_INITIAL);
  const {
    jobCardId,
    fileName,
    parsed,
    preview,
    isParsing,
    isPreviewing,
    isSaving,
    importProgress,
    error,
  } = importState;
  const patchImport = (patch) => patchImportState(patch);
  const setJobCardId = (value) => patchImport({ jobCardId: value });
  const setFileName = (value) => patchImport({ fileName: value });
  const setParsed = (value) => patchImport({ parsed: value });
  const setPreview = (value) => patchImport({ preview: value });
  const setIsParsing = (value) => patchImport({ isParsing: value });
  const setIsPreviewing = (value) => patchImport({ isPreviewing: value });
  const setIsSaving = (value) => patchImport({ isSaving: value });
  const setImportProgress = (value) => patchImport({ importProgress: value });
  const setError = (value) => patchImport({ error: value });

  const rows = parsed?.rows || [];
  const skipped = parsed?.skipped || [];
  const errors = parsed?.errors || [];
  const previewRows = preview?.rows || [];
  const previewById = new Map(previewRows.map((row) => [row.id, row]));
  const createCount = previewRows.filter((row) => row.action === "create").length;
  const updateCount = previewRows.filter((row) => row.action === "update").length;
  const selectedJob = (jobCards || []).find((job) => job.id === jobCardId);
  const showRoomSummary = importKind === "traveller" || importKind === "rooming";
  const parsedRoomSummary = showRoomSummary ? summarizeRoomTypes(rows) : {};
  const previewRoomSummary = showRoomSummary
    ? preview?.roomSummary || parsedRoomSummary
    : parsedRoomSummary;

  const reset = () => patchImportState(PASSENGER_IMPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

  useEffect(() => {
    let cancelled = false;
    async function runPreview() {
      const importRows = (parsed?.rows || []).map(toPassengerImportInput);
      if (!open || !jobCardId || importRows.length === 0) {
        dispatchImport({ type: "patch", patch: { preview: null } });
        return;
      }
      dispatchImport({ type: "patch", patch: { isPreviewing: true, error: "" } });
      try {
        const result = await previewPassengerImport({ jobCardId, rows: importRows });
        if (!cancelled) dispatchImport({ type: "patch", patch: { preview: result } });
      } catch (err) {
        if (!cancelled) {
          dispatchImport({
            type: "patch",
            patch: {
              preview: null,
              error: err?.data || err?.message || "Unable to preview passenger import.",
            },
          });
        }
      }
      if (!cancelled) dispatchImport({ type: "patch", patch: { isPreviewing: false } });
    }
    runPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, parsed, previewPassengerImport, dispatchImport]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed(null);
    setPreview(null);
    setError("");
    setIsParsing(true);
    try {
      setParsed(await parseWorkbookFile(file));
    } catch (err) {
      setError(err?.message || "Unable to read spreadsheet.");
    }
    setIsParsing(false);
    event.target.value = "";
  };

  const handleCommit = async () => {
    if (!jobCardId || rows.length === 0) return;
    setIsSaving(true);
    setError("");
    setImportProgress({ current: 0, total: 1 });
    try {
      setImportProgress({ current: 0, total: 1, label: "Uploading…" });
      const importRows = rows.map(toPassengerImportInput);
      const result = await commitPassengerImport({ jobCardId, rows: importRows });
      let message = `${successLabel}. Created ${result.created}, updated ${result.updated}, total processed ${result.total}.`;
      if (showRoomSummary && result.roomSummary) {
        const roomText = formatRoomSummaryText(result.roomSummary, selectedJob?.jobCode);
        if (roomText) message += ` Room summary: ${roomText}`;
      }
      toast.success(message);
      closeAndReset();
    } catch (err) {
      setError(err?.data || err?.message || "Import failed.");
    }
    setIsSaving(false);
    setImportProgress(null);
  };

  return (
    <ImportModalShell open={open} close={closeAndReset} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          value={jobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          onChange={setJobCardId}
          required
        />
        <ImportFileInput
          label={fileLabel}
          fileName={fileName}
          accept=".xlsx,.xls"
          onChange={handleFile}
        />
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {errors.length > 0 && <ImportIssueList title="Rows needing correction" rows={errors} />}
        {skipped.length > 0 && <ImportIssueList title="Skipped rows" rows={skipped.slice(0, 8)} />}
        {showRoomSummary && Object.keys(previewRoomSummary).length > 0 && (
          <RoomSummaryPanel summary={previewRoomSummary} jobCode={selectedJob?.jobCode} />
        )}
        {importProgress && (
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm text-brand-muted">
            {importProgress.label ||
              `Importing batch ${importProgress.current} of ${importProgress.total}…`}
          </div>
        )}
        {rows.length > 0 && (
          <DataTable
            compact
            rows={rows.slice(0, 50).map((row) => ({
              ...row,
              action: previewById.get(row.id)?.action || (isPreviewing ? "checking" : "upsert"),
            }))}
            empty={emptyLabel}
            columns={[
              [
                "Action",
                (row) => (
                  <Badge
                    label={row.action}
                    tone={
                      row.action === "update"
                        ? "blue"
                        : row.action === "create"
                          ? "green"
                          : "orange"
                    }
                  />
                ),
              ],
              ["Passenger", (row) => strong(row.fullName)],
              ["Hub", (row) => row.travelHub || "-"],
              ["Room", (row) => row.roomType || "-"],
              ["Visa", (row) => row.visaStatus || (row.visaRequired ? "Required" : "Not Required")],
              [
                "Passport",
                (row) =>
                  row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending",
              ],
              ["Source", (row) => `${row.sourceSheet} row ${row.sourceRowNumber}`],
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
          >
            Cancel
          </button>
          <button
            type="button"
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || rows.length === 0 || isPreviewing || isSaving}
            onClick={handleCommit}
          >
            {isSaving ? importProgress?.label || "Uploading…" : uploadLabel}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function FlightImportModal({ open, close, jobCards, itinerary, commitFlightImport }) {
  const toast = usePortalToast();
  const [flightState, patchFlightState] = usePatchReducer(FLIGHT_IMPORT_INITIAL);
  const { jobCardId, fileName, parsed, isParsing, isSaving, error } = flightState;
  const patchFlight = (patch) => patchFlightState(patch);
  const setJobCardId = (value) => patchFlight({ jobCardId: value });
  const setFileName = (value) => patchFlight({ fileName: value });
  const setParsed = (value) => patchFlight({ parsed: value });
  const setIsParsing = (value) => patchFlight({ isParsing: value });
  const setIsSaving = (value) => patchFlight({ isSaving: value });
  const setError = (value) => patchFlight({ error: value });

  const groups = parsed?.groups || [];
  const errors = parsed?.errors || [];
  const existingSegmentKeys = new Set(
    (itinerary || []).reduce((keys, group) => {
      if (jobCardId && group.jobCardId !== jobCardId) return keys;
      for (const segment of group.segments || []) {
        if (segment.importKey) keys.push(segment.importKey);
      }
      return keys;
    }, []),
  );
  const segmentCount = groups.reduce((sum, group) => sum + group.segments.length, 0);
  const updateCount = groups.reduce(
    (sum, group) =>
      sum + group.segments.filter((segment) => existingSegmentKeys.has(segment.importKey)).length,
    0,
  );

  const reset = () => patchFlightState(FLIGHT_IMPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

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
    }
    setIsParsing(false);
    event.target.value = "";
  };

  const handleCommit = async () => {
    if (!jobCardId || groups.length === 0) return;
    setIsSaving(true);
    setError("");
    try {
      const result = await commitFlightImport({ jobCardId, groups });
      toast.success(
        `Flight import complete. Created ${result.createdSegments}, updated ${result.updatedSegments} segments.`,
      );
      closeAndReset();
    } catch (err) {
      setError(err?.data || err?.message || "Flight import failed.");
    }
    setIsSaving(false);
  };

  return (
    <ImportModalShell open={open} close={closeAndReset} title="Import Flights">
      <div className="space-y-4">
        <Select
          label="Job Card"
          value={jobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          onChange={setJobCardId}
          required
        />
        <ImportFileInput
          label="Flight spreadsheet"
          fileName={fileName}
          accept=".xlsx,.xls"
          onChange={handleFile}
        />
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {errors.length > 0 && <ImportIssueList title="Rows needing correction" rows={errors} />}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group) => (
              <div key={group.id} className="rounded-lg border border-brand-border bg-white">
                <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
                  <div className="font-semibold text-citius-blue">{group.name}</div>
                  <div className="text-xs text-brand-muted">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <DataTable
                  compact
                  rows={group.segments.map((segment) => ({
                    ...segment,
                    action: existingSegmentKeys.has(segment.importKey) ? "update" : "create",
                  }))}
                  empty="No segments in this group."
                  columns={[
                    [
                      "Action",
                      (row) => (
                        <Badge
                          label={row.action}
                          tone={row.action === "update" ? "blue" : "green"}
                        />
                      ),
                    ],
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
          <button
            type="button"
            className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
          >
            Cancel
          </button>
          <button
            type="button"
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0 || isSaving}
            onClick={handleCommit}
          >
            {isSaving ? "Uploading…" : "Upload Flights"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function PassengerExportModal({
  open,
  close,
  jobCards,
  getPassengerExportRows,
  title = "Export Passengers",
  subtitle = "Select a job card to download a passenger spreadsheet compatible with the import template.",
  buildWorkbook = buildPassengerWorkbook,
  filenameSuffix = "passengers",
  sheetName,
  exportKind = "passenger",
}) {
  const [exportState, patchExportState, , dispatchExport] =
    usePatchReducer(PASSENGER_EXPORT_INITIAL);
  const { jobCardId, exportData, isLoading, isExporting, error } = exportState;
  const patchExport = (patch) => patchExportState(patch);
  const setJobCardId = (value) => patchExport({ jobCardId: value });
  const setExportData = (value) => patchExport({ exportData: value });
  const setIsLoading = (value) => patchExport({ isLoading: value });
  const setIsExporting = (value) => patchExport({ isExporting: value });
  const setError = (value) => patchExport({ error: value });

  const reset = () => patchExportState(PASSENGER_EXPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

  useEffect(() => {
    let cancelled = false;
    async function loadExportPreview() {
      if (!open || !jobCardId) {
        dispatchExport({ type: "patch", patch: { exportData: null } });
        return;
      }
      dispatchExport({ type: "patch", patch: { isLoading: true, error: "" } });
      try {
        const result = await getPassengerExportRows({ jobCardId, exportKind });
        if (!cancelled) dispatchExport({ type: "patch", patch: { exportData: result } });
      } catch (err) {
        if (!cancelled) {
          dispatchExport({
            type: "patch",
            patch: {
              exportData: null,
              error: err?.data || err?.message || "Unable to load passengers for export.",
            },
          });
        }
      }
      if (!cancelled) dispatchExport({ type: "patch", patch: { isLoading: false } });
    }
    loadExportPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, exportKind, getPassengerExportRows, dispatchExport]);

  const handleExport = async () => {
    if (!exportData?.rows?.length) return;
    setIsExporting(true);
    setError("");
    try {
      const workbook = buildWorkbook(exportData.rows, {
        sheetName: sheetName || exportData.jobCode,
      });
      downloadWorkbook(workbook, `${exportData.jobCode}-${filenameSuffix}.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(err?.message || "Passenger export failed.");
    }
    setIsExporting(false);
  };

  const rows = exportData?.rows || [];

  return (
    <ImportModalShell open={open} close={closeAndReset} title={title} subtitle={subtitle}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          value={jobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          onChange={setJobCardId}
          required
        />
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
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
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
              [
                "Passport",
                (row) =>
                  row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending",
              ],
            ]}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
          >
            Cancel
          </button>
          <button
            type="button"
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || isLoading || rows.length === 0 || isExporting}
            onClick={handleExport}
          >
            {isExporting ? "Exporting…" : "Download Spreadsheet"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function FlightExportModal({ open, close, jobCards, itinerary }) {
  const [jobCardId, setJobCardId] = useState("");
  const [error, setError] = useState("");

  const selectedJob = jobCards.find((job) => job.id === jobCardId) || null;
  const groups = (itinerary || []).filter((group) => group.jobCardId === jobCardId);
  const segmentCount = groups.reduce((sum, group) => sum + (group.segments?.length || 0), 0);

  const reset = () => {
    setJobCardId("");
    setError("");
  };

  const closeAndReset = () => {
    reset();
    close();
  };

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
        <Select
          label="Job Card"
          value={jobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          onChange={setJobCardId}
          required
        />
        <ImportSummary
          isBusy={false}
          totals={[
            ["Groups", jobCardId ? groups.length : "-"],
            ["Segments", jobCardId ? segmentCount : "-"],
            ["Job", selectedJob?.jobCode || "-"],
            ["Client", selectedJob?.clientName || "-"],
            [
              "Sheets",
              jobCardId
                ? new Set(groups.map((group) => group.sourceSheet || selectedJob.jobCode)).size
                : "-",
            ],
          ]}
        />
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
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
                  <div className="text-xs text-brand-muted">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
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
          <button
            type="button"
            className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
          >
            Cancel
          </button>
          <button
            type="button"
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0}
            onClick={handleExport}
          >
            Download Spreadsheet
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}

function ImportModalShell({
  open,
  close,
  title,
  subtitle = "Upload a spreadsheet, review the parsed rows, then commit the import.",
  children,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${PORTAL_Z.importModal} flex items-center justify-center bg-citius-blue/35 p-4 backdrop-blur-sm`}
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
              <button
                type="button"
                className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
                onClick={close}
              >
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
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="mt-2 block w-full text-sm text-brand-dark file:mr-3 file:rounded-md file:border-0 file:bg-citius-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      {fileName && <span className="mt-2 block text-xs text-brand-muted">{fileName}</span>}
    </label>
  );
}

function ImportSummary({ isBusy, totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {totals.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-brand-border bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-citius-blue">
            {isBusy && value === "-" ? "…" : value}
          </div>
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
          <div key={row.id}>
            {row.sourceSheet} row {row.sourceRowNumber}: {row.message || row.reason}
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({
  rows,
  columns,
  empty,
  compact = false,
  mobileCardRender,
  filtersActive = false,
}) {
  if (!rows) return <LoadingPanel />;
  const emptyLabel = filterEmptyMessage({ filtersActive, defaultMessage: empty });
  if (rows.length === 0) return <EmptyState label={emptyLabel} />;
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
                <th
                  key={label}
                  className="border-b border-brand-border px-4 py-3 text-left text-xs font-semibold text-citius-blue/80"
                >
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
                  <td
                    key={label}
                    className={`border-b border-brand-border px-4 ${compact ? "py-2" : "py-3"} text-sm text-brand-dark last:border-b-0`}
                  >
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
    <button
      type="button"
      className="portal-danger-btn"
      onClick={onClick}
      aria-label={`Delete ${label}`}
    >
      <Trash2 size={13} />
      Delete
    </button>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border border-brand-border bg-white p-5 shadow-sm md:p-6 ${className}`}
    >
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-citius-blue md:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-brand-muted">{subtitle}</p> : null}
      </div>
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
  const tone = type.includes("Cement")
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
      <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {type}
      </div>
      <div className={`mt-2 font-heading text-2xl font-semibold tabular-nums ${valueTone}`}>
        {count}
      </div>
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
      className={`group w-48 overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-lg ${
        featured
          ? "sm:col-span-2 bg-linear-to-br from-citius-blue to-citius-blue/90 text-white"
          : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold ${featured ? "text-white/80" : "text-brand-muted"}`}>
          {label}
        </div>
        <div className={`rounded-full p-2 ${featured ? "bg-white/15" : "bg-citius-orange/10"}`}>
          <Icon size={18} className={featured ? "text-citius-orange" : "text-citius-orange"} />
        </div>
      </div>
      <div
        className={`mt-3 font-heading text-3xl font-semibold tabular-nums ${featured ? "text-white" : "text-citius-blue"}`}
      >
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
          <div className="mt-1 text-xs text-brand-muted">
            {row.actorName} - {formatDate(row.createdAt)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", required = false, placeholder, ...rest }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
        {...rest}
      />
    </label>
  );
}

function Select({ label, value, options, onChange, required = false }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
      >
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MultiSelect({ label, value, options, onChange }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block text-xs font-semibold text-brand-muted">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) next.add(option.value);
                else next.delete(option.value);
                onChange(Array.from(next));
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Textarea({ label, value, onChange, maxWords }) {
  const wordCount = countWords(value);
  const updateTextareaValue = (event) => {
    let next = event.target.value;
    if (maxWords) {
      next = truncateToMaxWords(next, maxWords);
    }
    onChange(next);
  };

  return (
    <label className="block md:col-span-2">
      <span className="mb-1 block text-xs font-semibold text-brand-muted">{label}</span>
      <textarea
        value={value}
        onChange={updateTextareaValue}
        rows={4}
        className="w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
      />
      {maxWords ? (
        <span
          className={`mt-1 block text-xs ${wordCount >= maxWords ? "text-amber-700" : "text-brand-muted"}`}
        >
          {wordCount}/{maxWords} words
        </span>
      ) : null}
    </label>
  );
}

const BADGE_TONES = {
  blue: "bg-citius-blue/10 text-citius-blue",
  green: "bg-citius-green/15 text-emerald-700",
  amber: "bg-citius-orange/15 text-amber-700",
  red: "bg-red-50 text-red-700",
  purple: "bg-violet-50 text-violet-700",
  gray: "bg-brand-light text-brand-muted",
};

function Badge({ label, tone = "gray" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${BADGE_TONES[tone] || BADGE_TONES.gray}`}
    >
      {label}
    </span>
  );
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

function filterDropdowns(dropdowns, search) {
  const term = search.trim().toLowerCase();
  if (!term) return dropdowns;
  const filtered = {};
  for (const [category, values] of Object.entries(dropdowns)) {
    const categoryMatches = category.toLowerCase().includes(term);
    const matchedValues = values.filter((value) => value.toLowerCase().includes(term));
    if (categoryMatches || matchedValues.length > 0) {
      filtered[category] = categoryMatches ? values : matchedValues;
    }
  }
  return filtered;
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

const EMPTY_OVERFLOW_ACTIONS = [];

function getOverflowActionKey(action) {
  return action?.key || action?.props?.["aria-label"] || action?.props?.children || "action";
}

function QueryRowActions({ primaryAction, overflowActions = EMPTY_OVERFLOW_ACTIONS }) {
  const [open, setOpen] = useState(false);
  const closeAfterAction = (action) => {
    if (!isValidElement(action)) return action;
    return cloneElement(action, {
      key: getOverflowActionKey(action),
      onClick: (event) => {
        action.props.onClick?.(event);
        setOpen(false);
      },
    });
  };

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
                className={`fixed inset-0 ${PORTAL_Z.chrome} cursor-default bg-transparent`}
                aria-label="Close actions menu"
                onClick={() => setOpen(false)}
              />
              <div
                className={`absolute right-0 ${PORTAL_Z.dropdown} mt-2 min-w-[180px] rounded-xl border border-brand-border bg-white p-2 shadow-lg`}
              >
                <div role="menu" tabIndex={-1} className="flex flex-col gap-2">
                  {overflowActions.map(closeAfterAction)}
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
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
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
    Number(rowOrForm?.contractingLandCost || 0) +
    Number(rowOrForm?.contractingAirlinesCost || 0) +
    Number(rowOrForm?.contractingVisaCost || 0)
  );
}

function proposalCostPerPax(landCostPerPax, airfarePerPax, visaCostPerPax = 0) {
  return (
    Math.max(Number(landCostPerPax) || 0, 0) +
    Math.max(Number(airfarePerPax) || 0, 0) +
    Math.max(Number(visaCostPerPax) || 0, 0)
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
    <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/60 p-4">
      <div className="mb-3 font-heading text-sm font-semibold text-citius-blue">
        Contracting cost
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Land Cost (INR)"
          type="number"
          value={form.contractingLandCost}
          onChange={(v) => updateForm("contractingLandCost", v)}
        />
        <Input
          label="Airlines Cost (INR)"
          type="number"
          value={form.contractingAirlinesCost}
          onChange={(v) => updateForm("contractingAirlinesCost", v)}
        />
        <Input
          label="Visa Cost (INR)"
          type="number"
          value={form.contractingVisaCost}
          onChange={(v) => updateForm("contractingVisaCost", v)}
        />
        <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            Total cost
          </div>
          <div className="mt-1 font-semibold text-brand-dark">{money(totalCost)}</div>
        </div>
      </div>
    </div>
  );
}

const MAX_QUERY_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const QUERY_ATTACHMENT_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif";
const PASSPORT_MIME_TYPES_BY_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function inferPassportMimeType(file) {
  if (file.type?.trim()) {
    return file.type.trim().toLowerCase();
  }
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return PASSPORT_MIME_TYPES_BY_EXTENSION[extension] ?? "";
}

function onboardingActionLabel(row) {
  if (row.onboardingStatus === "ready") return "Send password reset";
  if (row.onboardingStatus === "pending") return "Resend verification";
  return "Send verification";
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
  const routeKind = kind === "proposal" ? "proposal" : kind === "expense" ? "expense" : "query";
  openPortalFile(`/api/portal/files/${routeKind}/${encodeURIComponent(attachmentId)}`);
}

async function openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl) {
  void getFinalizedPdfUrl;
  openPortalFile(`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`);
}

function FinalizedProposalPdfSummary({ finalizedPdf, canSend, onManage, onDownload }) {
  const toast = usePortalToast();
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
        onClick={() =>
          onDownload().catch((err) => {
            toast.error(err?.data || err?.message || "Unable to open file.");
          })
        }
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
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
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
        setUploadError(`Failed to upload ${file.name}.`);
        setIsUploading(false);
        return;
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
    }
    setIsUploading(false);
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "Remove finalized PDF",
      message: "Remove the finalized proposal PDF?",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeFinalizedPdf({ proposalId });
      toast.success("Finalized PDF removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      <p className="text-sm text-brand-muted">
        Upload the client-ready proposal PDF here. Sales can download it and send it to the client,
        then mark the proposal as sent.
      </p>
      {canSend && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            htmlFor="finalized-proposal-pdf-upload"
            className="mb-2 block text-sm font-medium text-brand-text"
          >
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
              <div className="text-xs text-brand-muted">
                Uploaded {formatDate(finalizedPdf.uploadedAt)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="portal-small-btn"
              onClick={() =>
                openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl).catch((err) => {
                  toast.error(err?.data || err?.message || "Unable to open file.");
                })
              }
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

function QueryAttachmentSummary({
  attachments,
  canManage,
  onManage,
  getQueryAttachmentUrl,
  attachmentKind = "query",
}) {
  const toast = usePortalToast();
  if (!attachments.length) {
    return canManage ? (
      <button type="button" className="portal-small-btn" onClick={onManage}>
        Add files
      </button>
    ) : (
      <span className="text-xs text-brand-muted">-</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {attachments.slice(0, 2).map((file) => (
        <button
          key={file.id}
          type="button"
          className="inline-flex max-w-[180px] items-center gap-1 truncate text-left text-xs font-medium text-citius-blue hover:underline"
          onClick={() =>
            openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch((err) => {
              toast.error(err?.data || err?.message || "Unable to open file.");
            })
          }
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
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
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
    }
    setIsUploading(false);
  };

  const handleRemove = async (attachment) => {
    const ok = await confirm({
      title: "Remove file",
      message: `Remove ${attachment.fileName}?`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    try {
      await removeQueryAttachment({ attachmentId: attachment.id });
      toast.success("File removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <motion.div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            htmlFor="query-attachment-upload"
            className="mb-2 block text-sm font-medium text-brand-text"
          >
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
                  onClick={() =>
                    openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch(
                      (err) => {
                        toast.error(err?.data || err?.message || "Unable to open file.");
                      },
                    )
                  }
                >
                  Open
                </button>
                {canManage && (
                  <button
                    type="button"
                    className="portal-small-btn text-red-600"
                    onClick={() => handleRemove(file)}
                  >
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
  if (
    [
      "Issued",
      "Approved",
      "Paid",
      "Active",
      "Available",
      "Done",
      "Order Confirmed",
      "Sent",
      "Assigned",
      "Confirmation",
      "Ready",
    ].includes(status)
  )
    return "green";
  if (
    [
      "Pending Issue",
      "Pending",
      "Awaiting",
      "Part Paid",
      "Proposal in progress",
      "Proposal in discussion",
      "Open",
      "Held",
      "Inquiry",
      "Proposal",
      "Ticketing",
      "Docs pending",
    ].includes(status)
  )
    return "amber";
  if (
    [
      "Cancelled",
      "Rejected",
      "Order Lost",
      "Lost",
      "Overdue",
      "Inactive",
      "Blocked",
      "Closed",
    ].includes(status)
  )
    return "red";
  if (["Reissue Required", "Name Change Required", "Re-applied", "Negotiation"].includes(status))
    return "purple";
  return "blue";
}

function BriefcaseIcon(props) {
  return <Settings {...props} />;
}
