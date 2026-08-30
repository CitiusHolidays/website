"use client";

import Link from "next/link";
import { SelectableDataTable } from "@/components/portal/SelectableDataTable";
import { StatusBadge } from "@/components/portal/workspace/portalWorkspaceListUi";
import { formatDisplayDate } from "@/lib/formatDate";
import { buildDashboardListUrl, buildJobCardHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel, DashboardProgress } from "./DashboardPanel";

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
              className="block overflow-hidden rounded-xl border border-brand-border bg-white p-4 transition-[border-color,box-shadow] hover:border-citius-blue/25 hover:shadow-md"
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
                <StatusBadge domain="jobCard" status={tour.status} />
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
      title="Upcoming departures"
    >
      <SelectableDataTable
        columns={[
          {
            id: "job-card",
            kind: "identity",
            label: "JC",
            render: (row) => (
              <Link
                className="font-semibold text-citius-blue hover:underline"
                href={buildJobCardHref(row.id, dateRange)}
              >
                {row.jobCode}
              </Link>
            ),
            sortValue: (row) => row.jobCode,
          },
          {
            id: "client",
            label: "Client",
            render: (row) => row.clientName,
            sortValue: (row) => row.clientName,
          },
          {
            id: "date",
            label: "Date",
            render: (row) => formatDisplayDate(row.travelStartDate),
            sortValue: (row) => row.travelStartDate,
          },
          {
            align: "right",
            id: "pax",
            label: "Pax",
            render: (row) => row.pax,
            sortValue: (row) => row.pax,
          },
          {
            hideable: true,
            id: "tour-manager",
            label: "TM",
            render: (row) => row.tourManagerName || "—",
            sortValue: (row) => row.tourManagerName,
          },
          {
            id: "readiness",
            kind: "status",
            label: "Readiness",
            render: (row) => <StatusBadge domain="dashboardReadiness" status={row.readiness} />,
            sortValue: (row) => row.readiness,
          },
        ]}
        compact
        empty="No upcoming departures."
        rows={departures || []}
      />
    </DashboardPanel>
  );
}

export function DashboardWorkQueuesSummary({ rows, variant = "full" }) {
  const visibleRows = rows || [];
  const columns =
    variant === "rail"
      ? [
          {
            id: "queue",
            kind: "identity",
            label: "Queue",
            render: (row) => (
              <Link className="font-semibold text-citius-blue hover:underline" href={row.href}>
                {row.label}
              </Link>
            ),
            sortValue: (row) => row.label,
          },
          {
            align: "right",
            id: "pending",
            label: "Pending",
            render: (row) => `${row.value ?? 0}${row.valueComplete === false ? "+" : ""}`,
            sortValue: (row) => row.value,
          },
        ]
      : [
          {
            id: "queue",
            kind: "identity",
            label: "Queue",
            render: (row) => (
              <Link className="font-semibold text-citius-blue hover:underline" href={row.href}>
                {row.label}
              </Link>
            ),
            sortValue: (row) => row.label,
          },
          {
            align: "right",
            id: "pending",
            label: "Pending",
            render: (row) => `${row.value ?? 0}${row.valueComplete === false ? "+" : ""}`,
            sortValue: (row) => row.value,
          },
          {
            align: "right",
            id: "oldest",
            label: "Oldest item",
            render: (row) => row.oldestLabel || "—",
            sortValue: (row) => row.oldestLabel,
          },
          {
            align: "right",
            id: "owner",
            label: "Owner",
            render: (row) => row.owner,
            sortValue: (row) => row.owner,
          },
        ];

  return (
    <DashboardPanel title="Work queues">
      {visibleRows.length ? (
        <SelectableDataTable
          columns={columns}
          compact
          empty="No open work queues for this period."
          rows={visibleRows.map((row) => ({ ...row, id: row.label }))}
          scrollHints={variant !== "rail"}
        />
      ) : (
        <DashboardEmpty label="No open work queues for this period." />
      )}
    </DashboardPanel>
  );
}
