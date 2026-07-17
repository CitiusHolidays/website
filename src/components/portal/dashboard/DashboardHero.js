"use client";

import Link from "next/link";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { getDashboardGreeting } from "./dashboardGreeting";
import { formatDataAsOf, formatPeriodLabel, isSummaryStale } from "./utils";

function mergeDashboardPeriod(href, dateRange) {
  if (!(dateRange?.from || dateRange?.to)) {
    return href;
  }
  try {
    const url = new URL(href, "http://portal.local");
    const viewMatch = url.pathname.match(/\/portal\/([^/]+)/);
    if (!viewMatch) {
      return href;
    }
    const view = viewMatch[1];
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
            <span className="ml-2 inline-block size-2.5 rounded-full bg-citius-orange align-middle" />
          </h2>
          <p className="mt-1.5 max-w-2xl text-brand-muted text-sm leading-relaxed">
            Start with what needs your attention, then move into the wider workspace picture.
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
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-border/70 bg-white/80 px-3 py-2">
          <span className="font-semibold text-[length:var(--portal-label-size)] text-citius-orange-ink uppercase tracking-[0.14em]">
            Owned-work SLA
          </span>
          {slaItems.map((item) => (
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-border bg-brand-light/60 px-3 py-1.5 text-brand-dark text-sm transition-colors hover:border-citius-blue/30 hover:text-citius-blue"
              href={mergeDashboardPeriod(item.href, dateRange)}
              key={item.label}
            >
              <span className="font-medium">{item.label}</span>
              <span className="rounded-full bg-citius-blue/10 px-2 py-0.5 font-semibold text-citius-blue text-xs tabular-nums">
                {item.count}
              </span>
              {item.oldestDays !== null ? (
                <span className="text-brand-muted text-xs">oldest {item.oldestDays}d</span>
              ) : null}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
