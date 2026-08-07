"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { ControlledDialog, ControlledDialogTitle } from "@/components/ui/application-dialog";
import { downloadPassengerImportReportCsv } from "@/lib/portal/importReconciliation";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PAGE_SIZE = 50;

export type PassengerImportReportDisposition = "created" | "failed" | "updated";

export interface PassengerImportReportRow {
  disposition: PassengerImportReportDisposition;
  message: string;
  rowNumber: number;
  travellerName: string;
}

export interface PassengerImportReportSummary {
  created?: number;
  failed?: number;
  total?: number;
  updated?: number;
}

export interface ImportReconciliationModalProps {
  jobCode?: string;
  onClose: () => void;
  open: boolean;
  roomSummaryText?: string;
  rows?: PassengerImportReportRow[];
  summary?: PassengerImportReportSummary;
}

export function ImportReconciliationModal({
  open,
  onClose,
  jobCode,
  roomSummaryText,
  rows,
  summary,
}: ImportReconciliationModalProps) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const pageRows = (rows ?? []).slice(start, start + PAGE_SIZE);
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <ControlledDialog
      backdropClassName="absolute inset-0 bg-slate-950/50"
      backdropRender={<Button aria-label="Close reconciliation report" type="button" />}
      escapeDisabled
      onOpenChange={handleOpenChange}
      open={open}
      popupClassName="relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xl"
      popupRender={<div />}
      triggerless
      viewportClassName={`fixed inset-0 ${PORTAL_Z.confirm} flex items-center justify-center p-4`}
    >
      {open ? (
        <>
          <header className="border-brand-border/70 border-b px-5 py-4">
            <ControlledDialogTitle className="font-heading font-semibold text-brand-dark text-lg">
              Import reconciliation
            </ControlledDialogTitle>
            <p className="mt-1 text-brand-muted text-sm">
              {jobCode ? `${jobCode} · ` : ""}
              Created {summary?.created ?? 0}, updated {summary?.updated ?? 0}, failed{" "}
              {summary?.failed ?? 0} of {summary?.total ?? rows?.length ?? 0}.
            </p>
            {roomSummaryText ? (
              <p className="mt-2 text-brand-muted text-xs">Room summary: {roomSummaryText}</p>
            ) : null}
          </header>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-brand-muted text-xs uppercase">
                <tr>
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Traveller</th>
                  <th className="py-2 pr-3">Disposition</th>
                  <th className="py-2">Message</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr
                    className="border-brand-border/50 border-t"
                    key={`${row.rowNumber}-${row.travellerName}`}
                  >
                    <td className="py-2 pr-3 tabular-nums">{row.rowNumber}</td>
                    <td className="py-2 pr-3">{row.travellerName || "—"}</td>
                    <td className="py-2 pr-3 capitalize">{row.disposition}</td>
                    <td className="py-2 text-brand-muted">{row.message || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-brand-border/70 border-t px-5 py-4">
            <div className="flex items-center gap-2 text-brand-muted text-xs">
              <Button
                className="rounded border border-brand-border px-2 py-1 disabled:opacity-40"
                disabled={page <= 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                type="button"
              >
                Previous
              </Button>
              <span>
                Page {page + 1} of {pageCount}
              </span>
              <Button
                className="rounded border border-brand-border px-2 py-1 disabled:opacity-40"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                type="button"
              >
                Next
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                onClick={() =>
                  downloadPassengerImportReportCsv(
                    rows,
                    jobCode ? `${jobCode}-import-reconciliation.csv` : "import-reconciliation.csv"
                  )
                }
                type="button"
              >
                Download CSV
              </Button>
              <Button className="portal-primary-btn" onClick={onClose} type="button">
                Done
              </Button>
            </div>
          </footer>
        </>
      ) : null}
    </ControlledDialog>
  );
}
