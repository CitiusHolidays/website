"use client";

import { Calendar } from "lucide-react";
import { useCallback, useId } from "react";
import { PortalDateInput } from "@/components/portal/PortalDateInput";
import { getFilterDateRangeError, normalizeDateRange } from "@/lib/portal/periodFilter";

const FILTER_INPUT_BASE =
  "portal-period-select !rounded-full !bg-white !w-[min(9.5rem,calc(100vw-6rem))] !min-w-0 !max-w-[9.5rem]";
const FILTER_INPUT_COMPACT = `${FILTER_INPUT_BASE} !h-9`;
const FILTER_INPUT_DEFAULT = `${FILTER_INPUT_BASE} !h-11`;

const TOOLBAR_ROW_CLASS = "grid grid-cols-1 items-start gap-2 sm:flex sm:flex-wrap sm:items-start";

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

  const updateFrom = useCallback(
    (from) => setDateRange((current) => normalizeDateRange({ ...current, from: from || null })),
    [setDateRange]
  );
  const updateTo = useCallback(
    (to) => setDateRange((current) => normalizeDateRange({ ...current, to: to || null })),
    [setDateRange]
  );
  const clearRange = useCallback(() => setDateRange({ from: null, to: null }), [setDateRange]);

  const inputClassName = compact ? FILTER_INPUT_COMPACT : FILTER_INPUT_DEFAULT;

  return (
    <div className={`min-w-0 max-w-full ${inlineError ? "w-full sm:w-auto" : "space-y-1"}`}>
      <div className={TOOLBAR_ROW_CLASS}>
        <Calendar aria-hidden className="hidden size-4 shrink-0 text-brand-muted sm:block" />
        <label className="flex min-w-0 items-center gap-2" htmlFor={fromId}>
          <span className="font-medium text-brand-muted text-xs">From</span>
          <PortalDateInput
            aria-label="Filter from date"
            id={fromId}
            inputClassName={inputClassName}
            onChange={updateFrom}
            value={normalized.from || ""}
          />
        </label>
        <div className="min-w-0">
          <label className="flex min-w-0 items-center gap-2" htmlFor={toId}>
            <span className="font-medium text-brand-muted text-xs">To</span>
            <PortalDateInput
              aria-describedby={rangeError && inlineError ? `${toId}-error` : undefined}
              aria-invalid={Boolean(rangeError)}
              aria-label="Filter to date"
              id={toId}
              inputClassName={inputClassName}
              onChange={updateTo}
              value={normalized.to || ""}
            />
          </label>
          {rangeError && inlineError ? (
            <p
              className="mt-1 max-w-full font-medium text-[11px] text-red-600 sm:ml-6"
              id={`${toId}-error`}
              role="alert"
            >
              {rangeError}
            </p>
          ) : null}
        </div>
        <button
          className={`portal-small-btn justify-self-start whitespace-nowrap sm:shrink-0 ${
            hasRange ? "" : "pointer-events-none invisible"
          }`}
          disabled={!hasRange}
          onClick={clearRange}
          tabIndex={hasRange ? 0 : -1}
          type="button"
        >
          Clear dates
        </button>
      </div>
      {rangeError && !inlineError ? (
        <p className="font-medium text-red-600 text-xs" role="alert">
          {rangeError}
        </p>
      ) : null}
    </div>
  );
}
