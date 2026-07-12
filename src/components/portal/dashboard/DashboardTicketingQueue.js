"use client";

import { AlertCircle, CalendarDays, Plane, RotateCw } from "lucide-react";
import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { DashboardPanel } from "./DashboardPanel";
import { formatMetricTrend } from "./utils";

export function DashboardTicketingQueue({ queue, dateRange, stats, metricTrends }) {
  const rows = queue || [];
  const tiles = [
    {
      href: buildDashboardListUrl({ dateRange, view: "tickets" }),
      Icon: Plane,
      label: "On hold",
      value: stats?.onHold ?? 0,
    },
    {
      href: buildDashboardListUrl({ dateRange, view: "tickets" }),
      Icon: RotateCw,
      label: "Reissue",
      value: stats?.reissue ?? 0,
    },
    {
      href: buildDashboardListUrl({ dateRange, view: "tickets" }),
      Icon: AlertCircle,
      label: "Cancel req.",
      trend: metricTrends?.departures30d,
      value: stats?.cancelReq ?? 0,
    },
    {
      href: buildDashboardListUrl({ dateRange, view: "job-cards" }),
      Icon: CalendarDays,
      label: "Upcoming dep.",
      trend: metricTrends?.departures30d,
      value: stats?.upcomingDep ?? 0,
    },
  ];

  return (
    <DashboardPanel
      action={
        <Link
          className="font-bold text-citius-blue text-xs hover:underline"
          href={buildDashboardListUrl({ dateRange, view: "tickets" })}
        >
          View all
        </Link>
      }
      title="Ticket attention"
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-brand-border/80 overflow-hidden rounded-lg border border-brand-border/80 sm:grid-cols-4 sm:divide-y-0">
        {tiles.map(({ label, value, Icon, href, trend }) => (
          <Link className="block min-h-20 p-3 hover:bg-brand-light" href={href} key={label}>
            <div className="flex items-center justify-between gap-2 text-brand-muted text-xs">
              <span>{label}</span>
              <Icon className="text-citius-blue" size={16} />
            </div>
            <div className="mt-2 font-heading font-semibold text-2xl text-brand-dark tabular-nums">
              {value}
            </div>
            {trend ? (
              <div className="mt-1 text-[length:var(--portal-label-size)] text-brand-muted">
                {formatMetricTrend(trend)}
              </div>
            ) : null}
          </Link>
        ))}
      </div>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-brand-border/80">
          {rows.slice(0, 3).map((row) => (
            <li key={row.id}>
              <Link
                className="block py-2 text-sm hover:text-citius-blue"
                href={buildDashboardListUrl({
                  dateRange,
                  deepLink: { id: row.id, open: "ticket" },
                  view: "tickets",
                })}
              >
                <span className="font-medium text-brand-dark">{row.ticketNumber || row.id}</span>
                <span className="mt-1 block text-brand-muted text-xs">{row.ticketStatus}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardPanel>
  );
}
