"use client";

import { buildKpiHref } from "@/lib/portal/dashboardLinks";
import { DashboardSectionHeading } from "./DashboardPanel";
import { DashboardStatCard } from "./DashboardStatCard";

export function DashboardStatGrid({ metrics, featuredLabel, dateRange }) {
  if (!metrics?.length) return null;

  return (
    <section className="space-y-3">
      <DashboardSectionHeading title="Overview" />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {metrics.map(({ label, value, Icon }) => (
          <DashboardStatCard
            key={label}
            label={label}
            value={value}
            Icon={Icon}
            featured={label === featuredLabel}
            href={buildKpiHref(label, dateRange)}
          />
        ))}
      </div>
    </section>
  );
}
