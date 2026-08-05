"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";

export type PaymentReconciliationOutcome =
  | "received"
  | "processed"
  | "ignored"
  | "unmatched"
  | "failed";

export type PaymentReconciliationMismatch =
  | "none"
  | "unmatched_provider_event"
  | "missing_provider_event"
  | "amount_currency_mismatch"
  | "status_mismatch"
  | "duplicate_replayed_event"
  | "processing_failure"
  | "stale_pending_state";

export type PaymentReconciliationRow = {
  amount: number | null;
  bookingId: string | null;
  bookingStatus: string | null;
  currency: string;
  errorMessage: string | null;
  eventType: string;
  expectedStatus: string | null;
  id: string;
  isFixture: boolean;
  mismatchCategory: PaymentReconciliationMismatch;
  orderId: string;
  outcome: PaymentReconciliationOutcome;
  paymentId: string | null;
  processedAt: string | null;
  provider: string;
  providerEventId: string;
  receivedAt: string;
  retryCount: number;
  source: "webhook" | "checkout" | "fixture" | "manual";
  statusAfter: string | null;
  statusBefore: string | null;
  tripId: string | null;
  updatedAt: string;
};

export type PaymentReconciliationAudit = {
  action: "reprocess_requested" | "reprocess_completed" | "reprocess_failed";
  actorAuthUserId: string;
  actorName: string;
  afterOutcome: string | null;
  beforeOutcome: string | null;
  createdAt: string;
  reason: string;
  result: string | null;
};

export type PaymentReconciliationDetail = {
  audits: PaymentReconciliationAudit[];
  event: PaymentReconciliationRow | null;
  history: PaymentReconciliationRow[];
};

export type PaymentReconciliationFilters = {
  bookingId?: string;
  eventType?: string;
  fromReceivedAt?: number;
  mismatchCategory?: PaymentReconciliationMismatch | "";
  search?: string;
  status?: PaymentReconciliationOutcome | "";
  toReceivedAt?: number;
  tripId?: string;
};

export type PaymentReconciliationViewProps = {
  dataMode?: "production" | "fixtures";
  detail?: PaymentReconciliationDetail | null;
  fixtureModeAllowed?: boolean;
  fixtureRowCount?: number;
  filters?: PaymentReconciliationFilters;
  hasMore?: boolean;
  loading?: boolean;
  onFilterChange?: (filters: PaymentReconciliationFilters) => void;
  onRequestReprocess?: (row: PaymentReconciliationRow, reason: string) => Promise<unknown>;
  onSelect?: (row: PaymentReconciliationRow) => void;
  productionRowCount?: number;
  rows?: PaymentReconciliationRow[];
};

const mismatchLabels: Record<PaymentReconciliationMismatch, string> = {
  amount_currency_mismatch: "Amount or currency mismatch",
  duplicate_replayed_event: "Duplicate or replayed event",
  missing_provider_event: "Missing provider event",
  none: "No mismatch",
  processing_failure: "Processing failure",
  stale_pending_state: "Stale pending payment",
  status_mismatch: "Status mismatch",
  unmatched_provider_event: "Unmatched provider event",
};

const outcomeLabels: Record<PaymentReconciliationOutcome, string> = {
  failed: "Failed",
  ignored: "Ignored",
  processed: "Processed",
  received: "Received",
  unmatched: "Needs review",
};

export function paymentMismatchLabel(mismatch: PaymentReconciliationMismatch) {
  return mismatchLabels[mismatch];
}

export function paymentOutcomeLabel(outcome: PaymentReconciliationOutcome) {
  return outcomeLabels[outcome];
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "—"
    : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function formatAmount(row: PaymentReconciliationRow) {
  if (row.amount === null) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    currency: row.currency || "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(row.amount);
}

function mismatchTone(mismatch: PaymentReconciliationMismatch) {
  return mismatch === "none"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

function outcomeTone(outcome: PaymentReconciliationOutcome) {
  if (outcome === "processed") {
    return "text-emerald-700";
  }
  if (outcome === "failed" || outcome === "unmatched") {
    return "text-rose-700";
  }
  return "text-amber-700";
}

function dateInputValue(value?: number) {
  if (value === undefined) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function dateInputIsoValue(value?: number) {
  const displayValue = dateInputValue(value);
  return displayValue;
}

interface PaymentReconciliationResultsProps {
  hasActiveFilter: boolean;
  hasMore: boolean;
  loading: boolean;
  onSelect: (row: PaymentReconciliationRow) => void;
  productionRowCount: number;
  rows: PaymentReconciliationRow[];
}

function PaymentReconciliationResults({
  hasActiveFilter,
  hasMore,
  loading,
  onSelect,
  productionRowCount,
  rows,
}: PaymentReconciliationResultsProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-brand-border bg-white p-10 text-center text-brand-muted text-sm">
        Loading payment events…
      </div>
    );
  }

  if (rows.length === 0) {
    const hasFilteredRows = hasActiveFilter && productionRowCount > 0;
    return (
      <div className="rounded-2xl border border-brand-border border-dashed bg-brand-surface/50 p-10 text-center">
        <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-600" />
        <h2 className="mt-3 font-semibold text-brand-ink">
          {hasFilteredRows
            ? "No payment events match these filters"
            : "No production payment events yet"}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-brand-muted text-sm">
          {hasFilteredRows
            ? "Try widening the filters or clearing the search to see the available reconciliation rows."
            : "This is an honest empty state. When Razorpay goes live, signed provider events will appear here automatically."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-brand-border border-b bg-brand-surface text-brand-muted text-xs uppercase tracking-[0.12em]">
            <tr>
              <th className="px-4 py-3 font-medium" scope="col">
                Event
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Booking / order
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Amount
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                State
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                Reconciliation
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {rows.map((row) => (
              <tr className="align-top" key={row.id}>
                <td className="px-4 py-4">
                  <button
                    className="text-left font-medium text-brand-ink hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary"
                    onClick={() => onSelect(row)}
                    type="button"
                  >
                    <span className="block">{row.eventType}</span>
                    <span className="mt-1 block text-brand-muted text-xs">
                      {formatTimestamp(row.receivedAt)}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-4 text-brand-muted">
                  <span className="block font-mono text-xs">{row.orderId || "No order match"}</span>
                  <span className="mt-1 block font-mono text-xs">
                    {row.paymentId || "No payment ID"}
                  </span>
                </td>
                <td className="px-4 py-4 font-medium text-brand-ink">{formatAmount(row)}</td>
                <td className={`px-4 py-4 font-medium ${outcomeTone(row.outcome)}`}>
                  {paymentOutcomeLabel(row.outcome)}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${mismatchTone(row.mismatchCategory)}`}
                  >
                    {Boolean(row.isFixture) && (
                      <FlaskConical aria-label="Test fixture" className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {paymentMismatchLabel(row.mismatchCategory)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    aria-label={`Open ${row.providerEventId}`}
                    className="rounded-full p-2 text-brand-muted hover:bg-brand-surface hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-primary"
                    onClick={() => onSelect(row)}
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Boolean(hasMore) && (
        <p className="border-brand-border border-t px-4 py-3 text-brand-muted text-xs">
          More events are available. Keep the list bounded with the existing portal pagination seam.
        </p>
      )}
    </div>
  );
}

export function PaymentReconciliationView({
  dataMode = "production",
  detail = null,
  fixtureModeAllowed = false,
  fixtureRowCount = 0,
  filters = {},
  hasMore = false,
  loading = false,
  onFilterChange,
  onRequestReprocess,
  onSelect,
  productionRowCount = 0,
  rows = [],
}: PaymentReconciliationViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    detail?.event ? detail.event.id : null
  );
  const [reason, setReason] = useState("");
  const selectedRow = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? detail?.event ?? null,
    [detail?.event, rows, selectedId]
  );

  const selectRow = (row: PaymentReconciliationRow) => {
    setSelectedId(row.id);
    setReason("");
    onSelect?.(row);
  };

  const updateFilter = (patch: PaymentReconciliationFilters) => {
    onFilterChange?.({ ...filters, ...patch });
  };
  const hasActiveFilter = Object.values(filters).some(
    (value) => value !== undefined && value !== ""
  );
  const canRequestReprocess = Boolean(
    onRequestReprocess &&
      selectedRow &&
      !selectedRow.isFixture &&
      selectedRow.source !== "manual" &&
      !selectedRow.id.startsWith("legacy:") &&
      !selectedRow.id.startsWith("missing:") &&
      selectedRow.mismatchCategory !== "none"
  );
  const submitReprocess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(onRequestReprocess && selectedRow) || reason.trim().length < 5) {
      return;
    }
    await onRequestReprocess(selectedRow, reason.trim());
  };

  return (
    <section aria-labelledby="payment-reconciliation-title" className="space-y-5">
      <header className="flex flex-col gap-4 rounded-2xl border border-brand-border bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand-muted text-xs uppercase tracking-[0.18em]">
            <CircleDollarSign aria-hidden="true" className="h-4 w-4" />
            Accounts finance control
          </div>
          <h1
            className="mt-2 font-semibold text-2xl text-brand-ink"
            id="payment-reconciliation-title"
          >
            Payment reconciliation
          </h1>
          <p className="mt-1 max-w-2xl text-brand-muted text-sm">
            Compare trusted provider events with the booking payment state. Reconciliation can
            request a safe transition, but never edits a payment status directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1.5 text-brand-muted">
            {productionRowCount} production {productionRowCount === 1 ? "row" : "rows"}
          </span>
          {dataMode === "fixtures" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-800">
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              {fixtureRowCount} test fixtures
            </span>
          )}
        </div>
      </header>

      {Boolean(fixtureModeAllowed) && (
        <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 text-sm">
          <FlaskConical aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Test fixtures are enabled for this non-production environment. They are labelled and
            cannot be reprocessed as customer payments.
          </p>
        </div>
      )}

      <div className="grid gap-3 rounded-2xl border border-brand-border bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Search order, payment, booking</span>
          <input
            className="portal-input w-full"
            onChange={(event) => updateFilter({ search: event.target.value })}
            placeholder="Search IDs"
            value={filters.search ?? ""}
          />
        </label>
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Booking ID</span>
          <input
            className="portal-input w-full"
            onChange={(event) => updateFilter({ bookingId: event.target.value })}
            placeholder="Convex booking ID"
            value={filters.bookingId ?? ""}
          />
        </label>
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Trip ID</span>
          <input
            className="portal-input w-full"
            onChange={(event) => updateFilter({ tripId: event.target.value })}
            placeholder="Convex trip ID"
            value={filters.tripId ?? ""}
          />
        </label>
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Reconciliation</span>
          <select
            className="portal-input w-full"
            onChange={(event) =>
              updateFilter({
                mismatchCategory: event.target.value as PaymentReconciliationMismatch | "",
              })
            }
            value={filters.mismatchCategory ?? ""}
          >
            <option value="">All mismatch categories</option>
            {Object.entries(mismatchLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Payment state</span>
          <select
            className="portal-input w-full"
            onChange={(event) =>
              updateFilter({ status: event.target.value as PaymentReconciliationOutcome | "" })
            }
            value={filters.status ?? ""}
          >
            <option value="">All states</option>
            {Object.entries(outcomeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label
          className="space-y-1 text-brand-muted text-xs"
          htmlFor="payment-reconciliation-received-from"
        >
          <span>Received from</span>
          <PortalDateInput
            aria-label="Received from"
            id="payment-reconciliation-received-from"
            name="receivedFrom"
            onChange={(value: string) =>
              updateFilter({
                fromReceivedAt: value ? Date.parse(`${value}T00:00:00.000Z`) : undefined,
              })
            }
            value={dateInputIsoValue(filters.fromReceivedAt)}
          />
        </label>
        <label
          className="space-y-1 text-brand-muted text-xs"
          htmlFor="payment-reconciliation-received-to"
        >
          <span>Received to</span>
          <PortalDateInput
            aria-label="Received to"
            id="payment-reconciliation-received-to"
            name="receivedTo"
            onChange={(value: string) =>
              updateFilter({
                toReceivedAt: value ? Date.parse(`${value}T23:59:59.999Z`) : undefined,
              })
            }
            value={dateInputIsoValue(filters.toReceivedAt)}
          />
        </label>
        <label className="space-y-1 text-brand-muted text-xs">
          <span>Provider event type</span>
          <select
            className="portal-input w-full"
            onChange={(event) => updateFilter({ eventType: event.target.value })}
            value={filters.eventType ?? ""}
          >
            <option value="">All event types</option>
            <option value="payment.authorized">Payment authorized</option>
            <option value="payment.captured">Payment captured</option>
            <option value="payment.failed">Payment failed</option>
            <option value="refund.created">Refund created</option>
          </select>
        </label>
      </div>

      <PaymentReconciliationResults
        hasActiveFilter={hasActiveFilter}
        hasMore={hasMore}
        loading={loading}
        onSelect={selectRow}
        productionRowCount={productionRowCount}
        rows={rows}
      />

      {selectedRow && (
        <aside
          aria-label="Payment event detail"
          className="rounded-2xl border border-brand-border bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-brand-muted text-xs uppercase tracking-[0.14em]">
                Reconciliation detail
              </p>
              <h2 className="mt-1 font-semibold text-brand-ink text-lg">{selectedRow.eventType}</h2>
              <p className="mt-1 break-all font-mono text-brand-muted text-xs">
                {selectedRow.providerEventId}
              </p>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs ${mismatchTone(selectedRow.mismatchCategory)}`}
            >
              {paymentMismatchLabel(selectedRow.mismatchCategory)}
            </span>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-brand-muted text-xs">Provider</dt>
              <dd className="mt-1 font-medium text-brand-ink">{selectedRow.provider}</dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Amount / currency</dt>
              <dd className="mt-1 font-medium text-brand-ink">
                {formatAmount(selectedRow)} {selectedRow.currency || ""}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Order ID</dt>
              <dd className="mt-1 break-all font-mono text-brand-ink text-xs">
                {selectedRow.orderId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Payment ID</dt>
              <dd className="mt-1 break-all font-mono text-brand-ink text-xs">
                {selectedRow.paymentId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Provider state</dt>
              <dd className="mt-1 font-medium text-brand-ink">{selectedRow.outcome}</dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Booking state</dt>
              <dd className="mt-1 font-medium text-brand-ink">
                {selectedRow.bookingStatus ?? "Not matched"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Expected state</dt>
              <dd className="mt-1 font-medium text-brand-ink">
                {selectedRow.expectedStatus ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Updated</dt>
              <dd className="mt-1 font-medium text-brand-ink">
                {formatTimestamp(selectedRow.updatedAt)}
              </dd>
            </div>
          </dl>
          {Boolean(selectedRow.errorMessage) && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-rose-800 text-sm">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              {selectedRow.errorMessage}
            </p>
          )}
          {detail && detail.audits.length > 0 && (
            <div className="mt-5 border-brand-border border-t pt-4">
              <h3 className="font-medium text-brand-ink text-sm">Audit history</h3>
              <ul className="mt-3 space-y-3 text-brand-muted text-xs">
                {detail.audits.map((audit) => (
                  <li className="space-y-1" key={`${audit.action}-${audit.createdAt}`}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        <strong className="text-brand-ink">
                          {audit.action.replaceAll("_", " ")}
                        </strong>{" "}
                        · {audit.actorName}
                      </span>
                      <time dateTime={audit.createdAt}>{formatTimestamp(audit.createdAt)}</time>
                    </div>
                    <p>{audit.reason}</p>
                    {Boolean(audit.beforeOutcome || audit.afterOutcome || audit.result) && (
                      <p className="text-slate-500">
                        {audit.beforeOutcome || "—"} → {audit.afterOutcome || "—"}
                        {audit.result ? ` · ${audit.result}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail && detail.history.length > 0 && (
            <div className="mt-5 border-brand-border border-t pt-4">
              <h3 className="font-medium text-brand-ink text-sm">Provider event history</h3>
              <ol className="mt-3 space-y-3 text-brand-muted text-xs">
                {detail.history.map((historyRow) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-2"
                    key={historyRow.id}
                  >
                    <span>
                      <strong className="text-brand-ink">{historyRow.eventType}</strong>
                      <span className="ml-2">{paymentOutcomeLabel(historyRow.outcome)}</span>
                    </span>
                    <time dateTime={historyRow.receivedAt}>
                      {formatTimestamp(historyRow.receivedAt)}
                    </time>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {canRequestReprocess && (
            <form
              className="mt-5 flex flex-col gap-3 border-brand-border border-t pt-4 sm:flex-row sm:items-end"
              onSubmit={submitReprocess}
            >
              <label className="min-w-0 flex-1 space-y-1 text-brand-muted text-xs">
                <span>Reason for safe reprocess</span>
                <input
                  className="portal-input w-full"
                  minLength={5}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Explain what was checked"
                  required
                  value={reason}
                />
              </label>
              <button
                className="portal-small-btn inline-flex items-center justify-center gap-2"
                disabled={reason.trim().length < 5}
                type="submit"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                Request safe reprocess
              </button>
            </form>
          )}
        </aside>
      )}
    </section>
  );
}
