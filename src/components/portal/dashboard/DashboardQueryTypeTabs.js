"use client";

import { useState } from "react";
import { PortalTabs } from "@/components/portal/PortalTabs";
import { buildQueryTypeTileHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardSectionHeading } from "./DashboardPanel";
import { DashboardQueryTypeTile } from "./DashboardQueryTypeTile";

const TABS = [
  { detailKey: "active", id: "active", label: "Active" },
  { detailKey: "confirmed", id: "confirmed", label: "Confirmed" },
  { detailKey: "closed", id: "closed", label: "Lost" },
];

function queryTypeDetail(tab, totals) {
  if (tab === "active") {
    return `${totals.active.toLocaleString("en-IN")} open enquiries in this period`;
  }
  if (tab === "confirmed") {
    return `${totals.confirmed.toLocaleString("en-IN")} order confirmed in this period`;
  }
  return `${totals.closed.toLocaleString("en-IN")} order lost in this period`;
}

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
    active: {
      rows: queryTypeCounts || [],
      total: activeQueryTotal,
      variant: "active",
    },
    closed: {
      rows: closedQueryTypeCounts || [],
      total: closedQueryTotal,
      variant: "closed",
    },
    confirmed: {
      rows: confirmedQueryTypeCounts || [],
      total: confirmedQueryTotal,
      variant: "confirmed",
    },
  };

  const current = datasets[tab] || datasets.active;
  if (
    !(queryTypeCounts?.length || confirmedQueryTypeCounts?.length || closedQueryTypeCounts?.length)
  ) {
    return null;
  }

  const detail = queryTypeDetail(tab, {
    active: activeQueryTotal,
    closed: closedQueryTotal,
    confirmed: confirmedQueryTotal,
  });

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-brand-border bg-white p-4 shadow-brand-dark/[0.03] shadow-sm">
        <div>
          <DashboardSectionHeading detail={detail} title="Query types by status" />
          <PortalTabs
            ariaLabel="Query status bucket"
            className="mt-3"
            items={TABS}
            onValueChange={setTab}
            panelClassName="mt-3"
            value={tab}
          >
            {current.rows?.length === 0 ? (
              <DashboardEmpty label="No queries in this bucket for the selected period." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {current.rows.map((item) => (
                  <DashboardQueryTypeTile
                    count={item.count}
                    href={buildQueryTypeTileHref(tab, item.type, dateRange)}
                    key={`${tab}-${item.type}`}
                    type={item.type}
                    variant={current.variant}
                  />
                ))}
              </div>
            )}
          </PortalTabs>
        </div>
      </div>
    </section>
  );
}
