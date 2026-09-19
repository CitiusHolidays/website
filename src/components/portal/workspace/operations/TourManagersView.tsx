"use client";

import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { formatDisplayDate } from "@/lib/formatDate";
import { CALLING_STATUSES, PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { runMutation } from "@/lib/portal/runMutation";
import {
  buildTourManagersByJobAndBatch,
  getAssignedTourManagerNames,
  travelBatchDisplayLabel,
} from "../portalOperationsHelpers";
import type { TourManagersViewProps } from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, EditButton, Panel, StatusBadge } from "../portalWorkspaceListUi";

type TourManagerRow = TourManagersViewProps["rows"][number];
type CallingBoardRow = NonNullable<TourManagersViewProps["travellers"]>[number];

function TourManagerRowActions({
  deleteItem,
  openModal,
  removeTourManager,
  row,
}: Pick<TourManagersViewProps, "deleteItem" | "openModal" | "removeTourManager"> & {
  row: TourManagerRow;
}) {
  const edit = () => {
    openModal("tourManager", {
      entityId: String(row.id),
      jobCardId: row.jobCardId || "",
      notes: row.notes,
      paidBy: row.phone,
      reportingInstructions: row.reportingInstructions || "",
      staffEmail: row.email,
      staffId: row.staffId || "",
      tourManagerName: row.name,
      travelBatchId: row.travelBatchId || "",
      travelStartDate: row.availabilityDate,
    });
  };
  const remove = () => {
    deleteItem(row.name, removeTourManager, { tourManagerId: String(row.id) });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <EditButton onClick={edit} />
      <DeleteButton label={row.name} onClick={remove} />
    </div>
  );
}

function CallingStatusButton({
  row,
  status,
  updateCallingStatus,
}: {
  row: CallingBoardRow;
  status: (typeof CALLING_STATUSES)[number];
  updateCallingStatus: TourManagersViewProps["updateCallingStatus"];
}) {
  const toast = usePortalToast();
  const update = () => {
    runMutation(
      {
        label: "Calling status",
        showToast: toast,
        successMessage: `Calling status set to ${status}`,
      },
      () => updateCallingStatus({ callingStatus: status, travellerId: String(row.id) })
    ).catch(() => undefined);
  };
  return (
    <Button className="portal-small-btn" onClick={update} type="button">
      {status}
    </Button>
  );
}

export function TourManagersView({
  rows,
  travellers,
  travellerPagination,
  assignments,
  openModal,
  has,
  canAssign,
  deleteItem,
  deleteSelected,
  removeTourManager,
  removeManyTourManagers,
  updateCallingStatus,
}: TourManagersViewProps) {
  const assignedTourManagersByJobAndBatch = buildTourManagersByJobAndBatch(assignments);
  const handleBulkDelete = async (ids: string[]) => {
    await deleteSelected(ids.length, "tour manager", removeManyTourManagers, () => ({
      tourManagerIds: ids,
    }));
    return true;
  };

  return (
    <div className="space-y-5">
      <Panel
        subtitle={
          travellers
            ? `${travellers.length} loaded travellers. Calls stay scoped to their Job Card and travel series.`
            : "Loading travellers…"
        }
        title="Calling status board"
      >
        <SelectableDataTable
          canLoadMore={travellerPagination?.canLoadMore}
          columns={[
            {
              id: "guest",
              label: "Guest",
              render: (row: CallingBoardRow) => strong(row.fullName),
            },
            { id: "job", label: "Job", render: (row: CallingBoardRow) => row.jobCode },
            {
              id: "travel-batch",
              label: "Travel in Series",
              render: (row: CallingBoardRow) => travelBatchDisplayLabel(row),
            },
            {
              id: "tour-manager",
              label: "Tour Manager",
              render: (row: CallingBoardRow) =>
                getAssignedTourManagerNames(row, assignedTourManagersByJobAndBatch),
            },
            { id: "hub", label: "Hub", render: (row: CallingBoardRow) => row.travelHub || "-" },
            { id: "type", label: "Type", render: (row: CallingBoardRow) => row.guestType },
            {
              id: "cancellation",
              label: "Cancellation",
              render: (row: CallingBoardRow) =>
                row.cancellation || row.lastMinuteDrop ? <Badge label="Flagged" tone="red" /> : "-",
            },
            {
              id: "calling",
              label: "Calling",
              render: (row: CallingBoardRow) => (
                <StatusBadge domain="calling" status={row.callingStatus} />
              ),
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: CallingBoardRow) =>
                has(P.MANAGE_TOUR_MANAGERS) && (
                  <div className="flex flex-wrap gap-2">
                    {CALLING_STATUSES.map((status) => (
                      <CallingStatusButton
                        key={status}
                        row={row}
                        status={status}
                        updateCallingStatus={updateCallingStatus}
                      />
                    ))}
                  </div>
                ),
            },
          ]}
          compact
          empty="No travellers to call yet."
          isLoadingMore={travellerPagination?.isLoadingMore}
          onLoadMore={travellerPagination?.loadMore}
          rows={travellers}
        />
      </Panel>
      {travellers ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-brand-muted">Loaded travellers</dt>
            <dd className="font-semibold tabular-nums">{travellers.length}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-brand-muted">Onboarded</dt>
            <dd className="font-semibold tabular-nums">
              {
                travellers.filter((row) => row.fullName && row.travelHub && row.foodPreference)
                  .length
              }
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-brand-muted">Visa or ticket pending</dt>
            <dd className="font-semibold tabular-nums">
              {
                travellers.filter(
                  (row) =>
                    !["Approved", "Not Required"].includes(String(row.visaStatus || "")) ||
                    row.ticketStatus !== "Issued"
                ).length
              }
            </dd>
          </div>
        </dl>
      ) : null}
      <Panel title="Tour manager assignments">
        <SelectableDataTable
          columns={[
            { id: "name", label: "Name", render: (row: TourManagerRow) => strong(row.name) },
            {
              id: "current-tour",
              label: "Current Tour",
              render: (row: TourManagerRow) => row.currentTour || "Available",
            },
            { id: "job", label: "Job", render: (row: TourManagerRow) => row.jobCode || "-" },
            { id: "calling", label: "Calling", render: (row: TourManagerRow) => row.callingStatus },
            {
              id: "available",
              label: "Available",
              render: (row: TourManagerRow) => formatDisplayDate(row.availabilityDate),
            },
            {
              id: "status",
              kind: "status",
              label: "Status",
              render: (row: TourManagerRow) => (
                <StatusBadge domain="tourManager" status={row.status} />
              ),
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: TourManagerRow) =>
                canAssign && (
                  <TourManagerRowActions
                    deleteItem={deleteItem}
                    openModal={openModal}
                    removeTourManager={removeTourManager}
                    row={row}
                  />
                ),
            },
          ]}
          empty="No Tour Managers yet."
          entityLabel="tour manager"
          onBulkDelete={canAssign ? handleBulkDelete : undefined}
          rows={rows}
          selectable={canAssign}
        />
      </Panel>
    </div>
  );
}
