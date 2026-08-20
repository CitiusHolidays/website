"use client";

import { useCallback } from "react";
import { PortalCopyButton } from "@/components/motion-ui/copy-button";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { TicketingFlightItinerary } from "@/components/portal/ticketing/TicketingFlightItinerary";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type { PnrViewProps, PortalPnrListRow } from "../portalViewTypes";
import { DeleteButton, EditButton, Panel } from "../portalWorkspaceListUi";

type PnrRow = PortalPnrListRow;

function PnrRowActions({
  deleteItem,
  openModal,
  removePnr,
  row,
}: Pick<PnrViewProps, "deleteItem" | "openModal" | "removePnr"> & { row: PnrRow }) {
  const edit = useCallback(() => {
    openModal("pnr", {
      airline: row.airline,
      entityId: String(row.id),
      fareType: row.fareType,
      jobCardId: row.jobCardId,
      pnrCode: row.pnrCode,
      route: row.route,
      totalSeats: String(row.totalSeats ?? ""),
    });
  }, [openModal, row]);
  const remove = useCallback(() => {
    deleteItem(row.pnrCode, removePnr, { pnrId: String(row.id) });
  }, [deleteItem, removePnr, row.id, row.pnrCode]);
  return (
    <div className="flex flex-wrap gap-2">
      <EditButton onClick={edit} />
      <DeleteButton label={row.pnrCode} onClick={remove} />
    </div>
  );
}

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
                  <PnrRowActions
                    deleteItem={deleteItem}
                    openModal={openModal}
                    removePnr={removePnr}
                    row={row}
                  />
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
