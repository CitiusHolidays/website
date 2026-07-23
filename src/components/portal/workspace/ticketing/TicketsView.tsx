"use client";

import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { getTicketAttention } from "@/lib/portal/ticketListPresentation";
import { travelBatchDisplayLabel } from "../portalOperationsHelpers";
import type { PortalTicketListRow, TicketsViewProps } from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, EditButton, StatusBadge } from "../portalWorkspaceListUi";

type TicketRow = PortalTicketListRow;

function ticketRowAttention(row: TicketRow) {
  return getTicketAttention(row.ticketStatus);
}

export function TicketsView({
  rows,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTicket,
  removeManyTickets,
}: TicketsViewProps) {
  const canManage = has(P.MANAGE_TICKETING);

  return (
    <SelectableDataTable
      columns={[
        {
          id: "ticket",
          kind: "identity",
          label: "Ticket",
          render: (row: TicketRow) => row.ticketNumber || "-",
          sortValue: (row: TicketRow) => row.ticketNumber || "",
        },
        {
          id: "traveller",
          label: "Traveller",
          render: (row: TicketRow) => strong(row.travellerName || "Unassigned"),
          sortValue: (row: TicketRow) => row.travellerName || "",
        },
        {
          id: "job",
          label: "Job",
          render: (row: TicketRow) => row.jobCode,
          sortValue: (row: TicketRow) => row.jobCode || "",
        },
        {
          id: "travel-batch",
          label: "Travel Batch",
          render: (row: TicketRow) => travelBatchDisplayLabel(row),
        },
        {
          id: "type",
          label: "Type",
          render: (row: TicketRow) => row.ticketType || "-",
        },
        {
          id: "pnr",
          label: "PNR",
          render: (row: TicketRow) =>
            row.pnrCode ? (
              <div className="flex items-center gap-2">
                <span>{row.pnrCode}</span>
                <PortalCopyButton aria-label={`Copy PNR ${row.pnrCode}`} value={row.pnrCode} />
              </div>
            ) : (
              "-"
            ),
        },
        {
          id: "class",
          label: "Class",
          render: (row: TicketRow) => row.cabinClass || "Economy",
        },
        {
          id: "seat",
          label: "Seat",
          render: (row: TicketRow) => row.seatNumber || row.seatPreference || "-",
        },
        {
          id: "status",
          kind: "status",
          label: "Status",
          render: (row: TicketRow) => <StatusBadge domain="ticketing" status={row.ticketStatus} />,
          sortValue: (row: TicketRow) => row.ticketStatus || "",
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: TicketRow) =>
            canManage && (
              <div className="flex flex-wrap gap-2">
                <EditButton
                  onClick={() =>
                    openModal("ticket", {
                      cabinClass: row.cabinClass,
                      entityId: row.id,
                      foodPreference: row.mealPreference,
                      jobCardId: row.jobCardId,
                      paymentType: row.paymentType,
                      pnrId: row.pnrId || "",
                      seatNumber: row.seatNumber,
                      seatPreference: row.seatPreference,
                      ticketNumber: row.ticketNumber,
                      ticketStatus: row.ticketStatus,
                      ticketType: row.ticketType,
                      travellerId: row.travellerId || "",
                    })
                  }
                />
                <DeleteButton
                  label={row.ticketNumber || "ticket"}
                  onClick={() =>
                    deleteItem(row.ticketNumber || "ticket", removeTicket, {
                      ticketId: String(row.id),
                    })
                  }
                />
              </div>
            ),
        },
      ]}
      empty="No tickets yet."
      entityLabel="ticket"
      onBulkDelete={
        canManage
          ? async (ids) => {
              await deleteSelected(ids.length, "ticket", removeManyTickets, () => ({
                ticketIds: ids,
              }));
              return true;
            }
          : undefined
      }
      rowAttention={ticketRowAttention}
      rows={rows}
      selectable={canManage}
    />
  );
}
