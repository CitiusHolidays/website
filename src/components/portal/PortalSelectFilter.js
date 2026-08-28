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
        className={`portal-period-select h-11 appearance-none rounded-xl border border-brand-border bg-white px-3 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10 ${sizeClass}`}
        id={selectId}
        onValueChange={onChange}
        options={options}
        value={value}
      />
    </div>
  );
}
