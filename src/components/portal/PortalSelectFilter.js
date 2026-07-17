"use client";

import { ChevronDown } from "lucide-react";

export function PortalSelectFilter({ label, value, onChange, options, className = "", id }) {
  const selectId = id || `portal-filter-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const sizeClass =
    className ||
    "min-w-[9rem] max-w-[14rem] w-auto xl:min-w-[10rem] xl:max-w-none xl:w-44";
  return (
    <label className="relative max-w-full shrink-0" htmlFor={selectId}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={`portal-period-select h-11 appearance-none rounded-full border border-brand-border bg-white px-3 pr-10 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 ${sizeClass}`}
        id={selectId}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-brand-muted/60"
        size={16}
      />
    </label>
  );
}
