"use client";

import { api } from "@convex/_generated/api";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import Image from "next/image";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { inputVariants } from "@/components/ui/application-field-variants";
import {
  type FeedbackDraft,
  type FeedbackEntry,
  PostTourFeedbackView,
} from "./PostTourFeedbackView";
import { TravelerFeedbackPanel } from "./TravelerFeedbackPanel";

export default function PostTourFeedbackWorkspace({
  initialJobCardId = "",
}: {
  initialJobCardId?: string;
}) {
  const selectId = useId();
  const [selectedJob, setSelectedJob] = useState(initialJobCardId);
  const [view, setView] = useState<"travellers" | "managers">("travellers");
  const jobs = usePaginatedQuery(api.crm.postTourFeedback.listJobs, {}, { initialNumItems: 30 });
  const jobCardId = selectedJob || undefined;
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
  const chooseJob = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setSelectedJob(event.target.value);
  const moreJobs = () => jobs.loadMore(30);
  const moreFeedback = () => feedback.loadMore(20);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="grid overflow-hidden rounded-[28px] border border-[#0B1026]/10 bg-[#FDFBF7] sm:grid-cols-[1fr_32%]">
        <div className="flex flex-col justify-center px-6 py-7 sm:px-8 sm:py-9">
          <h1 className="font-heading font-semibold text-3xl text-[#0B1026] leading-tight sm:text-4xl">
            Post-tour feedback
          </h1>
          <p className="mt-3 max-w-lg font-sans text-brand-muted text-sm leading-relaxed">
            Collect traveller comments and photos after each tour. Share a feedback link and keep
            every response with its Job Card.
          </p>
        </div>
        <div className="relative h-28 sm:h-auto sm:min-h-48">
          <Image
            alt="Blue domes overlooking the sea in Santorini"
            className="object-cover"
            fill
            priority
            sizes="(max-width: 640px) 100vw, 350px"
            src="/gallery/account/amalfi-santorini/santorini.webp"
          />
        </div>
      </header>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-brand-border bg-white p-4 sm:p-5">
        <label className="block min-w-0 flex-1 space-y-1" htmlFor={selectId}>
          <span className="font-sans font-semibold text-brand-dark text-sm">
            Job Card / JC number
          </span>
          <select
            className={`${inputVariants({ surface: "staff" })} bg-white`}
            id={selectId}
            onChange={chooseJob}
            value={selectedJob}
          >
            <option value="">All Job Cards</option>
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
        {jobs.status === "CanLoadMore" || jobs.status === "LoadingMore" ? (
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
      <fieldset aria-label="Feedback view" className="flex flex-wrap gap-3">
        <Button
          aria-pressed={view === "travellers"}
          onClick={() => setView("travellers")}
          type="button"
          variant={view === "travellers" ? "primary" : "outline"}
        >
          Traveller feedback
        </Button>
        <Button
          aria-pressed={view === "managers"}
          onClick={() => setView("managers")}
          type="button"
          variant={view === "managers" ? "primary" : "outline"}
        >
          Tour manager reports
        </Button>
      </fieldset>
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
      {view === "managers" &&
      (feedback.status === "CanLoadMore" || feedback.status === "LoadingMore") ? (
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
