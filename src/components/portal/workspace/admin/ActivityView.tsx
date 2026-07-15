"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { EmptyState, Timeline } from "../portalAdminHelpers";
import type { ActivityViewProps, PortalNotificationRow } from "../portalViewTypes";
import { DeleteButton, Panel } from "../portalWorkspaceListUi";

export function ActivityView({
  activity,
  notifications,
  deleteItem,
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
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel title="Activity log">
        <Timeline rows={activity} />
      </Panel>
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

              return (
                <div
                  className={itemClassName}
                  {...(isInteractive
                    ? {
                        onClick: () => handleNotificationClick(item),
                        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleNotificationClick(item);
                          }
                        },
                        role: "button",
                        tabIndex: 0,
                      }
                    : {})}
                  key={item.id}
                >
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
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
