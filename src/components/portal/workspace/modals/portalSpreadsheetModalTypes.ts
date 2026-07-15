import type { PortalTravelBatchModalWorkspaceSlice } from "../portalModalWorkspaceTypes";
import type { PortalFlightItineraryGroup, PortalJobCardOption } from "../portalViewTypes";
import type { FlightImportModalProps } from "./FlightImportModal";
import type { PassengerExportModalProps } from "./PassengerExportModal";
import type { PassengerImportModalProps } from "./PassengerImportModal";

export interface PortalSpreadsheetModalWorkspaceSlice
  extends Omit<PortalTravelBatchModalWorkspaceSlice, "jobCards"> {
  commitFlightImport: FlightImportModalProps["commitFlightImport"];
  commitPassengerImport: PassengerImportModalProps["commitPassengerImport"];
  flightItinerary: PortalFlightItineraryGroup[];
  getPassengerExportRows: PassengerExportModalProps["getPassengerExportRows"];
  jobCards: PortalJobCardOption[];
  previewPassengerImport: PassengerImportModalProps["previewPassengerImport"];
}
