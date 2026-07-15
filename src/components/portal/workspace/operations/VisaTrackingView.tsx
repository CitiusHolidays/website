"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { VisaTrackingViewProps } from "../portalViewTypes";

type VisaRow = VisaTrackingViewProps["rows"][number];

function visaRowLabel(row: VisaRow) {
  return row.travellerName;
}

import { travelBatchDisplayLabel } from "../portalOperationsHelpers";
import { strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, StatusBadge } from "../portalWorkspaceListUi";

export function VisaTrackingView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeVisa,
  removeManyVisas,
  filtersActive = false,
}: VisaTrackingViewProps) {
  const canManage = has(P.MANAGE_VISA);
  return (
    <SelectableDataTable
      columns={[
        {
          id: "traveller",
          label: "Traveller",
          render: (row: VisaRow) => strong(row.travellerName),
        },
        { id: "job", label: "Job", render: (row: VisaRow) => row.jobCode },
        {
          id: "travel-batch",
          label: "Travel Batch",
          render: (row: VisaRow) => travelBatchDisplayLabel(row),
        },
        { id: "hub", label: "Hub", render: (row: VisaRow) => row.travelHub || "-" },
        {
          id: "status",
          kind: "status",
          label: "Status",
          render: (row: VisaRow) => <StatusBadge domain="visa" status={row.status} />,
        },
        {
          id: "appointment",
          label: "Appointment",
          render: (row: VisaRow) => formatDisplayDate(row.appointmentDate),
        },
        { id: "notes", label: "Notes", render: (row: VisaRow) => row.notes || "-" },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: VisaRow) =>
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
                    deleteItem(`${row.travellerName} visa`, removeVisa, {
                      visaRecordId: String(row.id),
                    })
                  }
                />
              </div>
            ),
        },
      ]}
      empty="No visa records yet."
      entityLabel="visa record"
      filtersActive={filtersActive}
      mobileCardRender={(row: VisaRow) => (
        <div className="space-y-1">
          <div className="font-semibold text-brand-dark">{row.travellerName}</div>
          <div className="text-brand-muted text-xs">
            {row.jobCode} · {row.travelHub || "No hub"} · {travelBatchDisplayLabel(row)}
          </div>
          <StatusBadge domain="visa" status={row.status} />
        </div>
      )}
      onBulkDelete={
        canManage
          ? async (ids: string[]) => {
              await deleteSelected(ids.length, "visa record", removeManyVisas, () => ({
                visaRecordIds: ids,
              }));
              return true;
            }
          : undefined
      }
      rowLabel={visaRowLabel}
      rows={rows}
      selectable={canManage}
    />
  );
}
