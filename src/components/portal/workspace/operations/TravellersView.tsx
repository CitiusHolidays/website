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
            label: "Travel Batch",
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
                <div className="flex flex-wrap gap-2">
                  <EditButton
                    onClick={() =>
                      openModal("traveller", {
                        arrivingEarly: row.arrivingEarly ? "Yes" : "No",
                        biometricAppointmentDate: row.biometricAppointmentDate,
                        domesticTravelRequired: row.domesticTravelRequired ? "Yes" : "No",
                        entityId: row.id,
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
                      })
                    }
                  />
                  <DeleteButton
                    label={row.fullName}
                    onClick={() =>
                      deleteItem(row.fullName, removeTraveller, { travellerId: String(row.id) })
                    }
                  />
                </div>
              ),
          },
        ]}
        empty="No travellers yet."
        entityLabel="traveller"
        filtersActive={filtersActive}
        mobileCardRender={(row: TravellerRow) => {
          const expiry = getPassportExpiryInfo({
            expiryDate: row.passportExpiryDate,
            travelDate: row.travelStartDate || row.travelDate,
          });
          return (
            <div className="space-y-1">
              <div className="font-semibold text-brand-dark">{row.fullName}</div>
              <div className="text-brand-muted text-xs">
                {row.jobCode} · {row.travelHub || "No hub"} · {travelBatchDisplayLabel(row)}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <StatusBadge domain="visa" status={row.visaStatus} />
                <Badge
                  label={formatPassportExpiryLabel(expiry)}
                  tone={passportExpiryTone(expiry)}
                />
              </div>
            </div>
          );
        }}
        onBulkDelete={
          canManage
            ? async (ids: string[]) => {
                await deleteSelected(ids.length, "traveller", removeManyTravellers, () => ({
                  travellerIds: ids,
                }));
                return true;
              }
            : undefined
        }
        rowAttention={passportRowAttention}
        rowLabel={travellerRowLabel}
        rows={rows}
        selectable={canManage}
      />
    </div>
  );
}
