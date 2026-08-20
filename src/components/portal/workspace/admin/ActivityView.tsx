"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, useCallback } from "react";
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
  const handleDeleteClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      deleteItem(item.title || "notification", removeNotification, {
        notificationId: String(item.id),
      });
    },
    [deleteItem, item.id, item.title, removeNotification]
  );
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
      <DeleteButton label={item.title || "notification"} onClick={handleDeleteClick} />
    </div>
  );
}

function InteractiveNotificationItem({
  deleteItem,
  item,
  onNotificationClick,
  removeNotification,
}: NotificationItemContentProps & {
  onNotificationClick: (item: PortalNotificationRow) => void;
}) {
  const handleClick = useCallback(() => onNotificationClick(item), [item, onNotificationClick]);
  return (
    <Button
      className="cursor-pointer rounded-md border border-brand-border bg-brand-light p-3 transition-colors hover:bg-white"
      nativeButton={false}
      onClick={handleClick}
      render={<div />}
    >
      <NotificationItemContent
        deleteItem={deleteItem}
        item={item}
        removeNotification={removeNotification}
      />
    </Button>
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

  const handleNotificationClick = useCallback(
    (item: PortalNotificationRow) => {
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
    },
    [markNotificationRead, router]
  );

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
                  <InteractiveNotificationItem
                    deleteItem={deleteItem}
                    item={item}
                    key={item.id}
                    onNotificationClick={handleNotificationClick}
                    removeNotification={removeNotification}
                  />
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
          <EmailDeliveryStatusRegion
            coverage={emailDeliverySummaries.coverage}
            summaries={emailDeliverySummaries.summaries}
          />
        </div>
      ) : null}
    </div>
  );
}
