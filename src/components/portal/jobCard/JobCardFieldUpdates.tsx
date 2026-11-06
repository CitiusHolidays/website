"use client";

import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { formatDisplayDate, formatDisplayDateTime } from "@/lib/formatDate";
import { useTrackedPaginatedQuery, useTrackedQuery } from "@/lib/portal/trackedConvexSubscriptions";

type HeadcountDays = NonNullable<FunctionReturnType<typeof api.crm.fieldSync.listLatestHeadcounts>>;
type HeadcountStop = HeadcountDays[number]["latest"][number];

const MISSING_NAMES_SHOWN = 12;
const ANNOUNCEMENTS_PER_PAGE = 10;

function stopTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function missingSummary(stop: HeadcountStop) {
  if (stop.missing.length === 0) {
    return stop.expectedCount > 0 ? "Everyone is here." : "No travellers to count.";
  }
  const shown = stop.missing.slice(0, MISSING_NAMES_SHOWN).map((row) => row.fullName);
  const more = stop.missing.length - shown.length;
  return `Missing: ${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
}

function HeadcountStopRow({ stop }: { stop: HeadcountStop }) {
  const context = [stop.batchLabel, stop.recordedByName, stopTime(stop.startedAt)]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="py-2">
      <p className="font-sans text-brand-dark text-sm">
        <span className="font-semibold">{stop.label}</span>
        <span className="text-brand-muted"> · {context}</span>
      </p>
      <p className="font-sans text-brand-dark text-sm tabular-nums">
        {stop.presentCount} of {stop.expectedCount} present
      </p>
      <p className="font-sans text-brand-muted text-xs">{missingSummary(stop)}</p>
    </li>
  );
}

function HeadcountDaysList({ days }: { days: HeadcountDays }) {
  if (days.length === 0) {
    return <p className="mt-2 font-sans text-brand-muted text-sm">No headcounts synced yet.</p>;
  }
  return (
    <div className="mt-2 space-y-3">
      {days.map((entry) => (
        <div key={entry.day}>
          <h4 className="font-sans font-semibold text-brand-dark text-sm">
            {formatDisplayDate(entry.day)}
            <span className="font-normal text-brand-muted">
              {" "}
              · {entry.stopCount} {entry.stopCount === 1 ? "stop" : "stops"}
            </span>
          </h4>
          <ul className="divide-y divide-brand-border">
            {entry.latest.map((stop) => (
              <HeadcountStopRow key={stop.id} stop={stop} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AnnouncementsList({ jobCardId }: { jobCardId: string }) {
  const { loadMore, results, status } = useTrackedPaginatedQuery(
    api.crm.fieldSync.listAnnouncements,
    { jobCardId },
    { initialNumItems: ANNOUNCEMENTS_PER_PAGE }
  );
  const showMore = () => loadMore(ANNOUNCEMENTS_PER_PAGE);
  if (status === "LoadingFirstPage") {
    return <div className="mt-2 h-12 animate-pulse rounded bg-brand-light" />;
  }
  if (results.length === 0) {
    return <p className="mt-2 font-sans text-brand-muted text-sm">No announcements synced yet.</p>;
  }
  return (
    <>
      <ul className="mt-2 divide-y divide-brand-border">
        {results.map((row) => (
          <li className="py-2" key={row.id}>
            <p className="whitespace-pre-wrap font-sans text-brand-dark text-sm">{row.body}</p>
            <p className="mt-1 font-sans text-brand-muted text-xs tabular-nums">
              {formatDisplayDateTime(row.sharedAt)} · {row.authorName} ·{" "}
              {row.batchLabel || "Whole group"} · Seen by {row.seenCount} of {row.recipientCount}
            </p>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" ? (
        <button className="portal-small-btn mt-2 min-h-11" onClick={showMore} type="button">
          Show more announcements
        </button>
      ) : null}
    </>
  );
}

/**
 * Read-only office view of what tour managers synced from the tour manager app. Renders nothing for
 * callers without Operations access and office scope on the Job Card (the server returns null).
 */
export function JobCardFieldUpdates({ jobCardId }: { jobCardId: string }) {
  const headcounts = useTrackedQuery(api.crm.fieldSync.listLatestHeadcounts, { jobCardId });
  if (!headcounts) {
    return null;
  }
  return (
    <section
      aria-labelledby="job-card-field-updates"
      className="rounded-lg border border-brand-border bg-white p-4"
    >
      <h2 className="font-heading text-base text-brand-dark" id="job-card-field-updates">
        Field updates
      </h2>
      <p className="mt-1 text-brand-muted text-sm">
        Headcounts and announcements tour managers sent from the tour manager app.
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="font-heading text-brand-dark text-sm">Latest headcounts</h3>
          <HeadcountDaysList days={headcounts} />
        </div>
        <div>
          <h3 className="font-heading text-brand-dark text-sm">Announcements</h3>
          <AnnouncementsList jobCardId={jobCardId} />
        </div>
      </div>
    </section>
  );
}
