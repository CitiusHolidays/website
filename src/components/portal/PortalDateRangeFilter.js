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
        <Calendar aria-hidden className="hidden size-4 shrink-0 text-brand-muted sm:block" />
        <label className="flex shrink-0 items-center gap-2" htmlFor={fromId}>
          <span className="font-medium text-brand-muted text-xs">From</span>
          <PortalDateInput
            aria-label="Filter from date"
            id={fromId}
            inputClassName={inputClassName}
            onChange={(iso) => update("from", iso)}
            value={normalized.from || ""}
          />
        </label>
        <label className="relative flex shrink-0 items-center gap-2" htmlFor={toId}>
          <span className="font-medium text-brand-muted text-xs">To</span>
          <PortalDateInput
            aria-describedby={rangeError && inlineError ? `${toId}-error` : undefined}
            aria-invalid={Boolean(rangeError)}
            aria-label="Filter to date"
            id={toId}
            inputClassName={inputClassName}
            onChange={(iso) => update("to", iso)}
            value={normalized.to || ""}
          />
          {rangeError && inlineError ? (
            <span
              className="absolute -bottom-5 left-8 whitespace-nowrap font-medium text-[11px] text-red-600"
              id={`${toId}-error`}
              role="alert"
            >
              {rangeError}
            </span>
          ) : null}
        </label>
        <button
          className={`portal-small-btn shrink-0 whitespace-nowrap ${
            hasRange ? "" : "pointer-events-none invisible"
          }`}
          disabled={!hasRange}
          onClick={() => setDateRange({ from: null, to: null })}
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
