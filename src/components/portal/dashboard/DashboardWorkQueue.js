"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildJobCardHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel, DashboardProgress } from "./DashboardPanel";

const BADGE_TONES = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-900 border-amber-200",
  blue: "bg-blue-50 text-blue-800 border-blue-200",
};

function statusTone(readiness) {
  if (readiness === "Ready") return "green";
  if (readiness === "Docs pending") return "amber";
  return "blue";
}

function Badge({ label, tone }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[tone] || BADGE_TONES.blue}`}
    >
      {label}
    </span>
  );
}

export function DashboardActiveTours({ tours, dateRange, hasJobCards }) {
  if (!hasJobCards) return null;

  return (
    <DashboardPanel title="Active tours">
      {!tours?.length ? (
        <DashboardEmpty label="No active tours yet." />
      ) : (
        <div className="space-y-4">
          {tours.map((tour) => (
            <Link
              key={tour.id}
              href={buildJobCardHref(tour.id, dateRange)}
              className="block overflow-hidden rounded-xl border border-brand-border bg-brand-light p-4 transition-shadow hover:border-citius-orange/30 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-brand-dark">
                    {tour.jobCode} - {tour.clientName}
                  </div>
                  <div className="text-xs text-brand-muted">
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
      )}
    </DashboardPanel>
  );
}

export function DashboardUpcomingDepartures({ departures, dateRange, hasJobCards }) {
  if (!hasJobCards) return null;

  return (
    <DashboardPanel title="Upcoming departures">
      {!departures?.length ? (
        <DashboardEmpty label="No upcoming departures." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brand-border text-xs text-brand-muted">
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
                <tr key={row.id} className="border-b border-brand-border/60 last:border-0">
                  <td className="py-2 pr-3">
                    <Link
                      href={buildJobCardHref(row.id, dateRange)}
                      className="font-semibold text-citius-blue hover:underline"
                    >
                      {row.jobCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 font-medium text-brand-dark">{row.clientName}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatDisplayDate(row.travelStartDate)}</td>
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
      )}
    </DashboardPanel>
  );
}
