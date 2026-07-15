"use client";

import { useEffect } from "react";
import { Select } from "@/components/portal/PortalModalForm";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import type { PortalJobCardOption } from "../portalViewTypes";
import { formatConvexError, strong } from "../portalWorkspaceListHelpers";
import {
  buildPassengerWorkbook,
  downloadWorkbook,
  jobCardSelectOptions,
  PASSENGER_EXPORT_INITIAL,
  type SpreadsheetImportPreviewRow,
} from "./spreadsheetModalRuntime";
import { ImportModalShell, ImportSummary } from "./spreadsheetModalShell";

export interface PassengerExportModalProps {
  buildWorkbook?: (
    rows: SpreadsheetImportPreviewRow[],
    options: { sheetName: string }
  ) => Promise<unknown>;
  close: () => void;
  exportKind?: string;
  filenameSuffix?: string;
  getPassengerExportRows: (args: {
    exportKind?: string;
    jobCardId: string;
  }) => Promise<{ clientName?: string; jobCode?: string; rows: SpreadsheetImportPreviewRow[] }>;
  jobCards: PortalJobCardOption[];
  open: boolean;
  sheetName?: string;
  subtitle?: string;
  title?: string;
}

export function PassengerExportModal({
  open,
  close,
  jobCards = [],
  getPassengerExportRows,
  title = "Export Passengers",
  subtitle = "Select a job card to download a passenger spreadsheet compatible with the import template.",
  buildWorkbook = buildPassengerWorkbook,
  filenameSuffix = "passengers",
  sheetName = "",
  exportKind = "passenger",
}: PassengerExportModalProps) {
  const [exportState, patchExportState, , dispatchExport] =
    usePatchReducer(PASSENGER_EXPORT_INITIAL);
  const { jobCardId, exportData, isLoading, isExporting, error } = exportState;
  const patchExport = (patch: any) => patchExportState(patch);
  const setJobCardId = (value: any) => patchExport({ jobCardId: value });
  const setExportData = (value: any) => patchExport({ exportData: value });
  const setIsLoading = (value: any) => patchExport({ isLoading: value });
  const setIsExporting = (value: any) => patchExport({ isExporting: value });
  const setError = (value: any) => patchExport({ error: value });

  const reset = () => patchExportState(PASSENGER_EXPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

  useEffect(() => {
    let cancelled = false;
    async function loadExportPreview() {
      if (!(open && jobCardId)) {
        dispatchExport({ patch: { exportData: null }, type: "patch" });
        return;
      }
      dispatchExport({ patch: { error: "", isLoading: true }, type: "patch" });
      try {
        const result = await getPassengerExportRows({ exportKind, jobCardId });
        if (!cancelled) {
          dispatchExport({ patch: { exportData: result }, type: "patch" });
        }
      } catch (err) {
        if (!cancelled) {
          dispatchExport({
            patch: {
              error: formatConvexError(err, "Unable to load passengers for export."),
              exportData: null,
            },
            type: "patch",
          });
        }
      }
      if (!cancelled) {
        dispatchExport({ patch: { isLoading: false }, type: "patch" });
      }
    }
    loadExportPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, exportKind, getPassengerExportRows, dispatchExport]);

  const handleExport = async () => {
    if (!exportData?.rows?.length) {
      return;
    }
    setIsExporting(true);
    setError("");
    try {
      const workbook = await buildWorkbook(exportData.rows, {
        sheetName: sheetName || exportData.jobCode,
      });
      await downloadWorkbook(workbook, `${exportData.jobCode}-${filenameSuffix}.xlsx`);
      closeAndReset();
    } catch (err) {
      setError(formatConvexError(err, "Passenger export failed."));
    }
    setIsExporting(false);
  };

  const rows = exportData?.rows || [];

  return (
    <ImportModalShell close={closeAndReset} open={open} subtitle={subtitle} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportSummary
          isBusy={isLoading}
          totals={[
            ["Passengers", jobCardId ? (isLoading ? "-" : rows.length) : "-"],
            [
              "Confirmed",
              rows.filter((row: SpreadsheetImportPreviewRow) => row.willingToGo === "CONFIRMED")
                .length,
            ],
            [
              "Unable",
              rows.filter((row: SpreadsheetImportPreviewRow) => row.willingToGo !== "CONFIRMED")
                .length,
            ],
            ["Job", exportData?.jobCode || "-"],
            ["Client", exportData?.clientName || "-"],
          ]}
        />
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {jobCardId && !isLoading && rows.length === 0 && (
          <div className="rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-brand-muted text-sm">
            No passengers found for this job card.
          </div>
        )}
        {rows.length > 0 && (
          <SelectableDataTable
            columns={[
              {
                id: "passenger",
                label: "Passenger",
                render: (row) => strong(row.fullName),
              },
              {
                id: "status",
                kind: "status",
                label: "Status",
                render: (row) => row.willingToGo,
              },
              { id: "hub", label: "Hub", render: (row) => row.travelHub || "-" },
              { id: "food", label: "Food", render: (row) => row.foodPreference },
              {
                id: "passport",
                label: "Passport",
                render: (row) =>
                  row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending",
              },
            ]}
            compact
            empty="No passengers to export."
            rows={rows.slice(0, 25)}
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </button>
          <button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || isLoading || rows.length === 0 || isExporting}
            onClick={handleExport}
            type="button"
          >
            {isExporting ? "Exporting…" : "Download Spreadsheet"}
          </button>
        </div>
      </div>
    </ImportModalShell>
  );
}
