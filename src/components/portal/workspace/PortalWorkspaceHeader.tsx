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
  if (actions.length === 0) {
    return null;
  }
  return (
    <PortalActionMenu
      align="right"
      aria-label={label}
      onOpenChange={setOpen}
      open={open}
      trigger={(props) => (
        <Button {...props} className="portal-small-btn bg-white" type="button">
          <MoreHorizontal size={16} />
          More
        </Button>
      )}
    >
      {actions.map((action) => (
        <Button
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-brand-dark text-sm hover:bg-brand-light"
          key={action.label}
          onClick={() => {
            setOpen(false);
            action.onClick();
          }}
          role="menuitem"
          type="button"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </PortalActionMenu>
  );
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
  if (view === "travellers" && has(P.MANAGE_TRAVELLERS)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <HeaderMoreMenu
          actions={[
            {
              icon: <Download size={16} />,
              label: "Export Traveller Master",
              onClick: () => openModal("travellerExport"),
            },
            {
              icon: <Upload size={16} />,
              label: "Import Traveller Master",
              onClick: () => openModal("travellerImport"),
            },
          ]}
          label="Traveller list actions"
        />
        <Button className="portal-primary-btn" onClick={() => openModal("traveller")} type="button">
          <Plus size={16} />
          Add Traveller
        </Button>
      </div>
    );
  }
  if (view === "ticketing" && has(P.MANAGE_TICKETING)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <HeaderMoreMenu
          actions={[
            {
              icon: <Download size={16} />,
              label: "Export Passengers",
              onClick: () => openModal("passengerExport"),
            },
            {
              icon: <Upload size={16} />,
              label: "Import Passengers",
              onClick: () => openModal("passengerImport"),
            },
          ]}
          label="Ticketing list actions"
        />
        <Button className="portal-primary-btn" onClick={() => openModal("ticket")} type="button">
          <Plus size={16} />
          Issue Ticket
        </Button>
      </div>
    );
  }
  if (view === "flights" && has(P.MANAGE_TICKETING)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <HeaderMoreMenu
          actions={[
            {
              icon: <Download size={16} />,
              label: "Export Flights",
              onClick: () => openModal("flightExport"),
            },
            {
              icon: <Upload size={16} />,
              label: "Import Flights",
              onClick: () => openModal("flightImport"),
            },
          ]}
          label="Flights list actions"
        />
        <Button className="portal-primary-btn" onClick={() => openModal("pnr")} type="button">
          <Plus size={16} />
          Add PNR
        </Button>
      </div>
    );
  }
  if (view === "hotels" && has(P.MANAGE_OPERATIONS)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <HeaderMoreMenu
          actions={[
            {
              icon: <Download size={16} />,
              label: "Export Rooming",
              onClick: () => openModal("roomingExport"),
            },
            {
              icon: <Upload size={16} />,
              label: "Import Rooming",
              onClick: () => openModal("roomingImport"),
            },
          ]}
          label="Hotels and rooming actions"
        />
        <Button className="portal-primary-btn" onClick={() => openModal("hotel")} type="button">
          <Plus size={16} />
          Add Hotel
        </Button>
      </div>
    );
  }
  if (view === "passport" && has(P.MANAGE_VISA)) {
    return (
      <HeaderMoreMenu
        actions={[
          {
            icon: <Download size={16} />,
            label: "Export Passport",
            onClick: () => openModal("passportExport"),
          },
          {
            icon: <Upload size={16} />,
            label: "Import Passport",
            onClick: () => openModal("passportImport"),
          },
        ]}
        label="Passport list actions"
      />
    );
  }
  if (view === "visa" && has(P.MANAGE_VISA)) {
    return (
      <div className="flex shrink-0 flex-nowrap items-center gap-2">
        <HeaderMoreMenu
          actions={[
            {
              icon: <Download size={16} />,
              label: "Export Visa",
              onClick: () => openModal("visaExport"),
            },
            {
              icon: <Upload size={16} />,
              label: "Import Visa",
              onClick: () => openModal("visaImport"),
            },
          ]}
          label="Visa list actions"
        />
        <Button
          className="portal-primary-btn"
          onClick={() => openModal("visa_create")}
          type="button"
        >
          <Plus size={16} />
          Create Visa Record
        </Button>
      </div>
    );
  }
  const actions = {
    contracting: canHeadAssignQueryTeams(access) ? ["assignQueryTeams", "Assign teams"] : false,
    "employees-on-leave":
      has(P.REQUEST_LEAVE) || has(P.MANAGE_LEAVE)
        ? ["leave_create", has(P.MANAGE_LEAVE) ? "Record Leave" : "Request Leave"]
        : false,
    expenses: has(P.CREATE_EXPENSES) && ["expense", "Add Expense"],
    proposals: has(P.MANAGE_PROPOSALS) ? ["proposal", "New Proposal"] : false,
    queries: has(P.MANAGE_QUERIES) ? ["query", "New Query"] : false,
    "seat-allocation": has(P.MANAGE_TICKETING) ? ["seat", "Save Seat"] : false,
    settings: has(P.MANAGE_STAFF) ? ["staff", "Add Staff"] : false,
    tickets: has(P.MANAGE_TICKETING) ? ["ticket", "Issue Ticket"] : false,
    "tour-managers": canAssignTourManagers(access) ? ["tourManager", "Add Tour Manager"] : false,
  } satisfies Record<string, false | [string, string]>;
  const action = hasOwnKey(actions, view) ? actions[view] : false;
  if (!action) {
    return null;
  }
  return (
    <Button
      className="portal-primary-btn shrink-0 whitespace-nowrap"
      onClick={() => openModal(action[0])}
      type="button"
    >
      <Plus size={16} />
      {action[1]}
    </Button>
  );
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
