import type { Key } from "react";
import type {
  FlightWorkbookParseResult,
  ImportedFlightGroup,
} from "@/lib/portal/spreadsheetImports";
import {
  loadSpreadsheetExportRuntime,
  loadSpreadsheetImportRuntime,
} from "@/lib/portal/spreadsheetLazyRuntime";
import type { PortalJobCardOption } from "../portalViewTypes";

interface PassengerImportState {
  error: string;
  fileName: string;
  importProgress: { current: number; label?: string; total: number } | null;
  isParsing: boolean;
  isPreviewing: boolean;
  isSaving: boolean;
  jobCardId: string;
  parsed: {
    errors?: SpreadsheetImportIssueRow[];
    rows?: SpreadsheetImportPreviewRow[];
    skipped?: SpreadsheetImportIssueRow[];
  } | null;
  preview: {
    roomSummary?: Record<string, number>;
    rows?: SpreadsheetImportPreviewRow[];
  } | null;
}

export const PASSENGER_IMPORT_INITIAL: PassengerImportState = {
  error: "",
  fileName: "",
  importProgress: null,
  isParsing: false,
  isPreviewing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null,
  preview: null,
};

interface FlightImportState {
  error: string;
  fileName: string;
  isParsing: boolean;
  isSaving: boolean;
  jobCardId: string;
  parsed: FlightWorkbookParseResult | null;
}

export const FLIGHT_IMPORT_INITIAL: FlightImportState = {
  error: "",
  fileName: "",
  isParsing: false,
  isSaving: false,
  jobCardId: "",
  parsed: null,
};

interface PassengerExportState {
  error: string;
  exportData: unknown;
  isExporting: boolean;
  isLoading: boolean;
  jobCardId: string;
}

export const PASSENGER_EXPORT_INITIAL: PassengerExportState = {
  error: "",
  exportData: null,
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

export type FlightImportGroup = ImportedFlightGroup;

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

type SpreadsheetExportRuntime = Awaited<ReturnType<typeof loadSpreadsheetExportRuntime>>;

export const buildFlightWorkbook = async (
  ...args: Parameters<SpreadsheetExportRuntime["buildFlightWorkbook"]>
) => (await loadSpreadsheetExportRuntime()).buildFlightWorkbook(...args);

export const downloadWorkbook = async (
  ...args: Parameters<SpreadsheetExportRuntime["downloadWorkbook"]>
) => (await loadSpreadsheetExportRuntime()).downloadWorkbook(...args);

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
