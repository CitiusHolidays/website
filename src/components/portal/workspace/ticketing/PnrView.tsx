"use client";

import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { TicketingFlightItinerary } from "@/components/portal/ticketing/TicketingFlightItinerary";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PnrViewProps, PortalPnrListRow } from "../portalViewTypes";
import { DeleteButton, EditButton, Panel } from "../portalWorkspaceListUi";

type PnrRow = PortalPnrListRow;

export function PnrView({
  rows,
  itinerary,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removePnr,
  removeManyPnrs,
}: PnrViewProps) {
  const canManage = has(P.MANAGE_TICKETING);

  return (
    <div className="space-y-5">
      <Panel title="Flight Itinerary">
        <TicketingFlightItinerary rows={itinerary} />
      </Panel>
      <Panel title="PNR Records">
        <SelectableDataTable
          columns={[
            {
              id: "pnr",
              kind: "identity",
              label: "PNR",
              render: (row: PnrRow) => (
                <div className="flex items-center gap-2">
                  <span className="font-bold font-mono text-citius-blue tracking-[0.14em]">
                    {row.pnrCode}
                  </span>
                  <PortalCopyButton aria-label={`Copy PNR ${row.pnrCode}`} value={row.pnrCode} />
                </div>
              ),
              sortValue: (row: PnrRow) => row.pnrCode,
            },
            {
              id: "job",
              label: "Job",
              render: (row: PnrRow) => row.jobCode,
              sortValue: (row: PnrRow) => row.jobCode || "",
            },
            {
              id: "client",
              label: "Client",
              render: (row: PnrRow) => row.clientName,
              sortValue: (row: PnrRow) => row.clientName || "",
            },
            {
              id: "airline",
              label: "Airline",
              render: (row: PnrRow) => row.airline,
            },
            {
              id: "route",
              label: "Route",
              render: (row: PnrRow) => row.route,
            },
            {
              id: "fare",
              label: "Fare",
              render: (row: PnrRow) => row.fareType || "-",
            },
            {
              id: "seats",
              label: "Seats",
              render: (row: PnrRow) => `${row.issuedSeats ?? 0}/${row.totalSeats ?? 0}`,
            },
            {
              id: "action",
              kind: "action",
              label: "Action",
              render: (row: PnrRow) =>
                canManage && (
                  <div className="flex flex-wrap gap-2">
                    <EditButton
                      onClick={() =>
                        openModal("pnr", {
                          airline: row.airline,
                          entityId: row.id,
                          fareType: row.fareType,
                          jobCardId: row.jobCardId,
                          pnrCode: row.pnrCode,
                          route: row.route,
                          totalSeats: String(row.totalSeats ?? ""),
                        })
                      }
                    />
                    <DeleteButton
                      label={row.pnrCode}
                      onClick={() => deleteItem(row.pnrCode, removePnr, { pnrId: String(row.id) })}
                    />
                  </div>
                ),
            },
          ]}
          empty="No PNRs yet."
          entityLabel="PNR"
          onBulkDelete={
            canManage
              ? async (ids) => {
                  await deleteSelected(ids.length, "PNR", removeManyPnrs, () => ({
                    pnrIds: ids,
                  }));
                  return true;
                }
              : undefined
          }
          rows={rows}
          selectable={canManage}
        />
      </Panel>
    </div>
  );
}
