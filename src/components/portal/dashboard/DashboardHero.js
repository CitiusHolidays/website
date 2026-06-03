"use client";

import { formatDataAsOf, formatPeriodLabel, isSummaryStale } from "./utils";

export function DashboardHero({ displayName, dateRange, generatedAt }) {
  const period = formatPeriodLabel(dateRange);
  const asOf = formatDataAsOf(generatedAt);
  const stale = isSummaryStale(generatedAt);

  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-heading text-xl font-semibold text-brand-dark md:text-2xl">
          {displayName ? `Welcome back, ${displayName.split(" ")[0]}` : "Command center"}
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          Period: <span className="font-medium text-brand-dark">{period}</span>
        </p>
      </div>
      {asOf ? (
        <p className={`text-xs ${stale ? "text-amber-700" : "text-brand-muted"}`}>
          Data as of {asOf}
          {stale ? " · refresh for latest" : ""}
        </p>
      ) : null}
    </header>
  );
}
