"use client";

import { useMemo, useState } from "react";
import {
  downloadPassengerImportReportCsv,
  passengerImportReportToCsv,
} from "@/lib/portal/importReconciliation";
import { PORTAL_Z } from "@/lib/portal/zIndex";

const PAGE_SIZE = 50;

export function ImportReconciliationModal({
  open,
  onClose,
  jobCode,
  roomSummaryText,
  rows,
  summary,
}) {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return (rows ?? []).slice(start, start + PAGE_SIZE);
  }, [page, rows]);

  if (!open) {
    return null;
  }

  return (
    <div className={`fixed inset-0 ${PORTAL_Z.confirm} flex items-center justify-center p-4`}>
      <button
        aria-label="Close reconciliation report"
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-10 flex max-h-[min(90vh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-xl">
        <header className="border-brand-border/70 border-b px-5 py-4">
          <h2 className="font-heading font-semibold text-brand-dark text-lg">
            Import reconciliation
          </h2>
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
                <tr className="border-brand-border/50 border-t" key={`${row.rowNumber}-${row.travellerName}`}>
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
            <button
              className="rounded border border-brand-border px-2 py-1 disabled:opacity-40"
              disabled={page <= 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {pageCount}
            </span>
            <button
              className="rounded border border-brand-border px-2 py-1 disabled:opacity-40"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              type="button"
            >
              Next
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
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
            </button>
            <button className="portal-primary-btn" onClick={onClose} type="button">
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export { passengerImportReportToCsv };
