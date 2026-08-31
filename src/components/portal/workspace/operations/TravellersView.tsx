"use client";

import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import {
  formatPassportExpiryLabel,
  getPassportExpiryInfo,
  passportExpiryTone,
} from "@/lib/portal/passportExpiry";
import type { TravellersViewProps } from "../portalViewTypes";

type TravellerRow = TravellersViewProps["rows"][number];

function travellerRowLabel(row: TravellerRow) {
  return row.fullName;
}

function TravellerMobileCard({
  row,
  visibleColumnIds,
}: {
  row: TravellerRow;
  visibleColumnIds: ReadonlySet<string>;
}) {
  const expiry = getPassportExpiryInfo({
    expiryDate: row.passportExpiryDate,
    travelDate: row.travelStartDate || row.travelDate,
  });
  const summary = [
    row.jobCode,
    visibleColumnIds.has("hub") ? row.travelHub || "No hub" : null,
    visibleColumnIds.has("travel-batch") ? travelBatchDisplayLabel(row) : null,
  ].filter(Boolean);
  const optionalDetails = [
    { id: "surname", label: "Surname", value: row.surname || "-" },
    { id: "given-name", label: "Given Name", value: row.givenName || "-" },
    { id: "gender", label: "Gender", value: row.gender || "-" },
    { id: "room", label: "Room", value: row.roomType || "-" },
    { id: "food", label: "Food", value: row.foodPreference || "-" },
    { id: "passport", label: "Passport", value: row.passportStatus || "Pending" },
    { id: "ticket", label: "Ticket", value: row.ticketStatus || "-" },
    { id: "tm-call", label: "TM Call", value: row.callingStatus || "-" },
  ].filter((detail) => visibleColumnIds.has(detail.id));
  return (
    <div className="space-y-1">
      <div className="font-semibold text-brand-dark">{row.fullName}</div>
      <div className="text-brand-muted text-xs">{summary.join(" · ")}</div>
      {optionalDetails.length > 0 ? (
        <dl className="grid grid-cols-2 gap-2 py-1 text-xs">
          {optionalDetails.map((detail) => (
            <div key={detail.id}>
              <dt className="text-brand-muted">{detail.label}</dt>
              <dd className="font-medium text-brand-dark">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <StatusBadge domain="visa" status={row.visaStatus} />
        <Badge label={formatPassportExpiryLabel(expiry)} tone={passportExpiryTone(expiry)} />
      </div>
    </div>
  );
}

function renderTravellerMobileCard(row: TravellerRow, visibleColumnIds: ReadonlySet<string>) {
  return <TravellerMobileCard row={row} visibleColumnIds={visibleColumnIds} />;
}

function TravellerRowActions({
  deleteItem,
  openModal,
  removeTraveller,
  row,
}: Pick<TravellersViewProps, "deleteItem" | "openModal" | "removeTraveller"> & {
  row: TravellerRow;
}) {
  const edit = () => {
    openModal("traveller", {
      arrivingEarly: row.arrivingEarly ? "Yes" : "No",
      biometricAppointmentDate: row.biometricAppointmentDate,
      domesticTravelRequired: row.domesticTravelRequired ? "Yes" : "No",
      entityId: String(row.id),
      extensionOfTour: row.extensionOfTour ? "Yes" : "No",
      foodPreference: row.foodPreference,
      fullName: row.fullName,
      gender: row.gender || "",
      givenName: row.givenName || "",
      guestCompanions: row.guestCompanions,
      guestType: row.guestType,
      hotelAllocation: row.hotelAllocation,
      jobCardId: row.jobCardId,
      notes: row.specialRequests || "",
      passportStatus: row.passportStatus,
      paymentType: row.paymentType,
      roomType: row.roomType,
      surname: row.surname || "",
      travelBatchId: row.travelBatchId || "",
      travelDate: row.travelDate,
      travelHub: row.travelHub,
      visaRequired: row.visaRequired ? "Yes" : "No",
    });
  };
  const remove = () => {
    deleteItem(row.fullName, removeTraveller, { travellerId: String(row.id) });
  };
  return (
    <div className="flex flex-wrap gap-2">
      <EditButton onClick={edit} />
      <DeleteButton label={row.fullName} onClick={remove} />
    </div>
  );
}

import { passportRowAttention, travelBatchDisplayLabel } from "../portalOperationsHelpers";
import { strong } from "../portalWorkspaceListHelpers";
import { Badge, DeleteButton, EditButton, StatusBadge } from "../portalWorkspaceListUi";
import { TravellerCountView } from "./TravellerCountView";

export function TravellersView({
  rows,
  countRows,
  jobCards,
  jobCardFilter,
  setJobCardFilter,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTraveller,
  removeManyTravellers,
  filtersActive = false,
}: TravellersViewProps) {
  const canManage = has(P.MANAGE_TRAVELLERS);
  const handleBulkDelete = async (ids: string[]) => {
    await deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
      travellerIds: ids,
    }));
    return true;
  };
  return (
    <div className="space-y-4">
      <TravellerCountView
        jobCardFilter={jobCardFilter}
        jobCards={jobCards}
        rows={countRows}
        setJobCardFilter={setJobCardFilter}
      />
      <SelectableDataTable
        columns={[
          {
            id: "name",
            kind: "identity",
            label: "Name",
            render: (row: TravellerRow) => strong(row.fullName),
            sortValue: (row: TravellerRow) => row.fullName,
          },
          {
            hideable: true,
            id: "surname",
            label: "Surname",
            render: (row: TravellerRow) => row.surname || "-",
          },
          {
            hideable: true,
            id: "given-name",
            label: "Given Name",
            render: (row: TravellerRow) => row.givenName || "-",
          },
          {
            id: "job",
            label: "Job",
            render: (row: TravellerRow) => row.jobCode,
            sortValue: (row: TravellerRow) => row.jobCode,
          },
          {
            hideable: true,
            id: "travel-batch",
            label: "Travel in Series",
            render: (row: TravellerRow) => travelBatchDisplayLabel(row),
          },
          {
            hideable: true,
            id: "hub",
            label: "Hub",
            render: (row: TravellerRow) => row.travelHub || "-",
          },
          {
            hideable: true,
            id: "gender",
            label: "Gender",
            render: (row: TravellerRow) => row.gender || "-",
          },
          {
            hideable: true,
            id: "room",
            label: "Room",
            render: (row: TravellerRow) => <Badge label={row.roomType} tone="blue" />,
          },
          {
            hideable: true,
            id: "food",
            label: "Food",
            render: (row: TravellerRow) => <Badge label={row.foodPreference} tone="green" />,
          },
          {
            hideable: true,
            id: "passport",
            label: "Passport",
            render: (row: TravellerRow) => row.passportStatus || "Pending",
          },
          {
            id: "passport-expiry",
            label: "Passport expiry",
            render: (row: TravellerRow) => {
              const info = getPassportExpiryInfo({
                expiryDate: row.passportExpiryDate,
                travelDate: row.travelStartDate || row.travelDate,
              });
              return (
                <Badge label={formatPassportExpiryLabel(info)} tone={passportExpiryTone(info)} />
              );
            },
            sortValue: (row: TravellerRow) => row.passportExpiryDate || "",
          },
          {
            hideable: true,
            id: "ticket",
            kind: "status",
            label: "Ticket",
            render: (row: TravellerRow) => (
              <StatusBadge domain="ticketing" status={row.ticketStatus} />
            ),
          },
          {
            id: "visa",
            kind: "status",
            label: "Visa",
            render: (row: TravellerRow) => <StatusBadge domain="visa" status={row.visaStatus} />,
            sortValue: (row: TravellerRow) => row.visaStatus || "",
          },
          {
            hideable: true,
            id: "tm-call",
            label: "TM Call",
            render: (row: TravellerRow) => row.callingStatus,
          },
          {
            id: "action",
            kind: "action",
            label: "Action",
            render: (row: TravellerRow) =>
              canManage && (
                <TravellerRowActions
                  deleteItem={deleteItem}
                  openModal={openModal}
                  removeTraveller={removeTraveller}
                  row={row}
                />
              ),
          },
        ]}
        empty="No travellers yet."
        entityLabel="traveller"
        filtersActive={filtersActive}
        layoutKey="travellers:list"
        mobileCardRender={renderTravellerMobileCard}
        onBulkDelete={canManage ? handleBulkDelete : undefined}
        rowAttention={passportRowAttention}
        rowLabel={travellerRowLabel}
        rows={rows}
        selectable={canManage}
      />
    </div>
  );
}
