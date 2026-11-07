"use client";

import { api } from "@convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { canViewFieldPassportAccessLog } from "@/lib/portal/permissions";
import { useTrackedPaginatedQuery, useTrackedQuery } from "@/lib/portal/trackedConvexSubscriptions";

const VIEWS_PER_PAGE = 20;

const IST_DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

/** The time a passport was opened, in India Standard Time, as the office reads it. */
function formatPassportViewTime(timestamp: number) {
  return `${IST_DATE_TIME.format(new Date(timestamp))} IST`;
}

function PassportViewsList({ jobCardId }: { jobCardId: string }) {
  const { loadMore, results, status } = useTrackedPaginatedQuery(
    api.crm.fieldPassports.listFieldPassportAccess,
    { jobCardId },
    { initialNumItems: VIEWS_PER_PAGE }
  );
  const showMore = () => loadMore(VIEWS_PER_PAGE);
  if (status === "LoadingFirstPage") {
    return <div className="mt-3 h-12 animate-pulse rounded bg-brand-light" />;
  }
  if (results.length === 0) {
    return (
      <p className="mt-3 font-sans text-brand-muted text-sm">
        No passports have been opened in the tour manager app for this Job Card.
      </p>
    );
  }
  return (
    <>
      <ul className="mt-3 divide-y divide-brand-border">
        {results.map((row) => (
          <li className="py-2" key={row.id}>
            <p className="font-sans text-brand-dark text-sm">
              <span className="font-semibold">{row.actorName}</span> opened{" "}
              <span className="font-semibold">{row.travellerName}</span>’s passport
            </p>
            <p className="mt-1 font-sans text-brand-muted text-xs tabular-nums">
              {formatPassportViewTime(row.accessedAt)}
              {row.batchLabel ? ` · ${row.batchLabel}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {status === "CanLoadMore" ? (
        <button className="portal-small-btn mt-2 min-h-11" onClick={showMore} type="button">
          Show more passport views
        </button>
      ) : null}
    </>
  );
}

/**
 * Passport views on a Job Card: each time a tour manager opened a traveller's passport in the
 * tour manager app (director decision, 7 Nov 2026). Only the Operations Head and Admin see the
 * panel. Anyone else gets nothing and never subscribes to the log; the server is asked first, so
 * a Job Card it refuses (for example one reached only as its tour manager) also shows nothing.
 */
export function JobCardPassportViews({ jobCardId }: { jobCardId: string }) {
  const { isAuthenticated } = useConvexAuth();
  const access = useTrackedQuery(api.crm.staff.getMyPortalAccess, isAuthenticated ? {} : "skip");
  const allowed = canViewFieldPassportAccessLog(access);
  const serverAllows = useTrackedQuery(
    api.crm.fieldPassports.canListFieldPassportAccess,
    allowed ? { jobCardId } : "skip"
  );
  if (!(allowed && serverAllows === true)) {
    return null;
  }
  return (
    <section
      aria-labelledby="job-card-passport-views"
      className="rounded-lg border border-brand-border bg-white p-4"
    >
      <h2 className="font-heading text-base text-brand-dark" id="job-card-passport-views">
        Passport views
      </h2>
      <p className="mt-1 text-brand-muted text-sm">
        Who opened which traveller’s passport in the tour manager app, newest first.
      </p>
      <p className="mt-1 text-brand-muted text-xs">Records are kept for one year after the trip.</p>
      <PassportViewsList jobCardId={jobCardId} />
    </section>
  );
}
