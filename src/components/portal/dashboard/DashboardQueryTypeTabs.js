"use client";

import { useState } from "react";
import { buildQueryTypeTileHref } from "@/lib/portal/dashboardLinks";
import { DashboardEmpty, DashboardSectionHeading } from "./DashboardPanel";
import { DashboardQueryTypeTile } from "./DashboardQueryTypeTile";

const TABS = [
  { detailKey: "active", id: "active", label: "Active" },
  { detailKey: "confirmed", id: "confirmed", label: "Confirmed" },
  { detailKey: "closed", id: "closed", label: "Lost" },
];

const QUERY_TYPE_GROUPS = [
  { label: "Cement types", types: ["Cement", "Cement Bidding"] },
  { label: "MICE", types: ["MICE", "MICE Bidding"] },
  { label: "FIT / Family Group", types: ["FIT", "Family Group"] },
  { label: "Everything else", types: ["B2B", "Spiritual"] },
];

function groupQueryTypeRows(rows = []) {
  return QUERY_TYPE_GROUPS.map((group) => ({
    count: rows
      .filter((row) => group.types.includes(row.type))
      .reduce((sum, row) => sum + row.count, 0),
    sourceTypes: group.types,
    type: group.label,
  }));
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
      rows: groupQueryTypeRows(queryTypeCounts),
      total: activeQueryTotal,
      variant: "active",
    },
    closed: {
      rows: groupQueryTypeRows(closedQueryTypeCounts),
      total: closedQueryTotal,
      variant: "closed",
    },
    confirmed: {
      rows: groupQueryTypeRows(confirmedQueryTypeCounts),
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

  const detail =
    tab === "active"
      ? `${activeQueryTotal.toLocaleString("en-IN")} open enquiries in this period`
      : tab === "confirmed"
        ? `${confirmedQueryTotal.toLocaleString("en-IN")} order confirmed in this period`
        : `${closedQueryTotal.toLocaleString("en-IN")} order lost in this period`;

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-brand-border bg-white p-4 shadow-brand-dark/[0.03] shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <DashboardSectionHeading detail={detail} title="Query types by status" />
          <div
            aria-label="Query status bucket"
            className="flex rounded-lg border border-brand-border bg-white p-1"
            role="tablist"
          >
            {TABS.map((item) => (
              <button
                aria-selected={tab === item.id}
                className={`rounded-md px-3 py-1.5 font-semibold text-xs transition ${
                  tab === item.id
                    ? "bg-citius-blue text-white shadow-sm"
                    : "text-brand-muted hover:text-brand-dark"
                }`}
                key={item.id}
                onClick={() => setTab(item.id)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        {current.rows?.length === 0 ? (
          <DashboardEmpty label="No queries in this bucket for the selected period." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {current.rows.map((item) => (
              <DashboardQueryTypeTile
                count={item.count}
                href={buildQueryTypeTileHref(tab, item.sourceTypes?.[0] || item.type, dateRange)}
                key={`${tab}-${item.type}`}
                type={item.type}
                variant={current.variant}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
