"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildDashboardListUrl, buildJobCardHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel, DashboardProgress } from "./DashboardPanel";

const BADGE_TONES = {
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function statusTone(readiness) {
  if (readiness === "Ready") {
    return "green";
  }
  if (readiness === "Docs pending") {
    return "amber";
  }
  return "blue";
}

function Badge({ label, tone }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-semibold text-[11px] ${BADGE_TONES[tone] || BADGE_TONES.blue}`}
    >
      {label}
    </span>
  );
}

export function DashboardActiveTours({ tours, dateRange, hasJobCards }) {
  if (!hasJobCards) {
    return null;
  }

  return (
    <DashboardPanel title="Active tours">
      {tours?.length ? (
        <div className="space-y-4">
          {tours.map((tour) => (
            <Link
              className="block overflow-hidden rounded-xl border border-brand-border bg-brand-light p-4 transition-shadow hover:border-citius-orange/30 hover:shadow-md"
              href={buildJobCardHref(tour.id, dateRange)}
              key={tour.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-brand-dark text-sm">
                    {tour.jobCode} - {tour.clientName}
                  </div>
                  <div className="text-brand-muted text-xs">
                    {tour.destination || "Destination pending"} - {tour.pax} pax
                  </div>
                </div>
                <Badge label={tour.status} tone="blue" />
              </div>
              <DashboardProgress label="Tickets issued" value={tour.ticketProgress} />
              <DashboardProgress label="Visa approved" value={tour.visaProgress} />
            </Link>
          ))}
        </div>
      ) : (
        <DashboardEmpty label="No active tours yet." />
      )}
    </DashboardPanel>
  );
}

export function DashboardUpcomingDepartures({ departures, dateRange, hasJobCards }) {
  if (!hasJobCards) {
    return null;
  }

  return (
    <DashboardPanel
      action={
        <Link
          className="font-bold text-citius-blue text-xs hover:underline"
          href={buildDashboardListUrl({ dateRange, view: "job-cards" })}
        >
          View all job cards
        </Link>
      }
    >
      {departures?.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-brand-border border-b text-brand-muted text-xs">
                <th className="py-2 pr-3 font-semibold">JC</th>
                <th className="py-2 pr-3 font-semibold">Client</th>
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 pr-3 font-semibold">Pax</th>
                <th className="py-2 pr-3 font-semibold">TM</th>
                <th className="py-2 font-semibold">Readiness</th>
              </tr>
            </thead>
            <tbody>
              {departures.map((row) => (
                <tr className="border-brand-border/60 border-b last:border-0" key={row.id}>
                  <td className="py-2 pr-3">
                    <Link
                      className="font-semibold text-citius-blue hover:underline"
                      href={buildJobCardHref(row.id, dateRange)}
                    >
                      {row.jobCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 font-medium text-brand-dark">{row.clientName}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {formatDisplayDate(row.travelStartDate)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{row.pax}</td>
                  <td className="py-2 pr-3">{row.tourManagerName || "—"}</td>
                  <td className="py-2">
                    <Badge label={row.readiness} tone={statusTone(row.readiness)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmpty label="No upcoming departures." />
      )}
    </DashboardPanel>
  );
}

export function DashboardWorkQueuesSummary({ rows }) {
  const visibleRows = rows || [];

  return (
    <DashboardPanel title="Work queues">
      {visibleRows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-brand-border border-b text-brand-muted text-xs">
                <th className="py-2 pr-3 font-semibold">Queue</th>
                <th className="py-2 pr-3 text-right font-semibold">Pending</th>
                <th className="py-2 pr-3 text-right font-semibold">Oldest item</th>
                <th className="py-2 text-right font-semibold">Owner</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.slice(0, 5).map((row) => (
                <tr className="border-brand-border/70 border-b last:border-0" key={row.label}>
                  <td className="py-2.5 pr-3">
                    <Link
                      className="font-semibold text-citius-blue hover:underline"
                      href={row.href}
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-brand-dark tabular-nums">
                    {row.value ?? 0}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-brand-muted tabular-nums">
                    {row.oldestLabel || "—"}
                  </td>
                  <td className="py-2.5 text-right text-brand-muted">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <DashboardEmpty label="No open work queues for this period." />
      )}
    </DashboardPanel>
  );
}
