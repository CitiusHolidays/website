"use client";

import { useRouter } from "next/navigation";
import { NotificationInbox } from "@/components/portal/NotificationInbox";
import { formatDate } from "@/components/portal/PortalModalForm";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { EmptyState, Timeline } from "../portalAdminHelpers";
import type { ActivityViewProps, PortalNotificationRow } from "../portalViewTypes";
import { Panel } from "../portalWorkspaceListUi";

type EmailDeliveryResult = NonNullable<ActivityViewProps["emailDeliverySummaries"]>;
type EmailDeliverySummary = EmailDeliveryResult["summaries"][number];

export function EmailDeliveryStatusRegion({
  coverage,
  summaries,
}: {
  coverage: EmailDeliveryResult["coverage"];
  summaries: EmailDeliverySummary[];
}) {
  return (
    <Panel title="Notification email delivery">
      <p className="mb-4 text-brand-muted text-xs leading-5">
        Retries run automatically. Accepted means the email service took the message. Delivery to
        the recipient's mail server is not confirmed here.
      </p>
      {coverage === "partial" ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          Delivery totals are still being reconciled. Counts shown are partial.
        </p>
      ) : null}
      {summaries.length === 0 ? (
        <EmptyState label="No email delivery events yet." />
      ) : (
        <div aria-live="polite" className="space-y-3">
          {summaries.map((summary) => (
            <div
              className="rounded-md border border-brand-border bg-brand-light p-3"
              key={summary.eventId}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {summary.origin ? (
                  <a
                    className="font-semibold text-brand-dark text-sm underline-offset-2 hover:underline"
                    href={summary.origin.href}
                  >
                    {summary.origin.label}
                  </a>
                ) : (
                  <span className="font-semibold text-brand-dark text-sm">Email event</span>
                )}
                <span className="text-brand-muted text-xs">{formatDate(summary.updatedAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                  {summary.total} {coverage === "complete" ? "total" : "currently counted"}
                </span>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
                  {summary.sent} accepted
                </span>
                {summary.queued + summary.sending > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                    {summary.queued + summary.sending} in progress
                  </span>
                ) : null}
                {summary.retrying > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                    {summary.retrying} retrying automatically
                  </span>
                ) : null}
                {summary.exhausted > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">
                    {summary.exhausted} need attention
                  </span>
                ) : null}
                {summary.skipped > 0 ? (
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-slate-700">
                    {summary.skipped} skipped
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function ActivityView({
  activity,
  canViewActivityLog,
  notifications,
  notificationsLoading = false,
  emailDeliverySummaries,
  markNotificationRead,
}: ActivityViewProps) {
  const router = useRouter();

  const handleNotificationClick = (item: PortalNotificationRow) => {
    markNotificationRead({ notificationId: String(item.id) }).catch(() => {
      // Read state is best-effort; the destination remains available.
    });
    const href = getNotificationHref({
      entityId: item.entityId,
      entityType: item.entityType,
      title: item.title,
    });
    if (item.entityType && item.entityId) {
      router.push(href);
    }
  };

  return (
    <div
      className={`grid items-start gap-5 ${emailDeliverySummaries ? "xl:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}
    >
      <section
        aria-label="Your notifications"
        className="overflow-hidden rounded-2xl border border-brand-border bg-white"
      >
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-semibold text-brand-dark text-sm">Your updates</h2>
          <p className="mt-1 text-brand-muted text-xs leading-5">
            Open an update to view the work.
          </p>
        </div>
        <NotificationInbox
          items={notifications}
          loading={notificationsLoading}
          onActivate={handleNotificationClick}
        />
      </section>
      {emailDeliverySummaries ? (
        <EmailDeliveryStatusRegion
          coverage={emailDeliverySummaries.coverage}
          summaries={emailDeliverySummaries.summaries}
        />
      ) : null}
      {canViewActivityLog ? (
        <details className="rounded-2xl border border-brand-border bg-white p-5 xl:col-span-full">
          <summary className="cursor-pointer font-semibold text-brand-dark text-sm">
            Workspace activity
          </summary>
          <div className="mt-4">
            <Timeline rows={activity} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
