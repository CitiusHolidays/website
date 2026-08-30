"use client";

import { api } from "@convex/_generated/api";
import { ChevronDown, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildJobCardCommandCenter } from "@/lib/portal/jobCardCommandCenter";
import { displayPortalTerm } from "@/lib/portal/productTerminology";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
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
  return `${query.queryCode} · Sales ${displayPortalTerm(query.salesStatus)}${contracting}`;
}

function ContextField({ label, value }) {
  const displayValue = value === "" || value === null || value === undefined ? "—" : String(value);
  return (
    <div>
      <dt className="font-sans font-semibold text-[11px] text-brand-muted uppercase tracking-[0.08em]">
        {label}
      </dt>
      <dd className="mt-1 font-sans text-brand-dark text-sm">{displayValue}</dd>
    </div>
  );
}

const OPENING_FIELD_LABELS = {
  clientName: "Client",
  confirmedPax: "Confirmed pax",
  destination: "Destination",
  roomCount: "Room count",
  travelEndDate: "Travel end",
  travelStartDate: "Travel start",
};

const OPENING_COMMERCIAL_LABELS = {
  airfarePerPax: "Airfare / pax",
  approxMargin: "Approx. margin",
  landCostPerPax: "Land cost / pax",
  profitPerPax: "Profit / pax",
  sellingPricePerPax: "Selling price / pax",
  visaCostPerPax: "Visa cost / pax",
};

function openingFieldLabel(field) {
  return OPENING_FIELD_LABELS[field] ?? field;
}

function JobCardOpeningEvidence({ evidence }) {
  if (evidence.status !== "recorded") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h2 className="font-heading text-base text-brand-dark">Opening evidence</h2>
        <p className="mt-2 font-sans text-amber-900 text-sm">
          This legacy Job Card has no versioned opening snapshot. Current values are not presented
          as its confirmed baseline.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-brand-border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-base text-brand-dark">Opening evidence</h2>
          <p className="font-sans text-brand-muted text-xs">
            Immutable snapshot v{evidence.version} · Proposal revision{" "}
            {evidence.authority?.proposalRevision ?? "—"} · opened{" "}
            {evidence.openedAt
              ? new Date(evidence.openedAt).toLocaleString("en-IN")
              : "time unavailable"}
          </p>
        </div>
        <span className="rounded-full bg-brand-light px-2 py-1 font-medium font-sans text-brand-muted text-xs">
          {evidence.current.variances.length} current change(s)
        </span>
      </div>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(evidence.effective ?? {}).map(([field, value]) => (
          <ContextField key={field} label={openingFieldLabel(field)} value={String(value)} />
        ))}
      </dl>
      {evidence.commercial ? (
        <div className="mt-4 border-brand-border border-t pt-3">
          <h3 className="font-sans font-semibold text-brand-dark text-sm">
            Finance opening values
          </h3>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(evidence.commercial).map(([field, value]) => (
              <ContextField
                key={field}
                label={OPENING_COMMERCIAL_LABELS[field] ?? field}
                value={Number(value).toLocaleString("en-IN")}
              />
            ))}
          </dl>
        </div>
      ) : null}
      <div className="mt-4 grid gap-4 border-brand-border border-t pt-3 lg:grid-cols-2">
        <div>
          <h3 className="font-sans font-semibold text-brand-dark text-sm">Opening variances</h3>
          {evidence.variances.length ? (
            <ul className="mt-2 space-y-2">
              {evidence.variances.map((variance) => (
                <li className="font-sans text-brand-muted text-xs" key={variance.field}>
                  <span className="font-medium text-brand-dark">
                    {openingFieldLabel(variance.field)}:
                  </span>{" "}
                  {variance.fromValue || "—"} → {variance.toValue || "—"} · {variance.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-sans text-brand-muted text-xs">
              Opened without an operational override.
            </p>
          )}
        </div>
        <div>
          <h3 className="font-sans font-semibold text-brand-dark text-sm">Current variance</h3>
          {evidence.current.variances.length ? (
            <ul className="mt-2 space-y-2">
              {evidence.current.variances.map((variance) => (
                <li className="font-sans text-brand-muted text-xs" key={variance.field}>
                  <span className="font-medium text-brand-dark">
                    {openingFieldLabel(variance.field)}:
                  </span>{" "}
                  {variance.openingValue || "—"} → {variance.currentValue || "—"}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-sans text-brand-muted text-xs">
              Current operational values still match the opening snapshot.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function JobCardMoneyReadiness({ money }) {
  return (
    <section className="rounded-lg border border-brand-border bg-white p-4">
      <h2 className="font-heading text-base text-brand-dark">Payment readiness</h2>
      <p className="mt-1 font-sans text-brand-muted text-sm">{money.label}</p>
      {money.exact ? (
        <div className="mt-3 border-brand-border border-t pt-3">
          <h3 className="font-sans font-semibold text-brand-dark text-sm">Finance detail</h3>
          {money.exact.invoices.length ? (
            <ul className="mt-2 space-y-2">
              {money.exact.invoices.map((invoice) => (
                <li className="flex justify-between gap-3 font-sans text-xs" key={invoice.id}>
                  <span className="text-brand-dark">
                    {invoice.invoiceNumber} · {invoice.status}
                  </span>
                  <span className="text-brand-muted">
                    Expected {invoice.expectedAmount.toLocaleString("en-IN")} · received{" "}
                    {invoice.receivedAmount.toLocaleString("en-IN")} · balance{" "}
                    {invoice.balanceAmount.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-sans text-brand-muted text-xs">No Finance rows recorded.</p>
          )}
          {money.exact.truncated ? (
            <p className="mt-2 font-sans text-amber-800 text-xs">
              More rows exist. Continue in Finance for the complete list.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function JobCardTourContext({ commercialFiles, job, query, proposal }) {
  const clientName = job.clientName || query?.clientName || proposal?.clientName || "—";
  const destination = job.destination || query?.destination || "Destination pending";
  const hasDocuments = commercialFiles.length > 0;

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
            job.confirmedPax === null
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
            {commercialFiles.map((file) => {
              const route =
                file.fileKind === "proposalDoc"
                  ? `/api/portal/files/proposal-finalized/${encodeURIComponent(file.sourceId)}`
                  : `/api/portal/files/${file.sourceType}/${encodeURIComponent(file.attachmentId)}`;
              return (
                <li key={`${file.sourceType}:${file.attachmentId}`}>
                  <a
                    className="inline-flex max-w-full items-center gap-1.5 font-medium font-sans text-citius-blue text-sm hover:underline"
                    href={route}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {file.fileKind === "proposalDoc" ? (
                      <FileText className="shrink-0" size={14} />
                    ) : (
                      <Paperclip className="shrink-0" size={14} />
                    )}
                    <span className="truncate">{file.fileName}</span>
                    <span className="shrink-0 font-normal text-brand-muted text-xs">
                      · {formatFileSize(file.fileSize)}
                    </span>
                  </a>
                  <span className="ml-5 block text-[11px] text-brand-muted">
                    {file.sourceLabel}
                    {file.fileKind === "proposalDoc" ? " · Proposal document" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export default function JobCardCommandCenter({ jobCardId }) {
  const payload = useQuery(api.crm.jobCards.getCommandCenter, { jobCardId });
  const [tasksOpen, setTasksOpen] = useState(false);
  const toggleTasks = () => setTasksOpen((open) => !open);
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
      <JobCardTourContext
        commercialFiles={payload.commercialFiles ?? []}
        job={job}
        proposal={payload.proposal}
        query={payload.query}
      />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <JobCardOpeningEvidence evidence={model.openingEvidence} />
        <JobCardMoneyReadiness money={model.money} />
      </div>
      <JobCardReadinessMap sections={model.readinessSections} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-lg border border-brand-border bg-white" id="checklist-tasks">
          <button
            aria-expanded={tasksOpen}
            className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
            onClick={toggleTasks}
            type="button"
          >
            <div>
              <h2 className="font-heading text-base text-brand-dark">Checklist tasks</h2>
              <p className="font-sans text-brand-muted text-xs">
                {completedCount} / {tasks.length} complete
              </p>
            </div>
            <ChevronDown
              className={`shrink-0 text-brand-muted transition-transform duration-150 ease-[var(--portal-ease-out)] ${tasksOpen ? "rotate-180" : ""}`}
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
              {model.actions.length === 0 ? (
                <li className="font-sans text-brand-muted text-sm">No outstanding actions.</li>
              ) : (
                model.actions.slice(0, 8).map((action) => (
                  <li className="font-sans text-brand-muted text-sm" key={action.id}>
                    {action.href ? (
                      <Link
                        className="font-medium text-citius-blue hover:underline"
                        href={action.href}
                      >
                        {action.label}
                      </Link>
                    ) : (
                      <span className="text-brand-dark">{action.label}</span>
                    )}
                    <span className="block text-xs">
                      Owner: {action.owner.label}
                      {action.status === "owned_elsewhere" ? " · Continue in the owning team" : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
