"use client";

import { api } from "@convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import {
  type PaymentReconciliationFilters,
  type PaymentReconciliationRow,
  PaymentReconciliationView,
} from "./PaymentReconciliationView";

const PAGE_SIZE = 100;

export function PaymentReconciliationPanel() {
  const [filters, setFilters] = useState<PaymentReconciliationFilters>({});
  const [selectedProviderEventId, setSelectedProviderEventId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const result = useQuery(api.crm.paymentReconciliation.list, {
    bookingId: filters.bookingId || undefined,
    eventType: filters.eventType || undefined,
    fromReceivedAt: filters.fromReceivedAt,
    includeFixtures: process.env.NODE_ENV !== "production",
    limit: PAGE_SIZE,
    mismatchCategory: filters.mismatchCategory || undefined,
    search: filters.search || undefined,
    status: filters.status || undefined,
    toReceivedAt: filters.toReceivedAt,
    tripId: filters.tripId || undefined,
  });
  const detail = useQuery(
    api.crm.paymentReconciliation.getDetail,
    selectedProviderEventId ? { providerEventId: selectedProviderEventId } : "skip"
  );
  const requestReprocess = useMutation(api.crm.paymentReconciliation.requestReprocess);

  const handleFilterChange = useCallback((nextFilters: PaymentReconciliationFilters) => {
    setFilters(nextFilters);
    setActionMessage(null);
    setActionError(null);
  }, []);

  const handleRequestReprocess = useCallback(
    async (row: PaymentReconciliationRow, reason: string) => {
      setActionMessage(null);
      setActionError(null);
      try {
        await requestReprocess({ providerEventId: row.providerEventId, reason });
        setActionMessage(
          "The event was safely reprocessed and the action was recorded in the audit history."
        );
      } catch (error) {
        setActionError(
          error instanceof Error
            ? error.message
            : "The event could not be reprocessed. No payment status was changed."
        );
      }
    },
    [requestReprocess]
  );

  const handleSelect = useCallback((row: PaymentReconciliationRow) => {
    setSelectedProviderEventId(row.providerEventId);
    setActionMessage(null);
    setActionError(null);
  }, []);

  return (
    <div className="space-y-3">
      {Boolean(actionMessage || actionError) && (
        <p
          aria-live="polite"
          className={
            actionError
              ? "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm"
              : "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm"
          }
          role={actionError ? "alert" : "status"}
        >
          {actionError ?? actionMessage}
        </p>
      )}
      <PaymentReconciliationView
        dataMode={result?.dataMode ?? "production"}
        detail={detail ?? null}
        filters={filters}
        fixtureModeAllowed={result?.fixtureModeAllowed ?? false}
        fixtureRowCount={result?.fixtureRowCount ?? 0}
        hasMore={result?.hasMore ?? false}
        loading={result === undefined}
        onFilterChange={handleFilterChange}
        onRequestReprocess={handleRequestReprocess}
        onSelect={handleSelect}
        productionRowCount={result?.productionRowCount ?? 0}
        rows={result?.rows ?? []}
      />
    </div>
  );
}
