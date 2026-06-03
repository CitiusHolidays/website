"use client";

import Link from "next/link";
import { buildUrgentActionHref, buildUrgentViewAllHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";

const GROUP_LABELS = {
  approvals: "Approvals",
  finance: "Finance",
  accounts: "Accounts",
  ticketing: "Ticketing",
};

export function DashboardActionInbox({ actions, dateRange }) {
  if (!actions?.length) {
    return (
      <DashboardPanel title="Action inbox">
        <DashboardEmpty label="You're clear — no urgent actions right now." />
      </DashboardPanel>
    );
  }

  const grouped = actions.reduce(
    (acc, item) => {
      const key = item.type || "other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    /** @type {Record<string, typeof actions>} */ ({}),
  );

  return (
    <DashboardPanel title="Action inbox" subtitle="Items that need attention now">
      <div className="space-y-5">
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                {GROUP_LABELS[type] || type}
              </span>
              <Link
                href={buildUrgentViewAllHref(type, dateRange)}
                className="text-xs font-semibold text-citius-blue hover:underline"
              >
                View all
              </Link>
            </div>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={buildUrgentActionHref(item)}
                    className="block rounded-xl border border-brand-border bg-white p-3 text-sm transition-shadow hover:border-citius-orange/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citius-blue"
                  >
                    <div className="font-medium text-brand-dark">{item.label}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}
