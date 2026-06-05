"use client";

import { formatDataAsOf, formatPeriodLabel, isSummaryStale } from "./utils";

export function DashboardHero({ displayName, dateRange, generatedAt }) {
  const period = formatPeriodLabel(dateRange);
  const asOf = formatDataAsOf(generatedAt);
  const stale = isSummaryStale(generatedAt);
  const firstName = displayName?.split(" ")[0];

  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-heading text-xl font-semibold text-brand-dark md:text-2xl">
          {firstName ? `Good morning, ${firstName}` : "Good morning"}
          <span className="ml-2 inline-block size-2.5 rounded-full bg-citius-orange align-middle" />
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-brand-muted">
          Here's what's happening across your workspace.
          <span className="sr-only"> Current dashboard period: {period}.</span>
        </p>
      </div>
      {asOf ? (
        <p className={`shrink-0 text-xs sm:pt-1 ${stale ? "text-amber-700" : "text-brand-muted"}`}>
          Data as of {asOf}
          {stale ? " · refresh for latest" : ""}
        </p>
      ) : null}
    </header>
  );
}
