"use client";

import { ArrowUpRight, Bell, Check } from "lucide-react";
import { type Key, useState } from "react";
import { Button } from "@/components/ui/application-button";

interface InboxItem {
  body?: string;
  createdAt?: string;
  entityId?: string;
  entityType?: string;
  id: Key;
  readAt?: string | number | null;
  title?: string;
}

function notificationTime(createdAt?: string) {
  if (!createdAt) {
    return "";
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.valueOf())
    ? ""
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
      }).format(date);
}

export function NotificationInbox<T extends InboxItem>({
  compact = false,
  items,
  loading = false,
  onActivate,
}: {
  compact?: boolean;
  items: T[];
  loading?: boolean;
  onActivate: (item: T) => void;
}) {
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const unread = items.filter((item) => !item.readAt);
  const visible = filter === "unread" ? unread : items;
  const showUnread = () => setFilter("unread");
  const showAll = () => setFilter("all");
  return (
    <div aria-busy={loading}>
      <fieldset
        aria-label="Notification filter"
        className="flex items-center gap-5 border-brand-border border-b px-4 sm:px-5"
      >
        <Button
          aria-pressed={filter === "unread"}
          className={`min-h-11 rounded-none border-b-2 px-0 text-sm ${filter === "unread" ? "border-citius-blue font-semibold text-citius-blue" : "border-transparent text-brand-muted"}`}
          onClick={showUnread}
          type="button"
        >
          Unread{unread.length > 0 ? ` · ${unread.length}` : ""}
        </Button>
        <Button
          aria-pressed={filter === "all"}
          className={`min-h-11 rounded-none border-b-2 px-0 text-sm ${filter === "all" ? "border-citius-blue font-semibold text-citius-blue" : "border-transparent text-brand-muted"}`}
          onClick={showAll}
          type="button"
        >
          All
        </Button>
      </fieldset>
      <div className={compact ? "max-h-96 overflow-y-auto overscroll-contain" : ""}>
        <NotificationInboxContents
          compact={compact}
          hasItems={items.length > 0}
          loading={loading}
          onActivate={onActivate}
          showAll={showAll}
          visible={visible}
        />
      </div>
    </div>
  );
}

function NotificationInboxRow<T extends InboxItem>({
  compact,
  item,
  onActivate,
}: {
  compact: boolean;
  item: T;
  onActivate: (item: T) => void;
}) {
  const activate = () => onActivate(item);
  return (
    <li>
      <Button
        className={`flex w-full items-start gap-3 rounded-none px-4 text-left transition-colors hover:bg-brand-light sm:px-5 ${compact ? "py-4" : "py-5"}`}
        onClick={activate}
        type="button"
      >
        <span
          aria-hidden
          className={`mt-1.5 size-1.5 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-citius-orange"}`}
        />
        <span className="sr-only">{item.readAt ? "Read" : "Unread"}</span>
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm leading-5 ${item.readAt ? "font-medium text-brand-muted" : "font-semibold text-brand-dark"}`}
          >
            {item.title}
          </span>
          <span className="mt-1 block text-brand-muted text-xs leading-5">{item.body}</span>
          {item.createdAt ? (
            <time className="mt-2 block text-[11px] text-brand-muted" dateTime={item.createdAt}>
              {notificationTime(item.createdAt)}
            </time>
          ) : null}
        </span>
        {item.entityId && item.entityType ? (
          <ArrowUpRight aria-hidden className="mt-0.5 shrink-0 text-brand-muted" size={15} />
        ) : null}
      </Button>
    </li>
  );
}

function NotificationInboxContents<T extends InboxItem>({
  compact,
  hasItems,
  loading,
  onActivate,
  showAll,
  visible,
}: {
  compact: boolean;
  hasItems: boolean;
  loading: boolean;
  onActivate: (item: T) => void;
  showAll: () => void;
  visible: T[];
}) {
  if (loading) {
    return (
      <div aria-label="Loading notifications" className="space-y-5 px-5 py-6" role="status">
        {[1, 2, 3].map((row) => (
          <div aria-hidden className="space-y-2 motion-safe:animate-pulse" key={row}>
            <div className="h-4 w-3/4 rounded bg-brand-border" />
            <div className="h-3 w-full rounded bg-brand-light" />
            <div className="h-3 w-1/2 rounded bg-brand-light" />
          </div>
        ))}
        <span className="sr-only">Loading notifications</span>
      </div>
    );
  }
  if (visible.length === 0) {
    return (
      <div className={`flex flex-col items-center px-5 text-center ${compact ? "py-10" : "py-16"}`}>
        {hasItems ? (
          <Check aria-hidden className="mb-3 text-brand-muted" size={22} />
        ) : (
          <Bell aria-hidden className="mb-3 text-brand-muted" size={22} />
        )}
        <p className="font-semibold text-brand-dark text-sm">
          {hasItems ? "You're all caught up" : "No notifications yet"}
        </p>
        <p className="mt-1 max-w-64 text-brand-muted text-xs leading-5">
          {hasItems
            ? "No unread notifications."
            : "Your assignments and workflow updates will appear here."}
        </p>
        {hasItems ? (
          <Button
            className="mt-3 min-h-11 text-citius-blue text-sm"
            onClick={showAll}
            type="button"
          >
            View read updates
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-brand-border">
      {visible.map((item) => (
        <NotificationInboxRow compact={compact} item={item} key={item.id} onActivate={onActivate} />
      ))}
    </ul>
  );
}
