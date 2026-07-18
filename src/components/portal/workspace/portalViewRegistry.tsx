"use client";

import type { ComponentProps, ReactNode } from "react";
import type { PipelineMode } from "@/components/portal/pipeline/PipelineView";
import { canAssignTourManagers, canHeadAssignQueryTeams } from "@/lib/portal/permissions";
import {
  AccountsJobCardView,
  ActivityView,
  ApprovalsView,
  ContractingView,
  DashboardView,
  ExpensesView,
  FinanceView,
  HotelRoomingView,
  JobCardsView,
  LeaveView,
  PassportDocumentsView,
  PipelineView,
  PnrView,
  ProposalsView,
  QueriesView,
  ReportsView,
  SeatView,
  SettingsView,
  TeamView,
  TicketDashboardView,
  TicketsView,
  TourManagersView,
  TravellersView,
  VisaTrackingView,
} from "./portalLazyViews";
import type { PortalViewRegistryInputs } from "./portalViewRegistryInputs";
import type {
  AccountsJobCardViewProps,
  ActivityViewProps,
  ApprovalsViewProps,
  DashboardViewProps,
  ExpensesViewProps,
  FinanceViewProps,
  LeaveViewProps,
  PassportDocumentsViewProps,
  PipelineViewProps,
  PortalAccessSlice,
  PortalBulkDeleteHandler,
  PortalDeleteHandler,
  PortalFlightItineraryGroup,
  PortalHotelListRow,
  PortalJobCardDeletionOperation,
  PortalJobCardListRow,
  PortalJobCardOption,
  PortalModalOpener,
  PortalPaginationSlice,
  PortalPassportTravellerRow,
  PortalPermissionChecker,
  PortalPnrListRow,
  PortalProposalListRow,
  PortalQueryListRow,
  PortalRoomCountSummary,
  PortalSeatListRow,
  PortalTeamMemberRow,
  PortalTicketDashboardSummary,
  PortalTicketListRow,
  PortalTourManagerAssignmentRow,
  PortalTourManagerListRow,
  PortalTravellerListRow,
  PortalVisaListRow,
  ProposalsViewProps,
  QueriesViewProps,
  ReportsViewProps,
  SettingsViewProps,
  TeamViewProps,
} from "./portalViewTypes";

export const CORE_PORTAL_VIEW_IDS = ["dashboard", "pipeline", "accounts-job-cards"] as const;

export type CorePortalViewId = (typeof CORE_PORTAL_VIEW_IDS)[number];

export function isCorePortalView(view: string): view is CorePortalViewId {
  return (CORE_PORTAL_VIEW_IDS as readonly string[]).includes(view);
}

export interface CorePortalWorkspaceSlice {
  access: PortalAccessSlice;
  accountsJobCardCreators: AccountsJobCardViewProps["creators"];
  canMoveContractingPipeline: boolean;
  canMoveSalesPipeline: boolean;
  dateRange: DashboardViewProps["dateRange"];
  filteredAccountsQueries: AccountsJobCardViewProps["rows"];
  filteredJobCards: AccountsJobCardViewProps["jobCards"];
  filteredPipelineQueries: PipelineViewProps["rows"];
  has: PortalPermissionChecker;
  moveContractingPipelineStage?: PipelineViewProps["moveContractingPipelineStage"];
  moveSalesPipelineStage?: PipelineViewProps["moveSalesPipelineStage"];
  openModal: PortalModalOpener;
  pipelineMode: PipelineMode;
  setDateRangeWithUrl: DashboardViewProps["setDateRange"];
  setJobCardCreatorAccess: AccountsJobCardViewProps["setJobCardCreatorAccess"];
  setPipelineMode: (value: PipelineMode) => void;
  summary?: DashboardViewProps["summary"];
  view: string;
}

export function renderCorePortalView({
  view,
  workspace,
}: {
  view: string;
  workspace?: CorePortalWorkspaceSlice;
}): ReactNode {
  if (!isCorePortalView(view)) {
    return null;
  }
  if (!workspace) {
    throw new Error(`Core portal view ${view} requires its workspace slice`);
  }

  if (view === "dashboard") {
    return (
      <DashboardView
        access={workspace.access}
        dateRange={workspace.dateRange}
        has={workspace.has}
        loading={workspace.summary === undefined}
        openModal={workspace.openModal}
        setDateRange={workspace.setDateRangeWithUrl}
        summary={workspace.summary}
      />
    );
  }

  if (view === "pipeline") {
    return (
      <PipelineView
        canMoveContractingPipeline={workspace.canMoveContractingPipeline}
        canMoveSalesPipeline={workspace.canMoveSalesPipeline}
        mode={workspace.pipelineMode}
        moveContractingPipelineStage={workspace.moveContractingPipelineStage}
        moveSalesPipelineStage={workspace.moveSalesPipelineStage}
        rows={workspace.filteredPipelineQueries as ComponentProps<typeof PipelineView>["rows"]}
        setMode={workspace.setPipelineMode}
      />
    );
  }

  return (
    <AccountsJobCardView
      access={workspace.access}
      creators={workspace.accountsJobCardCreators}
      jobCards={workspace.filteredJobCards}
      openModal={workspace.openModal}
      rows={workspace.filteredAccountsQueries}
      setJobCardCreatorAccess={workspace.setJobCardCreatorAccess}
    />
  );
}

export const PILOT_PORTAL_VIEW_IDS = ["queries", "contracting", "proposals"] as const;

export type PilotPortalViewId = (typeof PILOT_PORTAL_VIEW_IDS)[number];

export function isPilotPortalView(view: string): view is PilotPortalViewId {
  return (PILOT_PORTAL_VIEW_IDS as readonly string[]).includes(view);
}

export interface PilotPortalWorkspaceSlice {
  access: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  filteredContractingQueries: PortalQueryListRow[];
  filteredProposals: PortalProposalListRow[];
  filteredQueries: PortalQueryListRow[];
  filtersActive: boolean;
  getFinalizedPdfUrl: ProposalsViewProps["getFinalizedPdfUrl"];
  getProposalAttachmentUrl: ProposalsViewProps["getProposalAttachmentUrl"];
  getQueryAttachmentUrl: QueriesViewProps["getQueryAttachmentUrl"];
  has: PortalPermissionChecker;
  markProposalSent: ProposalsViewProps["markProposalSent"];
  openModal: PortalModalOpener;
  removeProposal: ProposalsViewProps["removeProposal"];
  removeQuery: QueriesViewProps["removeQuery"];
  sendProposalToSales: ProposalsViewProps["sendProposalToSales"];
  submitToContracting: QueriesViewProps["submitToContracting"];
  team: PortalTeamMemberRow[];
  view: string;
}

export function renderPilotPortalView({
  view,
  workspace,
}: {
  view: string;
  workspace?: PilotPortalWorkspaceSlice;
}): ReactNode {
  if (!isPilotPortalView(view)) {
    return null;
  }
  if (!workspace) {
    throw new Error(`Pilot portal view ${view} requires its workspace slice`);
  }

  if (view === "queries") {
    return (
      <QueriesView
        access={workspace.access}
        deleteItem={workspace.deleteItem}
        filtersActive={workspace.filtersActive}
        getQueryAttachmentUrl={workspace.getQueryAttachmentUrl}
        has={workspace.has}
        openModal={workspace.openModal}
        removeQuery={workspace.removeQuery}
        rows={workspace.filteredQueries}
        submitToContracting={workspace.submitToContracting}
      />
    );
  }

  if (view === "contracting") {
    return (
      <ContractingView
        canAssign={canHeadAssignQueryTeams(workspace.access)}
        deleteItem={workspace.deleteItem}
        filtersActive={workspace.filtersActive}
        has={workspace.has}
        openModal={workspace.openModal}
        proposals={workspace.filteredProposals}
        removeQuery={workspace.removeQuery}
        rows={workspace.filteredContractingQueries}
        team={workspace.team}
      />
    );
  }

  return (
    <ProposalsView
      deleteItem={workspace.deleteItem}
      getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
      getProposalAttachmentUrl={workspace.getProposalAttachmentUrl}
      has={workspace.has}
      markProposalSent={workspace.markProposalSent}
      openModal={workspace.openModal}
      removeProposal={workspace.removeProposal}
      rows={workspace.filteredProposals}
      sendProposalToSales={workspace.sendProposalToSales}
    />
  );
}

export const OPERATIONS_PORTAL_VIEW_IDS = [
  "job-cards",
  "travellers",
  "passport",
  "visa",
  "hotels",
  "tour-managers",
] as const;

export type OperationsPortalViewId = (typeof OPERATIONS_PORTAL_VIEW_IDS)[number];

export function isOperationsPortalView(view: string): view is OperationsPortalViewId {
  return (OPERATIONS_PORTAL_VIEW_IDS as readonly string[]).includes(view);
}

export interface OperationsPortalWorkspaceSlice {
  access: PortalAccessSlice;
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  encryptAndStorePassport: PassportDocumentsViewProps["encryptAndStorePassport"];
  filteredHotels: PortalHotelListRow[];
  filteredJobCards: PortalJobCardListRow[];
  filteredPassportTravellers: PortalPassportTravellerRow[];
  filteredRoomingTravellers: PortalTravellerListRow[];
  filteredTourManagers: PortalTourManagerListRow[];
  filteredTravellers: PortalTravellerListRow[];
  filteredVisas: PortalVisaListRow[];
  filtersActive: boolean;
  generateUploadUrl: PassportDocumentsViewProps["generateUploadUrl"];
  getPassportDocument: PassportDocumentsViewProps["getPassportDocument"];
  has: PortalPermissionChecker;
  jobCardDeletionOperations?: PortalJobCardDeletionOperation[];
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  openModal: PortalModalOpener;
  pagination: {
    jobCards?: PortalPaginationSlice;
  };
  periodFiltered: {
    tourManagers: PortalTourManagerAssignmentRow[];
    travellers: PortalTravellerListRow[];
  };
  removeHotel: (args: { hotelId?: string }) => Promise<unknown>;
  removeJobCard: (args: { jobCardId?: string }) => Promise<unknown>;
  removeManyHotels: (args: { hotelIds: string[] }) => Promise<unknown>;
  removeManyTourManagers: (args: { tourManagerIds: string[] }) => Promise<unknown>;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<unknown>;
  removeManyVisas: (args: { visaRecordIds: string[] }) => Promise<unknown>;
  removePassport: (args: { travellerId: string }) => Promise<unknown>;
  removeTourManager: (args: { tourManagerId?: string }) => Promise<unknown>;
  removeTraveller: (args: { travellerId?: string }) => Promise<unknown>;
  removeVisa: (args: { visaRecordId?: string }) => Promise<unknown>;
  roomCountSummary?: PortalRoomCountSummary;
  setJobCardFilter: (value: string) => void;
  updateCallingStatus: (args: { callingStatus: string; travellerId: string }) => Promise<unknown>;
  updateJobStatus: (args: { jobCardId: string; status: string }) => Promise<unknown>;
  view: string;
}

export function renderOperationsPortalView({
  view,
  workspace,
}: {
  view: string;
  workspace?: OperationsPortalWorkspaceSlice;
}): ReactNode {
  if (!isOperationsPortalView(view)) {
    return null;
  }
  if (!workspace) {
    throw new Error(`Operations portal view ${view} requires its workspace slice`);
  }

  if (view === "job-cards") {
    return (
      <JobCardsView
        access={workspace.access}
        deleteItem={workspace.deleteItem}
        filtersActive={workspace.filtersActive}
        has={workspace.has}
        jobCardDeletionOperations={workspace.jobCardDeletionOperations}
        openModal={workspace.openModal}
        removeJobCard={workspace.removeJobCard}
        rows={workspace.filteredJobCards}
        updateJobStatus={workspace.updateJobStatus}
      />
    );
  }

  if (view === "travellers") {
    return (
      <TravellersView
        countRows={workspace.periodFiltered.travellers}
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        filtersActive={workspace.filtersActive}
        has={workspace.has}
        jobCardFilter={workspace.jobCardFilter}
        jobCards={workspace.jobCards}
        openModal={workspace.openModal}
        removeManyTravellers={workspace.removeManyTravellers}
        removeTraveller={workspace.removeTraveller}
        rows={workspace.filteredTravellers}
        setJobCardFilter={workspace.setJobCardFilter}
      />
    );
  }

  if (view === "passport") {
    return (
      <PassportDocumentsView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        encryptAndStorePassport={workspace.encryptAndStorePassport}
        filtersActive={workspace.filtersActive}
        generateUploadUrl={workspace.generateUploadUrl}
        getPassportDocument={workspace.getPassportDocument}
        has={workspace.has}
        removeManyTravellers={workspace.removeManyTravellers}
        removePassport={workspace.removePassport}
        removeTraveller={workspace.removeTraveller}
        travellers={workspace.filteredPassportTravellers}
      />
    );
  }

  if (view === "visa") {
    return (
      <VisaTrackingView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        filtersActive={workspace.filtersActive}
        has={workspace.has}
        openModal={workspace.openModal}
        removeManyVisas={workspace.removeManyVisas}
        removeVisa={workspace.removeVisa}
        rows={workspace.filteredVisas}
      />
    );
  }

  if (view === "hotels") {
    return (
      <HotelRoomingView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        filtersActive={workspace.filtersActive}
        has={workspace.has}
        hotels={workspace.filteredHotels}
        jobCardFilter={workspace.jobCardFilter}
        jobCards={workspace.jobCards}
        openModal={workspace.openModal}
        removeHotel={workspace.removeHotel}
        removeManyHotels={workspace.removeManyHotels}
        removeManyTravellers={workspace.removeManyTravellers}
        removeTraveller={workspace.removeTraveller}
        roomCountPagination={workspace.pagination.jobCards}
        roomCountSummary={workspace.roomCountSummary}
        roomingRows={workspace.filteredRoomingTravellers}
        setJobCardFilter={workspace.setJobCardFilter}
      />
    );
  }

  return (
    <TourManagersView
      assignments={workspace.periodFiltered.tourManagers}
      canAssign={canAssignTourManagers(workspace.access)}
      deleteItem={workspace.deleteItem}
      deleteSelected={workspace.deleteSelected}
      has={workspace.has}
      openModal={workspace.openModal}
      removeManyTourManagers={workspace.removeManyTourManagers}
      removeTourManager={workspace.removeTourManager}
      rows={workspace.filteredTourManagers}
      travellers={workspace.periodFiltered.travellers}
      updateCallingStatus={workspace.updateCallingStatus}
    />
  );
}

export const TICKETING_PORTAL_VIEW_IDS = [
  "ticketing",
  "flights",
  "seat-allocation",
  "tickets",
] as const;

export type TicketingPortalViewId = (typeof TICKETING_PORTAL_VIEW_IDS)[number];

export function isTicketingPortalView(view: string): view is TicketingPortalViewId {
  return (TICKETING_PORTAL_VIEW_IDS as readonly string[]).includes(view);
}

export interface TicketingPortalWorkspaceSlice {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filteredAllTickets: PortalTicketListRow[];
  filteredPnrs: PortalPnrListRow[];
  filteredSeats: PortalSeatListRow[];
  filteredTickets: PortalTicketListRow[];
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  periodFiltered: {
    flightItinerary: PortalFlightItineraryGroup[];
  };
  removeManyPnrs: (args: { pnrIds: string[] }) => Promise<unknown>;
  removeManySeatAllocations: (args: { seatAllocationIds: string[] }) => Promise<unknown>;
  removeManyTickets: (args: { ticketIds: string[] }) => Promise<unknown>;
  removePnr: (args: { pnrId?: string }) => Promise<unknown>;
  removeSeatAllocation: (args: { seatAllocationId?: string }) => Promise<unknown>;
  removeTicket: (args: { ticketId?: string }) => Promise<unknown>;
  ticketDashboard?: PortalTicketDashboardSummary;
  view: string;
}

export function renderTicketingPortalView({
  view,
  workspace,
}: {
  view: string;
  workspace?: TicketingPortalWorkspaceSlice;
}): ReactNode {
  if (!isTicketingPortalView(view)) {
    return null;
  }
  if (!workspace) {
    throw new Error(`Ticketing portal view ${view} requires its workspace slice`);
  }

  if (view === "ticketing") {
    return (
      <TicketDashboardView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        has={workspace.has}
        openModal={workspace.openModal}
        removeManyTickets={workspace.removeManyTickets}
        removeTicket={workspace.removeTicket}
        summary={workspace.ticketDashboard}
        tickets={workspace.filteredTickets}
      />
    );
  }

  if (view === "flights") {
    return (
      <PnrView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        has={workspace.has}
        itinerary={workspace.periodFiltered.flightItinerary}
        openModal={workspace.openModal}
        removeManyPnrs={workspace.removeManyPnrs}
        removePnr={workspace.removePnr}
        rows={workspace.filteredPnrs}
      />
    );
  }

  if (view === "seat-allocation") {
    return (
      <SeatView
        deleteItem={workspace.deleteItem}
        deleteSelected={workspace.deleteSelected}
        has={workspace.has}
        openModal={workspace.openModal}
        removeManySeatAllocations={workspace.removeManySeatAllocations}
        removeSeatAllocation={workspace.removeSeatAllocation}
        rows={workspace.filteredSeats}
      />
    );
  }

  return (
    <TicketsView
      deleteItem={workspace.deleteItem}
      deleteSelected={workspace.deleteSelected}
      has={workspace.has}
      openModal={workspace.openModal}
      removeManyTickets={workspace.removeManyTickets}
      removeTicket={workspace.removeTicket}
      rows={workspace.filteredAllTickets}
    />
  );
}

export const ADMINISTRATION_PORTAL_VIEW_IDS = [
  "finance",
  "expenses",
  "approvals",
  "reports",
  "team",
  "employees-on-leave",
  "activity",
  "settings",
] as const;

export type AdministrationPortalViewId = (typeof ADMINISTRATION_PORTAL_VIEW_IDS)[number];

export function isAdministrationPortalView(view: string): view is AdministrationPortalViewId {
  return (ADMINISTRATION_PORTAL_VIEW_IDS as readonly string[]).includes(view);
}

export interface AdministrationPortalWorkspaceSlice {
  access: PortalAccessSlice & { staffId?: string };
  decideApproval: ApprovalsViewProps["decideApproval"];
  decideExpenseFinance: ExpensesViewProps["decideExpenseFinance"];
  decideExpenseManager: ExpensesViewProps["decideExpenseManager"];
  decideLeave: LeaveViewProps["decideLeave"];
  deleteItem: PortalDeleteHandler;
  dropdowns: SettingsViewProps["dropdowns"];
  filteredActivity: ActivityViewProps["activity"];
  filteredApprovals: ApprovalsViewProps["rows"];
  filteredExpenses: ExpensesViewProps["rows"];
  filteredInvoices: FinanceViewProps["rows"];
  filteredLeaves: LeaveViewProps["rows"];
  filteredStaff: SettingsViewProps["staff"];
  filteredTeam: TeamViewProps["rows"];
  filtersActive: boolean;
  financeOverview?: FinanceViewProps["overview"];
  getExpenseAttachmentUrl: ExpensesViewProps["getExpenseAttachmentUrl"];
  has: PortalPermissionChecker;
  leaveBalances?: LeaveViewProps["leaveBalances"];
  markNotificationRead: ActivityViewProps["markNotificationRead"];
  openModal: PortalModalOpener;
  periodFiltered: {
    notifications: ActivityViewProps["notifications"];
  };
  removeApproval: ApprovalsViewProps["removeApproval"];
  removeExpense: ExpensesViewProps["removeExpense"];
  removeExpenseProof: ExpensesViewProps["removeExpenseProof"];
  removeInvoice: FinanceViewProps["removeInvoice"];
  removeLeave: LeaveViewProps["removeLeave"];
  removeNotification: ActivityViewProps["removeNotification"];
  removeStaff: SettingsViewProps["removeStaff"];
  reports?: ReportsViewProps["report"];
  search: string;
  staff: Array<{ id: string; name: string }>;
  startStaffOnboarding: SettingsViewProps["startStaffOnboarding"];
  submitExpenseForApproval: ExpensesViewProps["submitExpenseForApproval"];
  team: PortalTeamMemberRow[];
  view: string;
}

export function renderAdministrationPortalView({
  view,
  workspace,
}: {
  view: string;
  workspace?: AdministrationPortalWorkspaceSlice;
}): ReactNode {
  if (!isAdministrationPortalView(view)) {
    return null;
  }
  if (!workspace) {
    throw new Error(`Administration portal view ${view} requires its workspace slice`);
  }

  if (view === "finance") {
    return (
      <FinanceView
        deleteItem={workspace.deleteItem}
        has={workspace.has}
        openModal={workspace.openModal}
        overview={workspace.financeOverview}
        removeInvoice={workspace.removeInvoice}
        rows={workspace.filteredInvoices}
      />
    );
  }

  if (view === "expenses") {
    return (
      <ExpensesView
        decideExpenseFinance={workspace.decideExpenseFinance}
        decideExpenseManager={workspace.decideExpenseManager}
        deleteItem={workspace.deleteItem}
        filtersActive={workspace.filtersActive}
        getExpenseAttachmentUrl={workspace.getExpenseAttachmentUrl}
        has={workspace.has}
        openModal={workspace.openModal}
        removeExpense={workspace.removeExpense}
        removeExpenseProof={workspace.removeExpenseProof}
        rows={workspace.filteredExpenses}
        submitExpenseForApproval={workspace.submitExpenseForApproval}
      />
    );
  }

  if (view === "approvals") {
    return (
      <ApprovalsView
        decideApproval={workspace.decideApproval}
        deleteItem={workspace.deleteItem}
        has={workspace.has}
        openModal={workspace.openModal}
        removeApproval={workspace.removeApproval}
        rows={workspace.filteredApprovals}
      />
    );
  }

  if (view === "reports") {
    return <ReportsView report={workspace.reports} />;
  }

  if (view === "team") {
    return <TeamView rows={workspace.filteredTeam} />;
  }

  if (view === "employees-on-leave") {
    return (
      <LeaveView
        access={workspace.access}
        decideLeave={workspace.decideLeave}
        deleteItem={workspace.deleteItem}
        has={workspace.has}
        leaveBalances={workspace.leaveBalances}
        openModal={workspace.openModal}
        removeLeave={workspace.removeLeave}
        rows={workspace.filteredLeaves}
        staff={workspace.staff.length > 0 ? workspace.staff : workspace.team}
      />
    );
  }

  if (view === "activity") {
    return (
      <ActivityView
        activity={workspace.filteredActivity}
        deleteItem={workspace.deleteItem}
        markNotificationRead={workspace.markNotificationRead}
        notifications={workspace.periodFiltered.notifications}
        removeNotification={workspace.removeNotification}
      />
    );
  }

  return (
    <SettingsView
      deleteItem={workspace.deleteItem}
      dropdowns={workspace.dropdowns || {}}
      openModal={workspace.openModal}
      removeStaff={workspace.removeStaff}
      search={workspace.search}
      staff={workspace.filteredStaff}
      startStaffOnboarding={workspace.startStaffOnboarding}
    />
  );
}

export const ALL_PORTAL_VIEW_IDS = [
  ...CORE_PORTAL_VIEW_IDS,
  ...PILOT_PORTAL_VIEW_IDS,
  ...OPERATIONS_PORTAL_VIEW_IDS,
  ...TICKETING_PORTAL_VIEW_IDS,
  ...ADMINISTRATION_PORTAL_VIEW_IDS,
] as const;

export type PortalViewId = (typeof ALL_PORTAL_VIEW_IDS)[number];

export function renderPortalView(inputs: PortalViewRegistryInputs): ReactNode {
  const { view } = inputs;
  return (
    renderCorePortalView({ view, workspace: { view, ...inputs.core } }) ??
    renderPilotPortalView({ view, workspace: { view, ...inputs.pilot } }) ??
    renderOperationsPortalView({ view, workspace: { view, ...inputs.operations } }) ??
    renderTicketingPortalView({ view, workspace: { view, ...inputs.ticketing } }) ??
    renderAdministrationPortalView({ view, workspace: { view, ...inputs.administration } })
  );
}
