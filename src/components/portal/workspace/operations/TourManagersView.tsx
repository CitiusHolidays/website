"use client";

import { CheckCircle2, ShieldCheck, Users } from "lucide-react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
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
import {
  Badge,
  DeleteButton,
  EditButton,
  Panel,
  StatCard,
  StatusBadge,
} from "../portalWorkspaceListUi";

type TourManagerRow = TourManagersViewProps["rows"][number];
type CallingBoardRow = TourManagersViewProps["travellers"][number];

export function TourManagersView({
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
}: TourManagersViewProps) {
  const toast = usePortalToast() as {
    error: (message: string) => void;
    success: (message: string) => void;
  };
  const assignedTourManagersByJobAndBatch = buildTourManagersByJobAndBatch(assignments);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard Icon={Users} label="Total Pax" value={travellers.length} />
        <StatCard
          Icon={CheckCircle2}
          label="Onboarded"
          value={
            travellers.filter(
              (row: CallingBoardRow) => row.fullName && row.travelHub && row.foodPreference
            ).length
          }
        />
        <StatCard
          Icon={ShieldCheck}
          label="Docs Pending"
          value={
            travellers.filter(
              (row: CallingBoardRow) =>
                !["Approved", "Not Required"].includes(String(row.visaStatus || "")) ||
                row.ticketStatus !== "Issued"
            ).length
          }
        />
      </div>
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
                      deleteItem(row.name, removeTourManager, {
                        tourManagerId: String(row.id),
                      })
                    }
                  />
                </div>
              ),
          },
        ]}
        empty="No Tour Managers yet."
        entityLabel="tour manager"
        onBulkDelete={
          canAssign
            ? async (ids: string[]) => {
                await deleteSelected(ids.length, "tour manager", removeManyTourManagers, () => ({
                  tourManagerIds: ids,
                }));
                return true;
              }
            : undefined
        }
        rows={rows}
        selectable={canAssign}
      />
      <Panel title="Calling status board">
        <SelectableDataTable
          columns={[
            {
              id: "guest",
              label: "Guest",
              render: (row: CallingBoardRow) => strong(row.fullName),
            },
            { id: "job", label: "Job", render: (row: CallingBoardRow) => row.jobCode },
            {
              id: "travel-batch",
              label: "Travel Batch",
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
                              updateCallingStatus({
                                callingStatus: status,
                                travellerId: String(row.id),
                              })
                          ).catch(() => {})
                        }
                        type="button"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                ),
            },
          ]}
          compact
          empty="No travellers to call yet."
          rows={travellers}
        />
      </Panel>
    </div>
  );
}
