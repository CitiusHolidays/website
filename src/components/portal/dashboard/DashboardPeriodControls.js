"use client";

import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { DashboardPeriodPresets } from "./DashboardPeriodPresets";

export function DashboardPeriodControls({ dateRange, setDateRange }) {
  return (
    <div className="w-full rounded-xl border border-brand-border/60 bg-white/70 p-3 sm:w-max sm:min-w-[20rem]">
      <div className="flex flex-col gap-2.5">
        <DashboardPeriodPresets dateRange={dateRange} setDateRange={setDateRange} />
        <PortalDateRangeFilter compact dateRange={dateRange} setDateRange={setDateRange} />
      </div>
    </div>
  );
}
