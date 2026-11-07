"use client";

import type { Id } from "@convex/_generated/dataModel";
import type { ChangeEvent } from "react";
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
import type { PortalGridColumn } from "@/lib/portal/portalDataGrid";
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

const EMPTY_PASSENGER_IMPORT_ROWS: SpreadsheetImportPreviewRow[] = [];

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

function usePassengerImportModal({
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
  const setJobCardId = (value: string) => patchImportState({ jobCardId: value });

  const rows = parsed?.rows || EMPTY_PASSENGER_IMPORT_ROWS;
  const skipped = parsed?.skipped || [];
  const errors = parsed?.errors || [];
  const previewRows = preview?.rows || EMPTY_PASSENGER_IMPORT_ROWS;
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
  const selectedJob = jobCards.find((job) => job.id === jobCardId);
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

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    patchImportState({
      error: "",
      fileName: file.name,
      isParsing: true,
      parsed: null,
      preview: null,
    });
    try {
      patchImportState({ parsed: await parseWorkbookFile(file) });
    } catch (err) {
      patchImportState({ error: formatConvexError(err, "Unable to read spreadsheet.") });
    }
    patchImportState({ isParsing: false });
    event.target.value = "";
  };

  const handleCommit = async () => {
    if (!jobCardId || rows.length === 0) {
      return;
    }
    patchImportState({ error: "", importProgress: { current: 0, total: 1 }, isSaving: true });
    try {
      patchImportState({ importProgress: { current: 0, label: "Uploading…", total: 1 } });
      const importRows = rows.map(toPassengerImportInput);
      const result = await commitPassengerImport(
        {
          // SAFETY: jobCardId is selected from the validated Job Card options supplied to this modal.
          jobCardId: jobCardId as Id<"jobCards">,
          rows: importRows,
        },
        async ({ batchTotal, completedBatches }) => {
          patchImportState({
            importProgress: {
              current: completedBatches,
              label: `${completedBatches} of ${formatCount(batchTotal, "batch", "batches")} complete`,
              total: batchTotal,
            },
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
        result.rowResults,
        result.guardianLinks?.warnings
      );
      setReconciliation({
        jobCode: selectedJob?.jobCode,
        roomSummaryText,
        rows: reportRows,
        summary: result,
      });
      if (isPartialFailure) {
        toast.error(message);
        patchImportState({ error: message });
      } else {
        toast.success(message);
      }
    } catch (err) {
      patchImportState({ error: formatConvexError(err, "Import failed.") });
    }
    patchImportState({ importProgress: null, isSaving: false });
  };
  const closeReconciliation = () => {
    setReconciliation(null);
    closeAndReset();
  };
  const commitLabel = isSaving ? importProgress?.label || "Uploading…" : uploadLabel;

  return {
    closeAndReset,
    closeReconciliation,
    commitLabel,
    createCount,
    emptyLabel,
    error,
    errors,
    fileLabel,
    fileName,
    handleCommit,
    handleFile,
    importProgress,
    isParsing,
    isPreviewing,
    isSaving,
    jobCardId,
    jobCards,
    open,
    preview,
    previewById,
    previewRoomSummary,
    recentOperation,
    recentOperationJob,
    reconciliation,
    rows,
    selectedJob,
    setJobCardId,
    showRoomSummary,
    skipped,
    title,
    updateCount,
  };
}

type PassengerImportPreviewTableRow = SpreadsheetImportPreviewRow & { action: string };
type PassengerImportOperation = NonNullable<PassengerImportModalProps["operations"]>[number];

const PASSENGER_IMPORT_COLUMNS: PortalGridColumn<PassengerImportPreviewTableRow>[] = [
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
    label: "Travel in Series",
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
    render: (row) => (row.passport?.number ? `****${row.passport.number.slice(-4)}` : "Pending"),
  },
  {
    id: "source",
    label: "Source",
    render: (row) => `${row.sourceSheet} row ${row.sourceRowNumber}`,
  },
];

function importSummaryTotals({
  createCount,
  errorCount,
  hasPreview,
  readyCount,
  skippedCount,
  updateCount,
}: {
  createCount: number;
  errorCount: number;
  hasPreview: boolean;
  readyCount: number;
  skippedCount: number;
  updateCount: number;
}): [string, number | string][] {
  return [
    ["Ready", readyCount],
    ["Create", hasPreview ? createCount : "-"],
    ["Update", hasPreview ? updateCount : "-"],
    ["Skipped", skippedCount],
    ["Errors", errorCount],
  ];
}

function RecentImportOperation({
  jobCode,
  operation,
}: {
  jobCode?: string;
  operation?: PassengerImportOperation;
}) {
  if (!operation) {
    return null;
  }
  return (
    <div
      aria-live="polite"
      className="rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-muted text-sm tabular-nums"
    >
      <div className="font-semibold text-brand-dark">
        {jobCode || "Recent import"}: {operation.status}
      </div>
      <div className="mt-1">
        {operation.completedBatches} of {formatCount(operation.batchTotal, "batch", "batches")}{" "}
        complete · {formatCount(operation.processed, "row")} processed ·{" "}
        {formatCount(operation.failed, "row")} failed
      </div>
      {operation.stalled ? (
        <div className="mt-1 text-amber-800">
          Progress paused. Re-select the same file to resume safely.
        </div>
      ) : null}
    </div>
  );
}

function ImportErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-sm">
      {error}
    </div>
  ) : null;
}

function ImportBatchProgress({
  progress,
}: {
  progress: ReturnType<typeof usePassengerImportModal>["importProgress"];
}) {
  return progress ? (
    <div
      className="rounded-lg border border-brand-border bg-white px-3 py-2 text-brand-muted text-sm tabular-nums"
      data-testid="passenger-import-batch-progress"
    >
      {progress.label || `Importing batch ${progress.current} of ${progress.total}…`}
    </div>
  ) : null;
}

function PassengerImportIssues({
  errors,
  skipped,
}: {
  errors: ReturnType<typeof usePassengerImportModal>["errors"];
  skipped: ReturnType<typeof usePassengerImportModal>["skipped"];
}) {
  return (
    <>
      {errors.length > 0 && <ImportIssueList rows={errors} title="Rows needing correction" />}
      {skipped.length > 0 && <ImportIssueList rows={skipped.slice(0, 8)} title="Skipped rows" />}
    </>
  );
}

function PassengerImportPreviewTable({
  emptyLabel,
  isPreviewing,
  previewById,
  rows,
}: {
  emptyLabel: string;
  isPreviewing: boolean;
  previewById: Map<string, SpreadsheetImportPreviewRow & { action?: string }>;
  rows: SpreadsheetImportPreviewRow[];
}) {
  if (rows.length === 0) {
    return null;
  }
  const fallbackAction = isPreviewing ? "checking" : "upsert";
  return (
    <SelectableDataTable<PassengerImportPreviewTableRow>
      columns={PASSENGER_IMPORT_COLUMNS}
      compact
      empty={emptyLabel}
      rows={rows.slice(0, 50).map((row: SpreadsheetImportPreviewRow) => ({
        ...row,
        action: previewById.get(String(row.id))?.action || fallbackAction,
      }))}
    />
  );
}

export function PassengerImportModal(props: PassengerImportModalProps) {
  const {
    closeAndReset,
    closeReconciliation,
    commitLabel,
    createCount,
    emptyLabel,
    error,
    errors,
    fileLabel,
    fileName,
    handleCommit,
    handleFile,
    importProgress,
    isParsing,
    isPreviewing,
    isSaving,
    jobCardId,
    jobCards,
    open,
    preview,
    previewById,
    previewRoomSummary,
    recentOperation,
    recentOperationJob,
    reconciliation,
    rows,
    selectedJob,
    setJobCardId,
    showRoomSummary,
    skipped,
    title,
    updateCount,
  } = usePassengerImportModal(props);
  const commitBlocked = !jobCardId || rows.length === 0 || isPreviewing || isSaving;

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
          totals={importSummaryTotals({
            createCount,
            errorCount: errors.length,
            hasPreview: Boolean(preview),
            readyCount: rows.length,
            skippedCount: skipped.length,
            updateCount,
          })}
        />
        <RecentImportOperation jobCode={recentOperationJob?.jobCode} operation={recentOperation} />
        <ImportErrorMessage error={error} />
        <PassengerImportIssues errors={errors} skipped={skipped} />
        {showRoomSummary && Object.keys(previewRoomSummary).length > 0 && (
          <RoomSummaryPanel jobCode={selectedJob?.jobCode} summary={previewRoomSummary} />
        )}
        <ImportBatchProgress progress={importProgress} />
        <PassengerImportPreviewTable
          emptyLabel={emptyLabel}
          isPreviewing={isPreviewing}
          previewById={previewById}
          rows={rows}
        />
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
            disabled={commitBlocked}
            onClick={handleCommit}
            type="button"
          >
            {commitLabel}
          </Button>
        </div>
      </div>
      <ImportReconciliationModal
        jobCode={reconciliation?.jobCode}
        onClose={closeReconciliation}
        open={Boolean(reconciliation)}
        roomSummaryText={reconciliation?.roomSummaryText}
        rows={reconciliation?.rows ?? []}
        summary={reconciliation?.summary}
      />
    </ImportModalShell>
  );
}
