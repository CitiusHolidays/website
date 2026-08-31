"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { useTrackedPaginatedQuery as usePaginatedQuery } from "@/lib/portal/trackedConvexSubscriptions";
import { Panel } from "../portalWorkspaceListUi";

type ReconciliationRow = FunctionReturnType<
  typeof api.crm.paymentReconciliation.listInbox
>["page"][number];

export interface PaymentReconciliationContentProps {
  canLoadMore?: boolean;
  error?: string;
  incomplete?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onSelectBooking?: (bookingId: Id<"bookings">) => void;
  rows: ReconciliationRow[];
  selectedBookingId?: Id<"bookings">;
  timelineCanLoadMore?: boolean;
  timelineIsLoading?: boolean;
  timelineIsLoadingMore?: boolean;
  timelineOnLoadMore?: () => void;
  timelineRows?: ReconciliationRow[];
}

function eventAmount(row: ReconciliationRow) {
  if (row.amount === null || row.currency === null) {
    return "Amount unavailable";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      currency: row.currency,
      style: "currency",
    }).format(row.amount / 100);
  } catch {
    return `${row.currency} ${row.amount}`;
  }
}

function EventList({
  empty,
  onSelectBooking,
  rows,
}: {
  empty: string;
  onSelectBooking?: (bookingId: Id<"bookings">) => void;
  rows: ReconciliationRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-brand-muted text-sm">{empty}</p>;
  }
  return (
    <ol className="space-y-3">
      {rows.map((row) => (
        <li className="rounded-xl border border-brand-border/70 p-4" key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-brand-ink text-sm">{row.eventType}</p>
              <p className="mt-1 text-brand-muted text-xs">
                {eventAmount(row)} · {new Date(row.createdAt).toLocaleString()}
              </p>
              <p className="mt-2 text-brand-muted text-sm">
                {row.reconciliationReason ?? row.reason}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 text-xs">
              {row.outcome.replaceAll("_", " ")}
            </span>
          </div>
          {row.booking && onSelectBooking ? (
            <button
              className="mt-3 rounded-lg border border-brand-border px-3 py-1.5 font-semibold text-brand-ink text-xs hover:bg-brand-light"
              onClick={() => {
                if (row.booking) {
                  onSelectBooking(row.booking.id);
                }
              }}
              type="button"
            >
              View booking timeline
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function LoadMoreButton({
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: {
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  return canLoadMore ? (
    <button
      aria-busy={isLoadingMore}
      className="mt-4 rounded-lg border border-brand-border px-3 py-2 font-semibold text-brand-ink text-sm disabled:opacity-60"
      disabled={isLoadingMore}
      onClick={onLoadMore}
      type="button"
    >
      {isLoadingMore ? "Loading…" : "Load more"}
    </button>
  ) : null;
}

export function PaymentReconciliationContent({
  canLoadMore,
  error,
  incomplete = false,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onSelectBooking,
  rows,
  selectedBookingId,
  timelineCanLoadMore,
  timelineIsLoading,
  timelineIsLoadingMore,
  timelineOnLoadMore,
  timelineRows = [],
}: PaymentReconciliationContentProps) {
  if (error) {
    return (
      <Panel title="Payment reconciliation">
        <p className="text-red-700 text-sm" role="alert">
          {error}
        </p>
      </Panel>
    );
  }
  return (
    <Panel title="Payment reconciliation">
      {isLoading ? (
        <p aria-live="polite" className="text-brand-muted text-sm">
          Loading payment exceptions…
        </p>
      ) : (
        <EventList
          empty={
            incomplete
              ? "No payment exceptions in the bounded records checked yet. Load more to continue."
              : "No payment exceptions need review."
          }
          onSelectBooking={onSelectBooking}
          rows={rows}
        />
      )}
      <LoadMoreButton
        canLoadMore={canLoadMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={onLoadMore}
      />
      {selectedBookingId ? (
        <section className="mt-6 border-brand-border border-t pt-5">
          <h3 className="font-semibold text-brand-ink text-sm">Booking payment timeline</h3>
          <div className="mt-3">
            {timelineIsLoading ? (
              <p aria-live="polite" className="text-brand-muted text-sm">
                Loading booking timeline…
              </p>
            ) : (
              <EventList empty="No payment events recorded for this booking." rows={timelineRows} />
            )}
          </div>
          <LoadMoreButton
            canLoadMore={timelineCanLoadMore}
            isLoadingMore={timelineIsLoadingMore}
            onLoadMore={timelineOnLoadMore}
          />
        </section>
      ) : null}
    </Panel>
  );
}

function PaymentReconciliationData() {
  const [selectedBookingId, setSelectedBookingId] = useState<Id<"bookings">>();
  const inbox = usePaginatedQuery(
    api.crm.paymentReconciliation.listInbox,
    {},
    {
      initialNumItems: 25,
    }
  );
  const timeline = usePaginatedQuery(
    api.crm.paymentReconciliation.getTimeline,
    selectedBookingId ? { bookingId: selectedBookingId } : "skip",
    { initialNumItems: 25 }
  );
  return (
    <PaymentReconciliationContent
      canLoadMore={inbox.status === "CanLoadMore"}
      incomplete={inbox.status === "CanLoadMore" || inbox.status === "LoadingMore"}
      isLoading={inbox.status === "LoadingFirstPage"}
      isLoadingMore={inbox.status === "LoadingMore"}
      onLoadMore={() => inbox.loadMore(25)}
      onSelectBooking={setSelectedBookingId}
      rows={inbox.results}
      selectedBookingId={selectedBookingId}
      timelineCanLoadMore={timeline.status === "CanLoadMore"}
      timelineIsLoading={timeline.status === "LoadingFirstPage"}
      timelineIsLoadingMore={timeline.status === "LoadingMore"}
      timelineOnLoadMore={() => timeline.loadMore(25)}
      timelineRows={timeline.results}
    />
  );
}

class ReconciliationErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // The portal request logger owns diagnostic details; this surface stays non-sensitive.
  }

  render() {
    return this.state.failed ? (
      <PaymentReconciliationContent
        error="Payment reconciliation could not be loaded. Please try again."
        rows={[]}
      />
    ) : (
      this.props.children
    );
  }
}

export function PaymentReconciliationPanel() {
  return (
    <ReconciliationErrorBoundary>
      <PaymentReconciliationData />
    </ReconciliationErrorBoundary>
  );
}
