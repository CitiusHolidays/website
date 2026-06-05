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
      label: "On hold",
      value: stats?.onHold ?? 0,
      Icon: Plane,
      href: buildDashboardListUrl({ view: "tickets", dateRange }),
    },
    {
      label: "Reissue",
      value: stats?.reissue ?? 0,
      Icon: RotateCw,
      href: buildDashboardListUrl({ view: "tickets", dateRange }),
    },
    {
      label: "Cancel req.",
      value: stats?.cancelReq ?? 0,
      Icon: AlertCircle,
      href: buildDashboardListUrl({ view: "tickets", dateRange }),
      trend: metricTrends?.departures30d,
    },
    {
      label: "Upcoming dep.",
      value: stats?.upcomingDep ?? 0,
      Icon: CalendarDays,
      href: buildDashboardListUrl({ view: "job-cards", dateRange }),
      trend: metricTrends?.departures30d,
    },
  ];

  return (
    <DashboardPanel
      title="Ticketing"
      action={
        <Link
          href={buildDashboardListUrl({ view: "tickets", dateRange })}
          className="text-xs font-bold text-citius-blue hover:underline"
        >
          View all
        </Link>
      }
    >
      <div className="grid grid-cols-2 divide-x divide-y divide-brand-border/80 overflow-hidden rounded-lg border border-brand-border/80 sm:grid-cols-4 sm:divide-y-0">
        {tiles.map(({ label, value, Icon, href, trend }) => (
          <Link key={label} href={href} className="block min-h-20 p-3 hover:bg-brand-light">
            <div className="flex items-center justify-between gap-2 text-xs text-brand-muted">
              <span>{label}</span>
              <Icon size={16} className="text-citius-blue" />
            </div>
            <div className="mt-2 font-heading text-2xl font-semibold tabular-nums text-brand-dark">
              {value}
            </div>
            {trend ? (
              <div className="mt-1 text-[11px] text-brand-muted">{formatMetricTrend(trend)}</div>
            ) : null}
          </Link>
        ))}
      </div>
      {rows.length ? (
        <ul className="mt-3 divide-y divide-brand-border/80">
          {rows.slice(0, 3).map((row) => (
            <li key={row.id}>
              <Link
                href={buildDashboardListUrl({
                  view: "tickets",
                  dateRange,
                  deepLink: { open: "ticket", id: row.id },
                })}
                className="block py-2 text-sm hover:text-citius-blue"
              >
                <span className="font-medium text-brand-dark">{row.ticketNumber || row.id}</span>
                <span className="mt-1 block text-xs text-brand-muted">{row.ticketStatus}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </DashboardPanel>
  );
}
