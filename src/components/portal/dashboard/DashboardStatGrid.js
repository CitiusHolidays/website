"use client";

import { DashboardSectionHeading } from "./DashboardPanel";
import { DashboardStatCard } from "./DashboardStatCard";

export function DashboardStatGrid({ metrics, featuredMetricId }) {
  if (!metrics?.length) {
    return null;
  }
  if (metrics.length > 6) {
    throw new Error("DashboardStatGrid accepts at most six primary metrics");
  }

  return (
    <section>
      <DashboardSectionHeading className="sr-only" title="Overview" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ href, id, label, value, Icon, trend }) => (
          <DashboardStatCard
            featured={id === featuredMetricId}
            href={href}
            Icon={Icon}
            key={id}
            label={label}
            trend={trend}
            value={value}
          />
        ))}
      </div>
    </section>
  );
}
