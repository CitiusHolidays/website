"use client";

import { Calendar } from "lucide-react";
import { normalizeDateRange } from "@/lib/portal/periodFilter";

export function PortalDateRangeFilter({ dateRange, setDateRange }) {
  const normalized = normalizeDateRange(dateRange);
  const hasRange = Boolean(normalized.from || normalized.to);

  const update = (field, value) => {
    setDateRange((current) => normalizeDateRange({ ...current, [field]: value || null }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Calendar className="hidden size-4 text-brand-muted sm:block" aria-hidden />
      <label className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-muted">From</span>
        <input
          type="date"
          value={normalized.from || ""}
          onChange={(event) => update("from", event.target.value)}
          className="portal-period-select h-11 rounded-full border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
          aria-label="Filter from date"
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="text-xs font-medium text-brand-muted">To</span>
        <input
          type="date"
          value={normalized.to || ""}
          onChange={(event) => update("to", event.target.value)}
          className="portal-period-select h-11 rounded-full border border-brand-border bg-white px-3 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
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
    </div>
  );
}
