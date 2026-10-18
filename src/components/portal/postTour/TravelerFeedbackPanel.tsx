"use client";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  TRAVELER_FEEDBACK_CATEGORIES,
  type travelerFeedbackResponseValidator,
} from "@convex/lib/travelerFeedbackValidators";
import { useAction, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Infer } from "convex/values";
import { useId, useState } from "react";
import { Button } from "@/components/ui/application-button";
import { Input } from "@/components/ui/application-field";
import { inputVariants } from "@/components/ui/application-field-variants";
import { formatDisplayDate } from "@/lib/formatDate";
import { MoreRows } from "../travel/TravelWorkspaceUi";
import { useActiveOperationReferenceNow } from "../workspace/usePortalReferenceClock";
import { type FeedbackJob, FeedbackPhotoPreview } from "./PostTourFeedbackView";

type ResponseEntry = Infer<typeof travelerFeedbackResponseValidator>;
type FeedbackRequest = FunctionReturnType<
  typeof api.crm.travelerFeedback.listRequests
>["page"][number];

function RequestRow({ request, referenceNow }: { request: FeedbackRequest; referenceNow: number }) {
  const revoke = useMutation(api.crm.travelerFeedback.revokeRequest);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ask = () => setConfirm(true);
  const keep = () => setConfirm(false);
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await revoke({ requestId: request.id });
      setConfirm(false);
    } catch (failure) {
      setError(travelError(failure, "The link could not be revoked. Try again."));
    }
    setBusy(false);
  };
  const active = !request.revokedAt && request.expiresAt > referenceNow;
  let state = "Expired";
  if (request.revokedAt) {
    state = "Revoked";
  } else if (active) {
    state = `Open until ${formatDisplayDate(new Date(request.expiresAt).toISOString().slice(0, 10))}`;
  }
  return (
    <li className="border-brand-border border-t py-4">
      <p className="break-words font-medium text-sm">{request.publicTripLabel}</p>
      <p className="mt-1 text-brand-muted text-xs">
        {state} · {request.responseCount} responses
      </p>
      {active ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {confirm ? (
            <>
              <span className="text-sm">Close this link to new responses?</span>
              <Button disabled={busy} onClick={remove} type="button" variant="danger">
                Revoke link
              </Button>
              <Button disabled={busy} onClick={keep} type="button" variant="outline">
                Keep open
              </Button>
            </>
          ) : (
            <Button className="min-h-11" onClick={ask} type="button" variant="bare">
              Revoke link
            </Button>
          )}
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function RequestComposer({ job }: { job: FeedbackJob }) {
  const id = useId();
  const referenceNow = useActiveOperationReferenceNow(true);
  const create = useAction(api.crm.travelerFeedbackActions.createRequest);
  const requests = usePaginatedQuery(
    api.crm.travelerFeedback.listRequests,
    { jobCardId: job.jobCardId },
    { initialNumItems: 30 }
  );
  const [label, setLabel] = useState(job.destination || "Your Citius tour");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const changeLabel = (event: React.ChangeEvent<HTMLInputElement>) => setLabel(event.target.value);
  const changeDays = (event: React.ChangeEvent<HTMLSelectElement>) =>
    setDays(Number(event.target.value));
  const make = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await create({
        expiresInDays: days,
        jobCardId: job.jobCardId,
        publicTripLabel: label,
      });
      setLink(`${window.location.origin}/tour-feedback#${result.token}`);
      setStatus("Link created. Copy it to share with your travellers.");
    } catch (failure) {
      setError(travelError(failure, "The feedback link could not be created. Try again."));
    }
    setBusy(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied.");
    } catch {
      setStatus("Select the link and copy it to share.");
    }
  };
  return (
    <details className={travelFormCard} open>
      <summary className="min-h-11 cursor-pointer font-heading font-semibold text-lg focus-visible:outline-2 focus-visible:outline-citius-blue">
        Ask travellers for feedback
      </summary>
      <p className="mt-2 text-brand-muted text-sm leading-relaxed">
        Create a link for this tour. Anyone with it can submit feedback until it expires or you
        revoke it.
      </p>
      <form className="mt-5 space-y-4" onSubmit={make}>
        <label className="block space-y-1" htmlFor={`${id}-label`}>
          <span className="font-semibold text-sm">Trip name travellers will see</span>
          <Input
            className="bg-white"
            disabled={busy}
            id={`${id}-label`}
            maxLength={120}
            onChange={changeLabel}
            required
            value={label}
          />
        </label>
        <label className="block space-y-1" htmlFor={`${id}-expiry`}>
          <span className="font-semibold text-sm">Link stays open for</span>
          <select
            className={`${inputVariants({ surface: "staff" })} bg-white`}
            disabled={busy}
            id={`${id}-expiry`}
            onChange={changeDays}
            value={days}
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <Button disabled={busy} loading={busy} type="submit" variant="primary">
          Create feedback link
        </Button>
      </form>
      {link ? (
        <div className="mt-5 space-y-3 rounded-2xl border border-brand-border bg-white p-4">
          <label className="block space-y-1" htmlFor={`${id}-link`}>
            <span className="font-semibold text-sm">Traveller feedback link</span>
            <Input id={`${id}-link`} readOnly value={link} />
          </label>
          <Button onClick={copy} type="button" variant="outline">
            Copy link
          </Button>
          <p className="text-brand-muted text-xs">
            Copy this link before leaving the page. You can revoke it below.
          </p>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-3 text-brand-muted text-sm empty:hidden" role="status">
        {status}
      </p>
      {error ? (
        <p className="mt-3 text-red-700 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <details className="mt-5">
        <summary className="min-h-11 cursor-pointer font-semibold text-sm focus-visible:outline-2 focus-visible:outline-citius-blue">
          Feedback links
        </summary>
        <ul>
          {requests.results.map((request) => (
            <RequestRow key={request.id} referenceNow={referenceNow} request={request} />
          ))}
        </ul>
        {requests.status !== "LoadingFirstPage" && !requests.results.length ? (
          <p className="text-brand-muted text-sm">No feedback links created yet.</p>
        ) : null}
        <MoreRows loadMore={requests.loadMore} status={requests.status} />
      </details>
    </details>
  );
}

function TravelerResponseCard({ entry }: { entry: ResponseEntry }) {
  return (
    <article className={`${travelCard} space-y-5`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="break-words font-heading font-semibold text-lg">
            {entry.respondentName || "Traveller"}
          </h3>
          <p className="mt-1 break-words text-brand-muted text-xs">
            {entry.job.jobCode} · {entry.job.clientName} · {entry.job.destination}
          </p>
        </div>
        <time
          className="text-brand-muted text-xs"
          dateTime={new Date(entry.createdAt).toISOString()}
        >
          {formatDisplayDate(new Date(entry.createdAt).toISOString().slice(0, 10))}
        </time>
      </header>
      {TRAVELER_FEEDBACK_CATEGORIES.map((category) =>
        entry.comments[category.value] ? (
          <section key={category.value}>
            <h4 className="font-semibold text-brand-dark text-sm">{category.label}</h4>
            <p className="mt-2 whitespace-pre-wrap break-words text-brand-dark text-sm leading-relaxed">
              {entry.comments[category.value]}
            </p>
          </section>
        ) : null
      )}
      {entry.photos.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 [&>li:only-child]:sm:col-span-2">
          {entry.photos.map((photo) => (
            <li className="min-w-0" key={photo.id}>
              <FeedbackPhotoPreview
                basePath="/api/portal/files/traveler-feedback"
                category={
                  TRAVELER_FEEDBACK_CATEGORIES.find((category) => category.value === photo.category)
                    ?.label || "Tour photo"
                }
                photo={photo}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function TravelerFeedbackPanel({
  job,
  jobCardId,
}: {
  job: FeedbackJob | null;
  jobCardId?: Id<"jobCards">;
}) {
  const access = useQuery(
    api.crm.travelerFeedback.getRequestAccess,
    jobCardId ? { jobCardId } : "skip"
  );
  const responses = usePaginatedQuery(
    api.crm.travelerFeedback.listResponses,
    jobCardId ? { jobCardId } : {},
    { initialNumItems: 30 }
  );
  return (
    <div
      className={
        access?.canManage && job
          ? "grid items-start gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
          : ""
      }
    >
      {access?.canManage && job ? <RequestComposer job={job} key={job.jobCardId} /> : null}
      <section aria-label="Traveller responses" className="min-w-0 max-w-3xl space-y-4">
        <h2 className="font-heading font-semibold text-lg">
          {job ? "Traveller responses for this tour" : "Latest traveller responses"}
        </h2>
        {responses.status === "LoadingFirstPage" ? <p role="status">Loading responses...</p> : null}
        {responses.status !== "LoadingFirstPage" && !responses.results.length ? (
          <p className={`${travelCard} text-brand-muted text-sm`}>
            {job
              ? "No traveller responses for this tour yet."
              : "No traveller responses yet. Choose a Job Card to create a feedback link."}
          </p>
        ) : null}
        {responses.results.map((entry) => (
          <TravelerResponseCard entry={entry} key={entry.id} />
        ))}
        <MoreRows loadMore={responses.loadMore} status={responses.status} />
      </section>
    </div>
  );
}

import { travelCard, travelError, travelFormCard } from "../travel/travelPresentation";
