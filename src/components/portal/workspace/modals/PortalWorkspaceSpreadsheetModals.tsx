"use client";

import { TravelBatchEntityModalBridge } from "../TravelBatchEntityModalBridge";
import { FlightExportModal } from "./FlightExportModal";
import { FlightImportModal } from "./FlightImportModal";
import { PassengerExportModal } from "./PassengerExportModal";
import { PassengerImportModal } from "./PassengerImportModal";
import type { PortalSpreadsheetModalWorkspaceSlice } from "./portalSpreadsheetModalTypes";
import {
  PASSENGER_EXPORT_MODAL_CONFIGS,
  PASSENGER_IMPORT_MODAL_CONFIGS,
} from "./spreadsheetModalConfigs";
import { travelBatchEntityModalKey } from "./travelBatchEntityModalKey";

export type { PortalSpreadsheetModalWorkspaceSlice } from "./portalSpreadsheetModalTypes";

export function PortalWorkspaceSpreadsheetModals({
  workspace,
}: {
  workspace: PortalSpreadsheetModalWorkspaceSlice;
}) {
  return (
    <>
      <TravelBatchEntityModalBridge
        key={travelBatchEntityModalKey(workspace.modal, workspace.form)}
        workspace={workspace}
      />
      {PASSENGER_IMPORT_MODAL_CONFIGS.map((config) => (
        <PassengerImportModal
          close={workspace.closeModal}
          commitPassengerImport={workspace.commitPassengerImport}
          jobCards={workspace.jobCards}
          key={config.modal}
          open={workspace.modal === config.modal}
          previewPassengerImport={workspace.previewPassengerImport}
          {...config}
        />
      ))}
      <FlightImportModal
        close={workspace.closeModal}
        commitFlightImport={workspace.commitFlightImport}
        itinerary={workspace.flightItinerary}
        jobCards={workspace.jobCards}
        open={workspace.modal === "flightImport"}
      />
      {PASSENGER_EXPORT_MODAL_CONFIGS.map((config) => (
        <PassengerExportModal
          close={workspace.closeModal}
          getPassengerExportRows={workspace.getPassengerExportRows}
          jobCards={workspace.jobCards}
          key={config.modal}
          open={workspace.modal === config.modal}
          {...config}
        />
      ))}
      <FlightExportModal
        close={workspace.closeModal}
        itinerary={workspace.flightItinerary}
        jobCards={workspace.jobCards}
        open={workspace.modal === "flightExport"}
      />
    </>
  );
}
