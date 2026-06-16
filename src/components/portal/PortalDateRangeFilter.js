"use client";

import { Calendar } from "lucide-react";
import { useId } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { getFilterDateRangeError, normalizeDateRange } from "@/lib/portal/periodFilter";

const FILTER_INPUT_BASE =
  "portal-period-select !rounded-full !bg-white !w-[9.5rem] !min-w-[9.5rem] !max-w-[9.5rem]";
const FILTER_INPUT_COMPACT = `${FILTER_INPUT_BASE} !h-9`;
const FILTER_INPUT_DEFAULT = `${FILTER_INPUT_BASE} !h-11`;

const TOOLBAR_ROW_CLASS =
  "flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

export function PortalDateRangeFilter({
  dateRange,
  setDateRange,
  compact = false,
  inlineError = false,
}) {
  const fromId = useId();
  const toId = useId();
  const normalized = normalizeDateRange(dateRange);
  const hasRange = Boolean(normalized.from || normalized.to);
  const rangeError = getFilterDateRangeError(normalized);

  const update = (field, value) => {
    setDateRange((current) => normalizeDateRange({ ...current, [field]: value || null }));
  };

  const inputClassName = compact ? FILTER_INPUT_COMPACT : FILTER_INPUT_DEFAULT;

  return (
    <div className={`shrink-0 ${inlineError ? "" : "space-y-1"}`}>
      <div className={TOOLBAR_ROW_CLASS}>
        <Calendar className="hidden size-4 shrink-0 text-brand-muted sm:block" aria-hidden />
        <label htmlFor={fromId} className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-brand-muted">From</span>
          <PortalDateInput
            id={fromId}
            value={normalized.from || ""}
            onChange={(iso) => update("from", iso)}
            inputClassName={inputClassName}
            aria-label="Filter from date"
          />
        </label>
        <label htmlFor={toId} className="relative flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-brand-muted">To</span>
          <PortalDateInput
            id={toId}
            value={normalized.to || ""}
            onChange={(iso) => update("to", iso)}
            inputClassName={inputClassName}
            aria-label="Filter to date"
            aria-invalid={Boolean(rangeError)}
            aria-describedby={rangeError && inlineError ? `${toId}-error` : undefined}
          />
          {rangeError && inlineError ? (
            <span
              id={`${toId}-error`}
              className="absolute -bottom-5 left-8 whitespace-nowrap text-[11px] font-medium text-red-600"
              role="alert"
            >
              {rangeError}
            </span>
          ) : null}
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
      {rangeError && !inlineError ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {rangeError}
        </p>
      ) : null}
    </div>
  );
}
