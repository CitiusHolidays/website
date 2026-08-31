"use client";

import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import Link from "next/link";
import { useTrackedQuery as useQuery } from "@/lib/portal/trackedConvexSubscriptions";
import type { PortalAccessSlice, PortalDateRange } from "../workspace/portalViewTypes";
import { DashboardPanel } from "./DashboardPanel";

const SCORECARD_ROLES = [
  "Admin",
  "Directors",
  "Director Cement",
  "Sales Head",
  "Contracting Head",
  "Operations Head",
  "Accounts Head",
  "Head of Ticketing",
] as const;

type Scorecard = FunctionReturnType<typeof api.crm.operatingDayScorecard.get>;
type ScorecardMetric = Scorecard["metrics"][number];

export function canLoadOperatingDayScorecard(access: PortalAccessSlice) {
  return Boolean(
    access.staffId &&
      access.roles?.some((role) => SCORECARD_ROLES.some((allowed) => allowed === role))
  );
}

function scorecardArgs(dateRange: PortalDateRange) {
  const from = dateRange.from || undefined;
  const to = dateRange.to || undefined;
  return from || to ? { dateRange: { from, to } } : {};
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "Unknown";
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return "Unknown";
  }
  return `${new Date(parsed).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatDuration(value: number | null) {
  if (value === null) {
    return "Unknown";
  }
  const totalMinutes = Math.floor(value / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function metricValue(metric: ScorecardMetric) {
  if (metric.value.status !== "Known") {
    return metric.value.status;
  }
  if (metric.unit === "count") {
    return String(metric.value.count ?? 0);
  }
  return `${formatDuration(metric.value.medianMs)} median`;
}

function readinessTone(readiness: ScorecardMetric["readiness"]) {
  if (readiness === "ready") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (readiness === "reconciling" || readiness === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function MetricDrillDown({ metric }: { metric: ScorecardMetric }) {
  const hasRows = metric.drillDown.rows.length > 0;
  const breakdownTotal = metric.breakdown.reduce((total, item) => total + item.count, 0);
  return (
    <details className="border-brand-border/70 border-t pt-3">
      <summary className="cursor-pointer font-medium text-citius-blue text-xs">
        Drill-down · {metric.drillDown.total} {metric.drillDown.total === 1 ? "record" : "records"}
      </summary>
      <div className="mt-3 space-y-3">
        {metric.breakdown.length > 0 ? (
          <div className="flex flex-wrap gap-2" data-testid={`${metric.id}-breakdown`}>
            {metric.breakdown.map((item) => (
              <span
                className="rounded-full border border-brand-border bg-brand-light/50 px-2 py-1 text-brand-muted text-xs"
                key={item.label}
              >
                {item.label}: {item.count}
              </span>
            ))}
            <span className="sr-only">Breakdown total {breakdownTotal}</span>
          </div>
        ) : null}
        {hasRows ? (
          <ol className="divide-y divide-brand-border/70">
            {metric.drillDown.rows.map((row) => {
              const content = (
                <>
                  <span className="font-medium text-brand-dark">{row.label}</span>
                  <span className="text-brand-muted">
                    {row.status} · {formatTimestamp(row.at)}
                    {row.durationMs === null ? "" : ` · ${formatDuration(row.durationMs)}`}
                  </span>
                </>
              );
              return (
                <li className="py-2 text-xs" key={`${row.href ?? row.label}:${row.at}`}>
                  {row.href ? (
                    <Link className="flex flex-col gap-1 hover:text-citius-blue" href={row.href}>
                      {content}
                    </Link>
                  ) : (
                    <span className="flex flex-col gap-1">{content}</span>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-brand-muted text-xs">
            {metric.value.status === "Unknown"
              ? "Drill-down is withheld until this cohort is complete."
              : "No matching records in this cohort."}
          </p>
        )}
        {metric.drillDown.truncated ? (
          <p className="text-brand-muted text-xs">
            Showing {metric.drillDown.rows.length} of {metric.drillDown.total} matching records.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ScorecardMetricCard({ metric }: { metric: ScorecardMetric }) {
  const { coverage } = metric;
  return (
    <article className="space-y-3 rounded-xl border border-brand-border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading font-semibold text-brand-dark text-sm">{metric.label}</h3>
        <span
          className={`rounded-full border px-2 py-0.5 font-medium text-[11px] capitalize ${readinessTone(metric.readiness)}`}
        >
          {metric.readiness.replaceAll("_", " ")}
        </span>
      </div>
      <div>
        <p
          className={`font-heading font-semibold text-2xl ${metric.value.status === "Unknown" ? "text-slate-600" : "text-citius-blue"}`}
        >
          {metricValue(metric)}
        </p>
        {metric.unit === "milliseconds" && metric.value.status === "Known" ? (
          <p className="mt-1 text-brand-muted text-xs">
            P90 {formatDuration(metric.value.p90Ms)} · {metric.value.count} completed
          </p>
        ) : null}
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-brand-dark">Coverage</dt>
          <dd className="mt-0.5 text-brand-muted">
            {coverage.included}/{coverage.total} usable · {coverage.missingClocks} missing clocks ·{" "}
            {coverage.unresolvedRecords} unresolved · {coverage.pending} pending
          </dd>
        </div>
        <div>
          <dt className="font-medium text-brand-dark">Last complete</dt>
          <dd className="mt-0.5 text-brand-muted">{formatTimestamp(metric.lastCompleteAt)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium text-brand-dark">Cohort</dt>
          <dd className="mt-0.5 text-brand-muted">
            {metric.cohort.definition} {metric.cohort.from}–{metric.cohort.to} UTC.
          </dd>
        </div>
      </dl>
      <MetricDrillDown metric={metric} />
    </article>
  );
}

export function OperatingDayScorecardView({ scorecard }: { scorecard: Scorecard }) {
  const scopeLabel =
    scorecard.scope.kind === "organization"
      ? "Organization scope"
      : `Role scope · ${scorecard.scope.roles.join(", ")}`;
  return (
    <DashboardPanel
      action={null}
      ariaLabel="Operating-day scorecard"
      subtitle={`${scorecard.window.from}–${scorecard.window.to} UTC · ${scopeLabel}`}
      title="Operating-day scorecard"
    >
      {scorecard.window.status === "unsupported" ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 text-xs">
          Select at most {scorecard.window.maxDays} UTC days. Metrics remain Unknown until the
          cohort is bounded.
        </p>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {scorecard.metrics.map((metric) => (
          <ScorecardMetricCard key={metric.id} metric={metric} />
        ))}
      </div>
    </DashboardPanel>
  );
}

export function DashboardOperatingDayScorecard({
  access,
  dateRange,
}: {
  access: PortalAccessSlice;
  dateRange: PortalDateRange;
}) {
  const canLoad = canLoadOperatingDayScorecard(access);
  const scorecard = useQuery(
    api.crm.operatingDayScorecard.get,
    canLoad ? scorecardArgs(dateRange) : "skip"
  );
  if (!canLoad) {
    return null;
  }
  if (!scorecard) {
    return (
      <DashboardPanel
        action={null}
        ariaLabel="Loading operating-day scorecard"
        subtitle="Resolving bounded cohorts and readiness."
        title="Operating-day scorecard"
      >
        <p aria-live="polite" className="text-brand-muted text-sm">
          Loading scorecard…
        </p>
      </DashboardPanel>
    );
  }
  return <OperatingDayScorecardView scorecard={scorecard} />;
}
