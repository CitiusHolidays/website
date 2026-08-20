"use client";

import type { Id } from "@convex/_generated/dataModel";

import { Select } from "@/components/portal/PortalModalForm";
import { Button } from "@/components/ui/application-button";
import { formatCount } from "@/lib/countMessage";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import type { PortalJobCardOption } from "../portalViewTypes";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { Badge } from "../portalWorkspaceListUi";
import { jobCardSelectOptions, PASSENGER_EXPORT_INITIAL } from "./spreadsheetModalRuntime";
import { ImportModalShell, ImportSummary } from "./spreadsheetModalShell";

type ExportKind = "passport" | "passenger" | "rooming" | "traveller" | "visa";

interface ExportOperation {
  commandId: string;
  errorCode?: string;
  exportKind: string;
  fileName?: string;
  id: Id<"passengerExportOperations">;
  jobCardId: Id<"jobCards">;
  rowsProcessed: number;
  stalled: boolean;
  status: "completed" | "expired" | "failed" | "running";
}

export interface PassengerExportModalProps {
  close: () => void;
  exportKind?: ExportKind;
  getPassengerExportDownload: (args: {
    operationId: Id<"passengerExportOperations">;
  }) => Promise<{ fileName: string; url: string }>;
  jobCards: PortalJobCardOption[];
  open: boolean;
  operations?: ExportOperation[];
  startPassengerExport: (args: {
    commandId?: string;
    exportKind: ExportKind;
    jobCardId: Id<"jobCards">;
  }) => Promise<{ operationId: string }>;
  subtitle?: string;
  title?: string;
}

async function downloadExport(url: string, fileName: string) {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Export download returned HTTP ${response.status}.`);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

async function generatePassengerExport(
  startPassengerExport: PassengerExportModalProps["startPassengerExport"],
  exportKind: ExportKind,
  jobCardId: Id<"jobCards">,
  commandId?: string
) {
  try {
    await startPassengerExport({ commandId, exportKind, jobCardId });
    return "";
  } catch (error) {
    return formatConvexError(error, "Passenger export failed.");
  }
}

async function downloadPassengerExport(
  getPassengerExportDownload: PassengerExportModalProps["getPassengerExportDownload"],
  operationId: Id<"passengerExportOperations">
) {
  try {
    const download = await getPassengerExportDownload({ operationId });
    await downloadExport(download.url, download.fileName);
    return "";
  } catch (error) {
    return formatConvexError(error, "Unable to download the export.");
  }
}

function exportStatusLabel(operation?: ExportOperation) {
  if (operation?.stalled) {
    return "Needs retry";
  }
  if (operation?.status === "running") {
    return "In progress";
  }
  if (operation?.status === "completed") {
    return "Ready";
  }
  if (operation?.status === "failed") {
    return "Failed";
  }
  if (operation?.status === "expired") {
    return "Expired";
  }
  return "Not started";
}

function exportStatusMessage(operation: ExportOperation) {
  if (operation.stalled) {
    return "The last run stopped reporting progress. Retry to create a fresh export.";
  }
  if (operation.status === "running") {
    return `Processed ${formatCount(operation.rowsProcessed, "row")}. You can close this dialog; processing will continue.`;
  }
  if (operation.status === "completed") {
    return `${formatCount(operation.rowsProcessed, "row")} ${operation.rowsProcessed === 1 ? "is" : "are"} ready to download.`;
  }
  if (operation.status === "expired") {
    return "The previous download expired. Generate a fresh private export.";
  }
  return "The export did not complete. Retry when ready.";
}

function generateButtonLabel(isBusy: boolean, operation?: ExportOperation) {
  if (isBusy) {
    return "Exporting…";
  }
  if (operation?.status === "completed") {
    return "Generate New";
  }
  if (operation?.status === "failed" || operation?.stalled) {
    return "Retry Export";
  }
  if (operation?.status === "expired") {
    return "Generate Again";
  }
  return "Generate Spreadsheet";
}

export function PassengerExportModal({
  open,
  close,
  jobCards = [],
  getPassengerExportDownload,
  startPassengerExport,
  title = "Export Passengers",
  subtitle = "Generate a passenger spreadsheet in the background, then download it when ready.",
  exportKind = "passenger",
  operations: exportOperations = [],
}: PassengerExportModalProps) {
  const [exportState, patchExportState] = usePatchReducer(PASSENGER_EXPORT_INITIAL);
  const { jobCardId, isExporting, error } = exportState;
  const selectedJob = jobCards.find((job) => String(job.id) === String(jobCardId));
  const recentOperation = exportOperations?.find(
    (operation) =>
      operation.exportKind === exportKind && String(operation.jobCardId) === String(jobCardId)
  );
  const isRunning = recentOperation?.status === "running" && !recentOperation.stalled;

  const reset = () => patchExportState(PASSENGER_EXPORT_INITIAL);
  const closeAndReset = () => {
    reset();
    close();
  };

  const handleJobCardChange = (value: string) => patchExportState({ error: "", jobCardId: value });

  const handleGenerate = async () => {
    if (!jobCardId || isRunning) {
      return;
    }
    patchExportState({ error: "", isExporting: true });
    const retryCommandId =
      recentOperation?.status === "failed" || recentOperation?.stalled
        ? recentOperation.commandId
        : undefined;
    const nextError = await generatePassengerExport(
      startPassengerExport,
      exportKind,
      // SAFETY: jobCardId is selected from the validated Job Card options supplied to this modal.
      jobCardId as Id<"jobCards">,
      retryCommandId
    );
    patchExportState({ error: nextError, isExporting: false });
  };

  const handleDownload = async () => {
    if (recentOperation?.status !== "completed") {
      return;
    }
    patchExportState({ error: "", isExporting: true });
    const nextError = await downloadPassengerExport(getPassengerExportDownload, recentOperation.id);
    patchExportState({ error: nextError, isExporting: false });
  };

  const statusLabel = exportStatusLabel(recentOperation);
  const isBusy = Boolean(isRunning || isExporting);
  const actionLabel = generateButtonLabel(isBusy, recentOperation);

  return (
    <ImportModalShell close={closeAndReset} open={open} subtitle={subtitle} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={handleJobCardChange}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportSummary
          isBusy={isBusy}
          totals={[
            ["Status", statusLabel],
            ["Rows processed", recentOperation?.rowsProcessed ?? 0],
            ["Job", selectedJob?.jobCode || "-"],
          ]}
        />
        {recentOperation && (
          <div
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-lg border border-brand-border bg-brand-light/40 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-semibold text-brand-dark">{statusLabel}</p>
              <p className="mt-1 text-brand-muted">{exportStatusMessage(recentOperation)}</p>
            </div>
            <Badge
              label={statusLabel}
              tone={recentOperation.status === "failed" ? "red" : "gray"}
            />
          </div>
        )}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </Button>
          {recentOperation?.status === "completed" && (
            <Button
              className="portal-small-btn border-brand-border bg-white text-brand-dark hover:bg-brand-light/70"
              disabled={isExporting}
              onClick={handleDownload}
              type="button"
            >
              Download Spreadsheet
            </Button>
          )}
          <Button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || isRunning || isExporting}
            onClick={handleGenerate}
            type="button"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </ImportModalShell>
  );
}
