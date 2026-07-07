"use client";

import { buildKpiHref } from "@/lib/portal/dashboardLinks";
import { DashboardSectionHeading } from "./DashboardPanel";
import { DashboardStatCard } from "./DashboardStatCard";

export function DashboardStatGrid({ metrics, featuredLabel, dateRange }) {
  if (!metrics?.length) {
    return null;
  }
  const visibleMetrics = metrics.slice(0, 5);

  return (
    <section>
      <DashboardSectionHeading className="sr-only" title="Overview" />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {visibleMetrics.map(({ label, value, Icon, trend }) => (
          <DashboardStatCard
            featured={label === featuredLabel}
            href={buildKpiHref(label, dateRange)}
            Icon={Icon}
            key={label}
            label={label}
            trend={trend}
            value={value}
          />
        ))}
      </div>
    </section>
  );
}
