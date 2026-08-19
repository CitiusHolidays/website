"use client";

import dynamic from "next/dynamic";
import { SPREADSHEET_MODALS, type SpreadsheetModalId } from "@/lib/portal/workspaceContract";
import type { PortalSpreadsheetModalWorkspaceSlice } from "./portalSpreadsheetModalTypes";
import {
  PASSENGER_EXPORT_MODAL_CONFIGS,
  PASSENGER_IMPORT_MODAL_CONFIGS,
} from "./spreadsheetModalConfigs";
import { travelBatchEntityModalKey } from "./travelBatchEntityModalKey";

export type { PortalSpreadsheetModalWorkspaceSlice } from "./portalSpreadsheetModalTypes";

const CommercialFilesModal = dynamic(
  () => import("./CommercialFilesModal").then((module) => module.CommercialFilesModal),
  { ssr: false }
);
const TravelBatchEntityModalBridge = dynamic(
  () =>
    import("../TravelBatchEntityModalBridge").then((module) => module.TravelBatchEntityModalBridge),
  { ssr: false }
);
const PassengerImportModal = dynamic(
  () => import("./PassengerImportModal").then((module) => module.PassengerImportModal),
  { ssr: false }
);
const FlightImportModal = dynamic(
  () => import("./FlightImportModal").then((module) => module.FlightImportModal),
  { ssr: false }
);
const PassengerExportModal = dynamic(
  () => import("./PassengerExportModal").then((module) => module.PassengerExportModal),
  { ssr: false }
);
const FlightExportModal = dynamic(
  () => import("./FlightExportModal").then((module) => module.FlightExportModal),
  { ssr: false }
);

function isSpreadsheetModal(modal: string | null): modal is SpreadsheetModalId {
  return modal !== null && SPREADSHEET_MODALS.some((candidate) => candidate === modal);
}

function shouldLoadEntityModalBridge(modal: string | null) {
  return modal !== null && modal !== "commercialFiles" && !isSpreadsheetModal(modal);
}

export function PortalWorkspaceSpreadsheetModals({
  workspace,
}: {
  workspace: PortalSpreadsheetModalWorkspaceSlice;
}) {
  const { modal } = workspace;
  const access = workspace.access ?? {};
  const flightItinerary = workspace.flightItinerary ?? [];
  const jobCards = workspace.jobCards ?? [];
  const leaveHeadApproverCandidates = workspace.leaveHeadApproverCandidates ?? [];
  const pnrs = workspace.pnrs ?? [];
  const proposals = workspace.proposals ?? [];
  const queries = workspace.queries ?? [];
  const team = workspace.team ?? [];
  const travellers = workspace.travellers ?? [];
  const travellersWithoutVisa = workspace.travellersWithoutVisa ?? [];
  const visas = workspace.visas ?? [];

  return (
    <>
      {modal === "commercialFiles" ? (
        <CommercialFilesModal close={workspace.closeModal} form={workspace.form} modal={modal} />
      ) : null}
      {shouldLoadEntityModalBridge(modal) ? (
        <TravelBatchEntityModalBridge
          key={travelBatchEntityModalKey(modal, workspace.form)}
          workspace={{
            ...workspace,
            access,
            jobCards,
            leaveHeadApproverCandidates,
            pnrs,
            proposals,
            queries,
            team,
            travellers,
            travellersWithoutVisa,
            visas,
          }}
        />
      ) : null}
      {PASSENGER_IMPORT_MODAL_CONFIGS.map((config) =>
        modal === config.modal ? (
          <PassengerImportModal
            close={workspace.closeModal}
            commitPassengerImport={workspace.commitPassengerImport}
            jobCards={jobCards}
            key={config.modal}
            open
            operations={workspace.passengerImportOperations}
            previewPassengerImport={workspace.previewPassengerImport}
            {...config}
          />
        ) : null
      )}
      {modal === "flightImport" ? (
        <FlightImportModal
          close={workspace.closeModal}
          commitFlightImport={workspace.commitFlightImport}
          itinerary={flightItinerary}
          jobCards={jobCards}
          open
        />
      ) : null}
      {PASSENGER_EXPORT_MODAL_CONFIGS.map((config) =>
        modal === config.modal ? (
          <PassengerExportModal
            close={workspace.closeModal}
            getPassengerExportDownload={workspace.getPassengerExportDownload}
            jobCards={jobCards}
            key={config.modal}
            open
            operations={workspace.passengerExportOperations}
            startPassengerExport={workspace.startPassengerExport}
            {...config}
          />
        ) : null
      )}
      {modal === "flightExport" ? (
        <FlightExportModal
          close={workspace.closeModal}
          itinerary={flightItinerary}
          jobCards={jobCards}
          open
        />
      ) : null}
    </>
  );
}
