"use client";

import { Calendar } from "lucide-react";
import { useId } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { getFilterDateRangeError, normalizeDateRange } from "@/lib/portal/periodFilter";

const FILTER_INPUT_CLASS =
  "portal-period-select !h-9 !rounded-full !bg-white !w-[9.5rem] !min-w-[9.5rem] !max-w-[9.5rem]";

export function PortalDateRangeFilter({ dateRange, setDateRange, compact = false }) {
  const fromId = useId();
  const toId = useId();
  const normalized = normalizeDateRange(dateRange);
  const hasRange = Boolean(normalized.from || normalized.to);
  const rangeError = getFilterDateRangeError(normalized);

  const update = (field, value) => {
    setDateRange((current) => normalizeDateRange({ ...current, [field]: value || null }));
  };

  const rowClass = compact
    ? "flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    : "flex flex-wrap items-center gap-2";

  return (
    <div className="space-y-1">
      <div className={rowClass}>
        <Calendar className="hidden size-4 shrink-0 text-brand-muted sm:block" aria-hidden />
        <label htmlFor={fromId} className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-brand-muted">From</span>
          <PortalDateInput
            id={fromId}
            value={normalized.from || ""}
            onChange={(iso) => update("from", iso)}
            inputClassName={FILTER_INPUT_CLASS}
            aria-label="Filter from date"
          />
        </label>
        <label htmlFor={toId} className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-brand-muted">To</span>
          <PortalDateInput
            id={toId}
            value={normalized.to || ""}
            onChange={(iso) => update("to", iso)}
            inputClassName={FILTER_INPUT_CLASS}
            aria-label="Filter to date"
          />
        </label>
        <button
          type="button"
          className={`portal-small-btn shrink-0 whitespace-nowrap ${
            hasRange ? "" : "pointer-events-none invisible"
          }`}
          onClick={() => setDateRange({ from: null, to: null })}
          tabIndex={hasRange ? 0 : -1}
          disabled={!hasRange}
        >
          Clear dates
        </button>
      </div>
      {rangeError ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {rangeError}
        </p>
      ) : null}
    </div>
  );
}
