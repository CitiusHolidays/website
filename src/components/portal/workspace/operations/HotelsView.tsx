"use client";

import { useCallback } from "react";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { formatDisplayDate } from "@/lib/formatDate";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import type {
  HotelRoomingViewProps,
  PortalBulkDeleteHandler,
  PortalDeleteHandler,
  PortalHotelListRow,
  PortalModalOpener,
  PortalPermissionChecker,
} from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { DeleteButton, EditButton } from "../portalWorkspaceListUi";

export interface HotelsViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  openModal: PortalModalOpener;
  removeHotel: HotelRoomingViewProps["removeHotel"];
  removeManyHotels: (args: { hotelIds: string[] }) => Promise<{ deletedCount: number }>;
  rows: PortalHotelListRow[];
}

type HotelRow = HotelsViewProps["rows"][number];

function HotelRowActions({
  deleteItem,
  openModal,
  removeHotel,
  row,
}: Pick<HotelsViewProps, "deleteItem" | "openModal" | "removeHotel"> & { row: HotelRow }) {
  const edit = useCallback(() => {
    openModal("hotel", {
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      city: row.city,
      entityId: String(row.id),
      hotelName: row.name,
      jobCardId: row.jobCardId,
      notes: row.specialInstructions,
    });
  }, [openModal, row]);
  const remove = useCallback(() => {
    deleteItem(row.name, removeHotel, { hotelId: String(row.id) });
  }, [deleteItem, removeHotel, row.id, row.name]);

  return (
    <div className="flex flex-wrap gap-2">
      <EditButton onClick={edit} />
      <DeleteButton label={row.name} onClick={remove} />
    </div>
  );
}

export function HotelsView({
  rows,
  filtersActive = false,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeHotel,
  removeManyHotels,
}: HotelsViewProps) {
  const canManage = has(P.MANAGE_OPERATIONS);
  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      await deleteSelected(ids.length, "hotel", removeManyHotels, () => ({ hotelIds: ids }));
      return true;
    },
    [deleteSelected, removeManyHotels]
  );
  return (
    <SelectableDataTable
      columns={[
        { id: "hotel", label: "Hotel", render: (row: HotelRow) => strong(row.name) },
        { id: "job", label: "Job", render: (row: HotelRow) => row.jobCode },
        { id: "client", label: "Client", render: (row: HotelRow) => row.clientName },
        { id: "city", label: "City", render: (row: HotelRow) => row.city || "-" },
        {
          id: "check-in",
          label: "Check-in",
          render: (row: HotelRow) => formatDisplayDate(row.checkInDate),
        },
        {
          id: "check-out",
          label: "Check-out",
          render: (row: HotelRow) => formatDisplayDate(row.checkOutDate),
        },
        {
          id: "instructions",
          label: "Instructions",
          render: (row: HotelRow) => row.specialInstructions || "-",
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: HotelRow) =>
            canManage && (
              <HotelRowActions
                deleteItem={deleteItem}
                openModal={openModal}
                removeHotel={removeHotel}
                row={row}
              />
            ),
        },
      ]}
      empty="No hotel records yet. Add a hotel property or use Import Rooming for passenger assignments below."
      entityLabel="hotel"
      filtersActive={filtersActive}
      onBulkDelete={canManage ? handleBulkDelete : undefined}
      rows={rows}
      selectable={canManage}
    />
  );
}
