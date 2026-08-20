"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { travelBatchDisplayLabel } from "../portalOperationsHelpers";
import type {
  HotelRoomingViewProps,
  PortalBulkDeleteHandler,
  PortalDeleteHandler,
  PortalPermissionChecker,
  PortalTravellerListRow,
} from "../portalViewTypes";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton } from "../portalWorkspaceListUi";

export interface RoomingListViewProps {
  deleteItem: PortalDeleteHandler;
  deleteSelected: PortalBulkDeleteHandler;
  filtersActive?: boolean;
  has: PortalPermissionChecker;
  removeManyTravellers: (args: { travellerIds: string[] }) => Promise<{ deletedCount: number }>;
  removeTraveller: HotelRoomingViewProps["removeTraveller"];
  rows: PortalTravellerListRow[];
}

type RoomingRow = RoomingListViewProps["rows"][number];

function roomingRowLabel(row: RoomingRow) {
  return row.fullName;
}

function RoomingRowActions({
  deleteItem,
  removeTraveller,
  row,
}: Pick<RoomingListViewProps, "deleteItem" | "removeTraveller"> & { row: RoomingRow }) {
  const remove = () => {
    deleteItem(row.fullName, removeTraveller, { travellerId: String(row.id) });
  };
  return <DeleteButton label={row.fullName} onClick={remove} />;
}

export function RoomingListView({
  rows,
  filtersActive = false,
  has,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
}: RoomingListViewProps) {
  const canManage = has(P.MANAGE_TRAVELLERS);
  const handleBulkDelete = async (ids: string[]) => {
    await deleteSelected(ids.length, "rooming row", removeManyTravellers, () => ({
      travellerIds: ids,
    }));
    return true;
  };
  return (
    <SelectableDataTable
      columns={[
        { id: "name", label: "Name", render: (row: RoomingRow) => strong(row.fullName) },
        { id: "job", label: "Job", render: (row: RoomingRow) => row.jobCode },
        {
          id: "travel-batch",
          label: "Travel Batch",
          render: (row: RoomingRow) => travelBatchDisplayLabel(row),
        },
        { id: "hub", label: "Hub", render: (row: RoomingRow) => row.travelHub || "-" },
        {
          id: "room-type",
          label: "Room Type",
          render: (row: RoomingRow) => <Badge label={row.roomType || "-"} tone="blue" />,
        },
        {
          id: "hotel-allocation",
          label: "Hotel Allocation",
          render: (row: RoomingRow) => row.hotelAllocation || "-",
        },
        {
          id: "food",
          label: "Food",
          render: (row: RoomingRow) => <Badge label={row.foodPreference} tone="green" />,
        },
        {
          id: "special-requests",
          label: "Special Requests",
          render: (row: RoomingRow) => row.specialRequests || "-",
        },
        {
          id: "action",
          kind: "action",
          label: "Action",
          render: (row: RoomingRow) =>
            canManage && (
              <RoomingRowActions
                deleteItem={deleteItem}
                removeTraveller={removeTraveller}
                row={row}
              />
            ),
        },
      ]}
      empty="No rooming assignments yet. Import traveller master or rooming spreadsheet for this job card."
      entityLabel="rooming row"
      filtersActive={filtersActive}
      onBulkDelete={canManage ? handleBulkDelete : undefined}
      rowLabel={roomingRowLabel}
      rows={rows}
      selectable={canManage}
    />
  );
}
