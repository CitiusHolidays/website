"use client";

import { api } from "@convex/_generated/api";
import { FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { portalFileDownloadUrl, requestDocumentPreview } from "@/lib/portal/documentPreview";
import { buildJobCardCommandCenter } from "@/lib/portal/jobCardCommandCenter";
import { displayPortalTerm } from "@/lib/portal/productTerminology";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
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
      <dt className="font-sans font-semibold text-brand-muted text-xs">{label}</dt>
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
      <details className="rounded-lg border border-brand-border bg-white px-4 py-1">
        <summary className="min-h-11 cursor-pointer content-center font-heading text-base text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2">
          Opening evidence · Not recorded
        </summary>
        <p className="mt-2 pb-3 font-sans text-amber-900 text-sm">
          This legacy Job Card has no versioned opening snapshot. Current values are not presented
          as its confirmed baseline.
        </p>
      </details>
    );
  }
  return (
    <details className="rounded-lg border border-brand-border bg-white px-4 py-1">
      <summary className="min-h-11 cursor-pointer content-center font-heading text-base text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2">
        Opening evidence · {evidence.current.variances.length} current change(s)
      </summary>
      <div className="pb-3">
        <p className="font-sans text-brand-muted text-xs">
          Immutable snapshot v{evidence.version} · Proposal revision{" "}
          {evidence.authority?.proposalRevision ?? "—"} · opened{" "}
          {evidence.openedAt
            ? new Date(evidence.openedAt).toLocaleString("en-IN")
            : "time unavailable"}
        </p>
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
      </div>
    </details>
  );
}

function JobCardFinanceDetail({ money }) {
  if (!money.exact) {
    return null;
  }
  return (
    <details className="rounded-lg border border-brand-border bg-white px-4 py-1">
      <summary className="min-h-11 cursor-pointer content-center font-heading text-base text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2">
        Finance detail
      </summary>
      <div className="pb-3">
        {money.exact.invoices.length ? (
          <ul className="mt-2 space-y-2">
            {money.exact.invoices.map((invoice) => (
              <li
                className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-sans text-xs"
                key={invoice.id}
              >
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
    </details>
  );
}

function documentSourceUrl(file) {
  return file.fileKind === "proposalDoc"
    ? `/api/portal/files/proposal-finalized/${encodeURIComponent(file.sourceId)}`
    : `/api/portal/files/${file.sourceType}/${encodeURIComponent(file.attachmentId)}`;
}

function JobCardTourContext({ commercialFiles, query, proposal }) {
  const hasDocuments = commercialFiles.length > 0;

  return (
    <details className="rounded-lg border border-brand-border bg-white px-4 py-1">
      <summary className="min-h-11 cursor-pointer content-center font-heading text-base text-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2">
        Commercial context and files
      </summary>
      <div className="pb-3">
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <ContextField label="Query" value={formatQueryContext(query)} />
          <ContextField
            label="Proposal"
            value={proposal ? `${proposal.proposalCode} · ${proposal.status}` : "Not linked"}
          />
        </dl>
        {proposal?.itinerarySummary ? (
          <div className="mt-4 border-brand-border border-t pt-3">
            <p className="font-sans font-semibold text-brand-muted text-xs">Itinerary summary</p>
            <p className="mt-1 whitespace-pre-wrap font-sans text-brand-dark text-sm">
              {proposal.itinerarySummary}
            </p>
          </div>
        ) : null}
        {hasDocuments ? (
          <div className="mt-4 border-brand-border border-t pt-3">
            <p className="font-sans font-semibold text-brand-muted text-xs">Documents</p>
            <ul className="mt-2 space-y-2">
              {commercialFiles.map((file) => {
                const route = documentSourceUrl(file);
                const viewFile = () =>
                  requestDocumentPreview({
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    navigation: {
                      currentIndex: commercialFiles.indexOf(file),
                      items: commercialFiles.map((candidate) => ({
                        fileName: candidate.fileName,
                        mimeType: candidate.mimeType,
                        sourceUrl: documentSourceUrl(candidate),
                      })),
                    },
                    sourceUrl: route,
                  });
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"
                    key={`${file.sourceType}:${file.attachmentId}`}
                  >
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="flex items-start gap-1.5 font-medium font-sans text-brand-dark text-sm">
                        {file.fileKind === "proposalDoc" ? (
                          <FileText className="shrink-0" size={14} />
                        ) : (
                          <Paperclip className="shrink-0" size={14} />
                        )}
                        <span className="min-w-0 break-words">{file.fileName}</span>
                      </p>
                      <span className="ml-5 block text-brand-muted text-xs">
                        {file.sourceLabel}
                        {file.fileKind === "proposalDoc" ? " · Proposal document" : ""}
                        {` · ${formatFileSize(file.fileSize)}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        aria-label={`View ${file.fileName}`}
                        className="portal-small-btn min-h-11!"
                        onClick={viewFile}
                        type="button"
                      >
                        View
                      </button>
                      <a
                        aria-label={`Download ${file.fileName}`}
                        className="inline-flex min-h-11 items-center px-2 font-sans text-brand-muted text-sm hover:underline"
                        download={file.fileName}
                        href={portalFileDownloadUrl(route)}
                      >
                        Download
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default function JobCardCommandCenter({ jobCardId }) {
  const payload = useQuery(api.crm.jobCards.getCommandCenter, { jobCardId });
  if (payload === undefined) {
    return (
      <div
        aria-busy="true"
        className="h-64 rounded-lg bg-brand-light motion-safe:animate-pulse"
        role="status"
      >
        <span className="sr-only">Loading Job Card tasks</span>
      </div>
    );
  }
  const model = buildJobCardCommandCenter(payload);
  const job = payload.jobCard;
  const tasks = payload.checklistTasks ?? [];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-brand-border bg-white p-4">
        <div className="min-w-0">
          <Link
            className="inline-flex min-h-11 items-center font-sans text-citius-blue text-sm"
            href="/portal/job-cards"
          >
            Back to Job Cards
          </Link>
          <h1 className="mt-1 font-heading font-semibold text-brand-dark text-xl">{job.jobCode}</h1>
          <p className="font-sans text-brand-muted text-sm">
            {job.clientName ||
              payload.query?.clientName ||
              payload.proposal?.clientName ||
              "Client not recorded"}{" "}
            · {job.destination || payload.query?.destination || "Destination pending"}
          </p>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ContextField
            label="Travel dates"
            value={formatTravelDates(job.travelStartDate, job.travelEndDate)}
          />
          <ContextField
            label="Pax"
            value={
              job.confirmedPax === null || job.confirmedPax === undefined
                ? "Not recorded"
                : `${job.confirmedPax}${job.roomCount ? ` · ${job.roomCount} rooms` : ""}`
            }
          />
          <ContextField label="Status" value={job.status} />
          <ContextField label="Contracting" value={job.contractingOwnerName || "Unassigned"} />
        </dl>
      </section>
      <JobCardTaskBoard
        actions={model.actions}
        blockers={model.blockers}
        money={model.money}
        sections={model.readinessSections}
        tasks={tasks}
      />
      <JobCardTourContext
        commercialFiles={payload.commercialFiles ?? []}
        proposal={payload.proposal}
        query={payload.query}
      />
      <JobCardOpeningEvidence evidence={model.openingEvidence} />
      <JobCardFinanceDetail money={model.money} />
    </div>
  );
}
