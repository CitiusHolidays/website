"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { Button } from "@/components/ui/application-button";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { EmptyState, Timeline } from "../portalAdminHelpers";
import type {
  ActivityViewProps,
  PortalDeleteHandler,
  PortalNotificationRow,
} from "../portalViewTypes";
import { DeleteButton, Panel } from "../portalWorkspaceListUi";

interface NotificationItemContentProps {
  deleteItem: PortalDeleteHandler;
  item: PortalNotificationRow;
  removeNotification: ActivityViewProps["removeNotification"];
}

type EmailDeliverySummary = NonNullable<ActivityViewProps["emailDeliverySummaries"]>[number];

export function EmailDeliveryStatusRegion({ summaries }: { summaries: EmailDeliverySummary[] }) {
  return (
    <Panel title="Notification email delivery">
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
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">
                  {summary.sent} sent
                </span>
                {summary.queued + summary.sending > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                    {summary.queued + summary.sending} in progress
                  </span>
                ) : null}
                {summary.retrying > 0 ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-900">
                    {summary.retrying} retrying
                  </span>
                ) : null}
                {summary.exhausted > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-800">
                    {summary.exhausted} exhausted
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

function NotificationItemContent({
  deleteItem,
  item,
  removeNotification,
}: NotificationItemContentProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-semibold text-sm">
          {item.title}: {item.body}
        </div>
        <div className="mt-1 text-brand-muted text-xs">
          {item.readAt ? "Read" : "Unread"} - {formatDate(item.createdAt)}
        </div>
      </div>
      <DeleteButton
        label={item.title || "notification"}
        onClick={(event: MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          deleteItem(item.title || "notification", removeNotification, {
            notificationId: String(item.id),
          });
        }}
      />
    </div>
  );
}

export function ActivityView({
  activity,
  canViewActivityLog,
  notifications,
  deleteItem,
  emailDeliverySummaries,
  removeNotification,
  markNotificationRead,
}: ActivityViewProps) {
  const router = useRouter();

  const handleNotificationClick = (item: PortalNotificationRow) => {
    markNotificationRead({ notificationId: String(item.id) }).catch(() => {});
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
    <div className={`grid gap-5 ${canViewActivityLog ? "xl:grid-cols-2" : ""}`}>
      {canViewActivityLog ? (
        <Panel title="Activity log">
          <Timeline rows={activity} />
        </Panel>
      ) : null}
      {canViewActivityLog ? (
        <Panel title="Notifications">
          {notifications.length === 0 ? (
            <EmptyState label="No notifications yet." />
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => {
                const isInteractive = Boolean(item.entityType && item.entityId);
                const itemClassName = `rounded-md border border-brand-border bg-brand-light p-3 ${
                  isInteractive ? "cursor-pointer transition hover:bg-white" : ""
                }`;

                return isInteractive ? (
                  <Button
                    className={itemClassName}
                    key={item.id}
                    nativeButton={false}
                    onClick={() => handleNotificationClick(item)}
                    render={<div />}
                  >
                    <NotificationItemContent
                      deleteItem={deleteItem}
                      item={item}
                      removeNotification={removeNotification}
                    />
                  </Button>
                ) : (
                  <div className={itemClassName} key={item.id}>
                    <NotificationItemContent
                      deleteItem={deleteItem}
                      item={item}
                      removeNotification={removeNotification}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ) : null}
      {emailDeliverySummaries ? (
        <div className={canViewActivityLog ? "xl:col-span-2" : ""}>
          <EmailDeliveryStatusRegion summaries={emailDeliverySummaries} />
        </div>
      ) : null}
    </div>
  );
}
