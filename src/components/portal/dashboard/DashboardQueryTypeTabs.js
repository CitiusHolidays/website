"use client";

import { useState } from "react";
import { buildQueryTypeTileHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardSectionHeading } from "./DashboardPanel";
import { DashboardQueryTypeTile } from "./DashboardQueryTypeTile";

const TABS = [
  { id: "active", label: "Active", detailKey: "active" },
  { id: "confirmed", label: "Confirmed", detailKey: "confirmed" },
  { id: "closed", label: "Lost", detailKey: "closed" },
];

export function DashboardQueryTypeTabs({
  queryTypeCounts,
  confirmedQueryTypeCounts,
  closedQueryTypeCounts,
  activeQueryTotal,
  confirmedQueryTotal,
  closedQueryTotal,
  defaultTab = "active",
  dateRange,
}) {
  const [tab, setTab] = useState(defaultTab);

  const datasets = {
    active: { rows: queryTypeCounts, total: activeQueryTotal, variant: "active" },
    confirmed: {
      rows: confirmedQueryTypeCounts,
      total: confirmedQueryTotal,
      variant: "confirmed",
    },
    closed: { rows: closedQueryTypeCounts, total: closedQueryTotal, variant: "closed" },
  };

  const current = datasets[tab] || datasets.active;
  if (
    !queryTypeCounts?.length &&
    !confirmedQueryTypeCounts?.length &&
    !closedQueryTypeCounts?.length
  ) {
    return null;
  }

  const detail =
    tab === "active"
      ? `${activeQueryTotal.toLocaleString("en-IN")} open enquiries in this period`
      : tab === "confirmed"
        ? `${confirmedQueryTotal.toLocaleString("en-IN")} order confirmed in this period`
        : `${closedQueryTotal.toLocaleString("en-IN")} order lost in this period`;

  return (
    <section className="space-y-3">
      <DashboardSectionHeading title="Queries by type" detail={detail} />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Query status bucket">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              tab === item.id
                ? "bg-citius-blue text-white"
                : "border border-brand-border bg-white text-brand-muted hover:text-brand-dark"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {current.rows?.length === 0 ? (
        <DashboardEmpty label="No queries in this bucket for the selected period." />
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {current.rows.map((item) => (
            <DashboardQueryTypeTile
              key={`${tab}-${item.type}`}
              type={item.type}
              count={item.count}
              variant={current.variant}
              href={buildQueryTypeTileHref(tab, item.type, dateRange)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
