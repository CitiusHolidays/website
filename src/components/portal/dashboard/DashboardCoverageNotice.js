"use client";

import { Info } from "lucide-react";
import { formatDataAsOf } from "./utils";

export function shouldShowDashboardCoverageNotice(coverage) {
  if (!coverage) {
    return false;
  }
  if (coverage.complete && coverage.state !== "stale") {
    return false;
  }
  return !coverage.complete || coverage.state === "stale";
}

function coverageNoticeTitle(coverage) {
  if (coverage.state === "stale") {
    return "Dashboard totals may be out of date";
  }
  return "Some dashboard totals are still being prepared";
}

function coverageNoticeBody(coverage) {
  if (coverage.state === "stale") {
    return "Refresh this page for the latest figures. Numbers shown may not reflect recent activity.";
  }
  return "Totals may be incomplete until the refresh finishes. Check back shortly for the full picture.";
}

export function DashboardCoverageNotice({ coverage }) {
  if (!shouldShowDashboardCoverageNotice(coverage)) {
    return null;
  }

  const title = coverageNoticeTitle(coverage);
  const body = coverageNoticeBody(coverage);
  const lastCompletedLabel = formatDataAsOf(coverage.lastCompletedAt);
  const titleId = "dashboard-coverage-notice-title";

  return (
    <div
      aria-labelledby={titleId}
      className="flex gap-3 rounded-lg border border-citius-orange/25 bg-citius-orange/10 px-4 py-3 text-citius-orange-ink"
      data-testid="dashboard-coverage-notice"
      role="status"
    >
      <Info aria-hidden className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 space-y-1">
        <p className="font-heading font-semibold text-sm" id={titleId}>
          {title}
        </p>
        <p className="text-sm leading-relaxed">{body}</p>
        {lastCompletedLabel ? (
          <p className="text-xs">Last fully updated: {lastCompletedLabel}</p>
        ) : null}
      </div>
    </div>
  );
}
