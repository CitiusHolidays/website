"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { inputVariants } from "@/components/ui/application-field-variants";
import {
  type FeedbackDraft,
  type FeedbackEntry,
  PostTourFeedbackView,
} from "./PostTourFeedbackView";
import { StructuredPostTourReport } from "./StructuredPostTourReport";
import { TravelerFeedbackPanel } from "./TravelerFeedbackPanel";

type FeedbackView = "travellers" | "managers" | "report";
function feedbackView(value: string): FeedbackView {
  if (value === "travellers" || value === "managers") {
    return value;
  }
  return "report";
}
function reportQueryArgs(jobCardId: string, reportId: string) {
  if (jobCardId) {
    return { jobCardId };
  }
  if (reportId) {
    return { reportId };
  }
  return "skip" as const;
}
function FeedbackTabs({
  view,
  onChange,
}: {
  view: FeedbackView;
  onChange: (view: FeedbackView) => void;
}) {
  const tabs: Array<{ value: FeedbackView; label: string }> = [
    { label: "Internal tour report", value: "report" },
    { label: "Traveller feedback", value: "travellers" },
    { label: "Earlier team notes", value: "managers" },
  ];
  return (
    <fieldset aria-label="Feedback view" className="flex flex-wrap gap-3">
      {tabs.map((tab) => (
        <Button
          aria-pressed={view === tab.value}
          key={tab.value}
          onClick={() => onChange(tab.value)}
          type="button"
          variant={view === tab.value ? "primary" : "outline"}
        >
          {tab.label}
        </Button>
      ))}
    </fieldset>
  );
}
function canLoadMore(status: string) {
  return status === "CanLoadMore" || status === "LoadingMore";
}

export default function PostTourFeedbackWorkspace({
  initialJobCardId = "",
  initialReportId = "",
  initialView = "report",
}: {
  initialJobCardId?: string;
  initialReportId?: string;
  initialView?: string;
}) {
  const selectId = useId();
  const [selectedJob, setSelectedJob] = useState(initialJobCardId);
  const [reportFromLink, setReportFromLink] = useState(initialReportId);
  const [view, setView] = useState<FeedbackView>(() => feedbackView(initialView));
  const jobs = usePaginatedQuery(api.crm.postTourFeedback.listJobs, {}, { initialNumItems: 30 });
  const structured = useQuery(
    api.crm.postTourReports.workspace,
    reportQueryArgs(selectedJob, reportFromLink)
  );
  const jobCardId = selectedJob || structured?.jobCardId || undefined;
  const job = useQuery(api.crm.postTourFeedback.getJobContext, jobCardId ? { jobCardId } : "skip");
  const feedback = usePaginatedQuery(
    api.crm.postTourFeedback.list,
    jobCardId ? { jobCardId } : {},
    { initialNumItems: 20 }
  );
  const create = useMutation(api.crm.postTourFeedback.create);
  const update = useMutation(api.crm.postTourFeedback.update);
  const remove = useMutation(api.crm.postTourFeedback.remove);
  const removePhoto = useMutation(api.crm.postTourFeedback.removePhoto);
  const save = async (draft: FeedbackDraft) => {
    if (!job?.canCompose) {
      throw new Error("Select an assigned Job Card");
    }
    await create({ ...draft, jobCardId: job.jobCardId });
  };
  const updateEntry = async (entry: FeedbackEntry, draft: FeedbackDraft) => {
    await update({ ...draft, feedbackId: entry.id });
  };
  const deleteEntry = async (entry: FeedbackEntry) => {
    await remove({ feedbackId: entry.id });
  };
  const deletePhoto = async (photoId: FeedbackEntry["photos"][number]["id"]) => {
    await removePhoto({ photoId });
  };
  const upload = async (entry: FeedbackEntry, file: File) => {
    const params = new URLSearchParams({ feedbackId: entry.id, fileName: file.name });
    const result = await fetch(`/api/portal/post-tour/photos?${params}`, {
      body: file,
      headers: { "Content-Type": file.type },
      method: "POST",
    });
    if (!result.ok) {
      throw new Error("Photo upload failed");
    }
  };
  const chooseJob = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setReportFromLink("");
    setSelectedJob(event.target.value);
  };
  const moreJobs = () => jobs.loadMore(30);
  const moreFeedback = () => feedback.loadMore(20);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="border-brand-border border-b pb-5">
        <h1 className="portal-page-title font-heading font-semibold text-brand-dark">
          Post-tour feedback
        </h1>
        <p className="mt-2 max-w-2xl font-sans text-brand-muted text-sm leading-relaxed">
          Prepare the internal post-tour report against a Job Card, read earlier team notes, or
          manage the separate traveller feedback requests.
        </p>
      </header>
      <div className="flex flex-wrap items-end gap-3 border-brand-border border-b pb-4">
        <label className="block min-w-0 flex-1 space-y-1" htmlFor={selectId}>
          <span className="font-sans font-semibold text-brand-dark text-sm">
            Job Card / JC number
          </span>
          <select
            className={`${inputVariants({ surface: "staff" })} bg-white`}
            id={selectId}
            onChange={chooseJob}
            value={jobCardId ?? ""}
          >
            <option value="">{view === "report" ? "Choose a Job Card..." : "All Job Cards"}</option>
            {job && !jobs.results.some((item) => item.jobCardId === job.jobCardId) ? (
              <option value={job.jobCardId}>
                {job.jobCode} · {job.clientName}
              </option>
            ) : null}
            {jobs.results.map((item) => (
              <option key={item.jobCardId} value={item.jobCardId}>
                {item.jobCode} · {item.clientName}
                {item.canCompose ? " · Assigned to you" : ""}
              </option>
            ))}
          </select>
        </label>
        {canLoadMore(jobs.status) ? (
          <Button
            disabled={jobs.status === "LoadingMore"}
            onClick={moreJobs}
            surface="staff"
            type="button"
            variant="outline"
          >
            Load more Job Cards
          </Button>
        ) : null}
      </div>
      {jobCardId && job === null ? (
        <p className="text-brand-muted text-sm" role="status">
          This Job Card is no longer available. Choose another Job Card.
        </p>
      ) : null}
      <FeedbackTabs onChange={setView} view={view} />
      {view === "report" ? (
        <StructuredPostTourReport workspace={jobCardId ? structured : null} />
      ) : null}
      {view === "travellers" ? (
        <TravelerFeedbackPanel job={job ?? null} jobCardId={job?.jobCardId} />
      ) : null}
      {view === "managers" ? (
        <PostTourFeedbackView
          entries={feedback.results}
          job={job ?? null}
          loading={feedback.status === "LoadingFirstPage"}
          onDelete={deleteEntry}
          onRemovePhoto={deletePhoto}
          onSave={save}
          onUpdate={updateEntry}
          onUpload={upload}
        />
      ) : null}
      {view === "managers" && canLoadMore(feedback.status) ? (
        <Button
          disabled={feedback.status === "LoadingMore"}
          onClick={moreFeedback}
          surface="staff"
          type="button"
          variant="outline"
        >
          Load more feedback
        </Button>
      ) : null}
    </div>
  );
}
