"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { ChevronDown, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildJobCardCommandCenter } from "@/lib/portal/jobCardCommandCenter";
import JobCardReadinessMap from "./JobCardReadinessMap";
import JobCardTaskBoard from "./JobCardTaskBoard";

function formatFileSize(bytes) {
  if (!bytes) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTravelDates(startDate, endDate) {
  if (!startDate) {
    return "Dates pending";
  }
  const start = formatDisplayDate(startDate);
  if (!endDate || endDate === startDate) {
    return start;
  }
  return `${start} – ${formatDisplayDate(endDate)}`;
}

function formatQueryContext(query) {
  if (!query) {
    return "Not linked";
  }
  const contracting =
    query.contractingStatus && query.contractingStatus !== query.salesStatus
      ? ` · Contracting ${query.contractingStatus}`
      : "";
  return `${query.queryCode} · Sales ${query.salesStatus}${contracting}`;
}

function ContextField({ label, value }) {
  return (
    <div>
      <dt className="font-sans font-semibold text-[11px] text-brand-muted uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="mt-1 font-sans text-brand-dark text-sm">{value || "—"}</dd>
    </div>
  );
}

function JobCardTourContext({ job, query, proposal }) {
  const clientName = job.clientName || query?.clientName || proposal?.clientName || "—";
  const destination = job.destination || query?.destination || "Destination pending";
  const proposalId = proposal?.id ?? job.proposalId;
  const attachments = proposal?.attachments ?? [];
  const finalizedPdf = proposal?.finalizedPdf ?? null;
  const hasDocuments = Boolean(finalizedPdf) || attachments.length > 0;

  return (
    <section className="rounded-lg border border-brand-border bg-white p-4">
      <h2 className="font-heading text-base text-brand-dark">Tour context</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ContextField label="Job Card" value={job.jobCode} />
        <ContextField label="Client" value={clientName} />
        <ContextField label="Destination" value={destination} />
        <ContextField
          label="Travel dates"
          value={formatTravelDates(job.travelStartDate, job.travelEndDate)}
        />
        <ContextField
          label="Pax"
          value={
            job.confirmedPax == null
              ? "—"
              : `${job.confirmedPax}${job.roomCount ? ` · ${job.roomCount} rooms` : ""}`
          }
        />
        <ContextField label="Query" value={formatQueryContext(query)} />
        <ContextField
          label="Proposal"
          value={proposal ? `${proposal.proposalCode} · ${proposal.status}` : "Not linked"}
        />
      </dl>
      {proposal?.itinerarySummary ? (
        <div className="mt-4 border-brand-border border-t pt-3">
          <p className="font-sans font-semibold text-[11px] text-brand-muted uppercase tracking-[0.08em]">
            Itinerary summary
          </p>
          <p className="mt-1 whitespace-pre-wrap font-sans text-brand-dark text-sm">
            {proposal.itinerarySummary}
          </p>
        </div>
      ) : null}
      {hasDocuments ? (
        <div className="mt-4 border-brand-border border-t pt-3">
          <p className="font-sans font-semibold text-[11px] text-brand-muted uppercase tracking-[0.08em]">
            Documents
          </p>
          <ul className="mt-2 space-y-2">
            {finalizedPdf && proposalId ? (
              <li>
                <a
                  className="inline-flex max-w-full items-center gap-1.5 font-medium font-sans text-citius-blue text-sm hover:underline"
                  href={`/api/portal/files/proposal-finalized/${encodeURIComponent(proposalId)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <FileText className="shrink-0" size={14} />
                  <span className="truncate">{finalizedPdf.fileName}</span>
                  {finalizedPdf.uploadedAt ? (
                    <span className="shrink-0 font-normal text-brand-muted text-xs">
                      · {formatDisplayDate(finalizedPdf.uploadedAt)}
                    </span>
                  ) : null}
                </a>
                <span className="ml-5 block text-[11px] text-brand-muted">
                  Finalized client PDF
                </span>
              </li>
            ) : null}
            {attachments.map((file) => (
              <li key={file.id}>
                <a
                  className="inline-flex max-w-full items-center gap-1.5 font-medium font-sans text-citius-blue text-sm hover:underline"
                  href={`/api/portal/files/proposal/${encodeURIComponent(file.id)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Paperclip className="shrink-0" size={14} />
                  <span className="truncate">{file.fileName}</span>
                  <span className="shrink-0 font-normal text-brand-muted text-xs">
                    · {formatFileSize(file.fileSize)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function JobCardCommandCenter({ jobCardId }) {
  const payload = useQuery(api.crm.jobCards.getCommandCenter, { jobCardId });
  const [tasksOpen, setTasksOpen] = useState(false);
  if (payload === undefined) {
    return <div className="h-64 animate-pulse rounded-lg bg-brand-light" />;
  }
  const model = buildJobCardCommandCenter(payload);
  const job = payload.jobCard;
  const tasks = payload.checklistTasks ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-brand-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Link className="font-sans text-citius-blue text-xs" href="/portal/job-cards">
              Back to Job Cards
            </Link>
            <h1 className="mt-1 font-heading font-semibold text-brand-dark text-xl">
              {job.jobCode}
            </h1>
            <p className="font-sans text-brand-muted text-sm">
              {job.clientName} · {job.destination || "Destination pending"}
              {job.travelStartDate
                ? ` · ${formatDisplayDate(job.travelStartDate)}${job.travelEndDate ? ` – ${formatDisplayDate(job.travelEndDate)}` : ""}`
                : ""}
            </p>
          </div>
          <div className="text-right font-sans text-brand-muted text-xs">
            <div>{job.status}</div>
            <div className="mt-1">Contracting: {job.contractingOwnerName || "Unassigned"}</div>
          </div>
        </div>
      </section>
      <JobCardTourContext job={job} proposal={payload.proposal} query={payload.query} />
      <JobCardReadinessMap sections={model.readinessSections} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-brand-border bg-white">
          <button
            aria-expanded={tasksOpen}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            onClick={() => setTasksOpen((open) => !open)}
            type="button"
          >
            <div>
              <h2 className="font-heading text-base text-brand-dark">Checklist tasks</h2>
              <p className="font-sans text-brand-muted text-xs">
                {completedCount} / {tasks.length} complete
              </p>
            </div>
            <ChevronDown
              className={`shrink-0 text-brand-muted transition ${tasksOpen ? "rotate-180" : ""}`}
              size={18}
            />
          </button>
          {tasksOpen ? (
            <div className="border-brand-border border-t px-4 py-3">
              <JobCardTaskBoard tasks={tasks} />
            </div>
          ) : null}
        </section>
        <aside className="space-y-4">
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <h2 className="font-heading text-base text-brand-dark">Blockers</h2>
            <ul className="mt-3 space-y-2">
              {model.blockers.length === 0 ? (
                <li className="font-sans text-brand-muted text-sm">No readiness blockers.</li>
              ) : (
                model.blockers.map((blocker) => (
                  <li className="font-sans text-brand-muted text-sm" key={blocker.key}>
                    {blocker.label}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-brand-border bg-white p-4">
            <h2 className="font-heading text-base text-brand-dark">Next actions</h2>
            <ul className="mt-3 space-y-2">
              {model.nextActions.slice(0, 8).map((action) => (
                <li className="font-sans text-brand-muted text-sm" key={action.id}>
                  {action.label}
                  {action.dueDate ? ` · ${action.dueDate}` : ""}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
