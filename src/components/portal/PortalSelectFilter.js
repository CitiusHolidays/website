"use client";

import { Select } from "@/components/ui/application-select";

export function PortalSelectFilter({ label, value, onChange, options, className = "", id }) {
  const selectId = id || `portal-filter-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const sizeClass =
    className || "min-w-[9rem] max-w-[14rem] w-auto xl:min-w-[10rem] xl:max-w-none xl:w-44";
  return (
    <div className="relative max-w-full shrink-0">
      <label className="sr-only" htmlFor={selectId}>
        {label}
      </label>
      <Select
        aria-label={label}
        className={`portal-period-select h-11 appearance-none rounded-full border border-brand-border bg-white px-3 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 ${sizeClass}`}
        iconClassName="pointer-events-none absolute top-1/2 right-3 m-0 -translate-y-1/2 text-brand-muted/60"
        id={selectId}
        onValueChange={onChange}
        options={options}
        value={value}
      />
    </div>
  );
}
