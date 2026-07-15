import type { Key } from "react";
import {
  loadSpreadsheetExportRuntime,
  loadSpreadsheetImportRuntime,
} from "@/lib/portal/spreadsheetLazyRuntime";
import type { PortalJobCardOption } from "../portalViewTypes";

export const PASSENGER_IMPORT_INITIAL = {
  error: "",
  fileName: "",
  importProgress: null as { current: number; label?: string; total: number } | null,
  isParsing: false,
  isPreviewing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null as {
    errors?: SpreadsheetImportIssueRow[];
    rows?: SpreadsheetImportPreviewRow[];
    skipped?: SpreadsheetImportIssueRow[];
  } | null,
  preview: null as {
    roomSummary?: Record<string, number>;
    rows?: SpreadsheetImportPreviewRow[];
  } | null,
};

export const FLIGHT_IMPORT_INITIAL = {
  error: "",
  fileName: "",
  isParsing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null as {
    errors?: SpreadsheetImportIssueRow[];
    groups?: FlightImportGroup[];
  } | null,
};

export const PASSENGER_EXPORT_INITIAL = {
  error: "",
  exportData: null as PassengerExportData | null,
  isExporting: false,
  isLoading: false,
  jobCardId: "",
};

export interface SpreadsheetImportIssueRow {
  id?: Key;
  message?: string;
  reason?: string;
  sourceRowNumber?: number;
  sourceSheet?: string;
}

export interface SpreadsheetImportPreviewRow {
  action?: string;
  foodPreference?: string;
  fullName?: string;
  id: Key;
  passport?: { number?: string };
  roomType?: string;
  sourceRowNumber?: number;
  sourceSheet?: string;
  travelBatchReference?: string;
  travelHub?: string;
  visaRequired?: boolean;
  visaStatus?: string;
  willingToGo?: string;
}

export interface FlightImportGroup {
  id: string;
  name: string;
  segments: Array<{
    airline: string;
    arriveTime?: string;
    dateLabel: string;
    departTime?: string;
    destination: string;
    flightNumber: string;
    importKey: string;
    origin: string;
  }>;
  sourceSheet?: string;
}

export interface PassengerExportData {
  clientName?: string;
  jobCode?: string;
  rows: SpreadsheetImportPreviewRow[];
}

export const parsePassengerWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parsePassengerWorkbookFile(file);
export const parseTravellerMasterWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parseTravellerMasterWorkbookFile(file);
export const parseRoomingWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parseRoomingWorkbookFile(file);
export const parsePassportWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parsePassportWorkbookFile(file);
export const parseVisaWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parseVisaWorkbookFile(file);
export const parseFlightWorkbookFile = async (file: File) =>
  (await loadSpreadsheetImportRuntime()).parseFlightWorkbookFile(file);

const lazyWorkbookBuilder =
  (name: keyof Awaited<ReturnType<typeof loadSpreadsheetExportRuntime>>) =>
  async (...args: unknown[]) =>
    Reflect.apply((await loadSpreadsheetExportRuntime())[name], null, args);

export const buildPassengerWorkbook = lazyWorkbookBuilder("buildPassengerWorkbook");
export const buildTravellerMasterWorkbook = lazyWorkbookBuilder("buildTravellerMasterWorkbook");
export const buildRoomingWorkbook = lazyWorkbookBuilder("buildRoomingWorkbook");
export const buildPassportWorkbook = lazyWorkbookBuilder("buildPassportWorkbook");
export const buildVisaWorkbook = lazyWorkbookBuilder("buildVisaWorkbook");
export const buildFlightWorkbook = lazyWorkbookBuilder("buildFlightWorkbook");
export const downloadWorkbook = async (...args: unknown[]) =>
  Reflect.apply((await loadSpreadsheetExportRuntime()).downloadWorkbook, null, args);

export function jobCardSelectOptions(
  jobCards: PortalJobCardOption[] | null | undefined,
  {
    required = false,
    allowUnassigned = false,
  }: { allowUnassigned?: boolean; required?: boolean } = {}
) {
  const options = (jobCards ?? []).map((job) => ({
    label: `${job.jobCode} - ${job.clientName}`,
    value: String(job.id),
  }));
  if (allowUnassigned) {
    return [{ label: "Unassigned", value: "" }, ...options];
  }
  if (required) {
    return [{ label: "Select job card…", value: "" }, ...options];
  }
  return options;
}
