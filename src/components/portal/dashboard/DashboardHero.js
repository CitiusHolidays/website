"use client";

import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { getDashboardGreeting } from "./dashboardGreeting";
import { formatDataAsOf, formatPeriodLabel, isSummaryStale } from "./utils";

const PORTAL_VIEW_PATH_PATTERN = /\/portal\/([^/]+)/;

function mergeDashboardPeriod(href, dateRange) {
  if (!(dateRange?.from || dateRange?.to)) {
    return href;
  }
  try {
    const url = new URL(href, "http://portal.local");
    const viewMatch = url.pathname.match(PORTAL_VIEW_PATH_PATTERN);
    if (!viewMatch) {
      return href;
    }
    const [, view] = viewMatch;
    const listFilters = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (!["open", "id", "queryId", "inboundIntentId", "from", "to"].includes(key)) {
        listFilters[key] = value;
      }
    }
    return buildDashboardListUrl({
      dateRange,
      deepLink: {
        id: url.searchParams.get("id") ?? undefined,
        inboundIntentId: url.searchParams.get("inboundIntentId") ?? undefined,
        open: url.searchParams.get("open") ?? undefined,
        queryId: url.searchParams.get("queryId") ?? undefined,
      },
      listFilters,
      view,
    });
  } catch {
    return href;
  }
}

export function DashboardHero({ displayName, dateRange, generatedAt, ownedWorkSla, showSlaStrip }) {
  const period = formatPeriodLabel(dateRange);
  const asOf = formatDataAsOf(generatedAt);
  const stale = isSummaryStale(generatedAt);
  const greeting = getDashboardGreeting({ displayName });
  const slaItems = ownedWorkSla?.items ?? [];

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-heading font-semibold text-brand-dark text-xl md:text-2xl">
            {greeting}
          </h2>
          <p className="mt-1.5 max-w-2xl text-brand-muted text-sm leading-relaxed">
            Review urgent work and current results.
            <span className="sr-only"> Current dashboard period: {period}.</span>
          </p>
        </div>
        {asOf ? (
          <p
            className={`shrink-0 text-xs sm:pt-1 ${stale ? "text-amber-700" : "text-brand-muted"}`}
          >
            Data as of {asOf}
            {stale ? " · refresh for latest" : ""}
          </p>
        ) : null}
      </div>
      {showSlaStrip && slaItems.length > 0 ? (
        <div className="grid gap-x-5 gap-y-2 border-brand-border border-y py-3 md:grid-cols-[10.5rem_minmax(0,1fr)] md:items-center">
          <div className="min-w-0">
            <span className="block font-semibold text-brand-dark text-sm">Assigned work</span>
            <span className="mt-0.5 block text-brand-muted text-xs">Oldest open item by queue</span>
          </div>
          <div className="flex min-w-0 flex-wrap md:gap-y-2">
            {slaItems.map((item) => (
              <Link
                className="group grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 border-brand-border/80 border-t py-2 first:border-t-0 focus-visible:rounded-md md:w-auto md:min-w-[9.5rem] md:border-s md:border-t-0 md:px-4 md:py-0 md:first:border-s-0 md:first:ps-0"
                href={mergeDashboardPeriod(item.href, dateRange)}
                key={item.label}
              >
                <span className="font-medium text-brand-dark text-sm transition-colors group-hover:text-citius-blue">
                  {item.label}
                </span>
                <span className="font-semibold text-citius-blue text-sm tabular-nums">
                  {item.count}
                  <span className="sr-only"> {item.count === 1 ? "item" : "items"}</span>
                </span>
                {item.oldestDays === null ? null : (
                  <span className="col-span-2 mt-0.5 text-brand-muted text-xs tabular-nums">
                    Oldest: {item.oldestDays} {item.oldestDays === 1 ? "day" : "days"}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
