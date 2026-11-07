"use client";

import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { type PostTourReportContent, postTourReportError } from "@convex/lib/postTourReportContent";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";

export type ReportWorkspace = NonNullable<
  FunctionReturnType<typeof api.crm.postTourReports.workspace>
>;
export type ReportView = NonNullable<ReportWorkspace["report"]>;
export type SaveReportDraft = (
  args: FunctionArgs<typeof api.crm.postTourReports.saveDraft>
) => Promise<FunctionReturnType<typeof api.crm.postTourReports.saveDraft>>;
export type SubmitReport = (
  args: FunctionArgs<typeof api.crm.postTourReports.submit>
) => Promise<FunctionReturnType<typeof api.crm.postTourReports.submit>>;

// Unsaved drafts survive navigation within the tab, keyed by staff and Job Card.
const draftCache = new Map<string, { content: PostTourReportContent; revision: number }>();

export function forgetPostTourReportDraft(viewerKey: string, jobCardId: string) {
  draftCache.delete(`${viewerKey}:${jobCardId}`);
}

function saveFailureMessage<Cause>(cause: Cause) {
  return cause instanceof Error
    ? cause.message
    : "Report could not be saved. Your draft is still here.";
}

export function usePostTourReportDraft({
  onSaveDraft,
  onSubmitReport,
  readOnly,
  report,
  viewerKey,
  workspace,
}: {
  onSaveDraft: SaveReportDraft;
  onSubmitReport: SubmitReport;
  readOnly: boolean;
  report: ReportView | null;
  viewerKey: string;
  workspace: ReportWorkspace;
}) {
  const cacheKey = `${viewerKey}:${workspace.jobCardId}`;
  const [draft, setDraft] = useState(
    () => draftCache.get(cacheKey)?.content ?? report?.content ?? workspace.initial
  );
  // Read only when saving, so a newer revision never needs a redraw.
  const revision = useRef(draftCache.get(cacheKey)?.revision ?? report?.revision ?? 0);
  const [reportId, setReportId] = useState<Id<"postTourReports"> | null>(report?.id ?? null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);
  const change = (next: PostTourReportContent) => {
    setDraft(next);
    draftCache.set(cacheKey, { content: next, revision: revision.current });
    setMessage("");
  };
  const validationError = (submitting: boolean) => {
    if (formRef.current?.querySelector('[aria-invalid="true"]')) {
      return "Complete the tour dates in DD/MM/YYYY before saving.";
    }
    return postTourReportError(draft, submitting);
  };
  const save = async (submitting: boolean) => {
    if (busy.current || readOnly) {
      return;
    }
    const validation = validationError(submitting);
    if (validation) {
      setError(validation);
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const saved = await onSaveDraft({
        content: draft,
        expectedRevision: revision.current,
        jobCardId: workspace.jobCardId,
        reportId: reportId ?? undefined,
      });
      setReportId(saved.id);
      revision.current = saved.revision;
      draftCache.set(cacheKey, { content: draft, revision: saved.revision });
      if (submitting) {
        await onSubmitReport({ expectedRevision: saved.revision, reportId: saved.id });
        draftCache.delete(cacheKey);
        setMessage("Report submitted.");
      } else {
        draftCache.delete(cacheKey);
        setMessage("Draft saved. No submission alert has been sent.");
      }
    } catch (cause) {
      setError(saveFailureMessage(cause));
    }
    busy.current = false;
    setPending(false);
  };
  return { change, draft, error, errorRef, formRef, message, pending, reportId, save };
}
