"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { PortalPopover } from "@/components/portal/PortalPopover";
import { Button } from "@/components/ui/application-button";
import { getFilterDateRangeError } from "@/lib/portal/periodFilter";
import { DashboardPeriodPresets, getDashboardPeriodPresetId } from "./DashboardPeriodPresets";
import { formatPeriodLabel } from "./utils";

function dashboardPeriodSummary(dateRange) {
  const presetId = getDashboardPeriodPresetId(dateRange);
  if (presetId === "all") {
    return "All time";
  }
  if (presetId === "30d") {
    return "30d";
  }
  if (presetId === "mtd") {
    return "MTD";
  }
  return formatPeriodLabel(dateRange);
}

export function DashboardPeriodControls({ dateRange, setDateRange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const summary = dashboardPeriodSummary(dateRange);
  const rangeError = getFilterDateRangeError(dateRange);
  const triggerLabel = `Period: ${summary}${rangeError ? ", check dates" : ""}`;

  return (
    <>
      <div
        className="hidden w-full flex-col gap-2.5 lg:flex lg:w-auto lg:items-end"
        data-dashboard-period-desktop
      >
        <DashboardPeriodPresets dateRange={dateRange} setDateRange={setDateRange} />
        <PortalDateRangeFilter compact dateRange={dateRange} setDateRange={setDateRange} />
      </div>
      <div className="flex w-full justify-end lg:hidden" data-dashboard-period-mobile>
        <PortalPopover
          aria-label="dashboard period filters"
          className="portal-shell-surface w-[min(22rem,calc(100vw-2rem))] rounded-2xl"
          contentClassName="space-y-3 p-3"
          onOpenChange={setMobileOpen}
          open={mobileOpen}
          sideOffset={8}
          trigger={(props) => (
            <Button
              {...props}
              aria-label={triggerLabel}
              className={`flex min-h-11 max-w-full items-center gap-2 rounded-full border bg-white px-3.5 text-left text-sm shadow-sm ${
                rangeError ? "border-red-400 text-red-700" : "border-brand-border text-brand-dark"
              }`}
              type="button"
            >
              <span className="font-semibold text-citius-blue">Period</span>
              <span className="min-w-0 truncate text-brand-muted text-xs">{summary}</span>
              <ChevronDown
                aria-hidden
                className={`shrink-0 transition-transform duration-150 ease-[var(--portal-ease-out)] motion-reduce:transition-none ${mobileOpen ? "rotate-180" : ""}`}
                size={16}
              />
            </Button>
          )}
        >
          <DashboardPeriodPresets dateRange={dateRange} setDateRange={setDateRange} />
          <PortalDateRangeFilter
            compact
            dateRange={dateRange}
            inlineError
            setDateRange={setDateRange}
          />
        </PortalPopover>
      </div>
    </>
  );
}
