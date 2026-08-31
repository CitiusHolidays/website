"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type MouseEvent, type ReactNode, useState } from "react";
import { formatDate } from "@/components/portal/PortalModalForm";
import { usePortalToast } from "@/components/portal/PortalToast";
import { Button } from "@/components/ui/application-button";
import { getNotificationHref } from "@/lib/portal/notificationTargets";
import { EmptyState, Timeline } from "../portalAdminHelpers";
import type {
  ActivityViewProps,
  EmailDeliveryTriage,
  PortalDeleteHandler,
  PortalNotificationRow,
} from "../portalViewTypes";
import { formatConvexError } from "../portalWorkspaceListHelpers";
import { DeleteButton, Panel } from "../portalWorkspaceListUi";

interface NotificationItemContentProps {
  deleteItem: PortalDeleteHandler;
  item: PortalNotificationRow;
  removeNotification: ActivityViewProps["removeNotification"];
}

type EmailDeliveryResult = NonNullable<ActivityViewProps["emailDeliverySummaries"]>;
type EmailDeliverySummary = EmailDeliveryResult["summaries"][number];
const EMAIL_DELIVERY_FILTERS = [
  { label: "All", value: "all" },
  { label: "Needs attention", value: "attention" },
  { label: "Retrying", value: "retrying" },
] as const;

function EmailDeliveryBadges({
  coverage,
  summary,
}: {
  coverage: EmailDeliveryResult["coverage"];
  summary: EmailDeliverySummary;
}) {
  return (
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
  );
}

function EmailDeliveryTriagePanel({
  onResend,
  resendPending,
  triage,
}: {
  onResend?: (triage: EmailDeliveryTriage) => void;
  resendPending: boolean;
  triage: EmailDeliveryTriage;
}) {
  return (
    <div className="mt-3 rounded-md border border-brand-border bg-white p-3 text-sm">
      <p className="font-semibold text-brand-dark">Privacy-safe event triage</p>
      <p className="mt-1 text-brand-muted text-xs">
        {triage.target.targetEnvironment} · {triage.target.targetDeployment} ·{" "}
        {triage.target.targetRevision}
      </p>
      <p className="mt-1 text-brand-muted text-xs">
        Window: {formatDate(triage.window.startedAt)} to {formatDate(triage.window.endedAt)} ·
        attempts {triage.attempts.minimum}–{triage.attempts.maximum}
      </p>
      {triage.coverage === "partial" ? (
        <p className="mt-2 text-amber-900 text-xs">
          Cause coverage is partial; do not treat these buckets as complete.
        </p>
      ) : null}
      {triage.causes.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {triage.causes.map((cause) => (
            <li key={cause.code}>
              <p className="font-medium text-brand-dark text-xs">
                {cause.count} {cause.code.replaceAll("_", " ")} · {cause.kind} issue
              </p>
              <p className="mt-1 text-brand-muted text-xs">{cause.action}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-brand-muted text-xs">
          No retrying or terminal failure cause is recorded in this window.
        </p>
      )}
      <p className="mt-3 text-brand-muted text-xs">{triage.resendReason}</p>
      {triage.canResend && onResend ? (
        <button
          className="portal-primary-btn mt-3 min-h-11"
          disabled={resendPending}
          onClick={() => onResend(triage)}
          type="button"
        >
          {resendPending ? "Queueing one retry…" : "Retry failed recipients once"}
        </button>
      ) : null}
    </div>
  );
}

function EmailDeliverySummaryCard({
  coverage,
  expanded,
  onResend,
  onToggleEvent,
  resendPending,
  summary,
  triage,
}: {
  coverage: EmailDeliveryResult["coverage"];
  expanded: boolean;
  onResend?: (triage: EmailDeliveryTriage) => void;
  onToggleEvent?: (eventId: string) => void;
  resendPending: boolean;
  summary: EmailDeliverySummary;
  triage?: EmailDeliveryTriage;
}) {
  const hasTriage = summary.exhausted + summary.skipped + summary.retrying > 0;
  let expandedRegion: ReactNode = null;
  if (expanded) {
    expandedRegion =
      triage?.eventId === summary.eventId ? (
        <EmailDeliveryTriagePanel
          onResend={onResend}
          resendPending={resendPending}
          triage={triage}
        />
      ) : (
        <p className="mt-3 text-brand-muted text-xs" role="status">
          Loading authorized delivery triage…
        </p>
      );
  }
  return (
    <div className="rounded-md border border-brand-border bg-brand-light p-3">
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
      <EmailDeliveryBadges coverage={coverage} summary={summary} />
      {onToggleEvent && hasTriage ? (
        <button
          aria-expanded={expanded}
          className="portal-small-btn mt-3 min-h-11"
          onClick={() => onToggleEvent(summary.eventId)}
          type="button"
        >
          {expanded ? "Hide delivery triage" : "Review delivery triage"}
        </button>
      ) : null}
      {expandedRegion}
    </div>
  );
}

export function EmailDeliveryStatusRegion({
  coverage,
  expandedEventId,
  onResend,
  onToggleEvent,
  resendPending = false,
  summaries,
  triage,
}: {
  coverage: EmailDeliveryResult["coverage"];
  expandedEventId?: string | null;
  onResend?: (triage: EmailDeliveryTriage) => void;
  onToggleEvent?: (eventId: string) => void;
  resendPending?: boolean;
  summaries: EmailDeliverySummary[];
  triage?: EmailDeliveryTriage;
}) {
  const [filter, setFilter] = useState<"all" | "attention" | "retrying">("all");
  const visibleSummaries = summaries.filter((summary) => {
    if (filter === "attention") {
      return summary.exhausted + summary.skipped > 0;
    }
    if (filter === "retrying") {
      return summary.retrying > 0;
    }
    return true;
  });
  return (
    <Panel title="Notification email delivery">
      {coverage === "partial" ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
          Delivery totals are still being reconciled. Counts shown are partial.
        </p>
      ) : null}
      {summaries.length === 0 ? (
        <EmptyState
          label={
            coverage === "partial"
              ? "No authorized email delivery events appear in this bounded, incomplete view yet."
              : "No email delivery events yet."
          }
        />
      ) : (
        <div aria-live="polite" className="space-y-3">
          <fieldset className="flex flex-wrap gap-2 border-0 p-0">
            <legend className="sr-only">Email delivery filters</legend>
            {EMAIL_DELIVERY_FILTERS.map(({ label, value }) => (
              <button
                aria-pressed={filter === value}
                className="portal-small-btn min-h-11"
                key={value}
                onClick={() => setFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </fieldset>
          {visibleSummaries.map((summary) => (
            <EmailDeliverySummaryCard
              coverage={coverage}
              expanded={expandedEventId === summary.eventId}
              key={summary.eventId}
              onResend={onResend}
              onToggleEvent={onToggleEvent}
              resendPending={resendPending}
              summary={summary}
              triage={triage}
            />
          ))}
          {visibleSummaries.length === 0 ? (
            <EmptyState label="No email delivery events match this filter." />
          ) : null}
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
  const handleDeleteClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    deleteItem(item.title || "notification", removeNotification, {
      notificationId: String(item.id),
    });
  };
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
  const handleClick = () => onNotificationClick(item);
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
  const toast = usePortalToast();
  const [expandedEmailEventId, setExpandedEmailEventId] = useState<string | null>(null);
  const [emailTriageAt, setEmailTriageAt] = useState(() => Date.now());
  const [resendPendingEventId, setResendPendingEventId] = useState<string | null>(null);
  const emailDeliveryTriage = useQuery(
    api.crm.notificationEmailLedger.getDeliveryTriage,
    expandedEmailEventId ? { at: emailTriageAt, eventId: expandedEmailEventId } : "skip"
  );
  const requestEmailDeliveryResend = useMutation(
    api.crm.notificationEmailLedger.requestDeliveryResend
  );

  const toggleEmailTriage = (eventId: string) => {
    if (expandedEmailEventId === eventId) {
      setExpandedEmailEventId(null);
    } else {
      setEmailTriageAt(Date.now());
      setExpandedEmailEventId(eventId);
    }
  };

  const resendEmailEvent = async (triage: EmailDeliveryTriage) => {
    setResendPendingEventId(triage.eventId);
    try {
      const result = await requestEmailDeliveryResend({
        commandId: crypto.randomUUID(),
        eventId: triage.eventId,
        expectedTargetDeployment: triage.target.targetDeployment,
        expectedTargetEnvironment: triage.target.targetEnvironment,
        expectedTargetRevision: triage.target.targetRevision,
        expectedUpdatedAt: triage.eventUpdatedAt,
      });
      toast.success(
        result.replayed
          ? "That one-event retry was already queued."
          : `${result.queuedRecipientCount} failed ${result.queuedRecipientCount === 1 ? "recipient" : "recipients"} queued with the original delivery identity.`
      );
      setEmailTriageAt(Date.now());
    } catch (error) {
      toast.error(formatConvexError(error, "Could not queue that bounded email retry."));
    }
    setResendPendingEventId(null);
  };

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
            expandedEventId={expandedEmailEventId}
            onResend={resendEmailEvent}
            onToggleEvent={toggleEmailTriage}
            resendPending={resendPendingEventId === expandedEmailEventId}
            summaries={emailDeliverySummaries.summaries}
            triage={emailDeliveryTriage}
          />
        </div>
      ) : null}
    </div>
  );
}
