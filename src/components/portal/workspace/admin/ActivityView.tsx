"use client";

import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type SyntheticEvent, useState } from "react";
import {
  type NotificationHistoryControl,
  NotificationInbox,
} from "@/components/portal/NotificationInbox";
import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { PortalListFilters } from "@/components/portal/PortalListFilters";
import { formatDate } from "@/components/portal/PortalModalForm";
import { PortalSearchField } from "@/components/portal/PortalSearchField";
import { Button } from "@/components/ui/application-button";
import { getViewFilterSearchKeys } from "@/lib/portal/listFilterConfig";
import {
  getNotificationHref,
  NOTIFICATION_INBOX_PAGE_SIZE,
} from "@/lib/portal/notificationTargets";
import { EmptyState, Timeline } from "../portalAdminHelpers";
import type {
  ActivityLogControls,
  ActivityViewProps,
  PortalNotificationRow,
} from "../portalViewTypes";
import { Panel } from "../portalWorkspaceListUi";

type EmailDeliveryResult = NonNullable<ActivityViewProps["emailDeliverySummaries"]>;
type EmailDeliverySummary = EmailDeliveryResult["summaries"][number];

/** "Show older updates" stops here; past this the page says it shows the latest updates only. */
const NOTIFICATION_HISTORY_MAX = NOTIFICATION_INBOX_PAGE_SIZE * 5;
const ACTIVITY_SEARCH_KEYS = getViewFilterSearchKeys("activity");

const EMAIL_STATUS_MEANINGS = {
  accepted: "The email service took the message. Arrival in the person's mailbox isn't confirmed.",
  exhausted:
    "Couldn't be sent after every automatic retry. The update is still in the person's inbox here.",
  inProgress: "Waiting to be sent.",
  retrying: "A temporary problem. It tries again on its own.",
  skipped:
    "Not sent on purpose, for example because the person no longer has access to the record.",
} as const;

function EmailStatusLegend({ summaries }: { summaries: EmailDeliverySummary[] }) {
  const present = {
    exhausted: summaries.some((summary) => summary.exhausted > 0),
    inProgress: summaries.some((summary) => summary.queued + summary.sending > 0),
    retrying: summaries.some((summary) => summary.retrying > 0),
    skipped: summaries.some((summary) => summary.skipped > 0),
  };
  const rows: [string, string][] = [["Accepted", EMAIL_STATUS_MEANINGS.accepted]];
  if (present.inProgress) {
    rows.push(["In progress", EMAIL_STATUS_MEANINGS.inProgress]);
  }
  if (present.retrying) {
    rows.push(["Retrying", EMAIL_STATUS_MEANINGS.retrying]);
  }
  if (present.exhausted) {
    rows.push(["Need attention", EMAIL_STATUS_MEANINGS.exhausted]);
  }
  if (present.skipped) {
    rows.push(["Skipped", EMAIL_STATUS_MEANINGS.skipped]);
  }
  return (
    <div className="mt-4 border-brand-border border-t pt-4">
      <h3 className="font-semibold text-brand-dark text-xs">What the counts mean</h3>
      <dl className="mt-2 space-y-2 text-xs leading-5">
        {rows.map(([label, meaning]) => (
          <div key={label}>
            <dt className="inline font-semibold text-brand-dark">{label}: </dt>
            <dd className="inline text-brand-muted">{meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function needsAttentionFirst(summaries: EmailDeliverySummary[]) {
  return summaries
    .map((summary, index) => ({ index, summary }))
    .sort(
      (a, b) =>
        Number(b.summary.exhausted > 0) - Number(a.summary.exhausted > 0) || a.index - b.index
    )
    .map(({ summary }) => summary);
}

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
        <>
          <div aria-live="polite" className="space-y-3">
            {needsAttentionFirst(summaries).map((summary) => (
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
                    <span className="font-semibold text-brand-dark text-sm">Workflow email</span>
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
          <EmailStatusLegend summaries={summaries} />
        </>
      )}
    </Panel>
  );
}

/**
 * Loads older read history on request by raising the inbox limit one page at a time.
 * The first page comes from the workspace; later pages keep the last result on screen
 * while the next one loads. Nothing here marks an update read.
 */
function useNotificationHistory(baseRows: PortalNotificationRow[], baseLoading: boolean) {
  const [limit, setLimit] = useState(NOTIFICATION_INBOX_PAGE_SIZE);
  const [settled, setSettled] = useState<{ limit: number; rows: PortalNotificationRow[] } | null>(
    null
  );
  const extended = useQuery(
    api.crm.activity.listNotifications,
    limit > NOTIFICATION_INBOX_PAGE_SIZE ? { limit } : "skip"
  );
  if (extended !== undefined && (settled?.rows !== extended || settled.limit !== limit)) {
    setSettled({ limit, rows: extended });
  }
  const usingExtended = limit > NOTIFICATION_INBOX_PAGE_SIZE && settled !== null;
  const rows = usingExtended ? settled.rows : baseRows;
  const rowsLimit = usingExtended ? settled.limit : NOTIFICATION_INBOX_PAGE_SIZE;
  const loadingOlder = limit > NOTIFICATION_INBOX_PAGE_SIZE && extended === undefined;
  const mayHaveOlder = !baseLoading && rows.length >= rowsLimit;
  const loadOlder = () => {
    setLimit((current) =>
      Math.min(
        NOTIFICATION_HISTORY_MAX,
        Math.max(current, rowsLimit) + NOTIFICATION_INBOX_PAGE_SIZE
      )
    );
  };
  const history: NotificationHistoryControl = {
    canLoadOlder: mayHaveOlder && rowsLimit < NOTIFICATION_HISTORY_MAX,
    limitReached: mayHaveOlder && rowsLimit >= NOTIFICATION_HISTORY_MAX,
    loadingOlder,
    loadOlder,
    shownCount: rows.length,
  };
  return { history, rows };
}

function activityLogCountLine({
  canLoadMore,
  filtersActive,
  loadedCount,
  matchCount,
}: {
  canLoadMore: boolean;
  filtersActive: boolean;
  loadedCount: number;
  matchCount: number;
}) {
  if (filtersActive) {
    return `${matchCount} of ${loadedCount} ${canLoadMore ? "loaded " : ""}entries match`;
  }
  if (loadedCount === 1) {
    return "1 entry loaded";
  }
  return canLoadMore ? `${loadedCount} entries loaded` : `All ${loadedCount} entries loaded`;
}

function ActivityLogSection({ log }: { log: ActivityLogControls }) {
  // Filters restored from the address bar must stay visible, so the log opens with them.
  const [open, setOpen] = useState(log.filtersActive);
  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(event.currentTarget.open);
  };
  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => log.setSearch(event.target.value);
  const loadedCount = log.pagination?.loadedCount ?? log.rows.length;
  const canLoadMore = Boolean(log.pagination?.canLoadMore || log.pagination?.isLoadingMore);
  return (
    <details
      className="rounded-2xl border border-brand-border bg-white p-5 xl:col-span-full"
      onToggle={handleToggle}
      open={open}
    >
      <summary className="cursor-pointer text-sm">
        <span className="font-semibold text-brand-dark">Activity log</span>
        <span className="ms-2 text-brand-muted text-xs">
          Everyone's changes across the workspace
        </span>
      </summary>
      {open ? (
        <div className="mt-4">
          <div className="flex min-w-0 flex-wrap items-start gap-2 border-brand-border border-b pb-4">
            <PortalSearchField
              label="Search activity log"
              onChange={handleSearch}
              placeholder="Search"
              value={log.search}
              wrapperClassName="min-w-0 flex-1 sm:max-w-72"
            />
            <PortalDateRangeFilter
              compact
              dateRange={log.dateRange}
              inlineError
              setDateRange={log.setDateRange}
            />
            <PortalListFilters
              config={log.filterConfig}
              onChange={log.setFilter}
              rows={log.filterRows}
              search={log.search}
              searchKeys={ACTIVITY_SEARCH_KEYS}
              values={log.filters}
              view="activity"
            />
            {log.filtersActive ? (
              <Button
                className="portal-small-btn h-11 shrink-0 whitespace-nowrap bg-white"
                onClick={log.clearFilters}
                type="button"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
          <div className="mt-4">
            <Timeline rows={log.rows} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <span
              aria-live="polite"
              className="text-brand-muted text-xs tabular-nums"
              role="status"
            >
              {activityLogCountLine({
                canLoadMore,
                filtersActive: log.filtersActive,
                loadedCount,
                matchCount: log.rows.length,
              })}
            </span>
            {canLoadMore ? (
              <Button
                aria-busy={log.pagination?.isLoadingMore || undefined}
                className="portal-small-btn bg-white"
                disabled={log.pagination?.isLoadingMore}
                onClick={log.pagination?.loadMore}
                type="button"
              >
                {log.pagination?.isLoadingMore ? "Loading more…" : "Load more entries"}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </details>
  );
}

export function ActivityView({
  activityLog,
  notifications,
  notificationsLoading = false,
  emailDeliverySummaries,
  markNotificationRead,
}: ActivityViewProps) {
  const router = useRouter();
  const { history, rows } = useNotificationHistory(notifications, notificationsLoading);

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
        <NotificationInbox
          history={history}
          items={rows}
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
      {activityLog ? <ActivityLogSection log={activityLog} /> : null}
    </div>
  );
}
