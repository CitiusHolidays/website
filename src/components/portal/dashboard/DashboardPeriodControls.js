"use client";

import { PortalDateRangeFilter } from "@/components/portal/PortalDateRangeFilter";
import { DashboardPeriodPresets } from "./DashboardPeriodPresets";

export function DashboardPeriodControls({ dateRange, setDateRange }) {
  return (
    <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:items-end">
      <DashboardPeriodPresets dateRange={dateRange} setDateRange={setDateRange} />
      <PortalDateRangeFilter compact dateRange={dateRange} setDateRange={setDateRange} />
    </div>
  );
}
