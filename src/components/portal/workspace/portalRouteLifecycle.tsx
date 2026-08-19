"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import type { PortalWorkspaceImplementationState } from "@/components/portal/usePortalWorkspaceState";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { canAssignTourManagers, canHeadAssignQueryTeams } from "@/lib/portal/permissions";
import {
  getPortalRouteAccessibilityMetadata,
  getPortalRouteDefinition,
  resolvePortalRoutePagination,
} from "@/lib/portal/portalRouteManifest";
import { LoadingPanel } from "./portalAdminHelpers";
import {
  AccountsJobCardView,
  ActivityView,
  ApprovalsView,
  ContractingView,
  DashboardView,
  ExpensesView,
  FinanceView,
  HotelRoomingView,
  InboundLeadsView,
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
import type { PortalPaginationSlice } from "./portalViewTypes";

export interface PortalRouteModel {
  component: string;
  content: ReactNode;
  family: string;
  pagination: PortalPaginationSlice | undefined;
  view: string;
}

export function PortalRouteAccessibility({ gate, view }: { gate: string; view: string }) {
  const metadata = getPortalRouteAccessibilityMetadata(view);
  const previousReadyViewRef = useRef(view);
  const historyNavigationRef = useRef(false);

  useEffect(() => {
    const markHistoryNavigation = () => {
      historyNavigationRef.current = true;
    };
    window.addEventListener("popstate", markHistoryNavigation);
    return () => window.removeEventListener("popstate", markHistoryNavigation);
  }, []);

  useEffect(() => {
    document.title = metadata.documentTitle;
    if (gate !== "ready" || previousReadyViewRef.current === view) {
      return;
    }

    previousReadyViewRef.current = view;
    if (historyNavigationRef.current) {
      historyNavigationRef.current = false;
      return;
    }

    const frame = requestAnimationFrame(() => {
      document.getElementById(metadata.headingId)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [gate, metadata.documentTitle, metadata.headingId, view]);

  return (
    <h1 className="sr-only" id={metadata.headingId} tabIndex={-1}>
      {metadata.headingText}
    </h1>
  );
}

function assertNeverRouteComponent(component: never): never {
  throw new Error(`Unsupported portal route component: ${String(component)}`);
}

export function PortalRouteLifecycleBoundary({
  children,
  gate,
  view,
}: {
  children: ReactNode;
  gate: string;
  view: string;
}) {
  const route = getPortalRouteDefinition(view);
  if (gate === "loading") {
    return <LoadingPanel />;
  }
  if (gate === "denied") {
    return (
      <div
        className="rounded-2xl border border-brand-border bg-white p-8 shadow-sm"
        data-portal-route-family={route.family}
      >
        <div className="font-heading font-semibold text-citius-blue text-xl">
          No access to this portal page
        </div>
        <p className="mt-2 text-brand-muted text-sm">
          Your account is signed in, but your staff role does not include this module.
        </p>
      </div>
    );
  }
  return (
    <div data-portal-route-component={route.component} data-portal-route-family={route.family}>
      {children}
    </div>
  );
}

function selectPortalRouteContent(
  view: string,
  workspace: PortalWorkspaceImplementationState
): ReactNode {
  const { component } = getPortalRouteDefinition(view);
  switch (component) {
    case "AccountsJobCardView":
      return (
        <AccountsJobCardView
          access={workspace.access ?? {}}
          creators={workspace.accountsJobCardCreators || []}
          jobCards={workspace.filteredJobCards}
          openModal={workspace.openModal}
          rows={workspace.filteredAccountsQueries}
          setJobCardCreatorAccess={workspace.setJobCardCreatorAccess}
        />
      );
    case "ActivityView":
      return (
        <ActivityView
          activity={workspace.filteredActivity}
          canViewActivityLog={workspace.has(P.VIEW_ACTIVITY)}
          deleteItem={workspace.deleteItem}
          emailDeliverySummaries={workspace.emailDeliverySummaries}
          markNotificationRead={workspace.markNotificationRead}
          notifications={workspace.periodFiltered.notifications}
          removeNotification={workspace.removeNotification}
        />
      );
    case "ApprovalsView":
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
    case "ContractingView":
      return (
        <ContractingView
          access={workspace.access ?? {}}
          canAssign={canHeadAssignQueryTeams(workspace.access ?? {})}
          deleteItem={workspace.deleteItem}
          filtersActive={workspace.filtersActive}
          getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
          getQueryAttachmentUrl={workspace.getQueryAttachmentUrl}
          has={workspace.has}
          loading={workspace.queries === undefined}
          openModal={workspace.openModal}
          removeQuery={workspace.removeQuery}
          rows={workspace.filteredContractingQueries}
          team={workspace.team || []}
        />
      );
    case "DashboardView":
      return (
        <DashboardView
          access={workspace.access ?? {}}
          dateRange={{ from: workspace.dateRange.from ?? null, to: workspace.dateRange.to ?? null }}
          has={workspace.has}
          loading={workspace.summary === undefined}
          openModal={workspace.openModal}
          setDateRange={workspace.setDateRangeWithUrl}
          summary={workspace.summary}
        />
      );
    case "LeaveView":
      return (
        <LeaveView
          access={workspace.access ?? {}}
          decideLeave={workspace.decideLeave}
          deleteItem={workspace.deleteItem}
          has={workspace.has}
          leaveBalances={workspace.leaveBalances}
          openModal={workspace.openModal}
          removeLeave={workspace.removeLeave}
          rows={workspace.filteredLeaves}
          staff={workspace.staff || workspace.team || []}
        />
      );
    case "ExpensesView":
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
    case "FinanceView":
      return (
        <FinanceView
          deleteItem={workspace.deleteItem}
          has={workspace.has}
          loading={workspace.invoices === undefined || workspace.financeOverview === undefined}
          openModal={workspace.openModal}
          overview={workspace.financeOverview}
          removeInvoice={workspace.removeInvoice}
          rows={workspace.filteredInvoices}
        />
      );
    case "PnrView":
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
    case "HotelRoomingView":
      return (
        <HotelRoomingView
          deleteItem={workspace.deleteItem}
          deleteSelected={workspace.deleteSelected}
          filtersActive={workspace.filtersActive}
          has={workspace.has}
          hotels={workspace.filteredHotels}
          jobCardFilter={workspace.jobCardFilter}
          jobCards={workspace.jobCards || []}
          loading={
            workspace.hotels === undefined ||
            workspace.travellers === undefined ||
            workspace.roomCountSummary === undefined
          }
          openModal={workspace.openModal}
          removeHotel={workspace.removeHotel}
          removeManyHotels={workspace.removeManyHotels}
          removeManyTravellers={workspace.removeManyTravellers}
          removeTraveller={workspace.removeTraveller}
          roomCountPagination={workspace.pagination.jobCards}
          roomCountSummary={workspace.roomCountSummary}
          roomingRows={workspace.filteredRoomingTravellers}
          setJobCardFilter={workspace.setJobCardFilterWithUrl}
        />
      );
    case "InboundLeadsView":
      return <InboundLeadsView allowed={workspace.allowed} canFetch={workspace.canFetch} />;
    case "JobCardsView":
      return (
        <JobCardsView
          access={workspace.access ?? {}}
          deleteItem={workspace.deleteItem}
          filtersActive={workspace.filtersActive}
          has={workspace.has}
          jobCardDeletionOperations={workspace.jobCardDeletionOperations}
          loading={workspace.jobCards === undefined}
          openModal={workspace.openModal}
          removeJobCard={workspace.removeJobCard}
          rows={workspace.filteredJobCards}
          updateJobStatus={workspace.updateJobStatus}
        />
      );
    case "PassportDocumentsView":
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
    case "PipelineView":
      return (
        <PipelineView
          canMoveContractingPipeline={workspace.canMoveContractingPipeline}
          canMoveSalesPipeline={workspace.canMoveSalesPipeline}
          mode={workspace.pipelineMode}
          moveContractingPipelineStage={workspace.moveContractingPipelineStage}
          moveSalesPipelineStage={workspace.moveSalesPipelineStage}
          rows={workspace.filteredPipelineQueries}
          setMode={workspace.setPipelineMode}
        />
      );
    case "ProposalsView":
      return (
        <ProposalsView
          deleteItem={workspace.deleteItem}
          getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
          getProposalAttachmentUrl={workspace.getProposalAttachmentUrl}
          has={workspace.has}
          loading={workspace.proposals === undefined}
          openModal={workspace.openModal}
          removeProposal={workspace.removeProposal}
          rows={workspace.filteredProposals}
          sendProposalToSales={workspace.sendProposalToSales}
        />
      );
    case "QueriesView":
      return (
        <QueriesView
          access={workspace.access ?? {}}
          deleteItem={workspace.deleteItem}
          filtersActive={workspace.filtersActive}
          getFinalizedPdfUrl={workspace.getFinalizedPdfUrl}
          getQueryAttachmentUrl={workspace.getQueryAttachmentUrl}
          has={workspace.has}
          loading={workspace.queries === undefined}
          openModal={workspace.openModal}
          removeQuery={workspace.removeQuery}
          rows={workspace.filteredQueries}
          submitToContracting={workspace.submitToContracting}
        />
      );
    case "ReportsView":
      return <ReportsView report={workspace.reports} />;
    case "SeatView":
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
    case "SettingsView":
      return (
        <SettingsView
          access={workspace.access ?? {}}
          deleteItem={workspace.deleteItem}
          dropdowns={workspace.dropdowns || {}}
          openModal={workspace.openModal}
          removeStaff={workspace.removeStaff}
          search={workspace.search}
          staff={workspace.filteredStaff}
          startStaffOnboarding={workspace.startStaffOnboarding}
        />
      );
    case "TeamView":
      return <TeamView rows={workspace.filteredTeam} />;
    case "TicketDashboardView":
      return (
        <TicketDashboardView
          deleteItem={workspace.deleteItem}
          deleteSelected={workspace.deleteSelected}
          has={workspace.has}
          openModal={workspace.openModal}
          removeManyTickets={workspace.removeManyTickets}
          removeTicket={workspace.removeTicket}
          summary={workspace.ticketDashboard}
        />
      );
    case "TicketsView":
      return (
        <TicketsView
          deleteItem={workspace.deleteItem}
          deleteSelected={workspace.deleteSelected}
          has={workspace.has}
          loading={workspace.tickets === undefined}
          openModal={workspace.openModal}
          removeManyTickets={workspace.removeManyTickets}
          removeTicket={workspace.removeTicket}
          rows={workspace.filteredAllTickets}
        />
      );
    case "TourManagersView":
      return (
        <TourManagersView
          assignments={workspace.periodFiltered.tourManagers}
          canAssign={canAssignTourManagers(workspace.access ?? {})}
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
    case "TravellersView":
      return (
        <TravellersView
          countRows={workspace.periodFiltered.travellers}
          deleteItem={workspace.deleteItem}
          deleteSelected={workspace.deleteSelected}
          filtersActive={workspace.filtersActive}
          has={workspace.has}
          jobCardFilter={workspace.jobCardFilter}
          jobCards={workspace.jobCards || []}
          openModal={workspace.openModal}
          removeManyTravellers={workspace.removeManyTravellers}
          removeTraveller={workspace.removeTraveller}
          rows={workspace.filteredTravellers}
          setJobCardFilter={workspace.setJobCardFilterWithUrl}
        />
      );
    case "VisaTrackingView":
      return (
        <VisaTrackingView
          deleteItem={workspace.deleteItem}
          deleteSelected={workspace.deleteSelected}
          filtersActive={workspace.filtersActive}
          has={workspace.has}
          loading={workspace.visas === undefined}
          openModal={workspace.openModal}
          removeManyVisas={workspace.removeManyVisas}
          removeVisa={workspace.removeVisa}
          rows={workspace.filteredVisas}
        />
      );
    default:
      return assertNeverRouteComponent(component);
  }
}

export function createPortalRouteModel(
  view: string,
  workspace: PortalWorkspaceImplementationState
): PortalRouteModel {
  const definition = getPortalRouteDefinition(view);
  return Object.freeze({
    component: definition.component,
    content: selectPortalRouteContent(view, workspace),
    family: definition.family,
    pagination: resolvePortalRoutePagination(view, workspace.pagination),
    view,
  });
}

export function renderPortalRoute(route: PortalRouteModel): ReactNode {
  return route.content;
}
