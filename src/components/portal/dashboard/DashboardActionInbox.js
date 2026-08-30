"use client";

import Link from "next/link";
import { buildUrgentActionHref, buildUrgentViewAllHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatRelativeTime } from "./utils";

const GROUP_LABELS = {
  accounts: "Accounts",
  approvals: "Approvals",
  finance: "Finance",
  ticketing: "Ticketing",
};

export function DashboardActionInbox({ actions, categories = [], dateRange }) {
  if (!(actions?.length || categories.length)) {
    return (
      <DashboardPanel title="Needs attention">
        <DashboardEmpty label="No urgent work right now." />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel title="Needs attention">
      {categories.length ? (
        <nav
          aria-label="Needs attention queues"
          className="mb-2 flex flex-wrap gap-2 border-brand-border/80 border-b pb-3"
        >
          {categories.map((category) => (
            <Link
              className="rounded-full border border-brand-border bg-brand-light px-3 py-1.5 font-semibold text-citius-blue text-xs hover:border-citius-blue/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
              href={buildUrgentViewAllHref(category.type, dateRange)}
              key={category.type}
            >
              {GROUP_LABELS[category.type] || category.type}{" "}
              <span className="tabular-nums">
                {category.count}
                {category.complete ? "" : "+"}
              </span>
            </Link>
          ))}
        </nav>
      ) : null}
      <ul className="-mt-1 divide-y divide-brand-border/80">
        {actions?.length ? (
          actions.map((item) => (
            <li key={`${item.type}:${item.id}`}>
              <Link
                className="group grid grid-cols-[1fr_auto] items-center gap-3 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
                href={buildUrgentActionHref(item)}
              >
                <span className="min-w-0">
                  <span className="block font-bold text-[length:var(--portal-label-size)] text-brand-muted uppercase tracking-wide">
                    {GROUP_LABELS[item.type] || item.type}
                  </span>
                  <span className="mt-0.5 block truncate font-medium text-brand-dark group-hover:text-citius-blue">
                    {item.label}
                  </span>
                </span>
                <span className="text-brand-muted text-xs tabular-nums">
                  {formatRelativeTime(item.createdAt)}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="py-3 text-brand-muted text-sm">
            The preview is bounded. Open a queue above to inspect all matching records.
          </li>
        )}
      </ul>
    </DashboardPanel>
  );
}
