"use client";

import { Download, MoreHorizontal, Plus, Upload } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";
import { PortalActionMenu } from "@/components/portal/PortalActionMenu";
import { PortalCommandPaletteTrigger } from "@/components/portal/PortalCommandPalette";
import PortalListToolbar from "@/components/portal/PortalListToolbar";
import { jobCardFilterOptions } from "@/components/portal/workspace/portalOperationsHelpers";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { canAssignTourManagers, canHeadAssignQueryTeams } from "@/lib/portal/permissions";
import type { PortalViewMeta } from "@/lib/portal/workspaceContract";
import { resolveViewPagination } from "./portalViewRegistryInputs";
import type {
  PortalAccessSlice,
  PortalPaginationSlice,
  PortalPermissionChecker,
} from "./portalViewTypes";

const P = PORTAL_PERMISSIONS;

export interface PortalWorkspaceHeaderSlice {
  access: PortalAccessSlice;
  clearAllFilters: () => void;
  dateRange: { from: string | null; to: string | null };
  error: string;
  filtersActive: boolean;
  has: PortalPermissionChecker;
  jobCardFilter: string;
  jobCards: Array<{ clientName?: string; id: string; jobCode: string }>;
  listFilterConfig: Array<{ id: string; label: string; options?: string[] }>;
  listFilters: Record<string, string>;
  meta: PortalViewMeta;
  modal: string | null;
  openModal: (modal: string, initial?: Record<string, unknown>) => void;
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
        <button {...props} className="portal-small-btn bg-white" type="button">
          <MoreHorizontal size={16} />
          More
        </button>
      )}
    >
      {actions.map((action) => (
        <button
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
        </button>
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
  openModal: (modal: string, initial?: Record<string, unknown>) => void;
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
        <button className="portal-primary-btn" onClick={() => openModal("hotel")} type="button">
          <Plus size={16} />
          Add Hotel
        </button>
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
  const actions: Record<string, false | [string, string]> = {
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

export function PortalWorkspaceHeader({ workspace }: { workspace: PortalWorkspaceHeaderSlice }) {
  if (workspace.view === "dashboard") {
    return workspace.error && !workspace.modal ? (
      <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
        {workspace.error}
      </div>
    ) : null;
  }

  const filterSourceRowsByView: Record<string, unknown[] | undefined> = {
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
    ticketing: workspace.periodFiltered.tickets,
    tickets: workspace.periodFiltered.tickets,
    "tour-managers": workspace.periodFiltered.tourManagers,
    travellers: workspace.periodFiltered.travellers,
    visa: workspace.periodFiltered.visas,
  };
  const filterSourceRows =
    filterSourceRowsByView[workspace.view] ?? workspace.periodFiltered.queries;
  const viewPagination = resolveViewPagination(
    workspace.view,
    workspace.pagination as Parameters<typeof resolveViewPagination>[1]
  );

  return (
    <>
      <PortalListToolbar
        actions={
          <HeaderActions
            access={workspace.access}
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
        resultCount={(workspace.viewResultCount ?? null) as null | undefined}
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

      {workspace.error && !workspace.modal && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
          {workspace.error}
        </div>
      )}
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
        <button
          aria-busy={pagination.isLoadingMore || undefined}
          className="portal-small-btn bg-white"
          disabled={pagination.isLoadingMore}
          onClick={pagination.loadMore}
          type="button"
        >
          {pagination.isLoadingMore ? "Loading more…" : "Load more records"}
        </button>
      ) : null}
    </div>
  );
}
