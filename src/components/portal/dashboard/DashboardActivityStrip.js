"use client";

import Link from "next/link";
import { getNotificationHref } from "@/lib/portal/notificationPaths";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatRelativeTime } from "./utils";

function activityDot(message = "") {
  if (/confirmed|approved|issued/i.test(message)) return "bg-emerald-500";
  if (/lost|cancel|overdue|pending/i.test(message)) return "bg-citius-orange";
  return "bg-citius-blue";
}

export function DashboardActivityStrip({ activities, canView }) {
  if (!canView) return null;

  const rows = activities || [];

  return (
    <DashboardPanel
      title="Recent activity"
      action={
        <Link
          href="/portal/activity"
          className="text-xs font-bold text-citius-blue hover:underline"
        >
          View all activity
        </Link>
      }
    >
      {!rows.length ? (
        <DashboardEmpty label="No recent activity in this period." />
      ) : (
        <ul className="divide-y divide-brand-border/80">
          {rows.slice(0, 5).map((row) => {
            const href =
              row.entityType && row.entityId
                ? getNotificationHref({
                    entityType: row.entityType,
                    entityId: row.entityId,
                    title: row.action || "",
                  })
                : "/portal/activity";
            return (
              <li key={row.id}>
                <Link
                  href={href}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2 text-sm hover:text-citius-blue"
                >
                  <span className={`size-2 rounded-full ${activityDot(row.message)}`} />
                  <span className="min-w-0 truncate font-medium text-brand-dark">
                    {row.message}
                  </span>
                  <span className="text-xs tabular-nums text-brand-muted">
                    {row.createdAt ? formatRelativeTime(row.createdAt) : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
