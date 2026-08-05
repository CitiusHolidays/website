"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, ComponentType } from "react";

function portalViewLoading() {
  return <div aria-hidden className="min-h-[12rem] animate-pulse rounded-xl bg-brand-light/60" />;
}

function lazyView<
  TModule extends Record<string, ComponentType<any>>,
  TExportName extends keyof TModule & string,
>(loader: () => Promise<TModule>, exportName: TExportName) {
  type Props = ComponentProps<TModule[TExportName]>;

  return dynamic<Props>(
    () => loader().then((module) => module[exportName] as ComponentType<Props>),
    { loading: portalViewLoading }
  );
}

export const DashboardView = lazyView(
  () => import("@/components/portal/dashboard/DashboardView"),
  "DashboardView"
);
export const PipelineView = lazyView(
  () => import("@/components/portal/pipeline/PipelineView"),
  "PipelineView"
);
export const AccountsJobCardView = lazyView(
  () => import("./accounts/AccountsJobCardView"),
  "AccountsJobCardView"
);
export const ActivityView = lazyView(() => import("./admin/ActivityView"), "ActivityView");
export const ApprovalsView = lazyView(() => import("./admin/ApprovalsView"), "ApprovalsView");
export const ExpensesView = lazyView(() => import("./admin/ExpensesView"), "ExpensesView");
export const FinanceView = lazyView(() => import("./admin/FinanceView"), "FinanceView");
export const LeaveView = lazyView(() => import("./admin/LeaveView"), "LeaveView");
export const ReportsView = lazyView(() => import("./admin/ReportsView"), "ReportsView");
export const SettingsView = lazyView(() => import("./admin/SettingsView"), "SettingsView");
export const TeamView = lazyView(() => import("./admin/TeamView"), "TeamView");
export const ContractingView = lazyView(() => import("./ContractingView"), "ContractingView");
export const HotelRoomingView = lazyView(
  () => import("./operations/HotelRoomingView"),
  "HotelRoomingView"
);
export const JobCardsView = lazyView(() => import("./operations/JobCardsView"), "JobCardsView");
export const PassportDocumentsView = lazyView(
  () => import("./operations/PassportDocumentsView"),
  "PassportDocumentsView"
);
export const TourManagersView = lazyView(
  () => import("./operations/TourManagersView"),
  "TourManagersView"
);
export const TravellersView = lazyView(
  () => import("./operations/TravellersView"),
  "TravellersView"
);
export const VisaTrackingView = lazyView(
  () => import("./operations/VisaTrackingView"),
  "VisaTrackingView"
);
export const ProposalsView = lazyView(() => import("./ProposalsView"), "ProposalsView");
export const QueriesView = lazyView(() => import("./QueriesView"), "QueriesView");
export const PnrView = lazyView(() => import("./ticketing/PnrView"), "PnrView");
export const SeatView = lazyView(() => import("./ticketing/SeatView"), "SeatView");
export const TicketDashboardView = lazyView(
  () => import("./ticketing/TicketDashboardView"),
  "TicketDashboardView"
);
export const TicketsView = lazyView(() => import("./ticketing/TicketsView"), "TicketsView");
