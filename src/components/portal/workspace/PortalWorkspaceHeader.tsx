"use client";

import { Download, MoreHorizontal, Plus, Upload } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";
import { PortalCommandPaletteTrigger } from "@/components/portal/PortalCommandPalette";
import PortalListToolbar from "@/components/portal/PortalListToolbar";
import { jobCardFilterOptions } from "@/components/portal/workspace/portalOperationsHelpers";
import { Button } from "@/components/ui/application-button";
import type { JsonObject } from "@/lib/jsonValue";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { canAssignTourManagers, canHeadAssignQueryTeams } from "@/lib/portal/permissions";
import {
  type PortalRouteDefinition,
  resolvePortalRoutePagination,
} from "@/lib/portal/portalRouteManifest";
import { hasOwnKey } from "../../../lib/runtimeValues";
import type {
  PortalAccessSlice,
  PortalPaginationSlice,
  PortalPermissionChecker,
  PortalTicketDashboardSummary,
} from "./portalViewTypes";

const P = PORTAL_PERMISSIONS;

function WorkspaceErrorBanner({ message }: { message: string }) {
  return (
    <>
      <div aria-atomic="true" aria-live="assertive" className="sr-only" role="alert">
        {message}
      </div>
      {message ? (
        <div
          aria-hidden="true"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm"
        >
          {message}
        </div>
      ) : null}
    </>
  );
}

export interface PortalWorkspaceHeaderSlice {
  access?: PortalAccessSlice;
  clearAllFilters: () => void;
  dateRange: { from?: string | null; to?: string | null };
  error: string;
  filtersActive: boolean;
  has: PortalPermissionChecker;
  jobCardFilter: string;
  jobCards?: Array<{ clientName?: string; id: string; jobCode: string }>;
  listFilterConfig: Array<{ id: string; label: string; options?: string[] }>;
  listFilters: Record<string, string>;
  meta: PortalRouteDefinition;
  modal: string | null;
  openModal: (modal: string, initial?: JsonObject) => void;
  pagination: Record<string, PortalPaginationSlice>;
  periodFiltered: {
    activity: unknown[];
    approvals: unknown[];
    expenses: unknown[];
    invoices: unknown[];
    jobCards: unknown[];
    leaves: unknown[];
    pnrs: unknown[];
    proposals: unknown[];
    queries: unknown[];
    seats: unknown[];
    tickets: unknown[];
    tourManagers: unknown[];
    travellers: Array<{ hotelAllocation?: string; roomType?: string }>;
    visas: unknown[];
  };
  search: string;
  searchPreparing: boolean;
  setDateRangeWithUrl: (value: { from: string | null; to: string | null }) => void;
  setJobCardFilterWithUrl: (value: string) => void;
  setListFilterValue: (key: string, value: string) => void;
  setSearchWithUrl: (value: string) => void;
  showJobCardFilter: boolean;
  team: unknown[];
  ticketDashboard?: PortalTicketDashboardSummary;
  view: string;
  viewResultCount: number | null;
}

function HeaderMoreMenu({
  actions,
  label,
}: {
  actions: { icon: ReactElement; label: string; onClick: () => void }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const renderTrigger = (props: React.ComponentProps<typeof Button>) => (
    <Button {...props} className="portal-small-btn bg-white" type="button">
      <MoreHorizontal size={16} />
      More
    </Button>
  );
  if (actions.length === 0) {
    return null;
  }
  return (
    <PortalActionMenu
      align="right"
      aria-label={label}
      onOpenChange={setOpen}
      open={open}
      trigger={renderTrigger}
    >
      {actions.map((action) => (
        <HeaderMenuAction action={action} closeMenu={setOpen} key={action.label} />
      ))}
    </PortalActionMenu>
  );
}

function HeaderMenuAction({
  action,
  closeMenu,
}: {
  action: { icon: ReactElement; label: string; onClick: () => void };
  closeMenu: (open: boolean) => void;
}) {
  const handleClick = () => {
    closeMenu(false);
    action.onClick();
  };
  return (
    <Button
      className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-brand-dark text-sm hover:bg-brand-light"
      onClick={handleClick}
      role="menuitem"
      type="button"
    >
      {action.icon}
      {action.label}
    </Button>
  );
}

function ModalActionButton({
  label,
  modal,
  openModal,
}: {
  label: string;
  modal: string;
  openModal: (modal: string, initial?: JsonObject) => void;
}) {
  const handleClick = () => openModal(modal);
  return (
    <Button className="portal-primary-btn" onClick={handleClick} type="button">
      <Plus size={16} />
      {label}
    </Button>
  );
}

const HEADER_BULK_ACTIONS = {
  flights: {
    exportLabel: "Export Flights",
    exportModal: "flightExport",
    importLabel: "Import Flights",
    importModal: "flightImport",
    menuLabel: "Flights list actions",
    primaryLabel: "Add PNR",
    primaryModal: "pnr",
  },
  hotels: {
    exportLabel: "Export Rooming",
    exportModal: "roomingExport",
    importLabel: "Import Rooming",
    importModal: "roomingImport",
    menuLabel: "Hotels and rooming actions",
    primaryLabel: "Add Hotel",
    primaryModal: "hotel",
  },
  passport: {
    exportLabel: "Export Passport",
    exportModal: "passportExport",
    importLabel: "Import Passport",
    importModal: "passportImport",
    menuLabel: "Passport list actions",
  },
  ticketing: {
    exportLabel: "Export Passengers",
    exportModal: "passengerExport",
    importLabel: "Import Passengers",
    importModal: "passengerImport",
    menuLabel: "Ticketing list actions",
    primaryLabel: "Issue Ticket",
    primaryModal: "ticket",
  },
  travellers: {
    exportLabel: "Export Traveller Master",
    exportModal: "travellerExport",
    importLabel: "Import Traveller Master",
    importModal: "travellerImport",
    menuLabel: "Traveller list actions",
    primaryLabel: "Add Traveller",
    primaryModal: "traveller",
  },
  visa: {
    exportLabel: "Export Visa",
    exportModal: "visaExport",
    importLabel: "Import Visa",
    importModal: "visaImport",
    menuLabel: "Visa list actions",
    primaryLabel: "Create Visa Record",
    primaryModal: "visa_create",
  },
} as const;

type HeaderBulkActionKind = keyof typeof HEADER_BULK_ACTIONS;

function bulkActionKind(view: string, has: PortalPermissionChecker): HeaderBulkActionKind | null {
  if (view === "travellers" && has(P.MANAGE_TRAVELLERS)) {
    return "travellers";
  }
  if ((view === "ticketing" || view === "flights") && has(P.MANAGE_TICKETING)) {
    return view;
  }
  if (view === "hotels" && has(P.MANAGE_OPERATIONS)) {
    return "hotels";
  }
  if ((view === "passport" || view === "visa") && has(P.MANAGE_VISA)) {
    return view;
  }
  return null;
}

function HeaderBulkActions({
  kind,
  openModal,
}: {
  kind: HeaderBulkActionKind;
  openModal: (modal: string, initial?: JsonObject) => void;
}) {
  const config = HEADER_BULK_ACTIONS[kind];
  const actions = [
    {
      icon: <Download size={16} />,
      label: config.exportLabel,
      onClick: () => openModal(config.exportModal),
    },
    {
      icon: <Upload size={16} />,
      label: config.importLabel,
      onClick: () => openModal(config.importModal),
    },
  ];
  const menu = <HeaderMoreMenu actions={actions} label={config.menuLabel} />;
  if (!("primaryModal" in config)) {
    return menu;
  }
  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      {menu}
      <ModalActionButton
        label={config.primaryLabel}
        modal={config.primaryModal}
        openModal={openModal}
      />
    </div>
  );
}

function primaryHeaderAction(
  view: string,
  has: PortalPermissionChecker,
  access: PortalAccessSlice
): false | [string, string] {
  const actions = {
    contracting: canHeadAssignQueryTeams(access) ? ["assignQueryTeams", "Assign teams"] : false,
    "employees-on-leave":
      has(P.REQUEST_LEAVE) || has(P.MANAGE_LEAVE)
        ? ["leave_create", has(P.MANAGE_LEAVE) ? "Record Leave" : "Request Leave"]
        : false,
    expenses: has(P.CREATE_EXPENSES) ? ["expense", "Add Expense"] : false,
    proposals: has(P.MANAGE_PROPOSALS) ? ["proposal", "New Proposal"] : false,
    queries: has(P.MANAGE_QUERIES) ? ["query", "New Query"] : false,
    "seat-allocation": has(P.MANAGE_TICKETING) ? ["seat", "Save Seat"] : false,
    settings: has(P.MANAGE_STAFF) ? ["staff", "Add Staff"] : false,
    tickets: has(P.MANAGE_TICKETING) ? ["ticket", "Issue Ticket"] : false,
    "tour-managers": canAssignTourManagers(access) ? ["tourManager", "Add Tour Manager"] : false,
  } satisfies Record<string, false | [string, string]>;
  return hasOwnKey(actions, view) ? actions[view] : false;
}

function HeaderActions({
  view,
  openModal,
  has,
  access,
}: {
  access: PortalAccessSlice;
  has: PortalPermissionChecker;
  openModal: (modal: string, initial?: JsonObject) => void;
  view: string;
}) {
  const bulkKind = bulkActionKind(view, has);
  if (bulkKind) {
    return <HeaderBulkActions kind={bulkKind} openModal={openModal} />;
  }
  const action = primaryHeaderAction(view, has, access);
  if (!action) {
    return null;
  }
  return <ModalActionButton label={action[1]} modal={action[0]} openModal={openModal} />;
}

export function PortalWorkspaceHeader({ workspace }: { workspace: PortalWorkspaceHeaderSlice }) {
  if (workspace.view === "dashboard") {
    return <WorkspaceErrorBanner message={workspace.modal ? "" : workspace.error} />;
  }

  // Inbound leads own their status/source/search controls so the review and
  // conversion panel stay together instead of rendering a second generic
  // toolbar with unrelated Query filters.
  if (workspace.view === "inbound-leads") {
    return <WorkspaceErrorBanner message={workspace.modal ? "" : workspace.error} />;
  }

  const filterSourceRowsByView = {
    activity: workspace.periodFiltered.activity,
    approvals: workspace.periodFiltered.approvals,
    "employees-on-leave": workspace.periodFiltered.leaves,
    expenses: workspace.periodFiltered.expenses,
    finance: workspace.periodFiltered.invoices,
    flights: workspace.periodFiltered.pnrs,
    hotels: workspace.periodFiltered.travellers.filter(
      (row) => row.roomType || row.hotelAllocation
    ),
    "job-cards": workspace.periodFiltered.jobCards,
    passport: workspace.periodFiltered.travellers,
    proposals: workspace.periodFiltered.proposals,
    "seat-allocation": workspace.periodFiltered.seats,
    team: workspace.team,
    ticketing: workspace.ticketDashboard?.preview,
    tickets: workspace.periodFiltered.tickets,
    "tour-managers": workspace.periodFiltered.tourManagers,
    travellers: workspace.periodFiltered.travellers,
    visa: workspace.periodFiltered.visas,
  } satisfies Record<string, unknown[] | undefined>;
  const filterSourceRows = hasOwnKey(filterSourceRowsByView, workspace.view)
    ? filterSourceRowsByView[workspace.view]
    : workspace.periodFiltered.queries;
  const viewPagination = resolvePortalRoutePagination(workspace.view, workspace.pagination);

  return (
    <>
      <PortalListToolbar
        actions={
          <HeaderActions
            access={workspace.access ?? {}}
            has={workspace.has}
            openModal={workspace.openModal}
            view={workspace.view}
          />
        }
        commandPalette={<PortalCommandPaletteTrigger />}
        dateRange={workspace.dateRange}
        defaultFiltersOpen={workspace.view === "hotels"}
        filterSourceRows={filterSourceRows}
        filtersActive={workspace.filtersActive}
        jobCardFilter={workspace.jobCardFilter}
        jobCardFilterOptions={jobCardFilterOptions}
        jobCards={workspace.jobCards}
        listFilterConfig={workspace.listFilterConfig}
        listFilters={workspace.listFilters}
        onClearAllFilters={workspace.clearAllFilters}
        resultCount={workspace.viewResultCount ?? null}
        resultsPartial={Boolean(viewPagination?.canLoadMore || viewPagination?.isLoadingMore)}
        search={workspace.search}
        setDateRange={workspace.setDateRangeWithUrl}
        setJobCardFilter={workspace.setJobCardFilterWithUrl}
        setListFilterValue={workspace.setListFilterValue}
        setSearch={workspace.setSearchWithUrl}
        showJobCardFilter={workspace.showJobCardFilter && workspace.view !== "hotels"}
        showPeriodFilter={!["settings", "team"].includes(workspace.view)}
        showSearch
        title={workspace.meta.title}
      />

      {workspace.searchPreparing ? (
        <div
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 text-sm"
          role="status"
        >
          Search is temporarily unavailable while the bounded CRM search index is preparing. Your
          filter has been preserved.
        </div>
      ) : null}

      <WorkspaceErrorBanner message={workspace.modal ? "" : workspace.error} />
    </>
  );
}

export function WorkspacePagination({ pagination }: { pagination?: PortalPaginationSlice }) {
  if (!pagination) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
      <span aria-live="polite" className="text-brand-muted text-xs" role="status">
        {pagination.loadedCount ?? 0} authorized records loaded
        {pagination.canLoadMore ? "; more are available." : "; all available records are loaded."}
      </span>
      {pagination.canLoadMore || pagination.isLoadingMore ? (
        <Button
          aria-busy={pagination.isLoadingMore || undefined}
          className="portal-small-btn bg-white"
          disabled={pagination.isLoadingMore}
          onClick={pagination.loadMore}
          type="button"
        >
          {pagination.isLoadingMore ? "Loading more…" : "Load more records"}
        </Button>
      ) : null}
    </div>
  );
}
