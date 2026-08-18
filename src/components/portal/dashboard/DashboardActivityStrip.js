"use client";

import Link from "next/link";
import { getNotificationHref } from "@/lib/portal/notificationPaths";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";
import { formatRelativeTime } from "./utils";

export function DashboardActivityStrip({ activities, canView }) {
  if (!canView) {
    return null;
  }

  const rows = activities || [];

  return (
    <DashboardPanel
      action={
        <Link
          className="font-bold text-citius-blue text-xs hover:underline"
          href="/portal/activity"
        >
          View all activity
        </Link>
      }
      title="Recent activity"
    >
      {rows.length ? (
        <ul className="divide-y divide-brand-border/80">
          {rows.slice(0, 5).map((row) => {
            const href =
              row.entityType && row.entityId
                ? getNotificationHref({
                    entityId: row.entityId,
                    entityType: row.entityType,
                    title: row.action || "",
                  })
                : "/portal/activity";
            return (
              <li key={row.id}>
                <Link
                  className="grid grid-cols-[1fr_auto] items-center gap-3 py-2 text-sm hover:text-citius-blue"
                  href={href}
                >
                  <span className="min-w-0 truncate font-medium text-brand-dark">
                    {row.message}
                  </span>
                  <span className="text-brand-muted text-xs tabular-nums">
                    {row.createdAt ? formatRelativeTime(row.createdAt) : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <DashboardEmpty label="No recent activity in this period." />
      )}
    </DashboardPanel>
  );
}
