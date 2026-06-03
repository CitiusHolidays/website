"use client";

import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";

export function DashboardTicketingQueue({ queue, dateRange }) {
  const rows = queue || [];

  return (
    <DashboardPanel title="Tickets needing attention">
      {!rows.length ? (
        <DashboardEmpty label="No tickets in attention statuses." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={buildDashboardListUrl({
                  view: "tickets",
                  dateRange,
                  deepLink: { open: "ticket", id: row.id },
                })}
                className="block rounded-xl border border-brand-border p-3 text-sm hover:border-citius-orange/30 hover:shadow-sm"
              >
                <span className="font-medium text-brand-dark">{row.ticketNumber || row.id}</span>
                <span className="mt-1 block text-xs text-brand-muted">{row.ticketStatus}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
