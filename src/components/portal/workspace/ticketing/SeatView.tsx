"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PortalSeatListRow, SeatViewProps } from "../portalViewTypes";
import { DeleteButton, EditButton, StatusBadge } from "../portalWorkspaceListUi";

type SeatRow = PortalSeatListRow;

export function SeatView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeSeatAllocation,
  removeManySeatAllocations,
}: SeatViewProps) {
  const canManage = has(P.MANAGE_TICKETING);

  return (
    <SelectableDataTable
      columns={[
        {
          id: "seat",
          kind: "identity",
          label: "Seat",
          render: (row: SeatRow) => <span className="font-bold font-mono">{row.seatNumber}</span>,
          sortValue: (row: SeatRow) => row.seatNumber,
        },
        {
          id: "traveller",
          label: "Traveller",
          render: (row: SeatRow) => row.travellerName || "Unassigned",
          sortValue: (row: SeatRow) => row.travellerName || "",
        },
        {
          id: "job",
          label: "Job",
          render: (row: SeatRow) => row.jobCode,
          sortValue: (row: SeatRow) => row.jobCode || "",
        },
        {
          id: "status",
          kind: "status",
          label: "Status",
          render: (row: SeatRow) => <StatusBadge domain="seat" status={row.status} />,
          sortValue: (row: SeatRow) => row.status || "",
        },
        {
          id: "notes",
          label: "Notes",
          render: (row: SeatRow) => row.notes || "-",
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: SeatRow) =>
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
                      seatAllocationId: String(row.id),
                    })
                  }
                />
              </div>
            ),
        },
      ]}
      empty="No stored seat allocations yet."
      entityLabel="seat"
      onBulkDelete={
        canManage
          ? async (ids) => {
              await deleteSelected(ids.length, "seat", removeManySeatAllocations, () => ({
                seatAllocationIds: ids,
              }));
              return true;
            }
          : undefined
      }
      rows={rows}
      selectable={canManage}
    />
  );
}
