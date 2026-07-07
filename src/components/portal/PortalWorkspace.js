"use client";
"use no memo";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
  Paperclip,
  Plane,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cloneElement, isValidElement, Suspense, useEffect, useState } from "react";
import { DashboardView } from "@/components/portal/dashboard/DashboardView";
import { EntityModal } from "@/components/portal/EntityModal";
import {
  PortalChromeSavedViewsSync,
  usePortalChrome,
} from "@/components/portal/PortalChromeContext";
import {
  PortalCommandPaletteRoot,
  PortalCommandPaletteTrigger,
} from "@/components/portal/PortalCommandPalette";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import PortalListToolbar from "@/components/portal/PortalListToolbar";
import { formatDate, LifecycleDates } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import SaveViewDialog from "@/components/portal/SaveViewDialog";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { StaffWorkbookImportPanel } from "@/components/portal/settings/StaffWorkbookImportPanel";
import { usePortalNotificationDeepLink } from "@/components/portal/usePortalNotificationDeepLink";
import { usePortalWorkspaceState } from "@/components/portal/usePortalWorkspaceState";
import { formatDisplayDate } from "@/lib/formatDate";
import {
  CALLING_STATUSES,
  CONTRACTING_TEAM_ROLES,
  LEAVE_TYPES,
  PORTAL_PERMISSIONS,
  ROOM_TYPES,
} from "@/lib/portal/constants";
import { uploadEntityFiles } from "@/lib/portal/fileUploads";
import { buildPassengerImportResultMessage } from "@/lib/portal/importResultMessages";
import { filterEmptyMessage } from "@/lib/portal/listFilters";
import { executeModalCommand } from "@/lib/portal/modalCommandExecutor";
import { JOB_CARD_MODALS } from "@/lib/portal/modalLifecycle";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { toPassengerImportInput } from "@/lib/portal/passengerImportRows";
import {
  formatPassportExpiryLabel,
  getPassportExpiryInfo,
  passportExpiryTone,
} from "@/lib/portal/passportExpiry";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import {
  assignQueryTeamsButtonLabel,
  canAssignContracting,
  canAssignOperations,
  canAssignTicketing,
  canAssignTourManagers,
  canCreateJobCardFromAccounts,
  canHeadAssignQueryTeams,
  canManageJobCardCreatorAccess,
  canShowAssignQueryTeamsButton,
  getAccessibleNavGroups,
} from "@/lib/portal/permissions";
import {
  proposalLinkedQueryIds,
  proposalLinkedQueryLabel,
  proposalPrimaryQuery,
} from "@/lib/portal/proposalLinks";
import { buildQueryStatusAction } from "@/lib/portal/queryStatusAction";
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
import { buildTravellerCountSummary } from "@/lib/portal/travellerSummary";
import { getPipelineBuckets, getSalesPipelineBuckets } from "@/lib/portal/workflow";
import {
  buildTravelBatchModalInitial,
  formatTravelBatchOwnerSummary,
  SPREADSHEET_MODALS,
  TRAVEL_BATCH_MODAL,
} from "@/lib/portal/workspaceContract";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const P = PORTAL_PERMISSIONS;
const EMPTY_JOB_CARDS = [];
const EMPTY_LIST_FILTER_CONFIG = [];
const EMPTY_LIST_FILTERS = {};
const EMPTY_FILTER_SOURCE_ROWS = [];

const HOTEL_ROOMING_TABS = [
  { id: "hotels", label: "Hotels" },
  { id: "rooming", label: "Rooming" },
  { id: "room-count", label: "Room Count" },
];

const ROOM_TYPE_CAPACITY = {
  "Child with Bed": 1,
  Double: 2,
  "Family Room": 4,
  Single: 1,
  Triple: 3,
  Twin: 2,
};
const ROOM_TYPE_SET = new Set(ROOM_TYPES);

const PASSENGER_IMPORT_INITIAL = {
  error: "",
  fileName: "",
  importProgress: null,
  isParsing: false,
  isPreviewing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null,
  preview: null,
};

const FLIGHT_IMPORT_INITIAL = {
  error: "",
  fileName: "",
  isParsing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null,
};

const PASSENGER_EXPORT_INITIAL = {
  error: "",
  exportData: null,
  isExporting: false,
  isLoading: false,
  jobCardId: "",
};

function jobCardFilterOptions(jobCards) {
  return [
    { label: "All job cards", value: "" },
    ...(jobCards || []).map((job) => ({
      label: job.jobCode,
      value: job.id,
    })),
  ];
}

function travelBatchDisplayLabel(row) {
  return row?.travelBatchReference || row?.travelBatchCode || "-";
}

function jobCardSelectOptions(jobCards, { required = false, allowUnassigned = false } = {}) {
  const options = jobCards.map((job) => ({
    label: `${job.jobCode} - ${job.clientName}`,
    value: job.id,
  }));
  if (allowUnassigned) {
    return [{ label: "Unassigned", value: "" }, ...options];
  }
  if (required) {
    return [{ label: "Select job card…", value: "" }, ...options];
  }
  return options;
}

function linkedTravellerOptions(travellers, jobCardId) {
  const rows = jobCardId
    ? travellers.filter((traveller) => traveller.jobCardId === jobCardId)
    : travellers;
  return [
    { label: jobCardId ? "Unassigned" : "Select job card first…", value: "" },
    ...rows.map((traveller) => ({
      label: `${traveller.fullName} - ${traveller.jobCode}`,
      value: traveller.id,
    })),
  ];
}

function linkedPnrOptions(pnrs, jobCardId) {
  const rows = jobCardId ? pnrs.filter((pnr) => pnr.jobCardId === jobCardId) : pnrs;
  return [
    { label: jobCardId ? "No PNR" : "Select job card first…", value: "" },
    ...rows.map((pnr) => ({
      label: `${pnr.pnrCode} - ${pnr.route}`,
      value: pnr.id,
    })),
  ];
}

function applyJobCardLink(form, job, modal, { onlyEmpty = false } = {}) {
  if (!job) {
    return {};
  }

  const patch = { jobCardId: job.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
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
  if (!traveller) {
    return { travellerId: "" };
  }

  const patch = { travellerId: traveller.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
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
  if (!pnr) {
    return { pnrId: "" };
  }

  const patch = { pnrId: pnr.id };
  if (pnr.jobCardId && !(onlyEmpty && form.jobCardId)) {
    patch.jobCardId = pnr.jobCardId;
  }
  return patch;
}

function applyQueryLink(form, query, { onlyEmpty = false } = {}) {
  if (!query?.id) {
    return {};
  }

  const patch = { queryId: query.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
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
  if (!visa?.id) {
    return {};
  }

  const patch = { visaRecordId: visa.id };
  const set = (field, value) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (onlyEmpty && form[field]) {
      return;
    }
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
      <PortalWorkspaceInner {...props} key={props.view || "dashboard"} />
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
        <div className="font-heading font-semibold text-citius-blue text-xl">
          No access to this portal page
        </div>
        <p className="mt-2 text-brand-muted text-sm">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }
  return <PortalWorkspaceLayout workspace={workspace} />;
}

function PortalWorkspaceHeader({ workspace: w }) {
  if (w.view === "dashboard") {
    return w.error && !w.modal ? (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
        {w.error}
      </div>
    ) : null;
  }

  const filterSourceRows =
    {
      activity: w.periodFiltered.activity,
      approvals: w.periodFiltered.approvals,
      "employees-on-leave": w.periodFiltered.leaves,
      expenses: w.periodFiltered.expenses,
      finance: w.periodFiltered.invoices,
      flights: w.periodFiltered.pnrs,
      hotels: w.periodFiltered.travellers.filter((row) => row.roomType || row.hotelAllocation),
      "job-cards": w.periodFiltered.jobCards,
      passport: w.periodFiltered.travellers,
      proposals: w.periodFiltered.proposals,
      "seat-allocation": w.periodFiltered.seats,
      team: w.team || [],
      ticketing: w.periodFiltered.tickets,
      tickets: w.periodFiltered.tickets,
      "tour-managers": w.periodFiltered.tourManagers,
      travellers: w.periodFiltered.travellers,
      visa: w.periodFiltered.visas,
    }[w.view] ?? w.periodFiltered.queries;

  return (
    <>
      <PortalListToolbar
        actions={
          <HeaderActions access={w.access} has={w.has} openModal={w.openModal} view={w.view} />
        }
        commandPalette={<PortalCommandPaletteTrigger />}
        dateRange={w.dateRange}
        defaultFiltersOpen={w.view === "hotels"}
        filterSourceRows={filterSourceRows}
        filtersActive={w.filtersActive}
        jobCardFilter={w.jobCardFilter}
        jobCardFilterOptions={jobCardFilterOptions}
        jobCards={w.jobCards || []}
        listFilterConfig={w.listFilterConfig}
        listFilters={w.listFilters}
        onClearAllFilters={w.clearAllFilters}
        resultCount={w.viewResultCount}
        search={w.search}
        setDateRange={w.setDateRangeWithUrl}
        setJobCardFilter={w.setJobCardFilterWithUrl}
        setListFilterValue={w.setListFilterValue}
        setSearch={w.setSearchWithUrl}
        showJobCardFilter={w.showJobCardFilter && w.view !== "hotels"}
        showPeriodFilter={!["settings", "team"].includes(w.view)}
        showSearch
        title={w.meta.title}
      />

      {w.error && !w.modal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
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
          access={w.access}
          dateRange={w.dateRange}
          has={w.has}
          loading={w.summary === undefined}
          openModal={w.openModal}
          setDateRange={w.setDateRangeWithUrl}
          summary={w.summary}
        />
      )}
      {w.view === "queries" && (
        <QueriesView
          access={w.access}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          getQueryAttachmentUrl={w.getQueryAttachmentUrl}
          has={w.has}
          openModal={w.openModal}
          removeQuery={w.removeQuery}
          rows={w.filteredQueries}
          submitToContracting={w.submitToContracting}
        />
      )}
      {w.view === "pipeline" && (
        <PipelineView
          mode={w.pipelineMode}
          rows={w.filteredPipelineQueries}
          setMode={w.setPipelineMode}
        />
      )}
      {w.view === "contracting" && (
        <ContractingView
          canAssign={canHeadAssignQueryTeams(w.access)}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          proposals={w.filteredProposals}
          removeQuery={w.removeQuery}
          rows={w.filteredContractingQueries}
          team={w.team || []}
        />
      )}
      {w.view === "proposals" && (
        <ProposalsView
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          getFinalizedPdfUrl={w.getFinalizedPdfUrl}
          getProposalAttachmentUrl={w.getProposalAttachmentUrl}
          has={w.has}
          markProposalSent={w.markProposalSent}
          openModal={w.openModal}
          removeProposal={w.removeProposal}
          rows={w.filteredProposals}
        />
      )}
      {w.view === "accounts-job-cards" && (
        <AccountsJobCardView
          access={w.access}
          creators={w.accountsJobCardCreators || []}
          filtersActive={w.filtersActive}
          jobCards={w.filteredJobCards}
          openModal={w.openModal}
          rows={w.filteredAccountsQueries}
          setJobCardCreatorAccess={w.setJobCardCreatorAccess}
        />
      )}
      {w.view === "job-cards" && (
        <JobCardsView
          access={w.access}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeJobCard={w.removeJobCard}
          rows={w.filteredJobCards}
          updateJobStatus={w.updateJobStatus}
        />
      )}
      {w.view === "travellers" && (
        <TravellersView
          countRows={w.periodFiltered.travellers}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          jobCardFilter={w.jobCardFilter}
          jobCards={w.jobCards || []}
          openModal={w.openModal}
          removeManyTravellers={w.removeManyTravellers}
          removeTraveller={w.removeTraveller}
          rows={w.filteredTravellers}
          setJobCardFilter={w.setJobCardFilterWithUrl}
        />
      )}
      {w.view === "passport" && (
        <PassportDocumentsView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          encryptAndStorePassport={w.encryptAndStorePassport}
          filtersActive={w.filtersActive}
          generateUploadUrl={w.generateUploadUrl}
          getPassportDocument={w.getPassportDocument}
          has={w.has}
          removeManyTravellers={w.removeManyTravellers}
          removePassport={w.removePassport}
          removeTraveller={w.removeTraveller}
          travellers={w.filteredPassportTravellers}
        />
      )}
      {w.view === "visa" && (
        <VisaTrackingView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeManyVisas={w.removeManyVisas}
          removeVisa={w.removeVisa}
          rows={w.filteredVisas}
        />
      )}
      {w.view === "ticketing" && (
        <TicketDashboardView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          has={w.has}
          openModal={w.openModal}
          removeManyTickets={w.removeManyTickets}
          removeTicket={w.removeTicket}
          summary={w.ticketDashboard}
          tickets={w.filteredTickets}
        />
      )}
      {w.view === "flights" && (
        <PnrView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          itinerary={w.periodFiltered.flightItinerary}
          openModal={w.openModal}
          removeManyPnrs={w.removeManyPnrs}
          removePnr={w.removePnr}
          rows={w.filteredPnrs}
        />
      )}
      {w.view === "seat-allocation" && (
        <SeatView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeManySeatAllocations={w.removeManySeatAllocations}
          removeSeatAllocation={w.removeSeatAllocation}
          rows={w.filteredSeats}
        />
      )}
      {w.view === "tickets" && (
        <TicketsView
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeManyTickets={w.removeManyTickets}
          removeTicket={w.removeTicket}
          rows={w.filteredAllTickets}
        />
      )}
      {w.view === "hotels" && (
        <HotelRoomingTabs
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          hotels={w.filteredHotels}
          jobCardFilter={w.jobCardFilter}
          jobCards={w.jobCards || []}
          openModal={w.openModal}
          removeHotel={w.removeHotel}
          removeManyHotels={w.removeManyHotels}
          removeManyTravellers={w.removeManyTravellers}
          removeTraveller={w.removeTraveller}
          roomCountRows={w.periodFiltered.travellers.filter(
            (row) => row.roomType || row.hotelAllocation
          )}
          roomingRows={w.filteredRoomingTravellers}
          setJobCardFilter={w.setJobCardFilterWithUrl}
        />
      )}
      {w.view === "tour-managers" && (
        <TourManagersView
          assignments={w.periodFiltered.tourManagers}
          canAssign={canAssignTourManagers(w.access)}
          deleteItem={w.deleteItem}
          deleteSelected={w.deleteSelected}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeManyTourManagers={w.removeManyTourManagers}
          removeTourManager={w.removeTourManager}
          rows={w.filteredTourManagers}
          travellers={w.periodFiltered.travellers}
          updateCallingStatus={w.updateCallingStatus}
        />
      )}
      {w.view === "finance" && (
        <FinanceView
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          overview={w.financeOverview}
          removeInvoice={w.removeInvoice}
          rows={w.filteredInvoices}
        />
      )}
      {w.view === "expenses" && (
        <ExpensesView
          decideExpenseFinance={w.decideExpenseFinance}
          decideExpenseManager={w.decideExpenseManager}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          getExpenseAttachmentUrl={w.getExpenseAttachmentUrl}
          has={w.has}
          openModal={w.openModal}
          removeExpense={w.removeExpense}
          removeExpenseProof={w.removeExpenseProof}
          rows={w.filteredExpenses}
          submitExpenseForApproval={w.submitExpenseForApproval}
        />
      )}
      {w.view === "approvals" && (
        <ApprovalsView
          decideApproval={w.decideApproval}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          has={w.has}
          openModal={w.openModal}
          removeApproval={w.removeApproval}
          rows={w.filteredApprovals}
        />
      )}
      {w.view === "reports" && <ReportsView report={w.reports} />}
      {w.view === "team" && <TeamView rows={w.filteredTeam} />}
      {w.view === "employees-on-leave" && (
        <LeaveView
          access={w.access}
          decideLeave={w.decideLeave}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          has={w.has}
          leaveBalances={w.leaveBalances}
          openModal={w.openModal}
          removeLeave={w.removeLeave}
          rows={w.filteredLeaves}
          staff={w.staff || w.team || []}
        />
      )}
      {w.view === "activity" && (
        <ActivityView
          activity={w.filteredActivity}
          deleteItem={w.deleteItem}
          filtersActive={w.filtersActive}
          markNotificationRead={w.markNotificationRead}
          notifications={w.periodFiltered.notifications}
          removeNotification={w.removeNotification}
        />
      )}
      {w.view === "settings" && (
        <SettingsView
          deleteItem={w.deleteItem}
          dropdowns={w.dropdowns || {}}
          openModal={w.openModal}
          removeStaff={w.removeStaff}
          search={w.search}
          staff={w.filteredStaff}
          startStaffOnboarding={w.startStaffOnboarding}
        />
      )}
    </>
  );
}

const PASSENGER_IMPORT_MODAL_CONFIGS = [
  {
    fileLabel: "Ticketing passenger spreadsheet",
    modal: "passengerImport",
    successLabel: "Ticketing passenger import complete",
    title: "Import Ticketing Passenger List",
    uploadLabel: "Upload Ticketing List",
  },
  {
    emptyLabel: "No traveller master rows found.",
    fileLabel: "Traveller master spreadsheet",
    importKind: "traveller",
    modal: "travellerImport",
    parseWorkbookFile: parseTravellerMasterWorkbookFile,
    successLabel: "Traveller master import complete",
    title: "Import Traveller Master",
    uploadLabel: "Upload Traveller Master",
  },
  {
    emptyLabel: "No rooming rows found.",
    fileLabel: "Rooming spreadsheet",
    importKind: "rooming",
    modal: "roomingImport",
    parseWorkbookFile: parseRoomingWorkbookFile,
    successLabel: "Rooming import complete",
    title: "Import Rooming List",
    uploadLabel: "Upload Rooming",
  },
  {
    emptyLabel: "No passport rows found.",
    fileLabel: "Passport spreadsheet",
    modal: "passportImport",
    parseWorkbookFile: parsePassportWorkbookFile,
    successLabel: "Passport import complete",
    title: "Import Passport List",
    uploadLabel: "Upload Passports",
  },
  {
    emptyLabel: "No visa rows found.",
    fileLabel: "Visa spreadsheet",
    modal: "visaImport",
    parseWorkbookFile: parseVisaWorkbookFile,
    successLabel: "Visa import complete",
    title: "Import Visa List",
    uploadLabel: "Upload Visa Rows",
  },
];

const PASSENGER_EXPORT_MODAL_CONFIGS = [
  {
    exportKind: "passenger",
    filenameSuffix: "ticketing-passengers",
    modal: "passengerExport",
    subtitle: "Select a job card to download the ticketing passenger spreadsheet.",
    title: "Export Ticketing Passenger List",
  },
  {
    buildWorkbook: buildTravellerMasterWorkbook,
    exportKind: "traveller",
    filenameSuffix: "traveller-master",
    modal: "travellerExport",
    sheetName: "Master list",
    subtitle: "Select a job card to download the Master list sheet in the traveller master format.",
    title: "Export Traveller Master",
  },
  {
    buildWorkbook: buildRoomingWorkbook,
    exportKind: "rooming",
    filenameSuffix: "rooming",
    modal: "roomingExport",
    sheetName: "Rooming",
    subtitle: "Select a job card to download the Rooming sheet in the master-list format.",
    title: "Export Rooming List",
  },
  {
    buildWorkbook: buildPassportWorkbook,
    exportKind: "passport",
    filenameSuffix: "passport",
    modal: "passportExport",
    sheetName: "Passport",
    subtitle: "Select a job card to download the Passport sheet in the master-list format.",
    title: "Export Passport List",
  },
  {
    buildWorkbook: buildVisaWorkbook,
    exportKind: "visa",
    filenameSuffix: "visa",
    modal: "visaExport",
    sheetName: "Visa",
    subtitle: "Select a job card to download the Visa sheet in the master-list format.",
    title: "Export Visa List",
  },
];

function travelBatchEntityModalKey(modal, form) {
  if (modal === TRAVEL_BATCH_MODAL) {
    return `travel-batch:${form?.entityId ?? form?.jobCardId ?? "new"}`;
  }
  return modal ?? "closed";
}

function TravelBatchEntityModalBridge({ workspace: w }) {
  const toast = usePortalToast();
  const createTravelBatch = useMutation(api.crm.jobCards.createTravelBatch);
  const updateTravelBatch = useMutation(api.crm.jobCards.updateTravelBatch);
  const [travelBatchError, setTravelBatchError] = useState("");
  const [travelBatchSaving, setTravelBatchSaving] = useState(false);

  async function submit(event) {
    if (w.modal !== TRAVEL_BATCH_MODAL) {
      return w.submit(event);
    }
    event.preventDefault();
    setTravelBatchSaving(true);
    setTravelBatchError("");
    try {
      await runMutation(
        {
          label: "Save",
          onError: (message) => setTravelBatchError(message),
          showToast: toast,
          successMessage: "Saved",
        },
        async () => {
          await executeModalCommand({
            deps: {
              access: w.access,
              createTravelBatch,
              has: w.has,
              jobCardModals: JOB_CARD_MODALS,
              queries: w.queries || [],
              team: w.team || [],
              updateTravelBatch,
            },
            form: w.form,
            modal: TRAVEL_BATCH_MODAL,
          });
          w.closeModal();
        }
      );
    } catch (err) {
      setTravelBatchError(err?.data || err?.message || "Unable to save.");
    }
    setTravelBatchSaving(false);
  }

  return (
    <EntityModal
      access={w.access}
      attachFinalizedPdf={w.attachFinalizedPdf}
      attachProposalFile={w.attachProposalFile}
      attachQueryFile={w.attachQueryFile}
      close={w.closeModal}
      error={w.modal === TRAVEL_BATCH_MODAL ? travelBatchError : w.error}
      form={w.form}
      generateFinalizedPdfUploadUrl={w.generateFinalizedPdfUploadUrl}
      generateProposalUploadUrl={w.generateProposalUploadUrl}
      generateQueryUploadUrl={w.generateQueryUploadUrl}
      getExpenseAttachmentUrl={w.getExpenseAttachmentUrl}
      getFinalizedPdfUrl={w.getFinalizedPdfUrl}
      getProposalAttachmentUrl={w.getProposalAttachmentUrl}
      getQueryAttachmentUrl={w.getQueryAttachmentUrl}
      has={w.has}
      isSaving={w.modal === TRAVEL_BATCH_MODAL ? travelBatchSaving : w.isSaving}
      jobCards={w.jobCards || []}
      leaveBalances={w.leaveBalances}
      leaveHeadApproverCandidates={w.leaveHeadApproverCandidates || []}
      modal={SPREADSHEET_MODALS.includes(w.modal) ? null : w.modal}
      patchForm={w.patchForm}
      pendingExpenseProofFiles={w.pendingExpenseProofFiles}
      pendingProposalFiles={w.pendingProposalFiles}
      pendingQueryFiles={w.pendingQueryFiles}
      pnrs={w.pnrs || []}
      proposals={w.proposals || []}
      queries={w.queries || []}
      removeExpenseProof={w.removeExpenseProof}
      removeFinalizedPdf={w.removeFinalizedPdf}
      removeProposalAttachment={w.removeProposalAttachment}
      removeQueryAttachment={w.removeQueryAttachment}
      setPendingExpenseProofFiles={w.setPendingExpenseProofFiles}
      setPendingProposalFiles={w.setPendingProposalFiles}
      setPendingQueryFiles={w.setPendingQueryFiles}
      submit={submit}
      team={w.team || []}
      travellers={w.travellers || []}
      travellersWithoutVisa={w.travellersWithoutVisa || []}
      updateForm={w.updateForm}
      visas={w.visas || []}
    />
  );
}

function PortalWorkspaceSpreadsheetModals({ workspace: w }) {
  return (
    <>
      <TravelBatchEntityModalBridge
        key={travelBatchEntityModalKey(w.modal, w.form)}
        workspace={w}
      />
      {PASSENGER_IMPORT_MODAL_CONFIGS.map((config) => (
        <PassengerImportModal
          close={w.closeModal}
          commitPassengerImport={w.commitPassengerImport}
          jobCards={w.jobCards || []}
          open={w.modal === config.modal}
          previewPassengerImport={w.previewPassengerImport}
          {...config}
          key={config.modal}
        />
      ))}
      <FlightImportModal
        close={w.closeModal}
        commitFlightImport={w.commitFlightImport}
        itinerary={w.flightItinerary || []}
        jobCards={w.jobCards || []}
        open={w.modal === "flightImport"}
      />
      {PASSENGER_EXPORT_MODAL_CONFIGS.map((config) => (
        <PassengerExportModal
          close={w.closeModal}
          getPassengerExportRows={w.getPassengerExportRows}
          jobCards={w.jobCards || []}
          open={w.modal === config.modal}
          {...config}
          key={config.modal}
        />
      ))}
      <FlightExportModal
        close={w.closeModal}
        itinerary={w.flightItinerary || []}
        jobCards={w.jobCards || []}
        open={w.modal === "flightExport"}
      />
    </>
  );
}

function PortalWorkspaceLayout({ workspace: w }) {
  const navGroups = getAccessibleNavGroups(w.access);
  const { navShortcuts } = usePortalChrome();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savingView, setSavingView] = useState(false);

  return (
    <PortalCommandPaletteRoot
      onSaveView={() => setSaveDialogOpen(true)}
      workspace={{ ...w, navGroups, navShortcuts }}
    >
      <div className="mx-auto max-w-[1500px]">
        <PortalChromeSavedViewsSync
          applySavedView={w.applySavedView}
          deleteSavedView={w.deleteSavedView}
          saveCurrentView={w.saveCurrentView}
          savedViews={w.savedViews || []}
          toggleSavedViewFavorite={w.toggleSavedViewFavorite}
        />
        <PortalWorkspaceHeader workspace={w} />
        <PortalWorkspaceViews workspace={w} />
        <PortalWorkspaceSpreadsheetModals workspace={w} />
      </div>
      <SaveViewDialog
        onClose={() => setSaveDialogOpen(false)}
        onSave={async (name, options) => {
          setSavingView(true);
          try {
            await w.saveCurrentView(name, options);
            setSaveDialogOpen(false);
            setSavingView(false);
          } catch (error) {
            setSavingView(false);
            throw error;
          }
        }}
        open={saveDialogOpen}
        saving={savingView}
      />
    </PortalCommandPaletteRoot>
  );
}

function HeaderActions({ view, openModal, has, access }) {
  if (view === "travellers" && has(P.MANAGE_TRAVELLERS)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("travellerExport")}
          type="button"
        >
          <Download size={16} />
          Export Traveller Master
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("travellerImport")}
          type="button"
        >
          <Upload size={16} />
          Import Traveller Master
        </button>
        <button className="portal-primary-btn" onClick={() => openModal("traveller")} type="button">
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
          className="portal-small-btn bg-white"
          onClick={() => openModal("passengerExport")}
          type="button"
        >
          <Download size={16} />
          Export Passengers
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("passengerImport")}
          type="button"
        >
          <Upload size={16} />
          Import Passengers
        </button>
        <button className="portal-primary-btn" onClick={() => openModal("ticket")} type="button">
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
          className="portal-small-btn bg-white"
          onClick={() => openModal("flightExport")}
          type="button"
        >
          <Download size={16} />
          Export Flights
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("flightImport")}
          type="button"
        >
          <Upload size={16} />
          Import Flights
        </button>
        <button className="portal-primary-btn" onClick={() => openModal("pnr")} type="button">
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
          className="portal-small-btn bg-white"
          onClick={() => openModal("roomingExport")}
          type="button"
        >
          <Download size={16} />
          Export Rooming
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("roomingImport")}
          type="button"
        >
          <Upload size={16} />
          Import Rooming
        </button>
        <button className="portal-primary-btn" onClick={() => openModal("hotel")} type="button">
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
          className="portal-small-btn bg-white"
          onClick={() => openModal("passportExport")}
          type="button"
        >
          <Download size={16} />
          Export Passport
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("passportImport")}
          type="button"
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
          className="portal-small-btn bg-white"
          onClick={() => openModal("visaExport")}
          type="button"
        >
          <Download size={16} />
          Export Visa
        </button>
        <button
          className="portal-small-btn bg-white"
          onClick={() => openModal("visaImport")}
          type="button"
        >
          <Upload size={16} />
          Import Visa
        </button>
        <button
          className="portal-primary-btn"
          onClick={() => openModal("visa_create")}
          type="button"
        >
          <Plus size={16} />
          Create Visa Record
        </button>
      </div>
    );
  }
  const actions = {
    contracting: canHeadAssignQueryTeams(access) && ["assignQueryTeams", "Assign teams"],
    "employees-on-leave": (has(P.REQUEST_LEAVE) || has(P.MANAGE_LEAVE)) && [
      "leave_create",
      has(P.MANAGE_LEAVE) ? "Record Leave" : "Request Leave",
    ],
    expenses: has(P.CREATE_EXPENSES) && ["expense", "Add Expense"],
    proposals: has(P.MANAGE_PROPOSALS) && ["proposal", "New Proposal"],
    queries: has(P.MANAGE_QUERIES) && ["query", "New Query"],
    "seat-allocation": has(P.MANAGE_TICKETING) && ["seat", "Save Seat"],
    settings: has(P.MANAGE_STAFF) && ["staff", "Add Staff"],
    tickets: has(P.MANAGE_TICKETING) && ["ticket", "Issue Ticket"],
    "tour-managers": canAssignTourManagers(access) && ["tourManager", "Add Tour Manager"],
  };
  const action = actions[view];
  if (!action) {
    return null;
  }
  return (
    <button
      className="portal-primary-btn shrink-0 whitespace-nowrap"
      onClick={() => openModal(action[0])}
      type="button"
    >
      <Plus size={16} />
      {action[1]}
    </button>
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
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]"
        initial={{ opacity: 0, y: 12 }}
        transition={{ delay: 0.05, duration: 0.4 }}
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Active tours">
            {(summary.activeTours || []).length === 0 ? (
              <EmptyState label="No active tours yet." />
            ) : (
              <div className="space-y-4">
                {summary.activeTours.map((tour, index) => (
                  <m.div
                    animate={{ opacity: 1, y: 0 }}
                    className="overflow-hidden rounded-xl border border-brand-border bg-brand-light p-4 transition-shadow hover:shadow-md"
                    initial={{ opacity: 0, y: 12 }}
                    key={tour.id}
                    transition={{ delay: index * 0.06, duration: 0.35 }}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-brand-dark text-sm">
                          {tour.jobCode} - {tour.clientName}
                        </div>
                        <div className="text-brand-muted text-xs">
                          {tour.destination || "Destination pending"} - {tour.pax} pax
                        </div>
                      </div>
                      <Badge label={tour.status} tone="blue" />
                    </div>
                    <Progress label="Tickets issued" value={tour.ticketProgress} />
                    <Progress label="Visa approved" value={tour.visaProgress} />
                  </m.div>
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
                <m.div
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-xl border border-brand-border bg-white p-3 text-sm"
                  initial={{ opacity: 0, x: 12 }}
                  key={item.id}
                  transition={{ delay: index * 0.06, duration: 0.35 }}
                >
                  <div className="font-medium text-brand-dark">{item.label}</div>
                  <div className="mt-1 text-brand-muted text-xs">{item.type}</div>
                </m.div>
              ))}
            </div>
          )}
        </Panel>
      </m.div>
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
      <m.div
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-5 xl:grid-cols-2"
        initial={{ opacity: 0, y: 12 }}
        transition={{ delay: 0.12, duration: 0.4 }}
      >
        {has(P.VIEW_JOB_CARDS) && (
          <Panel title="Upcoming departures">
            {(summary.upcomingDepartures || []).length === 0 ? (
              <EmptyState label="No upcoming departures." />
            ) : (
              <DataTable
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
                compact
                empty="No upcoming departures."
                rows={summary.upcomingDepartures}
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
                    className="rounded-xl border border-brand-border bg-brand-light p-4"
                    key={member.id}
                  >
                    <div className="font-semibold text-brand-dark text-sm">{member.name}</div>
                    <div className="mt-1 text-brand-muted text-xs">
                      {member.function || member.department}
                    </div>
                    <div className="mt-1 text-brand-muted text-xs">
                      {member.location || member.email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </m.div>
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

function queryModalEditInitial(row) {
  return {
    batchingNotes: row.batchingNotes || "",
    budgetAmount: String(row.budgetAmount || ""),
    clientName: row.clientName,
    contactMobile: row.contactMobile,
    contactPerson: row.contactPerson,
    destination: row.destination,
    entityId: row.id,
    notes: row.notes,
    paxCount: String(row.paxCount),
    queryType: row.queryType,
    salesOwnerName: row.salesOwnerName,
    source: row.source,
    staffId: row.contractingOwnerId || "",
    ticketingScope: row.ticketingScope || "",
    travelEndDate: row.travelEndDate,
    travelInBatches: row.travelInBatches ? "Yes" : "No",
    travelStartDate: row.travelStartDate,
    travelType: row.travelType,
  };
}

function formatQueryBatchCell(row) {
  if (!row.travelInBatches) {
    return "No";
  }
  const notes = (row.batchingNotes || "").trim();
  if (!notes) {
    return "Yes";
  }
  const preview = notes.length > 48 ? `${notes.slice(0, 48)}...` : notes;
  return (
    <div>
      <div>Yes</div>
      <div className="text-brand-muted text-xs">{preview}</div>
    </div>
  );
}

function QueryManageActions({ row, openModal, has, deleteItem, removeQuery, submitToContracting }) {
  if (!has(P.MANAGE_QUERIES)) {
    return null;
  }
  const statusAction = buildQueryStatusAction(row, has);
  const alreadySubmitted = Boolean(row.submittedToContractingAt);
  return (
    <>
      <button
        className="portal-small-btn"
        onClick={() => openModal("query", queryModalEditInitial(row))}
        type="button"
      >
        Edit
      </button>
      <button
        className="portal-small-btn"
        onClick={() => openModal("queryAttachments", { queryCode: row.queryCode, queryId: row.id })}
        type="button"
      >
        Reference Itinerary
      </button>
      {!alreadySubmitted && (
        <button
          className="portal-small-btn"
          onClick={() => submitToContracting({ queryId: row.id })}
          type="button"
        >
          Submit to Contracting
        </button>
      )}
      <button
        className="portal-small-btn"
        onClick={() => openModal(statusAction.modal, statusAction.initial)}
        type="button"
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
  access,
  deleteItem,
  removeQuery,
  submitToContracting,
  getQueryAttachmentUrl,
}) {
  return (
    <DataTable
      columns={[
        ["Query ID", (row) => row.queryCode],
        ["Client", (row) => strong(row.clientName)],
        [
          "Dates",
          (row) => (
            <LifecycleDates
              compact
              items={[
                { label: "Created", value: row.createdAt },
                { label: "Submitted", value: row.submittedToContractingAt },
                { label: "Confirmed", value: row.confirmedAt },
              ]}
            />
          ),
        ],
        ["Destination", (row) => row.destination || "TBD"],
        [
          "Pax",
          (row) => (
            <div>
              <div>{row.paxCount}</div>
              <div className="text-brand-muted text-xs">
                {money(row.budgetAmount)}
                {isQueryConfirmed(row) && row.approxMargin != null
                  ? ` · ${money(row.approxMargin)} margin`
                  : ""}
              </div>
            </div>
          ),
        ],
        [
          "Stage",
          (row) => <Badge label={row.leadStage || "Inquiry"} tone={statusTone(row.leadStage)} />,
        ],
        [
          "Files",
          (row) => (
            <QueryAttachmentSummary
              attachments={row.attachments || []}
              canManage={has(P.MANAGE_QUERIES)}
              getQueryAttachmentUrl={getQueryAttachmentUrl}
              onManage={() =>
                openModal("queryAttachments", { queryCode: row.queryCode, queryId: row.id })
              }
            />
          ),
        ],
        ["Sales", (row) => row.salesOwnerName || "-"],
        ["Ticketing Scope", (row) => row.ticketingScope || "-"],
        ["Batches", (row) => formatQueryBatchCell(row)],
        [
          "Action",
          (row) => (
            <m.div className="hidden flex-wrap gap-2 md:flex">
              {has(P.MANAGE_QUERIES) && (
                <QueryManageActions
                  deleteItem={deleteItem}
                  has={has}
                  openModal={openModal}
                  removeQuery={removeQuery}
                  row={row}
                  submitToContracting={submitToContracting}
                />
              )}
              {canShowAssignQueryTeamsButton(access, row) && (
                <button
                  className="portal-small-btn"
                  onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
                  type="button"
                >
                  {assignQueryTeamsButtonLabel(access)}
                </button>
              )}
            </m.div>
          ),
        ],
      ]}
      empty="No queries yet."
      filtersActive={filtersActive}
      mobileCardRender={(row) => {
        const statusAction = buildQueryStatusAction(row, has);
        return (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-brand-dark">{row.queryCode}</div>
                <div className="text-brand-muted text-sm">{row.clientName}</div>
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
              {row.travelInBatches ? (
                <div className="col-span-2">
                  <span className="text-brand-muted">Travel in Series</span>
                  <div className="font-medium">
                    Yes
                    {(row.batchingNotes || "").trim()
                      ? ` - ${(row.batchingNotes || "").trim()}`
                      : ""}
                  </div>
                </div>
              ) : null}
            </div>
            {has(P.MANAGE_QUERIES) && (
              <QueryRowActions
                overflowActions={[
                  <button
                    className="portal-small-btn w-full"
                    key="ref"
                    onClick={() =>
                      openModal("queryAttachments", { queryCode: row.queryCode, queryId: row.id })
                    }
                    type="button"
                  >
                    Reference Itinerary
                  </button>,
                  row.submittedToContractingAt ? null : (
                    <button
                      className="portal-small-btn w-full"
                      key="submit"
                      onClick={() => submitToContracting({ queryId: row.id })}
                      type="button"
                    >
                      Submit to Contracting
                    </button>
                  ),
                  <button
                    className="portal-small-btn w-full"
                    key="update"
                    onClick={() => openModal(statusAction.modal, statusAction.initial)}
                    type="button"
                  >
                    {statusAction.label}
                  </button>,
                  <DeleteButton
                    key="delete"
                    label={row.queryCode}
                    onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })}
                  />,
                ]}
                primaryAction={
                  <button
                    className="portal-small-btn"
                    onClick={() => openModal("query", queryModalEditInitial(row))}
                    type="button"
                  >
                    Edit
                  </button>
                }
              />
            )}
            {canShowAssignQueryTeamsButton(access, row) && (
              <button
                className="portal-small-btn"
                onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
                type="button"
              >
                {assignQueryTeamsButtonLabel(access)}
              </button>
            )}
          </div>
        );
      }}
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
      if (queryIds.length === 0) {
        continue;
      }
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
    member.roles.some((role) => CONTRACTING_TEAM_ROLES.includes(role))
  );
  const teamRows = contractingTeam.map((member) => ({
    activeQueries: rows.filter(
      (query) =>
        query.contractingOwnerName === member.name &&
        !["Order Confirmed", "Order Lost"].includes(query.contractingStatus)
    ).length,
    email: member.email,
    id: member.id,
    location: member.location || "-",
    name: member.name,
  }));

  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.35 }}
    >
      {canAssign && (
        <Panel title="Contracting team">
          <DataTable
            columns={[
              ["Name", (row) => strong(row.name)],
              ["Email", (row) => row.email],
              ["Location", (row) => row.location],
              ["Active queries", (row) => row.activeQueries],
            ]}
            compact
            empty="No contracting staff in the directory yet."
            rows={teamRows}
          />
        </Panel>
      )}
      <DataTable
        columns={[
          [
            "Received",
            (row) => (
              <span className="text-brand-muted text-xs">
                {formatDate(row.submittedToContractingAt || row.createdAt)}
              </span>
            ),
          ],
          ["Query", (row) => row.queryCode],
          ["Client", (row) => strong(row.clientName)],
          [
            "Confirmed",
            (row) => (
              <span className="text-brand-muted text-xs">{formatDate(row.confirmedAt)}</span>
            ),
          ],
          ["Sales SPOC", (row) => row.salesOwnerName || "-"],
          ["Contracting SPOC", (row) => row.contractingOwnerName || "Unassigned"],
          ["Ticketing Scope", (row) => row.ticketingScope || "-"],
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
              if (!proposal) {
                return "-";
              }
              return (
                <button
                  className="font-semibold text-citius-blue underline-offset-2 hover:underline"
                  onClick={() =>
                    openModal("proposal", {
                      airfarePerPax: String(proposal.airfarePerPax ?? ""),
                      clientName: proposal.clientName,
                      entityId: proposal.id,
                      itinerarySummary: proposal.itinerarySummary || "",
                      landCostPerPax: String(proposal.landCostPerPax ?? ""),
                      paxCount: String(
                        proposalPrimaryQuery(proposal)?.paxCount ?? row.paxCount ?? 1
                      ),
                      queryId: proposal.queryId || "",
                      queryIds: proposalLinkedQueryIds(proposal),
                      sellingPrice: String(proposal.sellingPrice ?? ""),
                      taxRate: proposal.taxRate == null ? "" : String(proposal.taxRate),
                      visaCostPerPax: String(proposal.visaCostPerPax ?? ""),
                    })
                  }
                  type="button"
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
                ? row.approxMargin == null
                  ? "-"
                  : money(row.approxMargin)
                : "-",
          ],
          [
            "Action",
            (row) => {
              const statusAction = buildQueryStatusAction(row, has);
              return (
                <div className="flex gap-2">
                  {canAssign && (
                    <button
                      className="portal-small-btn"
                      onClick={() => openModal("assignQueryTeams", { queryId: row.id })}
                      type="button"
                    >
                      Assign
                    </button>
                  )}
                  {has(P.MANAGE_CONTRACTING) && (
                    <>
                      <button
                        className="portal-small-btn"
                        onClick={() => openModal(statusAction.modal, statusAction.initial)}
                        type="button"
                      >
                        {statusAction.label}
                      </button>
                      <DeleteButton
                        label={row.queryCode}
                        onClick={() => deleteItem(row.queryCode, removeQuery, { queryId: row.id })}
                      />
                    </>
                  )}
                </div>
              );
            },
          ],
        ]}
        empty="No contracting queries yet."
        filtersActive={filtersActive}
        rows={rows}
      />
    </m.div>
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
            className={`rounded-full px-4 py-2 font-semibold text-xs transition ${
              mode === value
                ? "bg-citius-blue text-white"
                : "text-brand-muted hover:text-citius-blue"
            }`}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(buckets).map(([stage, items], index) => (
          <m.div
            animate={{ opacity: 1, y: 0 }}
            className="min-h-36 rounded-2xl border border-brand-border bg-white p-4 shadow-sm"
            initial={{ opacity: 0, y: 16 }}
            key={stage}
            transition={{ delay: index * 0.05, duration: 0.35 }}
          >
            <div className="mb-3 flex items-center justify-between font-heading font-semibold text-citius-blue text-sm">
              {stage}
              <span className="grid size-7 place-items-center rounded-full bg-citius-orange font-bold text-white text-xs">
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  className="rounded-xl border border-brand-border bg-brand-light p-3"
                  key={item.id}
                >
                  <div className="font-semibold text-brand-dark text-sm">{item.clientName}</div>
                  <div className="mt-1 text-brand-muted text-xs">
                    {item.queryCode} - {item.destination || "TBD"} - {item.paxCount} pax
                  </div>
                  <div className="mt-1 text-brand-muted text-xs">
                    {item.salesOwnerName || "Unassigned"}
                  </div>
                </div>
              ))}
            </div>
          </m.div>
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
      columns={[
        ["Proposal", (row) => row.proposalCode],
        ["Client", (row) => strong(row.clientName)],
        [
          "Created",
          (row) => <span className="text-brand-muted text-xs">{formatDate(row.createdAt)}</span>,
        ],
        [
          "Sent",
          (row) => <span className="text-brand-muted text-xs">{formatDate(row.sentAt)}</span>,
        ],
        ["Linked Queries", (row) => proposalLinkedQueryLabel(row)],
        ["Land/Pax", (row) => money(row.landCostPerPax)],
        ["Airfare/Pax", (row) => money(row.airfarePerPax)],
        ["Visa/Pax", (row) => money(row.visaCostPerPax)],
        ["CP/Pax", (row) => money(row.costPrice)],
        ["Tax", (row) => (row.taxRate == null ? "-" : `${row.taxRate}%`)],
        ["Selling", (row) => money(row.sellingPrice)],
        [
          "Last Edit",
          (row) =>
            row.lastEditedByName
              ? `${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
              : "-",
        ],
        [
          "Finalized PDF",
          (row) => (
            <FinalizedProposalPdfSummary
              canSend={canSend}
              finalizedPdf={row.finalizedPdf}
              onDownload={() => openFinalizedProposalPdf(row.id, getFinalizedPdfUrl)}
              onManage={() =>
                openModal("proposalFinalizedPdf", {
                  proposalId: row.id,
                  queryCode: row.proposalCode,
                })
              }
            />
          ),
        ],
        ...(canManage
          ? [
              [
                "Working Files",
                (row) => (
                  <QueryAttachmentSummary
                    attachmentKind="proposal"
                    attachments={row.attachments || []}
                    canManage={canManage}
                    getQueryAttachmentUrl={getProposalAttachmentUrl}
                    onManage={() =>
                      openModal("proposalAttachments", {
                        proposalId: row.id,
                        queryCode: row.proposalCode,
                      })
                    }
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
                    className="portal-small-btn"
                    onClick={() => markProposalSent({ proposalId: row.id })}
                    type="button"
                  >
                    <Send size={13} /> Mark Sent
                  </button>
                )}
                {canManage && (
                  <EditButton
                    onClick={() =>
                      openModal("proposal", {
                        airfarePerPax: String(row.airfarePerPax ?? ""),
                        clientName: row.clientName,
                        entityId: row.id,
                        itinerarySummary: row.itinerarySummary || "",
                        landCostPerPax: String(row.landCostPerPax ?? ""),
                        paxCount: String(proposalPrimaryQuery(row)?.paxCount ?? 1),
                        queryId: row.queryId || "",
                        queryIds: proposalLinkedQueryIds(row),
                        sellingPrice: String(row.sellingPrice ?? ""),
                        taxRate: row.taxRate == null ? "" : String(row.taxRate),
                        visaCostPerPax: String(row.visaCostPerPax ?? ""),
                      })
                    }
                  />
                )}
                {canManage && (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      openModal("addProposalCollaborator", {
                        proposalId: row.id,
                        queryCode: row.proposalCode,
                      })
                    }
                    type="button"
                  >
                    Share
                  </button>
                )}
                {canManage && (row.collaboratorStaffIds ?? []).length > 0 && (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      openModal("removeProposalCollaborator", {
                        proposalId: row.id,
                        queryCode: row.proposalCode,
                      })
                    }
                    type="button"
                  >
                    Unshare
                  </button>
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
      empty="No proposals yet."
      mobileCardRender={(row) => (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-brand-dark">{row.proposalCode}</div>
              <div className="text-brand-muted text-sm">{row.clientName}</div>
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
    />
  );
}

function AccountsJobCardView({
  rows,
  jobCards,
  creators,
  setJobCardCreatorAccess,
  openModal,
  access,
}) {
  const toast = usePortalToast();
  const confirmed = rows.filter(
    (row) => row.salesStatus === "Order Confirmed" || row.contractingStatus === "Order Confirmed"
  );
  const jobByQuery = jobCards.reduce((map, job) => {
    if (job.queryId) {
      map.set(job.queryId, job);
    }
    return map;
  }, new Map());
  const canAssignCreator = canManageJobCardCreatorAccess(access);
  const canCreateJobCards = canCreateJobCardFromAccounts(access, creators);
  return (
    <div className="space-y-5">
      <Panel title="Job Card creators">
        <DataTable
          columns={[
            ["Name", (row) => strong(row.name)],
            ["Email", (row) => row.email],
            ["Role", (row) => row.roles.join(", ")],
            [
              "Create access",
              (row) => (
                <Badge
                  label={row.jobCardCreatorEnabled ? "Enabled" : "View only"}
                  tone={row.jobCardCreatorEnabled ? "green" : "slate"}
                />
              ),
            ],
            [
              "Action",
              (row) =>
                canAssignCreator ? (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      runMutation(
                        {
                          showToast: toast,
                          successMessage: row.jobCardCreatorEnabled
                            ? "Job Card creator access removed."
                            : "Job Card creator access enabled.",
                        },
                        () =>
                          setJobCardCreatorAccess({
                            enabled: !row.jobCardCreatorEnabled,
                            staffId: row.id,
                          })
                      )
                    }
                    type="button"
                  >
                    {row.jobCardCreatorEnabled ? "Disable" : "Enable"}
                  </button>
                ) : (
                  <span className="font-semibold text-brand-muted text-xs">Managed by head</span>
                ),
            ],
          ]}
          compact
          empty="No Accounts staff found."
        />
      </Panel>
      <Panel title="Payment terms reference">
        <DataTable
          columns={[
            ["Type", (row) => strong(row.type)],
            ["Advance", (row) => row.advance],
            ["Balance", (row) => row.balance],
            ["Notification", (row) => row.notify],
          ]}
          compact
          empty="No payment terms configured."
          rows={[
            {
              advance: "70-90%",
              balance: "10-30%",
              id: "mice",
              notify: "Sales, Contracting, Operations, Finance",
              type: "MICE / MICE Bidding",
            },
            {
              advance: "70-90%",
              balance: "10-30%",
              id: "cement",
              notify: "Sales, Contracting, Operations, Finance",
              type: "Cement",
            },
            {
              advance: "70-100%",
              balance: "0-30%",
              id: "cement-bid",
              notify: "Sales, Contracting, Operations, Finance",
              type: "Cement Bidding",
            },
            {
              advance: "90-100%",
              balance: "0-10%",
              id: "fit",
              notify: "Sales, Contracting, Operations, Finance",
              type: "FIT / Family Group",
            },
            {
              advance: "80-100%",
              balance: "0-20%",
              id: "b2b",
              notify: "Sales, Contracting, Finance",
              type: "B2B",
            },
            {
              advance: "Per plan",
              balance: "-",
              id: "spiritual",
              notify: "Sales, Operations, Finance",
              type: "Spiritual",
            },
          ]}
        />
      </Panel>
      <DataTable
        columns={[
          ["Query", (row) => row.queryCode],
          ["Client", (row) => strong(row.clientName)],
          [
            "Confirmed",
            (row) => (
              <span className="text-brand-muted text-xs">{formatDate(row.confirmedAt)}</span>
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
                  <div className="mt-1 text-brand-muted text-xs">
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
                  <span className="font-semibold text-brand-muted text-xs">
                    Linked to {linkedJob.jobCode}
                  </span>
                );
              }
              if (!canCreateJobCards) {
                return <Badge label="View only" tone="slate" />;
              }
              return (
                <button
                  className="portal-small-btn"
                  onClick={() =>
                    openModal("jobCard", {
                      clientName: row.clientName,
                      confirmedPax: String(row.paxCount),
                      destination: row.destination,
                      queryId: row.id,
                      travelEndDate: row.travelEndDate,
                      travelStartDate: row.travelStartDate,
                    })
                  }
                  type="button"
                >
                  Open JC
                </button>
              );
            },
          ],
        ]}
        empty="No confirmed orders waiting for Job Card creation."
        rows={confirmed}
      />
    </div>
  );
}

function JobCardTravelBatchesCell({ job, openModal, canManage }) {
  const batches = job.travelBatches || [];
  return (
    <div className="min-w-[220px] space-y-1.5 text-xs">
      {batches.length === 0 ? (
        <span className="text-brand-muted">No batches</span>
      ) : (
        batches.map((batch) => (
          <div
            className="space-y-0.5 border-brand-border/60 border-b pb-1.5 last:border-0 last:pb-0"
            key={batch.id}
          >
            <div className="font-medium text-brand-dark">{batch.batchReference}</div>
            <div className="text-brand-muted">
              {batch.destination || "—"} · {batch.confirmedPax} pax · {batch.roomCount || 0} rooms
            </div>
            <div className="text-brand-muted">
              {batch.travelStartDate ? formatDisplayDate(batch.travelStartDate) : "—"}
              {batch.travelEndDate ? ` – ${formatDisplayDate(batch.travelEndDate)}` : ""}
            </div>
            <div className="text-brand-muted" title={formatTravelBatchOwnerSummary(batch)}>
              {formatTravelBatchOwnerSummary(batch)}
              {batch.tourManagerName ? ` · TM ${batch.tourManagerName}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge label={batch.status} tone={statusTone(batch.status)} />
              {canManage ? (
                <button
                  className="portal-small-btn"
                  onClick={() =>
                    openModal(TRAVEL_BATCH_MODAL, buildTravelBatchModalInitial({ batch, job }))
                  }
                  type="button"
                >
                  Edit
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
      {canManage ? (
        <button
          className="portal-small-btn mt-1"
          onClick={() => openModal(TRAVEL_BATCH_MODAL, buildTravelBatchModalInitial({ job }))}
          type="button"
        >
          + Batch
        </button>
      ) : null}
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
  const canManage = has(P.MANAGE_JOB_CARDS);
  const canManageTravelBatches = canManage || has(P.MANAGE_OPERATIONS);

  return (
    <SelectableDataTable
      columns={[
        ["Job code", (row) => strong(row.jobCode)],
        ["Client", (row) => row.clientName],
        ["Destination", (row) => row.destination || "-"],
        ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
        [
          "Owners",
          (row) => (
            <span
              className="text-brand-muted text-xs"
              title={`Contracting: ${row.contractingOwnerName || "Unassigned"} · Ops: ${row.operationsOwnerName || "Unassigned"} · Ticketing: ${row.ticketingOwnerName || "Unassigned"}`}
            >
              {row.contractingOwnerName || row.operationsOwnerName || row.ticketingOwnerName
                ? [row.contractingOwnerName, row.operationsOwnerName, row.ticketingOwnerName]
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(" · ")
                : "Unassigned"}
            </span>
          ),
        ],
        [
          "Travel Batches",
          (row) => (
            <JobCardTravelBatchesCell
              canManage={canManageTravelBatches}
              job={row}
              openModal={openModal}
            />
          ),
        ],
        [
          "Opened",
          (row) => <span className="text-brand-muted text-xs">{formatDate(row.createdAt)}</span>,
        ],
        [
          "Last Edit",
          (row) =>
            row.lastEditedByName
              ? `${row.lastEditedByName} · ${formatDate(row.lastEditedAt)}`
              : "-",
        ],
        [
          "Actions",
          (row) => (
            <JobCardRowActions
              deleteItem={deleteItem}
              has={has}
              job={row}
              openModal={openModal}
              removeJobCard={removeJobCard}
              updateJobStatus={updateJobStatus}
              visibility={{
                assignContracting: showAssignContracting,
                assignOps: showAssignOps,
                assignTicketing: showAssignTicketing,
                canManage,
                canManageTravelBatches,
              }}
            />
          ),
        ],
      ]}
      compact
      empty="No Job Cards yet."
      mobileCardRender={(job) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-brand-dark">{job.jobCode}</div>
              <div className="text-brand-muted text-sm">{job.clientName}</div>
            </div>
            <Badge label={job.status} tone={statusTone(job.status)} />
          </div>
          <div className="text-brand-muted text-xs">
            {job.destination || "Destination pending"} · Opened {formatDate(job.createdAt)}
          </div>
          <JobCardTravelBatchesCell
            canManage={canManageTravelBatches}
            job={job}
            openModal={openModal}
          />
          <Link className="portal-small-btn inline-flex" href={`/portal/job-cards/${job.id}`}>
            Open
          </Link>
        </div>
      )}
    />
  );
}

function JobCardRowActions({
  job,
  openModal,
  has,
  visibility,
  updateJobStatus,
  deleteItem,
  removeJobCard,
}) {
  const [open, setOpen] = useState(false);
  const { canManage, canManageTravelBatches, assignContracting, assignOps, assignTicketing } =
    visibility;
  const overflowActions = [
    assignContracting ? (
      <button
        className="portal-small-btn w-full"
        key="assign-contracting"
        onClick={() => openModal("assignContractingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Contracting
      </button>
    ) : null,
    assignOps ? (
      <button
        className="portal-small-btn w-full"
        key="assign-ops"
        onClick={() => openModal("assignOperationsOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ops
      </button>
    ) : null,
    assignTicketing ? (
      <button
        className="portal-small-btn w-full"
        key="assign-ticketing"
        onClick={() => openModal("assignTicketingOwner", { jobCardId: job.id })}
        type="button"
      >
        Assign Ticketing
      </button>
    ) : null,
    canManageTravelBatches ? (
      <button
        className="portal-small-btn w-full"
        key="add-batch"
        onClick={() => openModal(TRAVEL_BATCH_MODAL, buildTravelBatchModalInitial({ job }))}
        type="button"
      >
        Add Travel Batch
      </button>
    ) : null,
    canManage ? (
      <EditButton
        key="edit"
        onClick={() =>
          openModal("jobCard", {
            clientName: job.clientName,
            confirmedPax: String(job.confirmedPax),
            destination: job.destination,
            entityId: job.id,
            proposalId: job.proposalId || "",
            queryId: job.queryId || "",
            roomCount: String(job.roomCount || ""),
            tourManagerName: job.tourManagerName,
            travelEndDate: job.travelEndDate,
            travelStartDate: job.travelStartDate,
          })
        }
      />
    ) : null,
    canManage ? (
      <button
        className="portal-small-btn w-full"
        key="share"
        onClick={() => openModal("addJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Share
      </button>
    ) : null,
    canManage && (job.collaboratorStaffIds ?? []).length > 0 ? (
      <button
        className="portal-small-btn w-full"
        key="unshare"
        onClick={() => openModal("removeJobCardCollaborator", { jobCardId: job.id })}
        type="button"
      >
        Unshare
      </button>
    ) : null,
    canManage ? (
      <button
        className="portal-small-btn w-full"
        key="advance"
        onClick={() =>
          updateJobStatus({
            jobCardId: job.id,
            status: job.status === "Open" ? "In Operations" : "Ready for Departure",
          })
        }
        type="button"
      >
        Advance Status
      </button>
    ) : null,
    canManage ? (
      <DeleteButton
        key="delete"
        label={job.jobCode}
        onClick={() =>
          deleteItem(
            job.jobCode,
            removeJobCard,
            { jobCardId: job.id },
            {
              confirmMessage: `Delete ${job.jobCode}? This will also delete linked travellers, passport records, visa records, flight groups and segments, PNRs, tickets, seats, hotels, rooming entries, tour manager assignments, vendors, itineraries, event flows, checklist tasks, invoices, additional services, expenses, proof attachments, approvals, and notifications. This cannot be undone.`,
            }
          )
        }
      />
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-2">
      <Link className="portal-small-btn" href={`/portal/job-cards/${job.id}`}>
        Open
      </Link>
      {overflowActions.length > 0 ? (
        <div className="relative">
          <button
            aria-expanded={open}
            aria-label="More job card actions"
            className="portal-small-btn inline-flex items-center gap-1"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <MoreHorizontal size={14} />
          </button>
          {open ? (
            <>
              <button
                aria-label="Close actions menu"
                className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                onClick={() => setOpen(false)}
                type="button"
              />
              <div
                className={`absolute right-0 ${PORTAL_Z.dropdown} z-10 mt-2 min-w-[180px] rounded-xl border border-brand-border bg-white p-2 shadow-lg`}
              >
                <div className="flex flex-col gap-2">{overflowActions}</div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TravellersView({
  rows,
  countRows,
  jobCards,
  jobCardFilter,
  setJobCardFilter,
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
    <div className="space-y-4">
      <TravellerCountView
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        rows={countRows}
        setJobCardFilter={setJobCardFilter}
      />
      <SelectableDataTable
        columns={[
          ["Name", (row) => strong(row.fullName)],
          ["Surname", (row) => row.surname || "-"],
          ["Given Name", (row) => row.givenName || "-"],
          ["Job", (row) => row.jobCode],
          ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
          ["Hub", (row) => row.travelHub || "-"],
          ["Gender", (row) => row.gender || "-"],
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
          [
            "Ticket",
            (row) => <Badge label={row.ticketStatus} tone={statusTone(row.ticketStatus)} />,
          ],
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
                        arrivingEarly: row.arrivingEarly ? "Yes" : "No",
                        biometricAppointmentDate: row.biometricAppointmentDate,
                        domesticTravelRequired: row.domesticTravelRequired ? "Yes" : "No",
                        entityId: row.id,
                        extensionOfTour: row.extensionOfTour ? "Yes" : "No",
                        foodPreference: row.foodPreference,
                        fullName: row.fullName,
                        gender: row.gender || "",
                        givenName: row.givenName || "",
                        guestCompanions: row.guestCompanions,
                        guestType: row.guestType,
                        hotelAllocation: row.hotelAllocation,
                        jobCardId: row.jobCardId,
                        notes: row.specialRequests || "",
                        passportStatus: row.passportStatus,
                        paymentType: row.paymentType,
                        roomType: row.roomType,
                        surname: row.surname || "",
                        travelBatchId: row.travelBatchId || "",
                        travelDate: row.travelDate,
                        travelHub: row.travelHub,
                        visaRequired: row.visaRequired ? "Yes" : "No",
                      })
                    }
                  />
                  <DeleteButton
                    label={row.fullName}
                    onClick={() =>
                      deleteItem(row.fullName, removeTraveller, { travellerId: row.id })
                    }
                  />
                </div>
              ),
          ],
        ]}
        empty="No travellers yet."
        entityLabel="traveller"
        filtersActive={filtersActive}
        mobileCardRender={(row) => {
          const expiry = getPassportExpiryInfo({
            expiryDate: row.passportExpiryDate,
            travelDate: row.travelStartDate || row.travelDate,
          });
          return (
            <div className="space-y-1">
              <div className="font-semibold text-brand-dark">{row.fullName}</div>
              <div className="text-brand-muted text-xs">
                {row.jobCode} · {row.travelHub || "No hub"} · {travelBatchDisplayLabel(row)}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge label={row.visaStatus} tone={statusTone(row.visaStatus)} />
                <Badge
                  label={formatPassportExpiryLabel(expiry)}
                  tone={passportExpiryTone(expiry)}
                />
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
        rowLabel={(row) => row.fullName}
        rows={rows}
        selectable={canManage}
      />
    </div>
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
      columns={[
        ["Traveller", (row) => strong(row.travellerName)],
        ["Job", (row) => row.jobCode],
        ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
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
                  className="portal-small-btn"
                  onClick={() =>
                    openModal("visa", {
                      appointmentDate: row.appointmentDate,
                      entityId: row.id,
                      notes: row.notes,
                      visaRecordId: row.id,
                      visaStatus: row.status,
                    })
                  }
                  type="button"
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
      empty="No visa records yet."
      entityLabel="visa record"
      filtersActive={filtersActive}
      mobileCardRender={(row) => (
        <div className="space-y-1">
          <div className="font-semibold text-brand-dark">{row.travellerName}</div>
          <div className="text-brand-muted text-xs">
            {row.jobCode} · {row.travelHub || "No hub"} · {travelBatchDisplayLabel(row)}
          </div>
          <Badge label={row.status} tone={statusTone(row.status)} />
        </div>
      )}
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "visa record", removeManyVisas, () => ({
                visaRecordIds: ids,
              }))
          : undefined
      }
      rowLabel={(row) => row.travellerName}
      rows={rows}
      selectable={canManage}
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
  if (!uploadTraveller) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 ${PORTAL_Z.nestedModal} grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm`}
    >
      <form
        className="w-full max-w-lg space-y-4 rounded-2xl border border-brand-border bg-white p-6 shadow-2xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between border-brand-border border-b pb-3">
          <h3 className="font-heading font-semibold text-citius-blue text-lg">
            Upload & Encrypt Passport: {uploadTraveller.fullName}
          </h3>
          <button
            className="text-brand-muted hover:text-brand-dark"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {uploadError && (
          <div className="rounded-md border border-red-100 bg-red-50 p-3 text-red-600 text-sm">
            {uploadError}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label
              className="mb-1 block font-medium text-brand-dark text-xs"
              htmlFor="passport-file-input"
            >
              Passport Scan File (PDF, JPEG, PNG, WebP , max 15 MB) *
            </label>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
              className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
              id="passport-file-input"
              required
              type="file"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block font-medium text-brand-dark text-xs"
                htmlFor="passport-number"
              >
                Passport Number
              </label>
              <input
                className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
                id="passport-number"
                onChange={(e) => setPassportForm({ ...passportForm, number: e.target.value })}
                placeholder="e.g. Z1234567"
                type="text"
                value={passportForm.number}
              />
            </div>
            <div>
              <label
                className="mb-1 block font-medium text-brand-dark text-xs"
                htmlFor="passport-expiry"
              >
                Expiry Date
              </label>
              <PortalDateInput
                className="w-full"
                id="passport-expiry"
                inputClassName="!h-9 !rounded-md !text-sm"
                onChange={(iso) => setPassportForm({ ...passportForm, expiryDate: iso })}
                value={passportForm.expiryDate}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                className="mb-1 block font-medium text-brand-dark text-xs"
                htmlFor="passport-nationality"
              >
                Nationality
              </label>
              <input
                className="w-full rounded-md border border-brand-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-citius-blue"
                id="passport-nationality"
                onChange={(e) => setPassportForm({ ...passportForm, nationality: e.target.value })}
                placeholder="e.g. Indian"
                type="text"
                value={passportForm.nationality}
              />
            </div>
            <div>
              <label
                className="mb-1 block font-medium text-brand-dark text-xs"
                htmlFor="passport-dob"
              >
                Date of Birth
              </label>
              <PortalDateInput
                className="w-full"
                id="passport-dob"
                inputClassName="!h-9 !rounded-md !text-sm"
                onChange={(iso) => setPassportForm({ ...passportForm, dateOfBirth: iso })}
                value={passportForm.dateOfBirth}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-brand-border border-t pt-4">
          <button
            className="portal-small-btn border-brand-border text-brand-dark"
            disabled={isUploading}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-small-btn flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
            disabled={isUploading}
            type="submit"
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
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
  filtersActive = false,
}) {
  const toast = usePortalToast();
  const { confirm } = usePortalConfirm();
  const [passportState, patchPassportState] = usePatchReducer({
    isUploading: false,
    passportForm: {
      dateOfBirth: "",
      expiryDate: "",
      nationality: "",
      number: "",
    },
    uploadError: "",
    uploadTraveller: null,
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
    if (!uploadTraveller) {
      return;
    }
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
        body: file,
        headers: { "Content-Type": mimeType },
        method: "POST",
      });
      if (!uploadRes.ok) {
        setUploadError("Failed to upload file to storage server.");
        setIsUploading(false);
        return;
      }
      const { storageId } = await uploadRes.json();

      await encryptAndStorePassport({
        dateOfBirth: passportForm.dateOfBirth || undefined,
        expiryDate: passportForm.expiryDate || undefined,
        fileName: file.name,
        fileSize: file.size,
        mimeType,
        nationality: passportForm.nationality || undefined,
        number: passportForm.number || undefined,
        tempStorageId: storageId,
        travellerId: uploadTraveller.id,
      });

      setUploadTraveller(null);
      setPassportForm({ dateOfBirth: "", expiryDate: "", nationality: "", number: "" });
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
      confirmLabel: "Delete",
      danger: true,
      message: `Delete passport scan for ${travellerName}? This cannot be undone.`,
      title: "Delete passport scan",
    });
    if (!ok) {
      return;
    }
    try {
      await runMutation({ showToast: toast, successMessage: "Passport scan deleted." }, () =>
        removePassport({ travellerId })
      );
    } catch {
      // runMutation surfaces toast
    }
  };

  return (
    <div className="space-y-6">
      <SelectableDataTable
        columns={[
          ["Traveller", (row) => strong(row.fullName)],
          ["Job Code", (row) => row.jobCode],
          ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
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
                      className="portal-small-btn inline-flex items-center gap-1 bg-citius-blue text-white hover:bg-citius-blue/90"
                      disabled={viewingTravellerId !== null}
                      onClick={() => handleView(row.id)}
                      type="button"
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
                        className="portal-small-btn border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDeletePassport(row.fullName, row.id)}
                        type="button"
                      >
                        Delete Document
                      </button>
                    )}
                  </>
                ) : (
                  has(P.MANAGE_VISA) && (
                    <button
                      className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                      onClick={() => setUploadTraveller(row)}
                      type="button"
                    >
                      {row.passportStatus === "Received" ? "Upload Scan" : "Upload Passport Scan"}
                    </button>
                  )
                )}
                {has(P.MANAGE_TRAVELLERS) && (
                  <DeleteButton
                    label={row.fullName}
                    onClick={() =>
                      deleteItem(row.fullName, removeTraveller, { travellerId: row.id })
                    }
                  />
                )}
              </div>
            ),
          ],
        ]}
        empty="No travellers on record."
        entityLabel="traveller"
        filtersActive={filtersActive}
        mobileCardRender={(row) => (
          <div className="space-y-1">
            <div className="font-semibold text-brand-dark">{row.fullName}</div>
            <div className="text-brand-muted text-xs">
              {row.jobCode} · {row.clientName || "No client"} · {travelBatchDisplayLabel(row)}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge
                label={row.passportStatus || "Pending"}
                tone={row.passportStatus === "Received" ? "green" : "orange"}
              />
              {row.hasPassportScan ? <Badge label="Scan uploaded" tone="green" /> : null}
            </div>
          </div>
        )}
        onBulkDelete={
          has(P.MANAGE_TRAVELLERS)
            ? (ids) =>
                deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
                  travellerIds: ids,
                }))
            : undefined
        }
        rowLabel={(row) => row.fullName}
        rows={travellers}
        selectable={has(P.MANAGE_TRAVELLERS)}
      />

      <PassportUploadModal
        isUploading={isUploading}
        onClose={() => setUploadTraveller(null)}
        onSubmit={handleUpload}
        passportForm={passportForm}
        setPassportForm={setPassportForm}
        uploadError={uploadError}
        uploadTraveller={uploadTraveller}
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
  if (!summary) {
    return <LoadingPanel />;
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard Icon={Ticket} label="Issued" value={summary.issued} />
        <StatCard Icon={Plane} label="Pending" value={summary.pending} />
        <StatCard Icon={RefreshCw} label="Attention" value={summary.attention} />
        <StatCard Icon={Ticket} label="FIT Tickets" value={summary.fitTickets ?? 0} />
        <StatCard Icon={Users} label="Group Tickets" value={summary.groupTickets ?? 0} />
        <StatCard Icon={FileText} label="PNRs" value={summary.pnrCount} />
        <StatCard
          Icon={Users}
          label="Issued Seats"
          value={`${summary.issuedSeats}/${summary.totalSeats}`}
        />
      </div>
      <TicketsView
        deleteItem={deleteItem}
        deleteSelected={deleteSelected}
        has={has}
        openModal={openModal}
        removeManyTickets={removeManyTickets}
        removeTicket={removeTicket}
        rows={tickets.slice(0, 8)}
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
          columns={[
            [
              "PNR",
              (row) => (
                <span className="font-bold font-mono text-citius-blue tracking-[0.14em]">
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
                          airline: row.airline,
                          entityId: row.id,
                          fareType: row.fareType,
                          jobCardId: row.jobCardId,
                          pnrCode: row.pnrCode,
                          route: row.route,
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
          empty="No PNRs yet."
          entityLabel="PNR"
          onBulkDelete={
            canManage
              ? (ids) =>
                  deleteSelected(ids.length, "PNR", removeManyPnrs, () => ({
                    pnrIds: ids,
                  }))
              : undefined
          }
          rows={rows}
          selectable={canManage}
        />
      </Panel>
    </div>
  );
}

function FlightItineraryList({ rows }) {
  if (!rows) {
    return <LoadingPanel />;
  }
  if (rows.length === 0) {
    return <EmptyState label="No flight itinerary imported yet." />;
  }
  return (
    <div className="space-y-4">
      {rows.map((group) => (
        <div className="rounded-lg border border-brand-border bg-brand-light/30" key={group.id}>
          <div className="flex flex-col gap-1 border-brand-border border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-citius-blue">{group.name}</div>
              <div className="text-brand-muted text-xs">
                {group.jobCode} - {group.clientName}
              </div>
            </div>
            <div className="font-medium text-brand-dark text-sm">{group.route}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="text-left font-semibold text-citius-blue/80 text-xs">
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
                  <tr className="border-brand-border border-t text-sm" key={segment.id}>
                    <td className="px-4 py-2">{segment.dateLabel}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium">{segment.airline}</span>
                      <span className="ml-2 font-mono text-brand-muted text-xs">
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
      columns={[
        ["Ticket", (row) => row.ticketNumber || "-"],
        ["Traveller", (row) => strong(row.travellerName || "Unassigned")],
        ["Job", (row) => row.jobCode],
        ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
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
                      cabinClass: row.cabinClass,
                      entityId: row.id,
                      foodPreference: row.mealPreference,
                      jobCardId: row.jobCardId,
                      paymentType: row.paymentType,
                      pnrId: row.pnrId || "",
                      seatNumber: row.seatNumber,
                      seatPreference: row.seatPreference,
                      ticketNumber: row.ticketNumber,
                      ticketStatus: row.ticketStatus,
                      ticketType: row.ticketType,
                      travellerId: row.travellerId || "",
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
      empty="No tickets yet."
      entityLabel="ticket"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "ticket", removeManyTickets, () => ({
                ticketIds: ids,
              }))
          : undefined
      }
      rows={rows}
      selectable={canManage}
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
      columns={[
        ["Seat", (row) => <span className="font-bold font-mono">{row.seatNumber}</span>],
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
                      notes: row.notes,
                      pnrId: row.pnrId || "",
                      seatNumber: row.seatNumber,
                      seatStatus: row.status,
                      travellerId: row.travellerId || "",
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
      empty="No stored seat allocations yet."
      entityLabel="seat"
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "seat", removeManySeatAllocations, () => ({
                seatAllocationIds: ids,
              }))
          : undefined
      }
      rows={rows}
      selectable={canManage}
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
                      checkInDate: row.checkInDate,
                      checkOutDate: row.checkOutDate,
                      city: row.city,
                      entityId: row.id,
                      hotelName: row.name,
                      jobCardId: row.jobCardId,
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
      empty="No hotel records yet. Add a hotel property or use Import Rooming for passenger assignments below."
      entityLabel="hotel"
      filtersActive={filtersActive}
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "hotel", removeManyHotels, () => ({
                hotelIds: ids,
              }))
          : undefined
      }
      rows={rows}
      selectable={canManage}
    />
  );
}

function estimateRoomCount(roomType, assignments) {
  const capacity = ROOM_TYPE_CAPACITY[roomType] ?? 1;
  return Math.ceil(assignments / capacity);
}

function buildRoomTypeCountRows(rows) {
  const counts = new Map();
  for (const row of rows || []) {
    const roomType = row.roomType || "Unassigned";
    counts.set(roomType, (counts.get(roomType) ?? 0) + 1);
  }
  const extraTypes = [];
  for (const roomType of counts.keys()) {
    if (!ROOM_TYPE_SET.has(roomType)) {
      extraTypes.push(roomType);
    }
  }
  extraTypes.sort((a, b) => a.localeCompare(b));
  const orderedTypes = [...ROOM_TYPES, ...extraTypes];
  const roomTypeRows = [];
  for (const roomType of orderedTypes) {
    if (!counts.has(roomType)) {
      continue;
    }
    const assignments = counts.get(roomType) ?? 0;
    roomTypeRows.push({
      assignments,
      estimatedRooms: estimateRoomCount(roomType, assignments),
      id: roomType,
      roomType,
    });
  }
  return roomTypeRows;
}

function buildJobRoomCountRows(rows, jobCards) {
  const jobsById = new Map((jobCards || []).map((job) => [job.id, job]));
  const groups = new Map();
  for (const row of rows || []) {
    const id = row.jobCardId || "unassigned";
    const current = groups.get(id) || {
      clientName: row.clientName || jobsById.get(row.jobCardId)?.clientName || "-",
      id,
      jobCode: row.jobCode || jobsById.get(row.jobCardId)?.jobCode || "Unassigned",
      rows: [],
    };
    current.rows.push(row);
    groups.set(id, current);
  }
  return Array.from(groups.values())
    .map((group) => {
      const roomTypes = buildRoomTypeCountRows(group.rows);
      return {
        ...group,
        assignments: group.rows.length,
        estimatedRooms: roomTypes.reduce((sum, row) => sum + row.estimatedRooms, 0),
        roomBreakdown: roomTypes.map((row) => `${row.roomType}: ${row.assignments}`).join(", "),
      };
    })
    .sort((a, b) => a.jobCode.localeCompare(b.jobCode));
}

function JobCardFilterPanel({ jobCards, jobCardFilter, setJobCardFilter, ariaLabel, children }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-light/50 p-3 sm:flex-row sm:items-end sm:justify-between">
      <label className="relative block min-w-0 sm:w-72">
        <span className="mb-1 block font-semibold text-citius-blue text-xs">Job Card</span>
        <select
          aria-label={ariaLabel}
          className="portal-toolbar-control portal-period-select h-11 w-full appearance-none rounded-lg border border-brand-border bg-white px-3 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
          onChange={(event) => setJobCardFilter(event.target.value)}
          value={jobCardFilter}
        >
          {jobCardFilterOptions(jobCards).map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 bottom-3 text-brand-muted/60"
          size={16}
        />
      </label>
      {children}
    </div>
  );
}

function RoomCountView({ rows, jobCards, jobCardFilter, setJobCardFilter }) {
  const selectedRows = jobCardFilter
    ? (rows || []).filter((row) => row.jobCardId === jobCardFilter)
    : rows || [];
  const selectedJob = (jobCards || []).find((job) => job.id === jobCardFilter);
  const roomTypeRows = buildRoomTypeCountRows(selectedRows);
  const totalAssignments = selectedRows.length;
  const totalEstimatedRooms = roomTypeRows.reduce((sum, row) => sum + row.estimatedRooms, 0);
  const jobBreakdownRows = jobCardFilter ? [] : buildJobRoomCountRows(rows || [], jobCards);

  return (
    <Panel subtitle="Filter by Job Card and review rooming counts by room type." title="Room Count">
      <JobCardFilterPanel
        ariaLabel="Filter room count by job card"
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        setJobCardFilter={setJobCardFilter}
      >
        <div className="grid grid-cols-2 gap-2 sm:min-w-64">
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Rooming rows</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {totalAssignments}
            </p>
          </div>
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Est. rooms</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {totalEstimatedRooms}
            </p>
          </div>
        </div>
      </JobCardFilterPanel>

      {selectedJob ? (
        <div className="mb-3 text-brand-muted text-sm">
          Showing room count for <strong className="text-brand-dark">{selectedJob.jobCode}</strong>
          {selectedJob.clientName ? ` · ${selectedJob.clientName}` : ""}
        </div>
      ) : null}

      <DataTable
        columns={[
          ["Room Type", (row) => <Badge label={row.roomType} tone="blue" />],
          ["Rooming Rows", (row) => row.assignments],
          ["Estimated Rooms", (row) => row.estimatedRooms],
        ]}
        compact
        empty="No rooming rows found for this job card."
        rows={roomTypeRows}
      />

      {!jobCardFilter && jobBreakdownRows.length > 0 ? (
        <div className="mt-5">
          <DashboardSectionHeading
            detail="Counts are grouped from rooming assignments."
            title="Job Card Breakdown"
          />
          <div className="mt-3">
            <DataTable
              columns={[
                ["Job", (row) => strong(row.jobCode)],
                ["Client", (row) => row.clientName],
                ["Rooming Rows", (row) => row.assignments],
                ["Est. Rooms", (row) => row.estimatedRooms],
                ["Room Types", (row) => row.roomBreakdown || "-"],
              ]}
              compact
              empty="No job card room counts yet."
              rows={jobBreakdownRows}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function buildJobTravellerCountRows(rows, jobCards) {
  const jobsById = new Map((jobCards || []).map((job) => [job.id, job]));
  const groups = new Map();
  for (const row of rows || []) {
    const id = row.jobCardId || "unassigned";
    const current = groups.get(id) || {
      clientName: row.clientName || jobsById.get(row.jobCardId)?.clientName || "-",
      id,
      jobCode: row.jobCode || jobsById.get(row.jobCardId)?.jobCode || "Unassigned",
      rows: [],
    };
    current.rows.push(row);
    groups.set(id, current);
  }
  return Array.from(groups.values())
    .map((group) => {
      const summary = buildTravellerCountSummary(group.rows);
      const foodParts = [];
      for (const row of summary.foodRows) {
        if (row.value > 0) {
          foodParts.push(`${row.label}: ${row.value}`);
        }
      }
      return {
        ...group,
        female: summary.female,
        foodBreakdown: foodParts.join(", ") || "-",
        male: summary.male,
        totalPax: group.rows.length,
      };
    })
    .sort((a, b) => a.jobCode.localeCompare(b.jobCode));
}

function TravellerCountView({ rows, jobCards, jobCardFilter, setJobCardFilter }) {
  const selectedRows = jobCardFilter
    ? (rows || []).filter((row) => row.jobCardId === jobCardFilter)
    : rows || [];
  const selectedJob = (jobCards || []).find((job) => job.id === jobCardFilter);
  const summary = buildTravellerCountSummary(selectedRows);
  const foodRows = summary.foodRows.map((row) => ({
    count: row.value,
    foodPreference: row.label,
    id: row.label,
  }));
  const jobBreakdownRows = jobCardFilter ? [] : buildJobTravellerCountRows(rows || [], jobCards);

  return (
    <Panel
      subtitle="Filter by Job Card and review gender and food preference counts."
      title="Passenger Count"
    >
      <JobCardFilterPanel
        ariaLabel="Filter passenger count by job card"
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        setJobCardFilter={setJobCardFilter}
      >
        <div className="grid grid-cols-2 gap-2 sm:min-w-64">
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Male</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {summary.male}
            </p>
          </div>
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2">
            <p className="font-semibold text-brand-muted text-xs">Female</p>
            <p className="font-heading font-semibold text-brand-dark text-xl tabular-nums">
              {summary.female}
            </p>
          </div>
        </div>
      </JobCardFilterPanel>

      {selectedJob ? (
        <div className="mb-3 text-brand-muted text-sm">
          Showing passenger count for{" "}
          <strong className="text-brand-dark">{selectedJob.jobCode}</strong>
          {selectedJob.clientName ? ` · ${selectedJob.clientName}` : ""}
        </div>
      ) : null}

      <DataTable
        columns={[
          ["Food Preference", (row) => <Badge label={row.foodPreference} tone="green" />],
          ["Count", (row) => row.count],
        ]}
        compact
        empty="No traveller rows found for this job card."
        rows={foodRows}
      />

      {!jobCardFilter && jobBreakdownRows.length > 0 ? (
        <div className="mt-5">
          <DashboardSectionHeading
            detail="Counts are grouped from traveller master rows."
            title="Job Card Breakdown"
          />
          <div className="mt-3">
            <DataTable
              columns={[
                ["Job", (row) => strong(row.jobCode)],
                ["Client", (row) => row.clientName],
                ["Total Pax", (row) => row.totalPax],
                ["Male", (row) => row.male],
                ["Female", (row) => row.female],
                ["Food", (row) => row.foodBreakdown],
              ]}
              compact
              empty="No job card passenger counts yet."
              rows={jobBreakdownRows}
            />
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function HotelRoomingTabs({
  hotels,
  roomingRows,
  roomCountRows,
  filtersActive,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeHotel,
  removeManyHotels,
  removeTraveller,
  removeManyTravellers,
  jobCards,
  jobCardFilter,
  setJobCardFilter,
}) {
  const [tab, setTab] = useState("room-count");

  return (
    <section className="space-y-4">
      <div
        aria-label="Hotel and rooming tabs"
        className="flex w-fit rounded-lg border border-brand-border bg-white p-1"
        role="tablist"
      >
        {HOTEL_ROOMING_TABS.map((item) => (
          <button
            aria-selected={tab === item.id}
            className={`rounded-md px-3 py-1.5 font-semibold text-xs transition ${
              tab === item.id
                ? "bg-citius-blue text-white shadow-sm"
                : "text-brand-muted hover:text-brand-dark"
            }`}
            key={item.id}
            onClick={() => setTab(item.id)}
            role="tab"
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "hotels" ? (
        <Panel
          subtitle="Manual hotel records for ground planning and check-in/out dates."
          title="Hotel Properties"
        >
          <HotelsView
            deleteItem={deleteItem}
            deleteSelected={deleteSelected}
            filtersActive={filtersActive}
            has={has}
            openModal={openModal}
            removeHotel={removeHotel}
            removeManyHotels={removeManyHotels}
            rows={hotels}
          />
        </Panel>
      ) : null}

      {tab === "rooming" ? (
        <Panel
          subtitle="Passenger room types and allocations from traveller master or rooming import."
          title="Rooming Assignments"
        >
          <JobCardFilterPanel
            ariaLabel="Filter rooming by job card"
            jobCardFilter={jobCardFilter}
            jobCards={jobCards}
            setJobCardFilter={setJobCardFilter}
          />
          <RoomingListView
            deleteItem={deleteItem}
            deleteSelected={deleteSelected}
            filtersActive={filtersActive}
            has={has}
            removeManyTravellers={removeManyTravellers}
            removeTraveller={removeTraveller}
            rows={roomingRows}
          />
        </Panel>
      ) : null}

      {tab === "room-count" ? (
        <RoomCountView
          jobCardFilter={jobCardFilter}
          jobCards={jobCards}
          rows={roomCountRows}
          setJobCardFilter={setJobCardFilter}
        />
      ) : null}
    </section>
  );
}

function RoomingListView({
  rows,
  filtersActive = false,
  has,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
}) {
  const canManage = has?.(P.MANAGE_TRAVELLERS);
  return (
    <SelectableDataTable
      columns={[
        ["Name", (row) => strong(row.fullName)],
        ["Job", (row) => row.jobCode],
        ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
        ["Hub", (row) => row.travelHub || "-"],
        ["Room Type", (row) => <Badge label={row.roomType || "-"} tone="blue" />],
        ["Hotel Allocation", (row) => row.hotelAllocation || "-"],
        ["Food", (row) => <Badge label={row.foodPreference} tone="green" />],
        ["Special Requests", (row) => row.specialRequests || "-"],
        [
          "Action",
          (row) =>
            canManage && (
              <DeleteButton
                label={row.fullName}
                onClick={() => deleteItem(row.fullName, removeTraveller, { travellerId: row.id })}
              />
            ),
        ],
      ]}
      empty="No rooming assignments yet. Import traveller master or rooming spreadsheet for this job card."
      entityLabel="rooming row"
      filtersActive={filtersActive}
      onBulkDelete={
        canManage
          ? (ids) =>
              deleteSelected(ids.length, "rooming row", removeManyTravellers, () => ({
                travellerIds: ids,
              }))
          : undefined
      }
      rowLabel={(row) => row.fullName}
      rows={rows}
      selectable={canManage}
    />
  );
}

function normalizeTravelBatchId(travelBatchId) {
  return travelBatchId || "";
}

function tourManagerAssignmentKey(jobCardId, travelBatchId) {
  return `${jobCardId}:${normalizeTravelBatchId(travelBatchId)}`;
}

function buildTourManagersByJobAndBatch(assignments) {
  const byKey = new Map();
  for (const manager of assignments || []) {
    if (!manager.jobCardId) {
      continue;
    }
    const key = tourManagerAssignmentKey(manager.jobCardId, manager.travelBatchId);
    const current = byKey.get(key) || [];
    current.push(manager.name);
    byKey.set(key, current);
  }
  return byKey;
}

function getAssignedTourManagerNames(row, byKey) {
  if (!row.jobCardId) {
    return "Unassigned";
  }
  const batchNames = byKey.get(tourManagerAssignmentKey(row.jobCardId, row.travelBatchId));
  if (batchNames?.length) {
    return batchNames.join(", ");
  }
  const fallbackNames = byKey.get(tourManagerAssignmentKey(row.jobCardId, ""));
  if (fallbackNames?.length) {
    return fallbackNames.join(", ");
  }
  return "Unassigned";
}

function TourManagersView({
  rows,
  travellers,
  assignments,
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
  const assignedTourManagersByJobAndBatch = buildTourManagersByJobAndBatch(assignments);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard Icon={Users} label="Total Pax" value={travellers.length} />
        <StatCard
          Icon={CheckCircle2}
          label="Onboarded"
          value={
            travellers.filter((row) => row.fullName && row.travelHub && row.foodPreference).length
          }
        />
        <StatCard
          Icon={ShieldCheck}
          label="Docs Pending"
          value={
            travellers.filter(
              (row) =>
                !["Approved", "Not Required"].includes(row.visaStatus) ||
                row.ticketStatus !== "Issued"
            ).length
          }
        />
      </div>
      <SelectableDataTable
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
                        notes: row.notes,
                        paidBy: row.phone,
                        reportingInstructions: row.reportingInstructions || "",
                        staffEmail: row.email,
                        staffId: row.staffId || "",
                        tourManagerName: row.name,
                        travelBatchId: row.travelBatchId || "",
                        travelStartDate: row.availabilityDate,
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
        empty="No Tour Managers yet."
        entityLabel="tour manager"
        onBulkDelete={
          canAssign
            ? (ids) =>
                deleteSelected(ids.length, "tour manager", removeManyTourManagers, () => ({
                  tourManagerIds: ids,
                }))
            : undefined
        }
        rows={rows}
        selectable={canAssign}
      />
      <Panel title="Calling status board">
        <DataTable
          columns={[
            ["Guest", (row) => strong(row.fullName)],
            ["Job", (row) => row.jobCode],
            ["Travel Batch", (row) => travelBatchDisplayLabel(row)],
            [
              "Tour Manager",
              (row) => getAssignedTourManagerNames(row, assignedTourManagersByJobAndBatch),
            ],
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
                        className="portal-small-btn"
                        key={status}
                        onClick={() =>
                          runMutation(
                            {
                              label: "Calling status",
                              showToast: toast,
                              successMessage: `Calling status set to ${status}`,
                            },
                            () =>
                              updateCallingStatus({ callingStatus: status, travellerId: row.id })
                          ).catch(() => {})
                        }
                        type="button"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                ),
            ],
          ]}
          compact
          empty="No travellers to call yet."
          rows={travellers}
        />
      </Panel>
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
              Icon={CircleDollarSign}
              label="Total Revenue"
              value={money(overview.summary.totalRevenue)}
            />
            <StatCard
              Icon={FileText}
              label="Client Outstanding"
              value={money(overview.summary.clientOutstanding)}
            />
            <StatCard
              Icon={ClipboardList}
              label="Approved Expenses"
              value={money(overview.summary.approvedExpenses)}
            />
          </div>
          {overview.fundProjections && (
            <Panel title="Fund projections">
              <m.div
                animate={{ opacity: 1, y: 0 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                initial={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.35 }}
              >
                <StatCard
                  Icon={CircleDollarSign}
                  label="Expected collections"
                  value={money(overview.fundProjections.expectedCollections)}
                />
                <StatCard
                  Icon={ClipboardList}
                  label="Advance pipeline"
                  value={money(overview.fundProjections.advancePipeline)}
                />
                <StatCard
                  Icon={RefreshCw}
                  label="Pending reimbursements"
                  value={money(overview.fundProjections.pendingReimbursements)}
                />
                <StatCard
                  Icon={CheckCircle2}
                  label="Expense approvals due"
                  value={money(overview.fundProjections.pendingExpenseApprovals)}
                />
              </m.div>
            </Panel>
          )}
          <Panel title="Tour-wise P&L">
            <DataTable
              columns={[
                ["JC", (row) => row.jobCode],
                ["Group", (row) => row.clientName],
                ["Revenue", (row) => money(row.revenue)],
                ["Expense", (row) => money(row.expense)],
                ["Profit", (row) => money(row.profit)],
                ["Margin", (row) => `${row.marginPercent}%`],
              ]}
              compact
              empty="No Job Cards available."
              rows={overview.pnl}
            />
          </Panel>
          <Panel title="Outstanding payments">
            <DataTable
              columns={[
                ["Client", (row) => strong(row.clientName)],
                ["JC", (row) => row.jobCode],
                ["Due", (row) => money(row.dueAmount)],
                ["Due Date", (row) => formatDisplayDate(row.dueDate)],
                ["Status", (row) => <Badge label={row.status} tone={statusTone(row.status)} />],
              ]}
              compact
              empty="No outstanding balances."
              rows={overview.outstanding}
            />
          </Panel>
        </>
      )}
      <DataTable
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
                        dueDate: row.dueDate,
                        entityId: row.id,
                        expectedAmount: String(row.expectedAmount),
                        invoiceNumber: row.invoiceNumber,
                        jobCardId: row.jobCardId,
                        receivedAmount: String(row.receivedAmount),
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
        empty="No invoices yet."
        rows={rows}
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
  decideExpenseManager,
  decideExpenseFinance,
  getExpenseAttachmentUrl,
  removeExpenseProof,
}) {
  const toast = usePortalToast();
  return (
    <DataTable
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
                className="portal-small-btn"
                onClick={() =>
                  openQueryAttachment(row.proofAttachment.id, getExpenseAttachmentUrl, "expense")
                }
                type="button"
              >
                {row.proofAttachment.fileName}
              </button>
            ) : (
              "-"
            ),
        ],
        [
          "Approval",
          (row) => (
            <div className="space-y-1">
              <Badge label={row.approvalStatus} tone={statusTone(row.approvalStatus)} />
              <div className="text-brand-muted text-xs">
                Manager: {row.managerReviewStatus || "Pending"}
              </div>
              <div className="text-brand-muted text-xs">
                Finance: {row.financeReviewStatus || "Pending"}
              </div>
            </div>
          ),
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
                        amount: String(row.amount),
                        cardAmount: String(row.cardAmount),
                        cashAmount: String(row.cashAmount),
                        category: row.category,
                        currency: row.currency,
                        entityId: row.id,
                        epayAmount: String(row.epayAmount),
                        expenseDate: row.expenseDate,
                        expenseType: row.jobCardId ? "jobCard" : "office",
                        jobCardId: row.jobCardId || "",
                        notes: row.notes,
                        paidBy: row.paidBy,
                        particulars: row.particulars,
                        tourManagerName: row.tourManagerName,
                      })
                    }
                  />
                )}
                {!row.submittedForApprovalAt && (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      runMutation(
                        {
                          label: "Expense approval",
                          showToast: toast,
                          successMessage: "Expense submitted for approval.",
                        },
                        () => submitExpenseForApproval({ expenseId: row.id })
                      ).catch(() => {})
                    }
                    type="button"
                  >
                    Submit for approval
                  </button>
                )}
                {row.canApproveManager && (
                  <>
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Manager approval",
                            showToast: toast,
                            successMessage: "Expense manager-approved.",
                          },
                          () =>
                            decideExpenseManager({
                              expenseId: row.id,
                              status: "Approved",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Manager approve
                    </button>
                    <button
                      className="portal-danger-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Manager approval",
                            showToast: toast,
                            successMessage: "Expense rejected.",
                          },
                          () =>
                            decideExpenseManager({
                              expenseId: row.id,
                              status: "Rejected",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Manager reject
                    </button>
                  </>
                )}
                {row.canApproveFinance && (
                  <>
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Finance approval",
                            showToast: toast,
                            successMessage: "Expense finance-approved.",
                          },
                          () =>
                            decideExpenseFinance({
                              expenseId: row.id,
                              reimbursementStatus: "Pending",
                              status: "Approved",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Finance approve
                    </button>
                    <button
                      className="portal-danger-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Finance approval",
                            showToast: toast,
                            successMessage: "Expense rejected.",
                          },
                          () =>
                            decideExpenseFinance({
                              expenseId: row.id,
                              reimbursementStatus: "Not Submitted",
                              status: "Rejected",
                            })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Finance reject
                    </button>
                  </>
                )}
                {row.proofAttachment && (
                  <button
                    className="portal-small-btn"
                    onClick={() =>
                      runMutation(
                        {
                          label: "Expense proof",
                          showToast: toast,
                          successMessage: "Expense proof removed.",
                        },
                        () => removeExpenseProof({ attachmentId: row.proofAttachment.id })
                      ).catch(() => {})
                    }
                    type="button"
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
      empty="No expenses yet."
      filtersActive={filtersActive}
    />
  );
}

function ApprovalsView({ rows, has, openModal, decideApproval, deleteItem, removeApproval }) {
  const toast = usePortalToast();
  return (
    <DataTable
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
                      className="portal-small-btn"
                      onClick={() =>
                        runMutation(
                          {
                            label: "Approval",
                            showToast: toast,
                            successMessage: "Approval approved.",
                          },
                          () => decideApproval({ approvalId: row.id, status: "Approved" })
                        ).catch(() => {})
                      }
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("approvalDecide", {
                          approvalId: row.id,
                          approvalStatus: "Needs Info",
                          decisionNote: "",
                        })
                      }
                      type="button"
                    >
                      Request Details
                    </button>
                    <button
                      className="portal-danger-btn"
                      onClick={() =>
                        openModal("approvalDecide", {
                          approvalId: row.id,
                          approvalStatus: "Rejected",
                          decisionNote: "",
                        })
                      }
                      type="button"
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
      empty="No approvals in the queue."
    />
  );
}

function ReportsView({ report }) {
  if (!report) {
    return <LoadingPanel />;
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          Icon={CircleDollarSign}
          label="Pipeline Budget"
          value={money(report.summary.totalPipelineBudget)}
        />
        <StatCard
          Icon={CheckCircle2}
          label="Confirmed Revenue"
          value={money(report.summary.confirmedRevenue)}
        />
        <StatCard
          Icon={ClipboardList}
          label="Confirmed / Lost"
          value={`${report.summary.confirmedQueries}/${report.summary.lostQueries}`}
        />
      </div>
      <Panel title="Revenue by query type">
        <DataTable
          columns={[
            ["Type", (row) => strong(row.queryType)],
            ["Pipeline Budget", (row) => money(row.revenue)],
            ["Queries", (row) => row.count],
          ]}
          compact
          empty="No query revenue yet."
          rows={report.revenueByType.map((row) => ({ ...row, id: row.queryType }))}
        />
      </Panel>
      <Panel title="Location-wise headcount">
        <DataTable
          columns={[
            ["Location", (row) => strong(row.location)],
            ["Headcount", (row) => row.count],
          ]}
          compact
          empty="No staff locations yet."
          rows={report.locationHeadcount}
        />
      </Panel>
    </div>
  );
}

function TeamView({ rows }) {
  return (
    <DataTable
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
      empty="No active staff records."
      rows={rows}
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
      entityId: item.entityId,
      entityType: item.entityType,
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
                  className={itemClassName}
                  {...(isInteractive
                    ? {
                        onClick: () => handleNotificationClick(item),
                        onKeyDown: (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleNotificationClick(item);
                          }
                        },
                        role: "button",
                        tabIndex: 0,
                      }
                    : {})}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-sm">
                        {item.title}: {item.body}
                      </div>
                      <div className="mt-1 text-brand-muted text-xs">
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
        detail: `${row.fiscalYear || "Current year"} balance`,
        leaveType,
        value: availableDays,
      };
    }

    if (leaveType === "Leave Without Pay") {
      return {
        detail: "No balance limit",
        leaveType,
        value: "Unpaid",
      };
    }

    return {
      detail: "No balance row",
      leaveType,
      value: "-",
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
    (r) => r.startDate <= today && r.endDate >= today && r.status === "Approved"
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
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard Icon={Users} label="Active Today" value={activeCount} />
        <StatCard Icon={RefreshCw} label="Pending Approval" value={pendingCount} />
        <StatCard Icon={CheckCircle2} label="Upcoming Approved" value={upcomingCount} />
        <StatCard Icon={ShieldCheck} label="Rejected" value={rejectedCount} />
        <StatCard Icon={ClipboardList} label="Total Recorded" value={rows.length} />
      </div>

      <Panel
        subtitle="Current fiscal-year availability before any pending request is approved."
        title="My leave balances"
      >
        {balanceRows === null ? (
          <div className="rounded-xl border border-brand-border bg-brand-light px-4 py-3 text-brand-muted text-sm">
            Loading leave balances...
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {balanceRows.map((row) => (
              <div
                className="rounded-xl border border-brand-border bg-brand-light px-4 py-3"
                key={row.leaveType}
              >
                <div className="font-medium text-brand-muted text-xs">{row.leaveType}</div>
                <div className="mt-1 font-semibold text-brand-dark text-xl">{row.value}</div>
                <div className="mt-1 text-brand-muted text-xs">{row.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-sm">
        <DataTable
          columns={[
            ["Employee Name", (row) => strong(row.staffName)],
            [
              "Department",
              (row) => (
                <span className="rounded-full bg-brand-border px-2.5 py-1 font-medium text-brand-text text-xs">
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
                      className="portal-small-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
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
                      className="portal-small-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
                    >
                      {decidingLeaveId === row.id ? "Saving…" : "Approve (HR)"}
                    </button>
                  )}
                  {row.canApproveFinal && (
                    <button
                      className="portal-small-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Approved")}
                      type="button"
                    >
                      {decidingLeaveId === row.id ? "Saving…" : "Approve (Final Authority)"}
                    </button>
                  )}
                  {row.canReject && (
                    <button
                      className="portal-danger-btn"
                      disabled={decidingLeaveId === row.id}
                      onClick={() => handleLeaveDecision(row.id, "Rejected")}
                      type="button"
                    >
                      Reject
                    </button>
                  )}
                  {(canManageLeave ||
                    (access?.staffId === row.staffId && row.status === "Pending")) && (
                    <button
                      className="portal-small-btn"
                      onClick={() =>
                        openModal("leave_create", {
                          endDate: row.endDate,
                          entityId: row.id,
                          leaveType: row.leaveType || "Casual",
                          reason: row.reason,
                          staffId: row.staffId,
                          startDate: row.startDate,
                          status: row.status,
                        })
                      }
                      type="button"
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
          empty="No leave records yet."
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
      <StaffWorkbookImportPanel />
      <Panel title="Staff allowlist">
        <DataTable
          columns={[
            ["Name", (row) => strong(row.name)],
            ["Email", (row) => row.email],
            ["Leave Head Approver", (row) => row.leaveHeadApproverName || "Matrix default"],
            ["Reporting Manager", (row) => row.reportingManagerName || "-"],
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
                    className="portal-small-btn"
                    onClick={() =>
                      openModal("staff", {
                        confirmationDate: row.confirmationDate || "",
                        department: row.department,
                        employmentStatus: row.employmentStatus || "Confirmed",
                        joiningDate: row.joiningDate || "",
                        leaveHeadApproverId: row.leaveHeadApproverId || "",
                        leavePolicyGroup: row.leavePolicyGroup || "",
                        location: row.location,
                        marriageLeaveUsed: Boolean(row.marriageLeaveUsed),
                        maternityEventsUsed: String(row.maternityEventsUsed ?? 0),
                        mobile: row.mobile,
                        paternityEventsUsed: String(row.paternityEventsUsed ?? 0),
                        reportingManagerName: row.reportingManagerName || "",
                        reportingManagerStaffId: row.reportingManagerStaffId || "",
                        staffActive: row.active,
                        staffEmail: row.email,
                        staffFunction: row.function,
                        staffId: row.id,
                        staffName: row.name,
                        staffRoles: row.roles,
                      })
                    }
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                    disabled={onboardingSending[row.id]}
                    onClick={() => handleSendOnboarding(row)}
                    type="button"
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
          empty={searchTerm ? "No staff match your search." : "No staff records yet."}
          rows={staff}
        />
      </Panel>
      <Panel title="Workflow dropdowns">
        {searchTerm && Object.keys(visibleDropdowns).length === 0 ? (
          <EmptyState label="No workflow dropdown values match your search." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(visibleDropdowns).map(([category, values]) => (
              <div
                className="rounded-md border border-brand-border bg-brand-light p-4"
                key={category}
              >
                <div className="mb-2 font-semibold text-sm capitalize">{category}</div>
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
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-brand-border bg-brand-light/60 p-3 text-sm">
      <div className="font-semibold text-brand-muted text-xs uppercase tracking-wide">
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
      if (!(open && jobCardId) || importRows.length === 0) {
        dispatchImport({ patch: { preview: null }, type: "patch" });
        return;
      }
      dispatchImport({ patch: { error: "", isPreviewing: true }, type: "patch" });
      try {
        const result = await previewPassengerImport({ jobCardId, rows: importRows });
        if (!cancelled) {
          dispatchImport({ patch: { preview: result }, type: "patch" });
        }
      } catch (err) {
        if (!cancelled) {
          dispatchImport({
            patch: {
              error: err?.data || err?.message || "Unable to preview passenger import.",
              preview: null,
            },
            type: "patch",
          });
        }
      }
      if (!cancelled) {
        dispatchImport({ patch: { isPreviewing: false }, type: "patch" });
      }
    }
    runPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, parsed, previewPassengerImport, dispatchImport]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
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
    if (!jobCardId || rows.length === 0) {
      return;
    }
    setIsSaving(true);
    setError("");
    setImportProgress({ current: 0, total: 1 });
    try {
      setImportProgress({ current: 0, label: "Uploading…", total: 1 });
      const importRows = rows.map(toPassengerImportInput);
      const result = await commitPassengerImport({ jobCardId, rows: importRows });
      let roomSummaryText = "";
      if (showRoomSummary && result.roomSummary) {
        roomSummaryText = formatRoomSummaryText(result.roomSummary, selectedJob?.jobCode) || "";
      }
      const { isPartialFailure, message } = buildPassengerImportResultMessage(
        result,
        successLabel,
        roomSummaryText
      );
      if (isPartialFailure) {
        toast.error(message);
        setError(message);
      } else {
        toast.success(message);
        closeAndReset();
      }
    } catch (err) {
      setError(err?.data || err?.message || "Import failed.");
    }
    setIsSaving(false);
    setImportProgress(null);
  };

  return (
    <ImportModalShell close={closeAndReset} open={open} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportFileInput
          accept=".xlsx,.xls"
          fileName={fileName}
          label={fileLabel}
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {errors.length > 0 && <ImportIssueList rows={errors} title="Rows needing correction" />}
        {skipped.length > 0 && <ImportIssueList rows={skipped.slice(0, 8)} title="Skipped rows" />}
        {showRoomSummary && Object.keys(previewRoomSummary).length > 0 && (
          <RoomSummaryPanel jobCode={selectedJob?.jobCode} summary={previewRoomSummary} />
        )}
        {importProgress && (
          <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-muted text-sm">
            {importProgress.label ||
              `Importing batch ${importProgress.current} of ${importProgress.total}…`}
          </div>
        )}
        {rows.length > 0 && (
          <DataTable
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
              ["Travel Batch", (row) => row.travelBatchReference || "-"],
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
            compact
            empty={emptyLabel}
            rows={rows.slice(0, 50).map((row) => ({
              ...row,
              action: previewById.get(row.id)?.action || (isPreviewing ? "checking" : "upsert"),
            }))}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || rows.length === 0 || isPreviewing || isSaving}
            onClick={handleCommit}
            type="button"
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
      if (jobCardId && group.jobCardId !== jobCardId) {
        return keys;
      }
      for (const segment of group.segments || []) {
        if (segment.importKey) {
          keys.push(segment.importKey);
        }
      }
      return keys;
    }, [])
  );
  const segmentCount = groups.reduce((sum, group) => sum + group.segments.length, 0);
  const updateCount = groups.reduce(
    (sum, group) =>
      sum + group.segments.filter((segment) => existingSegmentKeys.has(segment.importKey)).length,
    0
  );

  const reset = () => patchFlightState(FLIGHT_IMPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
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
    if (!jobCardId || groups.length === 0) {
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      const result = await commitFlightImport({ groups, jobCardId });
      toast.success(
        `Flight import complete. Created ${result.createdSegments}, updated ${result.updatedSegments} segments.`
      );
      closeAndReset();
    } catch (err) {
      setError(err?.data || err?.message || "Flight import failed.");
    }
    setIsSaving(false);
  };

  return (
    <ImportModalShell close={closeAndReset} open={open} title="Import Flights">
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportFileInput
          accept=".xlsx,.xls"
          fileName={fileName}
          label="Flight spreadsheet"
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {errors.length > 0 && <ImportIssueList rows={errors} title="Rows needing correction" />}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group) => (
              <div className="rounded-lg border border-brand-border bg-white" key={group.id}>
                <div className="flex items-center justify-between border-brand-border border-b px-4 py-3">
                  <div className="font-semibold text-citius-blue">
                    {group.name}
                    {group.travelBatchReference ? (
                      <span className="ml-2 font-normal text-brand-muted">
                        · {group.travelBatchReference}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-brand-muted text-xs">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <DataTable
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
                  compact
                  empty="No segments in this group."
                  rows={group.segments.map((segment) => ({
                    ...segment,
                    action: existingSegmentKeys.has(segment.importKey) ? "update" : "create",
                  }))}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0 || isSaving}
            onClick={handleCommit}
            type="button"
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
      if (!(open && jobCardId)) {
        dispatchExport({ patch: { exportData: null }, type: "patch" });
        return;
      }
      dispatchExport({ patch: { error: "", isLoading: true }, type: "patch" });
      try {
        const result = await getPassengerExportRows({ exportKind, jobCardId });
        if (!cancelled) {
          dispatchExport({ patch: { exportData: result }, type: "patch" });
        }
      } catch (err) {
        if (!cancelled) {
          dispatchExport({
            patch: {
              error: err?.data || err?.message || "Unable to load passengers for export.",
              exportData: null,
            },
            type: "patch",
          });
        }
      }
      if (!cancelled) {
        dispatchExport({ patch: { isLoading: false }, type: "patch" });
      }
    }
    loadExportPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, exportKind, getPassengerExportRows, dispatchExport]);

  const handleExport = async () => {
    if (!exportData?.rows?.length) {
      return;
    }
    setIsExporting(true);
    setError("");
    try {
      const workbook = buildWorkbook(exportData.rows, {
        sheetName: sheetName || exportData.jobCode,
      });
      await downloadWorkbook(workbook, `${exportData.jobCode}-${filenameSuffix}.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(err?.message || "Passenger export failed.");
    }
    setIsExporting(false);
  };

  const rows = exportData?.rows || [];

  return (
    <ImportModalShell close={closeAndReset} open={open} subtitle={subtitle} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {jobCardId && !isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
            No passengers found for this job card.
          </div>
        )}
        {rows.length > 0 && (
          <DataTable
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
            compact
            empty="No passengers to export."
            rows={rows.slice(0, 25)}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || isLoading || rows.length === 0 || isExporting}
            onClick={handleExport}
            type="button"
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

  const handleExport = async () => {
    if (!selectedJob || groups.length === 0) {
      return;
    }
    setError("");
    try {
      const workbook = buildFlightWorkbook(groups, { defaultSheetName: selectedJob.jobCode });
      await downloadWorkbook(workbook, `${selectedJob.jobCode}-flights.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(err?.message || "Flight export failed.");
    }
  };

  return (
    <ImportModalShell
      close={closeAndReset}
      open={open}
      subtitle="Select a job card to download a flight itinerary spreadsheet compatible with the import template."
      title="Export Flights"
    >
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
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
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {jobCardId && groups.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
            No flight itinerary found for this job card.
          </div>
        )}
        {groups.length > 0 && (
          <div className="space-y-3">
            {groups.slice(0, 8).map((group) => (
              <div className="rounded-lg border border-brand-border bg-white" key={group.id}>
                <div className="flex items-center justify-between border-brand-border border-b px-4 py-3">
                  <div className="font-semibold text-citius-blue">{group.name}</div>
                  <div className="text-brand-muted text-xs">
                    {group.segments.length} segment{group.segments.length === 1 ? "" : "s"}
                  </div>
                </div>
                <DataTable
                  columns={[
                    ["Date", (row) => row.dateLabel],
                    ["Flight", (row) => `${row.airline} ${row.flightNumber}`],
                    ["Depart", (row) => `${row.departTime || "-"} ${row.origin}`],
                    ["Arrive", (row) => `${row.arriveTime || "-"} ${row.destination}`],
                  ]}
                  compact
                  empty="No segments in this group."
                  rows={group.segments}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || groups.length === 0}
            onClick={handleExport}
            type="button"
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
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.importModal} flex items-center justify-center bg-citius-blue/35 p-4 backdrop-blur-sm`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <m.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-brand-border bg-white p-5 shadow-2xl md:p-6"
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading font-semibold text-2xl text-citius-blue">{title}</h2>
                <p className="mt-1 text-brand-muted text-sm">{subtitle}</p>
              </div>
              <button
                className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function ImportFileInput({ label, fileName, accept, onChange }) {
  return (
    <label className="block rounded-lg border border-brand-border border-dashed bg-brand-light/40 p-4">
      <span className="font-semibold text-citius-blue text-sm">{label}</span>
      <input
        accept={accept}
        className="mt-2 block w-full text-brand-dark text-sm file:mr-3 file:rounded-md file:border-0 file:bg-citius-blue file:px-3 file:py-2 file:font-semibold file:text-sm file:text-white"
        onChange={onChange}
        type="file"
      />
      {fileName && <span className="mt-2 block text-brand-muted text-xs">{fileName}</span>}
    </label>
  );
}

function ImportSummary({ isBusy, totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {totals.map(([label, value]) => (
        <div className="rounded-lg border border-brand-border bg-white px-4 py-3" key={label}>
          <div className="font-semibold text-brand-muted text-xs uppercase tracking-[0.08em]">
            {label}
          </div>
          <div className="mt-1 font-semibold text-2xl text-citius-blue">
            {isBusy && value === "-" ? "…" : value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportIssueList({ title, rows }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="font-semibold text-amber-900 text-sm">{title}</div>
      <div className="mt-2 space-y-1 text-amber-800 text-sm">
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
  if (!rows) {
    return <LoadingPanel />;
  }
  const emptyLabel = filterEmptyMessage({ defaultMessage: empty, filtersActive });
  if (rows.length === 0) {
    return <EmptyState label={emptyLabel} />;
  }
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm"
      initial={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.35 }}
    >
      {mobileCardRender && (
        <div className="divide-y divide-brand-border md:hidden">
          {rows.map((row, rowIndex) => (
            <m.div
              animate={{ opacity: 1 }}
              className="p-4"
              initial={{ opacity: 0 }}
              key={row.id}
              transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
            >
              {mobileCardRender(row)}
            </m.div>
          ))}
        </div>
      )}
      <div className={`overflow-x-auto ${mobileCardRender ? "hidden md:block" : ""}`}>
        <table className="min-w-full border-collapse">
          <thead className="bg-brand-light/80">
            <tr>
              {columns.map(([label]) => (
                <th
                  className="border-brand-border border-b px-4 py-3 text-left font-semibold text-citius-blue/80 text-xs"
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <m.tr
                animate={{ opacity: 1 }}
                className="transition-colors hover:bg-citius-blue/[0.03]"
                initial={{ opacity: 0 }}
                key={row.id}
                transition={{ delay: Math.min(rowIndex * 0.02, 0.2) }}
              >
                {columns.map(([label, render]) => (
                  <td
                    className={`border-brand-border border-b px-4 ${compact ? "py-2" : "py-3"} text-brand-dark text-sm last:border-b-0`}
                    key={label}
                  >
                    {render(row) || "-"}
                  </td>
                ))}
              </m.tr>
            ))}
          </tbody>
        </table>
      </div>
    </m.div>
  );
}

function EditButton({ onClick, label = "Edit" }) {
  return (
    <button className="portal-small-btn" onClick={onClick} type="button">
      {label}
    </button>
  );
}

function DeleteButton({ label, onClick }) {
  return (
    <button
      aria-label={`Delete ${label}`}
      className="portal-danger-btn"
      onClick={onClick}
      type="button"
    >
      <Trash2 size={13} />
      Delete
    </button>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <m.section
      className={`rounded-2xl border border-brand-border bg-white p-5 shadow-sm md:p-6 ${className}`}
      initial={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      viewport={{ margin: "-40px", once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <div className="mb-4">
        <h2 className="font-heading font-semibold text-citius-blue text-lg md:text-xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-brand-muted text-sm">{subtitle}</p> : null}
      </div>
      {children}
    </m.section>
  );
}

function DashboardSectionHeading({ title, detail }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h3 className="font-heading font-semibold text-brand-dark text-sm tracking-wide">{title}</h3>
      {detail ? <p className="text-brand-muted text-xs">{detail}</p> : null}
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
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-linear-to-br p-4 shadow-sm transition-shadow hover:shadow-md ${tone} ${ringTone}`}
      initial={{ opacity: 0, y: 12 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2 }}
    >
      <div className="font-semibold text-[11px] text-brand-muted uppercase tracking-wide">
        {type}
      </div>
      <div className={`mt-2 font-heading font-semibold text-2xl tabular-nums ${valueTone}`}>
        {count}
      </div>
    </m.div>
  );
}

function StatCard({ label, value, Icon, index = 0, featured = false }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className={`group w-48 overflow-hidden rounded-2xl border border-brand-border bg-white p-5 shadow-sm transition-shadow hover:border-citius-orange/30 hover:shadow-lg ${
        featured
          ? "bg-linear-to-br from-citius-blue to-citius-blue/90 text-white sm:col-span-2"
          : ""
      }`}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.01, y: -4 }}
    >
      <div className="flex items-center justify-between">
        <div className={`font-semibold text-xs ${featured ? "text-white/80" : "text-brand-muted"}`}>
          {label}
        </div>
        <div className={`rounded-full p-2 ${featured ? "bg-white/15" : "bg-citius-orange/10"}`}>
          <Icon className={featured ? "text-citius-orange" : "text-citius-orange"} size={18} />
        </div>
      </div>
      <div
        className={`mt-3 font-heading font-semibold text-3xl tabular-nums ${featured ? "text-white" : "text-citius-blue"}`}
      >
        {value}
      </div>
    </m.div>
  );
}

function Progress({ label, value }) {
  return (
    <div>
      <div className="mt-3 flex justify-between text-brand-muted text-xs">
        <span>{label}</span>
        <strong className="text-citius-blue">{Math.min(value || 0, 100)}%</strong>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-border">
        <m.div
          animate={{ width: `${Math.min(value || 0, 100)}%` }}
          className="h-full rounded-full bg-linear-to-r from-citius-orange to-citius-blue"
          initial={{ width: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function Timeline({ rows }) {
  if (!rows.length) {
    return <EmptyState label="No records yet." />;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div className="rounded-md border border-brand-border bg-brand-light p-3" key={row.id}>
          <div className="font-semibold text-sm">{row.message}</div>
          <div className="mt-1 text-brand-muted text-xs">
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
      <span className="mb-1 block font-semibold text-brand-muted text-xs">{label}</span>
      <input
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type={type}
        value={value}
        {...rest}
      />
    </label>
  );
}

function Select({ label, value, options, onChange, required = false }) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option
  );
  return (
    <label className="block">
      <span className="mb-1 block font-semibold text-brand-muted text-xs">{label}</span>
      <select
        className="h-11 w-full rounded-xl border border-brand-border bg-brand-light px-3 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
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
    typeof option === "string" ? { label: option, value: option } : option
  );
  const selected = new Set(value);
  return (
    <div className="md:col-span-2">
      <span className="mb-2 block font-semibold text-brand-muted text-xs">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {normalized.map((option) => (
          <label
            className="flex items-center gap-2 rounded-md border border-brand-border bg-brand-light px-3 py-2 text-sm"
            key={option.value}
          >
            <input
              checked={selected.has(option.value)}
              onChange={(event) => {
                const next = new Set(selected);
                if (event.target.checked) {
                  next.add(option.value);
                } else {
                  next.delete(option.value);
                }
                onChange(Array.from(next));
              }}
              type="checkbox"
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
      <span className="mb-1 block font-semibold text-brand-muted text-xs">{label}</span>
      <textarea
        className="w-full rounded-xl border border-brand-border bg-brand-light px-3 py-2 text-sm outline-none transition focus:border-citius-blue focus:bg-white focus:ring-2 focus:ring-citius-blue/10"
        onChange={updateTextareaValue}
        rows={4}
        value={value}
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
  amber: "bg-citius-orange/15 text-amber-700",
  blue: "bg-citius-blue/10 text-citius-blue",
  gray: "bg-brand-light text-brand-muted",
  green: "bg-citius-green/15 text-emerald-700",
  purple: "bg-violet-50 text-violet-700",
  red: "bg-red-50 text-red-700",
};

function Badge({ label, tone = "gray" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-semibold text-[11px] ${BADGE_TONES[tone] || BADGE_TONES.gray}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ label }) {
  return (
    <div className="rounded-2xl border border-brand-border border-dashed bg-white p-8 text-center text-brand-muted text-sm">
      {label}
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid min-h-60 place-items-center rounded-2xl border border-brand-border bg-white">
      <div className="flex items-center gap-2 text-brand-muted text-sm">
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
  if (!term) {
    return dropdowns;
  }
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
  if (!error) {
    return fallback;
  }
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
    if (!isValidElement(action)) {
      return action;
    }
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
            aria-expanded={open}
            aria-label="More actions"
            className="portal-small-btn inline-flex items-center gap-1"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <MoreHorizontal size={14} />
            More
          </button>
          {open && (
            <>
              <button
                aria-label="Close actions menu"
                className={`fixed inset-0 ${PORTAL_Z.dropdownBackdrop} cursor-default bg-transparent`}
                onClick={() => setOpen(false)}
                type="button"
              />
              <div
                className={`absolute right-0 ${PORTAL_Z.dropdown} mt-2 min-w-[180px] rounded-xl border border-brand-border bg-white p-2 shadow-lg`}
              >
                <div className="flex flex-col gap-2" role="menu" tabIndex={-1}>
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
  if (!trimmed) {
    return 0;
  }
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
  if (!text) {
    return "-";
  }
  const words = text.split(/\s+/).filter(Boolean);
  const display = words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : text;
  return (
    <span
      className="block max-w-[220px] whitespace-normal break-words text-brand-muted text-xs leading-snug"
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
    <div className="rounded-xl border border-brand-border bg-brand-light/60 p-4 md:col-span-2">
      <div className="mb-3 font-heading font-semibold text-citius-blue text-sm">
        Contracting cost
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Land Cost (INR)"
          onChange={(v) => updateForm("contractingLandCost", v)}
          type="number"
          value={form.contractingLandCost}
        />
        <Input
          label="Airlines Cost (INR)"
          onChange={(v) => updateForm("contractingAirlinesCost", v)}
          type="number"
          value={form.contractingAirlinesCost}
        />
        <Input
          label="Visa Cost (INR)"
          onChange={(v) => updateForm("contractingVisaCost", v)}
          type="number"
          value={form.contractingVisaCost}
        />
        <div className="rounded-lg border border-brand-border bg-white px-3 py-2 text-sm">
          <div className="font-semibold text-brand-muted text-xs uppercase tracking-wide">
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
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  pdf: "application/pdf",
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
  if (row.onboardingStatus === "ready") {
    return "Send password reset";
  }
  if (row.onboardingStatus === "pending") {
    return "Resend verification";
  }
  return "Send verification";
}

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
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
      <button className="portal-small-btn" onClick={onManage} type="button">
        Upload PDF
      </button>
    ) : (
      <span className="text-brand-muted text-xs">Not uploaded</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="inline-flex max-w-[180px] items-center gap-1 truncate text-left font-medium text-citius-blue text-xs hover:underline"
        onClick={() =>
          onDownload().catch((err) => {
            toast.error(err?.data || err?.message || "Unable to open file.");
          })
        }
        type="button"
      >
        <FileText className="shrink-0" size={12} />
        <span className="truncate">{finalizedPdf.fileName}</span>
      </button>
      {finalizedPdf.uploadedAt && (
        <span className="text-[11px] text-brand-muted">{formatDate(finalizedPdf.uploadedAt)}</span>
      )}
      {canSend && (
        <button className="portal-small-btn mt-1 w-fit" onClick={onManage} type="button">
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
    if (!(file && proposalId)) {
      return;
    }

    if (file.size > MAX_QUERY_ATTACHMENT_BYTES) {
      setUploadError(`${file.name} exceeds the 15 MB limit.`);
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      const uploadUrl = await generateFinalizedPdfUploadUrl({});
      const uploadRes = await fetch(uploadUrl, {
        body: file,
        headers: { "Content-Type": file.type || "application/pdf" },
        method: "POST",
      });
      if (!uploadRes.ok) {
        setUploadError(`Failed to upload ${file.name}.`);
        setIsUploading(false);
        return;
      }
      const { storageId } = await uploadRes.json();
      await attachFinalizedPdf({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
        proposalId,
        storageId,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    }
    setIsUploading(false);
  };

  const handleRemove = async () => {
    const ok = await confirm({
      confirmLabel: "Remove",
      danger: true,
      message: "Remove the finalized proposal PDF?",
      title: "Remove finalized PDF",
    });
    if (!ok) {
      return;
    }
    try {
      await removeFinalizedPdf({ proposalId });
      toast.success("Finalized PDF removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <m.div className="space-y-4">
      <p className="text-brand-muted text-sm">
        Upload the client-ready proposal PDF here. Sales can download it and send it to the client,
        then mark the proposal as sent.
      </p>
      {canSend && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            className="mb-2 block font-medium text-brand-text text-sm"
            htmlFor="finalized-proposal-pdf-upload"
          >
            {finalizedPdf ? "Replace Finalized Proposal PDF" : "Upload Finalized Proposal PDF"}
          </label>
          <p className="mb-3 text-brand-muted text-xs">PDF only, up to 15 MB.</p>
          <input
            accept=".pdf,application/pdf"
            className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:font-semibold file:text-sm file:text-white"
            disabled={isUploading}
            id="finalized-proposal-pdf-upload"
            onChange={handleUpload}
            type="file"
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-brand-muted text-sm">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-red-600 text-sm">{uploadError}</p>}
        </div>
      )}

      {finalizedPdf ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium text-brand-text">{finalizedPdf.fileName}</div>
            {finalizedPdf.uploadedAt && (
              <div className="text-brand-muted text-xs">
                Uploaded {formatDate(finalizedPdf.uploadedAt)}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              className="portal-small-btn"
              onClick={() =>
                openFinalizedProposalPdf(proposalId, getFinalizedPdfUrl).catch((err) => {
                  toast.error(err?.data || err?.message || "Unable to open file.");
                })
              }
              type="button"
            >
              Download
            </button>
            {canSend && (
              <button className="portal-danger-btn" onClick={handleRemove} type="button">
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-brand-muted text-sm">No finalized proposal PDF uploaded yet.</p>
      )}
    </m.div>
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
      <button className="portal-small-btn" onClick={onManage} type="button">
        Add files
      </button>
    ) : (
      <span className="text-brand-muted text-xs">-</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {attachments.slice(0, 2).map((file) => (
        <button
          className="inline-flex max-w-[180px] items-center gap-1 truncate text-left font-medium text-citius-blue text-xs hover:underline"
          key={file.id}
          onClick={() =>
            openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch((err) => {
              toast.error(err?.data || err?.message || "Unable to open file.");
            })
          }
          type="button"
        >
          <Paperclip className="shrink-0" size={12} />
          <span className="truncate">{file.fileName}</span>
        </button>
      ))}
      {attachments.length > 2 && (
        <span className="text-[11px] text-brand-muted">+{attachments.length - 2} more</span>
      )}
      {canManage && (
        <button className="portal-small-btn mt-1 w-fit" onClick={onManage} type="button">
          Manage
        </button>
      )}
    </div>
  );
}

function QueryFilePicker({ files, onChange, inputId }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
      <label className="mb-2 block font-medium text-brand-text text-sm" htmlFor={inputId}>
        Attachments
      </label>
      <p className="mb-3 text-brand-muted text-xs">
        PDF, Office documents, images, or text files up to 15 MB each.
      </p>
      <input
        accept={QUERY_ATTACHMENT_ACCEPT}
        className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-blue file:px-4 file:py-2 file:font-semibold file:text-sm file:text-white hover:file:bg-citius-blue/90"
        id={inputId}
        multiple
        onChange={(event) => {
          const picked = Array.from(event.target.files || []);
          if (!picked.length) {
            return;
          }
          onChange([...files, ...picked]);
          event.target.value = "";
        }}
        type="file"
      />
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, index) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-white px-3 py-2 text-sm"
              key={`${file.name}-${file.size}-${index}`}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.name}</div>
                <div className="text-brand-muted text-xs">{formatFileSize(file.size)}</div>
              </div>
              <button
                className="shrink-0 font-semibold text-red-600 text-xs hover:underline"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                type="button"
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
    if (!(picked.length && targetId)) {
      return;
    }

    setIsUploading(true);
    setUploadError("");
    try {
      await uploadEntityFiles({
        attachFile: attachQueryFile,
        entityId: targetId,
        files: picked,
        generateUploadUrl: generateQueryUploadUrl,
        idField,
      });
    } catch (err) {
      setUploadError(err?.data || err?.message || "Upload failed.");
    }
    setIsUploading(false);
  };

  const handleRemove = async (attachment) => {
    const ok = await confirm({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${attachment.fileName}?`,
      title: "Remove file",
    });
    if (!ok) {
      return;
    }
    try {
      await removeQueryAttachment({ attachmentId: attachment.id });
      toast.success("File removed.");
    } catch (err) {
      toast.error(err?.data || err?.message || "Unable to remove file.");
    }
  };

  return (
    <m.div className="space-y-4">
      {canManage && (
        <div className="rounded-xl border border-brand-border bg-brand-light/40 p-4">
          <label
            className="mb-2 block font-medium text-brand-text text-sm"
            htmlFor="query-attachment-upload"
          >
            {uploadLabel}
          </label>
          <input
            accept={QUERY_ATTACHMENT_ACCEPT}
            className="block w-full text-brand-text text-sm file:mr-3 file:rounded-full file:border-0 file:bg-citius-orange file:px-4 file:py-2 file:font-semibold file:text-sm file:text-white"
            disabled={isUploading}
            id="query-attachment-upload"
            multiple
            onChange={handleUpload}
            type="file"
          />
          {isUploading && (
            <p className="mt-2 flex items-center gap-2 text-brand-muted text-sm">
              <Loader2 className="animate-spin" size={14} />
              Uploading…
            </p>
          )}
          {uploadError && <p className="mt-2 text-red-600 text-sm">{uploadError}</p>}
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="text-brand-muted text-sm">No files attached yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((file) => (
            <li
              className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-white px-4 py-3"
              key={file.id}
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-brand-text">{file.fileName}</div>
                <div className="text-brand-muted text-xs">
                  {formatFileSize(file.fileSize)} · {formatDate(file.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="portal-small-btn"
                  onClick={() =>
                    openQueryAttachment(file.id, getQueryAttachmentUrl, attachmentKind).catch(
                      (err) => {
                        toast.error(err?.data || err?.message || "Unable to open file.");
                      }
                    )
                  }
                  type="button"
                >
                  Open
                </button>
                {canManage && (
                  <button
                    className="portal-small-btn text-red-600"
                    onClick={() => handleRemove(file)}
                    type="button"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </m.div>
  );
}

function paymentTermLabel(queryType) {
  if (queryType === "Spiritual") {
    return "100% advance";
  }
  if (queryType === "B2B") {
    return "80%-100% advance";
  }
  if (["FIT", "Family Group"].includes(queryType)) {
    return "90%-100% advance";
  }
  if (queryType === "Cement Bidding") {
    return "70%-100% advance";
  }
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
  ) {
    return "green";
  }
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
  ) {
    return "amber";
  }
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
  ) {
    return "red";
  }
  if (["Reissue Required", "Name Change Required", "Re-applied", "Negotiation"].includes(status)) {
    return "purple";
  }
  return "blue";
}

function BriefcaseIcon(props) {
  return <Settings {...props} />;
}
