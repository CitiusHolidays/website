"use client";

import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { type RefObject, useId, useState } from "react";
import { usePortalConfirm } from "@/components/portal/PortalConfirmDialog";
import { Button } from "@/components/ui/application-button";
import {
  AssessmentSection,
  ClosureSection,
  HitMissSection,
  PerformanceSection,
  SupplierSection,
  TourDetailsSection,
} from "./PostTourReportSections";
import {
  forgetPostTourReportDraft,
  type ReportView,
  type ReportWorkspace,
  type SaveReportDraft,
  type SubmitReport,
  usePostTourReportDraft,
} from "./usePostTourReportDraft";

function ReportFormNotices({
  error,
  errorRef,
  id,
  message,
}: {
  error: string;
  errorRef: RefObject<HTMLParagraphElement | null>;
  id: string;
  message: string;
}) {
  return (
    <>
      {error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm"
          id={`${id}-error`}
          ref={errorRef}
          role="alert"
          tabIndex={-1}
        >
          {error} Your unsaved draft is retained in this browser tab.
        </p>
      ) : null}
      {message ? (
        <p className="text-brand-dark text-sm" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}

function ReportFormActions({
  onSaveDraft,
  pending,
}: {
  onSaveDraft: () => void;
  pending: boolean;
}) {
  return (
    <div className="sticky bottom-0 flex flex-wrap gap-3 border-brand-border border-t bg-white py-4">
      <Button
        disabled={pending}
        onClick={onSaveDraft}
        surface="staff"
        type="button"
        variant="outline"
      >
        {pending ? "Saving..." : "Save draft"}
      </Button>
      <Button disabled={pending} surface="staff" type="submit">
        Submit report
      </Button>
      <p className="w-full text-brand-muted text-xs">
        Submit shares the report with CRM staff and alerts only the selected Directors, Finance Head
        and related Sales/Contracting people. Drafts send no alert.
      </p>
    </div>
  );
}

export function PostTourReportForm({
  workspace,
  report,
  viewerKey,
  readOnly = false,
  onSaveDraft,
  onSubmitReport,
}: {
  workspace: ReportWorkspace;
  report: ReportView | null;
  viewerKey: string;
  readOnly?: boolean;
  onSaveDraft: SaveReportDraft;
  onSubmitReport: SubmitReport;
}) {
  const { change, draft, error, errorRef, formRef, message, pending, reportId, save } =
    usePostTourReportDraft({ onSaveDraft, onSubmitReport, readOnly, report, viewerKey, workspace });
  const id = useId();
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save(true);
  };
  const saveDraft = () => save(false);
  // Read-only fields render the stored snapshot. Drafts never adopt a later JC edit silently.
  const content = readOnly ? (report?.content ?? draft) : draft;
  const section = { change, content, draft };
  return (
    <form
      aria-label="Internal post-tour report"
      className="space-y-6"
      data-report-id={reportId ?? "new"}
      onSubmit={submitForm}
      ref={formRef}
    >
      <fieldset className="min-w-0 space-y-6 disabled:opacity-100" disabled={pending || readOnly}>
        <TourDetailsSection {...section} idPrefix={id} />
        <PerformanceSection {...section} />
        <HitMissSection {...section} />
        <SupplierSection {...section} />
        <ClosureSection {...section} />
        <AssessmentSection {...section} report={report} viewerName={workspace.viewerName} />
      </fieldset>
      <ReportFormNotices error={error} errorRef={errorRef} id={id} message={message} />
      {readOnly ? null : <ReportFormActions onSaveDraft={saveDraft} pending={pending} />}
    </form>
  );
}

export function StructuredPostTourReport({
  workspace,
}: {
  workspace: ReportWorkspace | null | undefined;
}) {
  const archive = useMutation(api.crm.postTourReports.archive);
  const saveDraft = useMutation(api.crm.postTourReports.saveDraft);
  const submitReport = useMutation(api.crm.postTourReports.submit);
  const { confirm } = usePortalConfirm();
  const [epoch, setEpoch] = useState(0);
  const [error, setError] = useState("");
  const archiveReport = async (item: ReportView, restore = false) => {
    setError("");
    try {
      await confirm({
        confirmLabel: restore ? "Restore report" : "Archive report",
        danger: !restore,
        message: restore
          ? "Restore this report to its previous state. This sends no new submission alert."
          : "Hide this report from normal views and stop queued submission alerts. Admin can restore it; nothing is permanently deleted.",
        onConfirm: async () => {
          await archive({ expectedRevision: item.revision, reportId: item.id, restore });
          if (workspace) {
            forgetPostTourReportDraft(workspace.viewerKey, workspace.jobCardId);
          }
          setEpoch((value) => value + 1);
        },
        title: restore ? "Restore internal report?" : "Archive internal report?",
      });
    } catch {
      setError("The report could not be archived or restored. It has not been removed.");
    }
  };
  if (workspace === undefined) {
    return <p role="status">Loading the internal report...</p>;
  }
  if (workspace === null) {
    return (
      <p role="status">Select an available Job Card to read or prepare its internal report.</p>
    );
  }
  const { report } = workspace;
  return (
    <section aria-label="Post-Tour Feedback & Learning Form" className="space-y-5">
      <header className="space-y-2">
        <p className="text-brand-muted text-xs uppercase tracking-wide">
          Citius Holidays · Internal use only
        </p>
        <h2 className="font-heading font-semibold text-2xl text-brand-dark">
          Post-Tour Feedback & Learning Form
        </h2>
        <p className="text-brand-muted text-sm">
          {workspace.jobCode} · Operations, Tour Managers and Management · About 5–7 minutes on a
          phone
        </p>
        <p className="text-brand-muted text-sm">
          {report?.status === "submitted"
            ? "Submitted report. All CRM staff can read this snapshot."
            : "Save a private draft or submit the completed report. This is separate from traveller feedback."}
        </p>
      </header>
      {report?.canArchive ? (
        <Button
          onClick={() => archiveReport(report)}
          surface="staff"
          type="button"
          variant="outline"
        >
          Archive report
        </Button>
      ) : null}
      {report || workspace.canPrepare ? (
        <PostTourReportForm
          key={`${workspace.viewerKey}:${workspace.jobCardId}:${report?.status === "submitted" ? "submitted" : "editing"}:${epoch}`}
          onSaveDraft={saveDraft}
          onSubmitReport={submitReport}
          readOnly={!workspace.canPrepare || report?.status === "submitted"}
          report={report}
          viewerKey={workspace.viewerKey}
          workspace={workspace}
        />
      ) : (
        <p className="text-brand-muted text-sm">
          No submitted report yet. Only the assigned Tour Manager, assigned Operations owner or
          Operations Head can prepare it.
        </p>
      )}
      {error ? <p role="alert">{error}</p> : null}
      {workspace.archived.length ? (
        <details className="border-brand-border border-t pt-4">
          <summary className="cursor-pointer text-sm">Archived reports, Admin only</summary>
          <ul className="mt-3 space-y-3">
            {workspace.archived.map((item) => (
              <li className="space-y-3" key={item.id}>
                <span className="text-sm">
                  {item.preparedBy} · {item.content.tour.client}
                </span>
                <details>
                  <summary className="cursor-pointer text-sm">Read archived report</summary>
                  <PostTourReportForm
                    key={item.id}
                    onSaveDraft={saveDraft}
                    onSubmitReport={submitReport}
                    readOnly
                    report={item}
                    viewerKey={workspace.viewerKey}
                    workspace={workspace}
                  />
                </details>
                <Button
                  onClick={() => archiveReport(item, true)}
                  surface="staff"
                  type="button"
                  variant="outline"
                >
                  Restore report
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
