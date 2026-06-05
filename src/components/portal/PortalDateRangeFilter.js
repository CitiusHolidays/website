"use client";

import { Calendar } from "lucide-react";
import { useId } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { getFilterDateRangeError, normalizeDateRange } from "@/lib/portal/periodFilter";

const FILTER_INPUT_CLASS = "portal-period-select !rounded-full !bg-white min-w-[9.5rem]";

export function PortalDateRangeFilter({ dateRange, setDateRange, compact = false }) {
  const fromId = useId();
  const toId = useId();
  const normalized = normalizeDateRange(dateRange);
  const hasRange = Boolean(normalized.from || normalized.to);
  const rangeError = getFilterDateRangeError(normalized);

  const update = (field, value) => {
    setDateRange((current) => normalizeDateRange({ ...current, [field]: value || null }));
  };

  return (
    <div
      className={
        compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2"
      }
    >
      <Calendar className="hidden size-4 text-brand-muted sm:block" aria-hidden />
      <label htmlFor={fromId} className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-muted">From</span>
        <PortalDateInput
          id={fromId}
          value={normalized.from || ""}
          onChange={(iso) => update("from", iso)}
          inputClassName={FILTER_INPUT_CLASS}
          aria-label="Filter from date"
        />
      </label>
      <label htmlFor={toId} className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-muted">To</span>
        <PortalDateInput
          id={toId}
          value={normalized.to || ""}
          onChange={(iso) => update("to", iso)}
          inputClassName={FILTER_INPUT_CLASS}
          aria-label="Filter to date"
        />
      </label>
      {hasRange && (
        <button
          type="button"
          className="portal-small-btn"
          onClick={() => setDateRange({ from: null, to: null })}
        >
          Clear dates
        </button>
      )}
      {rangeError && (
        <p className="w-full text-xs font-medium text-red-600" role="alert">
          {rangeError}
        </p>
      )}
    </div>
  );
}
