import {
  parsePassportWorkbookFile,
  parseRoomingWorkbookFile,
  parseTravellerMasterWorkbookFile,
  parseVisaWorkbookFile,
} from "./spreadsheetModalRuntime";

export const PASSENGER_IMPORT_MODAL_CONFIGS = [
  {
    fileLabel: "Ticketing passenger spreadsheet",
    importKind: "passenger",
    modal: "passengerImport",
    successLabel: "Ticketing passenger import complete",
    title: "Import Ticketing Passenger List",
    uploadLabel: "Upload Ticketing List",
  },
  {
    emptyLabel: "No traveller master rows found.",
    fileLabel: "Traveller master spreadsheet",
    importKind: "traveller",
    modal: "travellerImport",
    parseWorkbookFile: parseTravellerMasterWorkbookFile,
    successLabel: "Traveller master import complete",
    title: "Import Traveller Master",
    uploadLabel: "Upload Traveller Master",
  },
  {
    emptyLabel: "No rooming rows found.",
    fileLabel: "Rooming spreadsheet",
    importKind: "rooming",
    modal: "roomingImport",
    parseWorkbookFile: parseRoomingWorkbookFile,
    successLabel: "Rooming import complete",
    title: "Import Rooming List",
    uploadLabel: "Upload Rooming",
  },
  {
    emptyLabel: "No passport rows found.",
    fileLabel: "Passport spreadsheet",
    importKind: "passport",
    modal: "passportImport",
    parseWorkbookFile: parsePassportWorkbookFile,
    successLabel: "Passport import complete",
    title: "Import Passport List",
    uploadLabel: "Upload Passports",
  },
  {
    emptyLabel: "No visa rows found.",
    fileLabel: "Visa spreadsheet",
    importKind: "visa",
    modal: "visaImport",
    parseWorkbookFile: parseVisaWorkbookFile,
    successLabel: "Visa import complete",
    title: "Import Visa List",
    uploadLabel: "Upload Visa Rows",
  },
] as const;

export const PASSENGER_EXPORT_MODAL_CONFIGS = [
  {
    exportKind: "passenger",
    modal: "passengerExport",
    subtitle: "Select a job card to download the ticketing passenger spreadsheet.",
    title: "Export Ticketing Passenger List",
  },
  {
    exportKind: "traveller",
    modal: "travellerExport",
    subtitle: "Select a job card to download the Master list sheet in the traveller master format.",
    title: "Export Traveller Master",
  },
  {
    exportKind: "rooming",
    modal: "roomingExport",
    subtitle: "Select a job card to download the Rooming sheet in the master-list format.",
    title: "Export Rooming List",
  },
  {
    exportKind: "passport",
    modal: "passportExport",
    subtitle: "Select a job card to download the Passport sheet in the master-list format.",
    title: "Export Passport List",
  },
  {
    exportKind: "visa",
    modal: "visaExport",
    subtitle: "Select a job card to download the Visa sheet in the master-list format.",
    title: "Export Visa List",
  },
] as const;
