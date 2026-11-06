"use client";

import { ArrowUpRight, Bell, Check } from "lucide-react";
import { type Key, useId, useState } from "react";
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

/** Older read history for the Notifications page. The bell never passes this. */
export interface NotificationHistoryControl {
  canLoadOlder: boolean;
  limitReached: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  shownCount: number;
}

interface InboxDayGroup<T> {
  items: T[];
  key: string;
  label: string;
}

const UNDATED_GROUP_KEY = "undated";

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  weekday: "short",
});

function parseCreatedAt(createdAt?: string) {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayLabel(date: Date, now: Date) {
  const today = localDayKey(now);
  const yesterday = localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const key = localDayKey(date);
  if (key === today) {
    return "Today";
  }
  if (key === yesterday) {
    return "Yesterday";
  }
  const day = dayFormat.format(date);
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
}

/** Groups newest-first inbox items by the reader's local calendar day, keeping server order. */
function groupInboxItemsByDay<T extends InboxItem>(items: T[], now: Date) {
  const groups: InboxDayGroup<T>[] = [];
  const byKey = new Map<string, InboxDayGroup<T>>();
  for (const item of items) {
    const date = parseCreatedAt(item.createdAt);
    const key = date ? localDayKey(date) : UNDATED_GROUP_KEY;
    let group = byKey.get(key);
    if (!group) {
      group = { items: [], key, label: date ? dayLabel(date, now) : "Earlier" };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function NotificationInbox<T extends InboxItem>({
  compact = false,
  history,
  items,
  loading = false,
  now,
  onActivate,
}: {
  compact?: boolean;
  history?: NotificationHistoryControl;
  items: T[];
  loading?: boolean;
  /** Fixed reference time for tests; defaults to the time the inbox mounted. */
  now?: number;
  onActivate: (item: T) => void;
}) {
  const [filter, setFilter] = useState<"unread" | "all">("unread");
  const [mountedAt] = useState(() => Date.now());
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
          now={now ?? mountedAt}
          onActivate={onActivate}
          showAll={showAll}
          visible={visible}
        />
        {history && filter === "all" && !loading && visible.length > 0 ? (
          <NotificationHistoryFooter history={history} />
        ) : null}
      </div>
    </div>
  );
}

function NotificationHistoryFooter({ history }: { history: NotificationHistoryControl }) {
  if (!(history.canLoadOlder || history.loadingOlder || history.limitReached)) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-brand-border border-t px-4 py-4 sm:px-5">
      <span aria-live="polite" className="text-brand-muted text-xs tabular-nums" role="status">
        {history.limitReached
          ? `Showing the latest ${history.shownCount} updates.`
          : `${history.shownCount} updates shown`}
      </span>
      {history.canLoadOlder || history.loadingOlder ? (
        <Button
          aria-busy={history.loadingOlder || undefined}
          className="portal-small-btn bg-white"
          disabled={history.loadingOlder}
          onClick={history.loadOlder}
          type="button"
        >
          {history.loadingOlder ? "Loading older updates…" : "Show older updates"}
        </Button>
      ) : null}
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
  const createdAt = parseCreatedAt(item.createdAt);
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
          {createdAt ? (
            <time
              className="mt-2 block text-[11px] text-brand-muted tabular-nums"
              dateTime={item.createdAt}
            >
              {timeFormat.format(createdAt)}
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

function NotificationInboxDayGroups<T extends InboxItem>({
  compact,
  now,
  onActivate,
  visible,
}: {
  compact: boolean;
  now: number;
  onActivate: (item: T) => void;
  visible: T[];
}) {
  const idPrefix = useId();
  const groups = groupInboxItemsByDay(visible, new Date(now));
  return (
    <div>
      {groups.map((group, index) => {
        const headingId = `${idPrefix}-${group.key}`;
        return (
          <div className={index > 0 ? "border-brand-border border-t" : ""} key={group.key}>
            <h3
              className={`px-4 font-semibold text-brand-muted text-xs sm:px-5 ${compact ? "pt-4" : "pt-5"}`}
              id={headingId}
            >
              {group.label}
            </h3>
            <ul aria-labelledby={headingId} className="divide-y divide-brand-border">
              {group.items.map((item) => (
                <NotificationInboxRow
                  compact={compact}
                  item={item}
                  key={item.id}
                  onActivate={onActivate}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function NotificationInboxContents<T extends InboxItem>({
  compact,
  hasItems,
  loading,
  now,
  onActivate,
  showAll,
  visible,
}: {
  compact: boolean;
  hasItems: boolean;
  loading: boolean;
  now: number;
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
    <NotificationInboxDayGroups
      compact={compact}
      now={now}
      onActivate={onActivate}
      visible={visible}
    />
  );
}
