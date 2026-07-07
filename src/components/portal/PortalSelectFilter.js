"use client";

import { ChevronDown } from "lucide-react";

export function PortalSelectFilter({ label, value, onChange, options, className = "sm:w-44", id }) {
  const selectId = id || `portal-filter-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="relative shrink-0" htmlFor={selectId}>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className={`portal-period-select h-11 w-full appearance-none rounded-full border border-brand-border bg-white px-2 pr-10 text-sm outline-none transition focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 ${className}`}
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
