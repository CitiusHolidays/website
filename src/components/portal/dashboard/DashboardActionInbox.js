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

export function DashboardActionInbox({ actions, dateRange }) {
  const viewAllHref = actions?.length
    ? buildUrgentViewAllHref(actions[0].type, dateRange)
    : "/portal/activity";

  if (!actions?.length) {
    return (
      <DashboardPanel
        action={
          <Link className="font-bold text-citius-blue text-xs hover:underline" href={viewAllHref}>
            View all
          </Link>
        }
        title="Action inbox"
      >
        <DashboardEmpty label="You're clear — no urgent actions right now." />
      </DashboardPanel>
    );
  }

  return (
    <DashboardPanel
      action={
        <Link className="font-bold text-citius-blue text-xs hover:underline" href={viewAllHref}>
          View all
        </Link>
      }
    >
      <ul className="-mt-1 divide-y divide-brand-border/80">
        {actions.slice(0, 5).map((item) => (
          <li key={item.id}>
            <Link
              className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-citius-blue focus-visible:outline-offset-2"
              href={buildUrgentActionHref(item)}
            >
              <span
                className={`mt-0.5 size-2 rounded-full ${
                  item.type === "ticketing" ? "bg-citius-blue" : "bg-citius-orange"
                }`}
              />
              <span className="min-w-0">
                <span className="block font-bold text-[11px] text-brand-muted uppercase tracking-wide">
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
        ))}
      </ul>
    </DashboardPanel>
  );
}
