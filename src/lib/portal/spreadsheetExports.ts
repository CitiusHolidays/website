import { FLIGHT_EXPORT_HEADER } from "./spreadsheetImports";
import {
  sanitizeSheetName,
  type WorkbookRow,
  type WorkbookRows,
  workbookArrayBufferFromSheets,
  workbookFromSheets,
} from "./workbookAdapter";

export interface FlightSegmentExportRow {
  airline?: string;
  arriveTime?: string;
  dateLabel?: string;
  departTime?: string;
  destination?: string;
  duration?: string;
  flightNumber?: string | number;
  origin?: string;
  transit?: string;
}

export interface FlightGroupExportRow {
  segments?: FlightSegmentExportRow[];
  sourceSheet?: string;
  travelBatchReference?: string;
}

interface FlightWorkbookBuildOptions {
  defaultSheetName?: string;
}

function flightHeaderRow(): WorkbookRow {
  return ["", ...FLIGHT_EXPORT_HEADER];
}

function flightSegmentRow(segment: FlightSegmentExportRow): WorkbookRow {
  return [
    "",
    segment.dateLabel || "",
    segment.airline || "",
    segment.flightNumber || "",
    segment.departTime || "",
    segment.origin || "",
    segment.arriveTime || "",
    segment.destination || "",
    segment.duration || "-",
    segment.transit || "-",
  ];
}

function groupFlightsBySheet(
  groups: FlightGroupExportRow[],
  defaultSheetName: string
): Map<string, FlightGroupExportRow[]> {
  const groupsBySheet = new Map<string, FlightGroupExportRow[]>();
  for (const group of groups) {
    const key = group.sourceSheet || defaultSheetName;
    const sheetGroups = groupsBySheet.get(key) ?? [];
    sheetGroups.push(group);
    groupsBySheet.set(key, sheetGroups);
  }
  return groupsBySheet;
}

function uniqueSheetName(
  sheetKey: string,
  defaultSheetName: string,
  usedNames: Set<string>
): string {
  let sheetName = sanitizeSheetName(sheetKey, defaultSheetName);
  let suffix = 2;
  while (usedNames.has(sheetName)) {
    const trimmed = sheetName.slice(0, Math.max(1, 28 - String(suffix).length));
    sheetName = `${trimmed}-${suffix}`;
    suffix += 1;
  }
  usedNames.add(sheetName);
  return sheetName;
}

function flightSheetRows(sheetGroups: FlightGroupExportRow[]): WorkbookRow[] {
  const sheetRows: WorkbookRow[] = [[]];
  for (const group of sheetGroups) {
    const segments = group.segments || [];
    if (segments.length === 0) {
      continue;
    }
    if (group.travelBatchReference) {
      sheetRows.push(["Travel Batch", group.travelBatchReference]);
    }
    sheetRows.push(flightHeaderRow());
    for (const segment of segments) {
      sheetRows.push(flightSegmentRow(segment));
    }
    sheetRows.push([]);
  }
  if (sheetRows.length === 1) {
    sheetRows.push(flightHeaderRow());
  }
  return sheetRows;
}

export function buildFlightWorkbook(
  groups: FlightGroupExportRow[],
  { defaultSheetName = "Flights" }: FlightWorkbookBuildOptions = {}
): WorkbookRows {
  const groupsBySheet = groupFlightsBySheet(groups, defaultSheetName);
  const sheets: Record<string, WorkbookRow[]> = {};

  if (groupsBySheet.size === 0) {
    sheets[sanitizeSheetName(defaultSheetName)] = [[], flightHeaderRow()];
    return workbookFromSheets(sheets);
  }

  const usedNames = new Set<string>();
  for (const [sheetKey, sheetGroups] of groupsBySheet.entries()) {
    const sheetName = uniqueSheetName(sheetKey, defaultSheetName, usedNames);
    sheets[sheetName] = flightSheetRows(sheetGroups);
  }

  return workbookFromSheets(sheets);
}

export async function downloadWorkbook(workbook: WorkbookRows, filename: string): Promise<void> {
  const buffer = await workbookArrayBufferFromSheets(workbook.Sheets);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
