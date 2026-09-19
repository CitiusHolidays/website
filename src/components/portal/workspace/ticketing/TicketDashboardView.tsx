"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/formatDate";
import { LoadingPanel } from "../portalAdminHelpers";
import type { TicketDashboardViewProps } from "../portalViewTypes";
import { TicketsView } from "./TicketsView";

export function TicketDashboardView({
  summary,
  openModal,
  has,
  deleteItem,
  deleteSelected,
  removeTicket,
  removeManyTickets,
}: TicketDashboardViewProps) {
  if (!summary) {
    return <LoadingPanel />;
  }
  const totalsReady = summary.aggregateCoverage?.complete === true;
  const metrics = [
    { label: "Issued", value: summary.issued },
    { label: "Pending", value: summary.pending },
    { label: "Attention", value: summary.attention },
    { label: "FIT tickets", value: summary.fitTickets },
    { label: "Group tickets", value: summary.groupTickets },
    { label: "PNRs", value: summary.pnrCount },
    {
      label: "Issued seats / capacity",
      value: `${summary.issuedSeats ?? "Unknown"} / ${summary.totalSeats ?? "Unknown"}`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold text-brand-dark text-sm">Recent tickets</h2>
          <p className="mt-1 text-brand-muted text-xs">
            {summary.preview.length} loaded in this preview
            {summary.workCoverage
              ? ` · ${formatDisplayDate(summary.workCoverage.from)} – ${formatDisplayDate(summary.workCoverage.to)}`
              : ""}
            . Open All Tickets for the full list and filters.
          </p>
        </div>
        <Link className="portal-small-btn inline-flex min-h-11 items-center" href="/portal/tickets">
          All Tickets
        </Link>
      </div>
      <TicketsView
        deleteItem={deleteItem}
        deleteSelected={deleteSelected}
        has={has}
        openModal={openModal}
        removeManyTickets={removeManyTickets}
        removeTicket={removeTicket}
        rows={summary.preview}
      />
      <section className="rounded-xl border border-brand-border bg-white p-4">
        <h2 className="font-heading font-semibold text-brand-dark text-sm">Ticketing totals</h2>
        {totalsReady ? (
          <>
            <p className="mt-1 text-brand-muted text-xs">
              Totals cover records available to your role in the selected period.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 xl:grid-cols-7">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <dt className="text-brand-muted text-xs">{metric.label}</dt>
                  <dd className="mt-1 font-semibold text-brand-dark text-lg tabular-nums">
                    {metric.value ?? "Unknown"}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="mt-2 text-brand-muted text-sm" role="status">
            Ticketing totals are preparing. Loaded tickets remain available above.
          </p>
        )}
      </section>
    </div>
  );
}
