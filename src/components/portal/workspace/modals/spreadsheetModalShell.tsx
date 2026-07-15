"use client";

import { AnimatePresence, m } from "motion/react";
import type { ChangeEvent, ReactNode } from "react";
import { PORTAL_Z } from "@/lib/portal/zIndex";
import type { SpreadsheetImportIssueRow } from "./spreadsheetModalRuntime";

export function ImportModalShell({
  open,
  close,
  title,
  subtitle = "Upload a spreadsheet, review the parsed rows, then commit the import.",
  children,
}: {
  children: ReactNode;
  close: () => void;
  open: boolean;
  subtitle?: string;
  title: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <m.div
          animate={{ opacity: 1 }}
          className={`fixed inset-0 ${PORTAL_Z.importModal} flex items-center justify-center bg-slate-950/65 p-4`}
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <m.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-brand-border bg-white p-5 shadow-2xl md:p-6"
            exit={{ opacity: 0, scale: 0.96, y: 18 }}
            initial={{ opacity: 0, scale: 0.96, y: 18 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-heading font-semibold text-2xl text-citius-blue">{title}</h2>
                <p className="mt-1 text-brand-muted text-sm">{subtitle}</p>
              </div>
              <button
                className="portal-small-btn border-brand-border bg-brand-light text-brand-dark hover:bg-brand-light/70"
                onClick={close}
                type="button"
              >
                Close
              </button>
            </div>
            {children}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

export function ImportFileInput({
  label,
  fileName,
  accept,
  onChange,
}: {
  accept: string;
  fileName: string;
  label: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="block rounded-lg border border-brand-border border-dashed bg-brand-light/40 p-4">
      <span className="font-semibold text-citius-blue text-sm">{label}</span>
      <input
        accept={accept}
        className="mt-2 block w-full text-brand-dark text-sm file:mr-3 file:rounded-md file:border-0 file:bg-citius-blue file:px-3 file:py-2 file:font-semibold file:text-sm file:text-white"
        onChange={onChange}
        type="file"
      />
      {fileName && <span className="mt-2 block text-brand-muted text-xs">{fileName}</span>}
    </label>
  );
}

export function ImportSummary({
  isBusy,
  totals,
}: {
  isBusy: boolean;
  totals: Array<[string, number | string]>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {totals.map(([label, value]) => (
        <div className="rounded-lg border border-brand-border bg-white px-4 py-3" key={label}>
          <div className="font-semibold text-brand-muted text-xs uppercase tracking-[0.08em]">
            {label}
          </div>
          <div className="mt-1 font-semibold text-2xl text-citius-blue">
            {isBusy && value === "-" ? "…" : value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImportIssueList({
  title,
  rows,
}: {
  rows: SpreadsheetImportIssueRow[];
  title: string;
}) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="font-semibold text-amber-900 text-sm">{title}</div>
      <div className="mt-2 space-y-1 text-amber-800 text-sm">
        {rows.map((row) => (
          <div key={String(row.id ?? `${row.sourceSheet}-${row.sourceRowNumber}`)}>
            {row.sourceSheet} row {row.sourceRowNumber}: {row.message || row.reason}
          </div>
        ))}
      </div>
    </div>
  );
}
