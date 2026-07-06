"use client";

import { api } from "@convex/_generated/api";
import { useConvex, useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useReducer } from "react";
import { usePortalToast } from "@/components/portal/PortalToast";
import { parseStaffWorkbookFile } from "@/lib/portal/staffWorkbookImport";

const ACCEPTABLE_ACTIONS = new Set(["created", "updated"]);
const EMPTY_ROWS = [];

const AFTER_FIELD_LABELS = [
  ["roles", "Roles"],
  ["department", "Department"],
  ["function", "Function / job role"],
  ["mobile", "Mobile"],
  ["location", "Location"],
  ["leaveLevel1ApproverName", "Level 1 approver"],
  ["leaveEscalationApproverName", "Escalation approver"],
  ["leaveFinalAuthorityName", "Final authority"],
  ["leaveHrCopyName", "HR copy"],
];

function defaultAcceptedEmails(previewRows) {
  const emails = new Set();
  for (const row of previewRows) {
    if (ACCEPTABLE_ACTIONS.has(row.action) && row.emailNormalized) {
      emails.add(row.emailNormalized);
    }
  }
  return emails;
}

function formatFieldValue(value) {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "-";
  const text = String(value ?? "").trim();
  return text || "-";
}

function actionTone(action) {
  if (action === "created") return "green";
  if (action === "updated") return "blue";
  if (action === "unchanged") return "gray";
  return "orange";
}

function ActionBadge({ action }) {
  const tone = actionTone(action);
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : tone === "blue"
        ? "bg-sky-50 text-sky-800 border-sky-200"
        : tone === "orange"
          ? "bg-amber-50 text-amber-900 border-amber-200"
          : "bg-stone-100 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {action}
    </span>
  );
}

function SummaryTiles({ isBusy, totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {totals.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-brand-border bg-white px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-muted">
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold text-citius-blue">
            {isBusy && value === "-" ? "…" : value}
          </div>
        </div>
      ))}
    </div>
  );
}

function IssueList({ title, rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-900">{title}</div>
      <div className="mt-2 space-y-1 text-sm text-amber-800">
        {rows.map((row) => (
          <div
            key={row.id || `${row.sourceSheet}:${row.sourceRowNumber}:${row.reason || row.message}`}
          >
            {row.sourceSheet} row {row.sourceRowNumber}: {row.message || row.reason}
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewRowCard({ row, accepted, onToggle }) {
  const after = row.after || {};
  const changedFields = new Set((row.changes || []).map((change) => change.field));
  const canAccept = ACCEPTABLE_ACTIONS.has(row.action);

  return (
    <div className="rounded-lg border border-brand-border bg-brand-light/30 p-3 text-sm">
      <div className="flex flex-wrap items-start gap-3">
        <label className="mt-1 flex items-center gap-2">
          <input
            type="checkbox"
            checked={canAccept && accepted}
            disabled={!canAccept}
            onChange={(event) => onToggle(row.emailNormalized, event.target.checked)}
          />
          <span className="sr-only">Accept row</span>
        </label>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={row.action} />
            <span className="font-semibold text-citius-blue">{row.name || row.email}</span>
            <span className="text-brand-muted">{row.email}</span>
            {row.sourceSheet ? (
              <span className="text-xs text-brand-muted">
                {row.sourceSheet} row {row.sourceRowNumber}
              </span>
            ) : null}
          </div>
          {row.message ? <div className="text-amber-800">{row.message}</div> : null}
          {(row.changes || []).length > 0 && (
            <div className="rounded-md border border-sky-200 bg-sky-50/80 px-3 py-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-sky-900">
                Changed fields
              </div>
              <ul className="mt-1 space-y-1 text-sky-950">
                {row.changes.map((change) => (
                  <li key={change.field}>
                    <span className="font-medium">
                      {AFTER_FIELD_LABELS.find(([key]) => key === change.field)?.[1] ||
                        change.field}
                      :
                    </span>{" "}
                    {formatFieldValue(change.before)} → {formatFieldValue(change.after)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AFTER_FIELD_LABELS.map(([field, label]) => (
              <div
                key={field}
                className={`rounded-md border px-2.5 py-1.5 ${
                  changedFields.has(field)
                    ? "border-sky-200 bg-white"
                    : "border-brand-border/70 bg-white/70"
                }`}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
                  {label}
                </div>
                <div className="mt-0.5 text-brand-dark">{formatFieldValue(after[field])}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const INITIAL_STATE = {
  fileName: "",
  parsed: null,
  preview: null,
  acceptedEmails: new Set(),
  applyResult: null,
  isParsing: false,
  isPreviewing: false,
  isApplying: false,
  error: "",
};

function reducer(state, action) {
  switch (action.type) {
    case "fileSelected":
      return {
        ...INITIAL_STATE,
        fileName: action.fileName,
        isParsing: true,
      };
    case "parseSuccess":
      return {
        ...state,
        parsed: action.parsed,
        isParsing: false,
      };
    case "parseFailure":
      return {
        ...state,
        error: action.error,
        isParsing: false,
      };
    case "previewStart":
      return {
        ...state,
        applyResult: action.clearApplyResult ? null : state.applyResult,
        error: "",
        isPreviewing: true,
      };
    case "previewSuccess":
      return {
        ...state,
        preview: action.preview,
        acceptedEmails: defaultAcceptedEmails(action.preview.rows),
        isPreviewing: false,
      };
    case "previewFailure":
      return {
        ...state,
        preview: null,
        acceptedEmails: new Set(),
        error: action.error,
        isPreviewing: false,
      };
    case "toggleAccepted": {
      const acceptedEmails = new Set(state.acceptedEmails);
      if (action.checked) acceptedEmails.add(action.emailNormalized);
      else acceptedEmails.delete(action.emailNormalized);
      return { ...state, acceptedEmails };
    }
    case "setAcceptedEmails":
      return {
        ...state,
        acceptedEmails: action.acceptedEmails,
      };
    case "applyStart":
      return {
        ...state,
        error: "",
        isApplying: true,
      };
    case "applySuccess":
      return {
        ...state,
        applyResult: action.applyResult,
        isApplying: false,
      };
    case "applyFailure":
      return {
        ...state,
        error: action.error,
        isApplying: false,
      };
    case "setError":
      return {
        ...state,
        error: action.error,
      };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

export function StaffWorkbookImportPanel() {
  const toast = usePortalToast();
  const convex = useConvex();
  const applyStaffWorkbookUpdates = useMutation(
    api.crm.staffWorkbookUpdates.applyStaffWorkbookUpdates,
  );

  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const {
    fileName,
    parsed,
    preview,
    acceptedEmails,
    applyResult,
    isParsing,
    isPreviewing,
    isApplying,
    error,
  } = state;

  const parsedRows = parsed?.rows || EMPTY_ROWS;
  const parserSkipped = parsed?.skipped || EMPTY_ROWS;
  const previewRows = preview?.rows || EMPTY_ROWS;
  const previewSummary = preview?.summary;

  const applicableRows = previewRows.filter((row) => ACCEPTABLE_ACTIONS.has(row.action));

  const allApplicableAccepted =
    applicableRows.length > 0 &&
    applicableRows.every((row) => acceptedEmails.has(row.emailNormalized));

  async function runPreview(rows, options = {}) {
    dispatch({ type: "previewStart", clearApplyResult: options.clearApplyResult !== false });
    try {
      const result = await convex.query(api.crm.staffWorkbookUpdates.previewStaffWorkbookUpdates, {
        rows,
      });
      dispatch({ type: "previewSuccess", preview: result });
    } catch (err) {
      dispatch({
        type: "previewFailure",
        error: err?.data || err?.message || "Unable to preview staff workbook updates.",
      });
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    dispatch({ type: "fileSelected", fileName: file.name });
    try {
      const result = await parseStaffWorkbookFile(file);
      dispatch({ type: "parseSuccess", parsed: result });
      if (result.rows.length > 0) {
        await runPreview(result.rows);
      }
    } catch (err) {
      dispatch({
        type: "parseFailure",
        error: err?.message || "Unable to read leave matrix workbook.",
      });
    }
    event.target.value = "";
  };

  const toggleAccepted = (emailNormalized, checked) => {
    if (!emailNormalized) return;
    dispatch({ type: "toggleAccepted", emailNormalized, checked });
  };

  const toggleAllApplicable = (checked) => {
    dispatch({
      type: "setAcceptedEmails",
      acceptedEmails: checked ? defaultAcceptedEmails(applicableRows) : new Set(),
    });
  };

  const handleApply = async () => {
    if (!parsedRows.length) return;
    const accepted = Array.from(acceptedEmails);
    if (accepted.length === 0) {
      dispatch({ type: "setError", error: "Select at least one created or updated row to apply." });
      return;
    }

    dispatch({ type: "applyStart" });
    try {
      const result = await applyStaffWorkbookUpdates({
        rows: parsedRows,
        acceptedEmailNormalized: accepted,
      });
      dispatch({ type: "applySuccess", applyResult: result });
      const { created = 0, updated = 0, unchanged = 0, skipped = 0 } = result.summary || {};
      toast.success(
        `Staff workbook applied: ${created} created, ${updated} updated, ${unchanged} unchanged, ${skipped} skipped.`,
      );
      await runPreview(parsedRows, { clearApplyResult: false });
    } catch (err) {
      dispatch({
        type: "applyFailure",
        error: err?.data || err?.message || "Failed to apply staff workbook updates.",
      });
    }
  };

  const handleReset = () => {
    dispatch({ type: "reset" });
  };

  const busy = isParsing || isPreviewing || isApplying;
  const acceptedCount = applicableRows.filter((row) =>
    acceptedEmails.has(row.emailNormalized),
  ).length;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-citius-blue md:text-xl">
          Leave matrix workbook
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Upload the staff leave matrix workbook to review new or changed staff records and approver
          routing before applying.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block rounded-lg border border-dashed border-brand-border bg-brand-light/40 p-4">
          <span className="text-sm font-semibold text-citius-blue">Leave matrix spreadsheet</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            disabled={busy}
            className="mt-2 block w-full text-sm text-brand-dark file:mr-3 file:rounded-md file:border-0 file:bg-citius-blue file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
          />
          {fileName ? (
            <span className="mt-2 block text-xs text-brand-muted">{fileName}</span>
          ) : null}
        </label>

        <SummaryTiles
          isBusy={isParsing || isPreviewing}
          totals={[
            ["Parsed", parsed ? parsedRows.length : "-"],
            ["Parser skipped", parsed ? parserSkipped.length : "-"],
            ["Create", previewSummary ? previewSummary.created : "-"],
            ["Update", previewSummary ? previewSummary.updated : "-"],
            ["Unchanged", previewSummary ? previewSummary.unchanged : "-"],
          ]}
        />

        {previewSummary ? (
          <div className="text-sm text-brand-muted">
            Preview skipped {previewSummary.skipped} row
            {previewSummary.skipped === 1 ? "" : "s"}.
            {acceptedCount > 0
              ? ` ${acceptedCount} row${acceptedCount === 1 ? "" : "s"} selected to apply.`
              : " No rows selected to apply."}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {applyResult?.summary ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Last apply: {applyResult.summary.created} created, {applyResult.summary.updated}{" "}
            updated, {applyResult.summary.unchanged} unchanged, {applyResult.summary.skipped}{" "}
            skipped.
          </div>
        ) : null}

        {parserSkipped.length > 0 ? (
          <IssueList title="Parser skipped rows" rows={parserSkipped.slice(0, 12)} />
        ) : null}

        {previewRows.some((row) => row.action === "skipped") ? (
          <IssueList
            title="Preview skipped rows"
            rows={previewRows
              .filter((row) => row.action === "skipped")
              .slice(0, 12)
              .map((row) => ({
                sourceSheet: row.sourceSheet,
                sourceRowNumber: row.sourceRowNumber,
                message: row.message || "Skipped",
              }))}
          />
        ) : null}

        {previewRows.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-citius-blue">Review changes</div>
              {applicableRows.length > 0 ? (
                <label className="flex items-center gap-2 text-sm text-brand-dark">
                  <input
                    type="checkbox"
                    checked={allApplicableAccepted}
                    onChange={(event) => toggleAllApplicable(event.target.checked)}
                    disabled={busy}
                  />
                  Accept all created/updated rows ({applicableRows.length})
                </label>
              ) : null}
            </div>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {previewRows.map((row) => (
                <PreviewRowCard
                  key={row.emailNormalized || `${row.sourceSheet}:${row.sourceRowNumber}`}
                  row={row}
                  accepted={acceptedEmails.has(row.emailNormalized)}
                  onToggle={toggleAccepted}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {(parsed || preview || fileName) && (
            <button
              type="button"
              className="portal-small-btn bg-brand-light border-brand-border text-brand-dark hover:bg-brand-light/70"
              onClick={handleReset}
              disabled={busy}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            className="portal-small-btn bg-citius-blue text-white hover:bg-citius-blue/90 disabled:opacity-60"
            onClick={handleApply}
            disabled={busy || !parsedRows.length || acceptedCount === 0}
          >
            {isApplying ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Applying…
              </span>
            ) : (
              `Apply ${acceptedCount} accepted row${acceptedCount === 1 ? "" : "s"}`
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
