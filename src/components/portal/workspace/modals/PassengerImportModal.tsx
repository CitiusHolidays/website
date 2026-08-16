"use client";

import type { Id } from "@convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { Select } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { Button } from "@/components/ui/application-button";
import { formatCount } from "@/lib/countMessage";
import { buildPassengerImportReportRows } from "@/lib/portal/importReconciliation";
import type { PassengerImportMutationResult } from "@/lib/portal/importResultMessages";
import { buildPassengerImportResultMessage } from "@/lib/portal/importResultMessages";
import type { PassengerImportBatchProgress } from "@/lib/portal/passengerImportClient";
import { toPassengerImportInput } from "@/lib/portal/passengerImportRows";
import { usePatchReducer } from "@/lib/portal/patchReducer";
import { formatRoomSummaryText, summarizeRoomTypes } from "@/lib/portal/roomSummary";
import type { PortalJobCardOption } from "../portalViewTypes";
import { formatConvexError, strong } from "../portalWorkspaceListHelpers";
import { Badge } from "../portalWorkspaceListUi";
import { ImportReconciliationModal } from "./ImportReconciliationModal";
import { RoomSummaryPanel } from "./RoomSummaryPanel";
import {
  jobCardSelectOptions,
  PASSENGER_IMPORT_INITIAL,
  parsePassengerWorkbookFile,
  type SpreadsheetImportPreviewRow,
} from "./spreadsheetModalRuntime";
import {
  ImportFileInput,
  ImportIssueList,
  ImportModalShell,
  ImportSummary,
} from "./spreadsheetModalShell";

export interface PassengerImportModalProps {
  close: () => void;
  commitPassengerImport: (
    args: {
      jobCardId: Id<"jobCards">;
      rows: ReturnType<typeof toPassengerImportInput>[];
    },
    onBatchCompleted?: (progress: PassengerImportBatchProgress) => Promise<void> | void
  ) => Promise<
    PassengerImportMutationResult & {
      roomSummary?: Record<string, number>;
      operationId: string;
      rowResults?: Array<{
        disposition: "created" | "failed" | "updated";
        fullName: string;
        id: string;
        message?: string;
        sourceRowNumber?: number;
        sourceSheet?: string;
      }>;
    }
  >;
  emptyLabel?: string;
  fileLabel?: string;
  importKind?: string;
  jobCards: PortalJobCardOption[];
  open: boolean;
  operations?: Array<{
    batchTotal: number;
    completedBatches: number;
    failed: number;
    importKinds: string[];
    jobCardId: Id<"jobCards">;
    processed: number;
    stalled: boolean;
    status: "completed" | "partial" | "running";
    total: number;
  }>;
  parseWorkbookFile?: (file: File) => Promise<{
    errors?: Array<{
      id?: string;
      message?: string;
      reason?: string;
      sourceRowNumber?: number;
      sourceSheet?: string;
    }>;
    rows?: SpreadsheetImportPreviewRow[];
    skipped?: Array<{
      id?: string;
      message?: string;
      reason?: string;
      sourceRowNumber?: number;
      sourceSheet?: string;
    }>;
  }>;
  previewPassengerImport: (args: {
    jobCardId: Id<"jobCards">;
    rows: ReturnType<typeof toPassengerImportInput>[];
  }) => Promise<{ roomSummary?: Record<string, number>; rows?: SpreadsheetImportPreviewRow[] }>;
  successLabel?: string;
  title?: string;
  uploadLabel?: string;
}

function importActionTone(action: string) {
  if (action === "update") {
    return "blue";
  }
  return action === "create" ? "green" : "orange";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: the bounded import lifecycle is intentionally colocated with its modal state.
export function PassengerImportModal({
  open,
  close,
  jobCards = [],
  previewPassengerImport,
  commitPassengerImport,
  title = "Import Passengers",
  fileLabel = "Passenger spreadsheet",
  parseWorkbookFile = parsePassengerWorkbookFile,
  emptyLabel = "No confirmed passengers found.",
  successLabel = "Passenger import complete",
  uploadLabel = "Upload Passengers",
  importKind = "passenger",
  operations: importOperations = [],
}: PassengerImportModalProps) {
  const toast = usePortalToast();
  const [reconciliation, setReconciliation] = useState<{
    jobCode?: string;
    roomSummaryText: string;
    rows: ReturnType<typeof buildPassengerImportReportRows>;
    summary: PassengerImportMutationResult;
  } | null>(null);
  const [importState, patchImportState, , dispatchImport] =
    usePatchReducer(PASSENGER_IMPORT_INITIAL);
  const {
    jobCardId,
    fileName,
    parsed,
    preview,
    isParsing,
    isPreviewing,
    isSaving,
    importProgress,
    error,
  } = importState;
  const patchImport = (patch: any) => patchImportState(patch);
  const setJobCardId = (value: any) => patchImport({ jobCardId: value });
  const setFileName = (value: any) => patchImport({ fileName: value });
  const setParsed = (value: any) => patchImport({ parsed: value });
  const setPreview = (value: any) => patchImport({ preview: value });
  const setIsParsing = (value: any) => patchImport({ isParsing: value });
  const setIsPreviewing = (value: any) => patchImport({ isPreviewing: value });
  const setIsSaving = (value: any) => patchImport({ isSaving: value });
  const setImportProgress = (value: any) => patchImport({ importProgress: value });
  const setError = (value: any) => patchImport({ error: value });

  const rows = parsed?.rows || [];
  const skipped = parsed?.skipped || [];
  const errors = parsed?.errors || [];
  const previewRows = preview?.rows || [];
  const previewById = new Map<string, SpreadsheetImportPreviewRow & { action?: string }>(
    previewRows.map((row: SpreadsheetImportPreviewRow & { action?: string }) => [
      String(row.id),
      row,
    ])
  );
  const createCount = previewRows.filter(
    (row: SpreadsheetImportPreviewRow) => row.action === "create"
  ).length;
  const updateCount = previewRows.filter(
    (row: SpreadsheetImportPreviewRow) => row.action === "update"
  ).length;
  const selectedJob = (jobCards || []).find((job: any) => job.id === jobCardId);
  const recentOperation = importOperations?.find((operation) =>
    operation.importKinds.includes(importKind)
  );
  const recentOperationJob = jobCards.find(
    (job) => String(job.id) === String(recentOperation?.jobCardId)
  );
  const showRoomSummary = importKind === "traveller" || importKind === "rooming";
  const parsedRoomSummary = showRoomSummary ? summarizeRoomTypes(rows) : {};
  const previewRoomSummary = showRoomSummary
    ? preview?.roomSummary || parsedRoomSummary
    : parsedRoomSummary;

  const reset = () => patchImportState(PASSENGER_IMPORT_INITIAL);

  const closeAndReset = () => {
    reset();
    close();
  };

  useEffect(() => {
    let cancelled = false;
    async function runPreview() {
      const importRows = (parsed?.rows || []).map(toPassengerImportInput);
      if (!(open && jobCardId) || importRows.length === 0) {
        dispatchImport({ patch: { preview: null }, type: "patch" });
        return;
      }
      dispatchImport({ patch: { error: "", isPreviewing: true }, type: "patch" });
      try {
        const result = await previewPassengerImport({
          // SAFETY: jobCardId is selected from the validated Job Card options supplied to this modal.
          jobCardId: jobCardId as Id<"jobCards">,
          rows: importRows,
        });
        if (!cancelled) {
          dispatchImport({ patch: { preview: result }, type: "patch" });
        }
      } catch (err) {
        if (!cancelled) {
          dispatchImport({
            patch: {
              error: formatConvexError(err, "Unable to preview passenger import."),
              preview: null,
            },
            type: "patch",
          });
        }
      }
      if (!cancelled) {
        dispatchImport({ patch: { isPreviewing: false }, type: "patch" });
      }
    }
    runPreview();
    return () => {
      cancelled = true;
    };
  }, [open, jobCardId, parsed, previewPassengerImport, dispatchImport]);

  const handleFile = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setParsed(null);
    setPreview(null);
    setError("");
    setIsParsing(true);
    try {
      setParsed(await parseWorkbookFile(file));
    } catch (err) {
      setError(formatConvexError(err, "Unable to read spreadsheet."));
    }
    setIsParsing(false);
    event.target.value = "";
  };

  const handleCommit = async () => {
    if (!jobCardId || rows.length === 0) {
      return;
    }
    setIsSaving(true);
    setError("");
    setImportProgress({ current: 0, total: 1 });
    try {
      setImportProgress({ current: 0, label: "Uploading…", total: 1 });
      const importRows = rows.map(toPassengerImportInput);
      const result = await commitPassengerImport(
        {
          // SAFETY: jobCardId is selected from the validated Job Card options supplied to this modal.
          jobCardId: jobCardId as Id<"jobCards">,
          rows: importRows,
        },
        async ({ batchTotal, completedBatches }) => {
          setImportProgress({
            current: completedBatches,
            label: `${completedBatches} of ${formatCount(batchTotal, "batch", "batches")} complete`,
            total: batchTotal,
          });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      );
      let roomSummaryText = "";
      if (showRoomSummary && result.roomSummary) {
        roomSummaryText = formatRoomSummaryText(result.roomSummary, selectedJob?.jobCode) || "";
      }
      const { isPartialFailure, message } = buildPassengerImportResultMessage(
        result,
        successLabel,
        roomSummaryText
      );
      const reportRows = buildPassengerImportReportRows(
        previewRows,
        result.batches,
        result.rowResults
      );
      setReconciliation({
        jobCode: selectedJob?.jobCode,
        roomSummaryText,
        rows: reportRows,
        summary: result,
      });
      if (isPartialFailure) {
        toast.error(message);
        setError(message);
      } else {
        toast.success(message);
      }
    } catch (err) {
      setError(formatConvexError(err, "Import failed."));
    }
    setIsSaving(false);
    setImportProgress(null);
  };

  return (
    <ImportModalShell close={closeAndReset} open={open} title={title}>
      <div className="space-y-4">
        <Select
          label="Job Card"
          onChange={setJobCardId}
          options={jobCardSelectOptions(jobCards, { required: true })}
          required
          value={jobCardId}
        />
        <ImportFileInput
          accept=".xlsx,.xls"
          fileName={fileName}
          label={fileLabel}
          onChange={handleFile}
        />
        <ImportSummary
          isBusy={isParsing || isPreviewing}
          totals={[
            ["Ready", rows.length],
            ["Create", preview ? createCount : "-"],
            ["Update", preview ? updateCount : "-"],
            ["Skipped", skipped.length],
            ["Errors", errors.length],
          ]}
        />
        {recentOperation ? (
          <div
            aria-live="polite"
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-muted text-sm tabular-nums"
          >
            <div className="font-semibold text-brand-dark">
              {recentOperationJob?.jobCode || "Recent import"}: {recentOperation.status}
            </div>
            <div className="mt-1">
              {recentOperation.completedBatches} of{" "}
              {formatCount(recentOperation.batchTotal, "batch", "batches")} complete ·{" "}
              {formatCount(recentOperation.processed, "row")} processed ·{" "}
              {formatCount(recentOperation.failed, "row")} failed
            </div>
            {recentOperation.stalled ? (
              <div className="mt-1 text-amber-800">
                Progress paused. Re-select the same file to resume safely.
              </div>
            ) : null}
          </div>
        ) : null}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
            {error}
          </div>
        )}
        {errors.length > 0 && <ImportIssueList rows={errors} title="Rows needing correction" />}
        {skipped.length > 0 && <ImportIssueList rows={skipped.slice(0, 8)} title="Skipped rows" />}
        {showRoomSummary && Object.keys(previewRoomSummary).length > 0 && (
          <RoomSummaryPanel jobCode={selectedJob?.jobCode} summary={previewRoomSummary} />
        )}
        {importProgress && (
          <div
            className="rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-muted text-sm tabular-nums"
            data-testid="passenger-import-batch-progress"
          >
            {importProgress.label ||
              `Importing batch ${importProgress.current} of ${importProgress.total}…`}
          </div>
        )}
        {rows.length > 0 && (
          <SelectableDataTable<SpreadsheetImportPreviewRow & { action: string }>
            columns={[
              {
                id: "action",
                label: "Action",
                render: (row) => <Badge label={row.action} tone={importActionTone(row.action)} />,
              },
              {
                id: "passenger",
                label: "Passenger",
                render: (row) => strong(row.fullName),
              },
              {
                id: "travel-batch",
                label: "Travel Batch",
                render: (row) => row.travelBatchReference || "-",
              },
              { id: "hub", label: "Hub", render: (row) => row.travelHub || "-" },
              { id: "room", label: "Room", render: (row) => row.roomType || "-" },
              {
                id: "visa",
                label: "Visa",
                render: (row) => row.visaStatus || (row.visaRequired ? "Required" : "Not Required"),
              },
              {
                id: "passport",
                label: "Passport",
                render: (row) =>
                  row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending",
              },
              {
                id: "source",
                label: "Source",
                render: (row) => `${row.sourceSheet} row ${row.sourceRowNumber}`,
              },
            ]}
            compact
            empty={emptyLabel}
            rows={rows.slice(0, 50).map((row: SpreadsheetImportPreviewRow) => ({
              ...row,
              action:
                previewById.get(String(row.id))?.action || (isPreviewing ? "checking" : "upsert"),
            }))}
          />
        )}
        <div className="flex justify-end gap-2">
          <Button
            className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
            onClick={closeAndReset}
            type="button"
          >
            Cancel
          </Button>
          <Button
            className="portal-primary-btn disabled:opacity-60"
            disabled={!jobCardId || rows.length === 0 || isPreviewing || isSaving}
            onClick={handleCommit}
            type="button"
          >
            {isSaving ? importProgress?.label || "Uploading…" : uploadLabel}
          </Button>
        </div>
      </div>
      <ImportReconciliationModal
        jobCode={reconciliation?.jobCode}
        onClose={() => {
          setReconciliation(null);
          closeAndReset();
        }}
        open={Boolean(reconciliation)}
        roomSummaryText={reconciliation?.roomSummaryText}
        rows={reconciliation?.rows ?? []}
        summary={reconciliation?.summary}
      />
    </ImportModalShell>
  );
}
