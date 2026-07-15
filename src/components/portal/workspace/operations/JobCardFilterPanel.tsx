"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { jobCardFilterOptions } from "../portalOperationsHelpers";
import type { PortalJobCardOption } from "../portalViewTypes";

export function JobCardFilterPanel({
  jobCards,
  jobCardFilter,
  setJobCardFilter,
  ariaLabel,
  children = null,
}: {
  ariaLabel: string;
  children?: ReactNode;
  jobCardFilter: string;
  jobCards: PortalJobCardOption[];
  setJobCardFilter: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-brand-border bg-brand-light/50 p-3 sm:flex-row sm:items-end sm:justify-between">
      <label className="relative block min-w-0 sm:w-72">
        <span className="mb-1 block font-semibold text-citius-blue text-xs">Job Card</span>
        <select
          aria-label={ariaLabel}
          className="portal-toolbar-control portal-period-select h-11 w-full appearance-none rounded-lg border border-brand-border bg-white px-3 pr-10 text-sm outline-none transition-[border-color,box-shadow] duration-150 ease-[var(--portal-ease-out)] focus:border-citius-blue focus:ring-2 focus:ring-citius-blue/10"
          onChange={(event) => setJobCardFilter(event.target.value)}
          value={jobCardFilter}
        >
          {jobCardFilterOptions(jobCards).map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 bottom-3 text-brand-muted/60"
          size={16}
        />
      </label>
      {children}
    </div>
  );
}
