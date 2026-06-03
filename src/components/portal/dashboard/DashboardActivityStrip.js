"use client";

import Link from "next/link";
import { getNotificationHref } from "@/lib/portal/notificationPaths";
import { DashboardEmpty, DashboardPanel } from "./DashboardPanel";

export function DashboardActivityStrip({ activities, canView }) {
  if (!canView) return null;

  const rows = activities || [];

  return (
    <DashboardPanel title="Recent activity">
      <p className="mb-3 text-xs">
        <Link href="/portal/activity" className="font-semibold text-citius-blue hover:underline">
          View all activity
        </Link>
      </p>
      {!rows.length ? (
        <DashboardEmpty label="No recent activity in this period." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
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
                  className="block rounded-lg border border-brand-border bg-brand-light px-3 py-2 text-sm hover:border-citius-orange/30"
                >
                  <div className="font-medium text-brand-dark">{row.message}</div>
                  <div className="mt-0.5 text-xs text-brand-muted">
                    {row.actorName}
                    {row.createdAt
                      ? ` · ${new Date(row.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`
                      : ""}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}
