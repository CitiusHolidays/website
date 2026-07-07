"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  FileText,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
import { resolveDashboardPersona } from "@/lib/portal/dashboardPersona";
import { getQueryTypeOptions } from "@/lib/portal/permissions";
import { DashboardActionInbox } from "./DashboardActionInbox";
import { DashboardActivityStrip } from "./DashboardActivityStrip";
import { DashboardCollapsibleSection } from "./DashboardCollapsibleSection";
import { DashboardFinanceOverdue } from "./DashboardFinanceOverdue";
import { DashboardHero } from "./DashboardHero";
import { DashboardOpsReadiness } from "./DashboardOpsReadiness";
import { DashboardPeriodControls } from "./DashboardPeriodControls";
import { DashboardPipelineSnapshot } from "./DashboardPipelineSnapshot";
import { DashboardQueryTypeTabs } from "./DashboardQueryTypeTabs";
import { DashboardQuickActions } from "./DashboardQuickActions";
import { DashboardSectionSkeleton, DashboardStatsSkeleton } from "./DashboardSkeleton";
import { DashboardStatGrid } from "./DashboardStatGrid";
import { DashboardTicketingQueue } from "./DashboardTicketingQueue";
import { DashboardUpcomingDepartures, DashboardWorkQueuesSummary } from "./DashboardWorkQueue";
import { formatMetricTrend, formatMoney, formatOldestDays } from "./utils";

function metricTrend(summary, key) {
  const trend = summary?.metricTrends?.[key];
  return {
    ...trend,
    label: formatMetricTrend(trend),
  };
}

function buildDashboardMetrics(summary, has, persona) {
  const m = summary.metrics;
  const directorMetrics = [
    {
      Icon: ClipboardList,
      label: "Active queries",
      permission: P.VIEW_QUERIES,
      trendKey: "activeQueries",
      value: m.activeQueries,
    },
    {
      Icon: FileText,
      label: "Proposals sent",
      permission: P.VIEW_PROPOSALS,
      trendKey: "proposalsSent",
      value: m.proposalsSent,
    },
    {
      Icon: CheckCircle2,
      label: "Confirmed jobs",
      permission: P.VIEW_QUERIES,
      trendKey: "confirmedJobs",
      value: m.confirmedJobs,
    },
    {
      Icon: BriefcaseIcon,
      label: "Open job cards",
      permission: P.VIEW_JOB_CARDS,
      trendKey: "jobCardsOpen",
      value: m.jobCardsOpen,
    },
    {
      Icon: CalendarDays,
      label: "Departures (30d)",
      permission: P.VIEW_JOB_CARDS,
      trendKey: "departures30d",
      value: m.departures30d ?? 0,
    },
  ];

  if (persona.id === "director") {
    return directorMetrics.reduce((metrics, metric) => {
      if (!has(metric.permission)) {
        return metrics;
      }
      metrics.push({
        ...metric,
        trend: metricTrend(summary, metric.trendKey),
      });
      return metrics;
    }, []);
  }

  return [
    {
      Icon: ClipboardList,
      label: "Active queries",
      permission: P.VIEW_QUERIES,
      trendKey: "activeQueries",
      value: m.activeQueries,
    },
    {
      Icon: FileText,
      label: "Proposals sent",
      permission: P.VIEW_PROPOSALS,
      trendKey: "proposalsSent",
      value: m.proposalsSent,
    },
    {
      Icon: CheckCircle2,
      label: "Confirmed jobs",
      permission: P.VIEW_QUERIES,
      trendKey: "confirmedJobs",
      value: m.confirmedJobs,
    },
    {
      Icon: BriefcaseIcon,
      label: "Open job cards",
      permission: P.VIEW_JOB_CARDS,
      trendKey: "jobCardsOpen",
      value: m.jobCardsOpen,
    },
    {
      Icon: Ticket,
      label: "Tickets pending",
      permission: P.VIEW_TICKETING,
      value: m.ticketsPending,
    },
    {
      Icon: ShieldCheck,
      label: "Visa pending",
      permission: P.VIEW_VISA,
      value: m.visaPending,
    },
    {
      Icon: CircleDollarSign,
      label: "Outstanding",
      permission: P.VIEW_FINANCE,
      value: formatMoney(m.outstandingAmount),
    },
    {
      Icon: CheckCircle2,
      label: "Pending approvals",
      permission: P.VIEW_APPROVALS,
      value: m.pendingApprovals,
    },
    {
      Icon: CircleDollarSign,
      label: "Revenue pipeline",
      permission: P.VIEW_FINANCE,
      value: formatMoney(m.revenuePipeline),
    },
  ].reduce((metrics, metric) => {
    if (!has(metric.permission)) {
      return metrics;
    }
    metrics.push({
      ...metric,
      trend: metric.trendKey ? metricTrend(summary, metric.trendKey) : undefined,
    });
    return metrics;
  }, []);
}

function BriefcaseIcon(props) {
  return (
    <svg
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      <path d="M10 2h4a2 2 0 0 1 2 2v2H8V4a2 2 0 0 1 2-2z" />
      <path d="M4 8h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
    </svg>
  );
}

function filterUrgentActions(summary, has) {
  return (summary.urgentActions || []).filter((item) => {
    if (item.type === "approvals") {
      return has(P.VIEW_APPROVALS);
    }
    if (item.type === "finance") {
      return has(P.VIEW_FINANCE);
    }
    if (item.type === "accounts") {
      return has(P.MANAGE_JOB_CARDS);
    }
    if (item.type === "ticketing") {
      return has(P.VIEW_TICKETING);
    }
    return has(P.VIEW_QUERIES);
  });
}

function filterDepartmentWorkflow(summary, has) {
  return (summary.departmentWorkflow || []).filter((item) => {
    if (item.label.startsWith("Sales")) {
      return has(P.VIEW_QUERIES);
    }
    if (item.label.startsWith("Contracting")) {
      return has(P.VIEW_CONTRACTING);
    }
    if (item.label.startsWith("Ops")) {
      return has(P.VIEW_JOB_CARDS);
    }
    if (item.label.startsWith("Ticketing")) {
      return has(P.VIEW_TICKETING);
    }
    if (item.label.startsWith("Finance")) {
      return has(P.VIEW_FINANCE);
    }
    return true;
  });
}

function DashboardSectionBlock({ id, sections, persona }) {
  const node = sections[id];
  if (!(node && persona.sections.includes(id))) {
    return null;
  }
  return <div>{node}</div>;
}

const EMPTY_CAPACITY_ROWS = [];

function DashboardCapacityHeatmap({ rows = EMPTY_CAPACITY_ROWS, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!rows.length) {
    return null;
  }
  return (
    <section className="border-brand-border/70 border-b pb-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <h2 className="font-heading text-base text-brand-dark">Capacity heatmap</h2>
        <span className="font-sans text-brand-muted text-xs">Role load</span>
      </button>
      {open ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((row) => (
            <div className="rounded-lg bg-brand-light/40 p-3" key={row.role}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-heading text-brand-dark text-sm">{row.role}</p>
                <span
                  className={`rounded-full px-2 py-0.5 font-sans text-[11px] ${
                    row.severity === "overloaded"
                      ? "bg-red-100 text-red-700"
                      : row.severity === "busy"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {row.severity}
                </span>
              </div>
              <p className="mt-2 font-sans text-brand-muted text-xs">
                Avg {row.averageLoad} items · {row.staffCount} staff
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DashboardPipelineTypesCollapsible({ pipeline, queryTypes, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!(pipeline || queryTypes)) {
    return null;
  }
  return (
    <section className="border-brand-border/70 border-b pb-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <h2 className="font-heading text-base text-brand-dark">Pipeline & types</h2>
        <ChevronDown className={`shrink-0 transition ${open ? "rotate-180" : ""}`} size={18} />
      </button>
      {open ? (
        <div className="mt-4 space-y-4">
          {pipeline}
          {queryTypes}
        </div>
      ) : null}
    </section>
  );
}

export function DashboardView({
  summary,
  has,
  access,
  dateRange,
  setDateRange,
  openModal,
  loading,
}) {
  const persona = resolveDashboardPersona(has, access);
  const generatedAt = summary?.generatedAt;

  if (loading && !summary) {
    return (
      <div aria-busy="true" className="space-y-8">
        <DashboardSectionSkeleton lines={1} />
        <DashboardStatsSkeleton />
        <DashboardSectionSkeleton lines={4} />
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const metrics = buildDashboardMetrics(summary, has, persona);

  const urgentActions = filterUrgentActions(summary, has);
  const departmentWorkflow = filterDepartmentWorkflow(summary, has);

  const queryTypeOptions = getQueryTypeOptions(access);
  const emptyQueryTypeCounts = () => queryTypeOptions.map((type) => ({ count: 0, type }));
  const queryTypeCounts = has(P.VIEW_QUERIES)
    ? summary.queriesByType?.length
      ? summary.queriesByType
      : emptyQueryTypeCounts()
    : [];
  const confirmedQueryTypeCounts = has(P.VIEW_QUERIES)
    ? summary.confirmedQueriesByType?.length
      ? summary.confirmedQueriesByType
      : emptyQueryTypeCounts()
    : [];
  const closedQueryTypeCounts = has(P.VIEW_QUERIES)
    ? summary.closedQueriesByType?.length
      ? summary.closedQueriesByType
      : emptyQueryTypeCounts()
    : [];
  const activeQueryTotal = queryTypeCounts.reduce((sum, item) => sum + item.count, 0);
  const confirmedQueryTotal = confirmedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0);
  const closedQueryTotal = closedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0);

  const showOpsProgress =
    has(P.VIEW_JOB_CARDS) ||
    has(P.VIEW_TRAVELLERS) ||
    has(P.VIEW_TICKETING) ||
    has(P.VIEW_VISA) ||
    has(P.VIEW_OPERATIONS) ||
    has(P.VIEW_FINANCE);

  const oldestByType = (type) => {
    let oldest = null;
    for (const item of urgentActions) {
      if (item.type !== type || !item.createdAt) {
        continue;
      }
      if (oldest === null || item.createdAt < oldest) {
        oldest = item.createdAt;
      }
    }
    return oldest;
  };

  const roomingPending = Math.max(
    0,
    (summary.progress?.rooming?.total || 0) - (summary.progress?.rooming?.done || 0)
  );

  const workQueueRows = [
    has(P.MANAGE_JOB_CARDS) && {
      href: buildDashboardListUrl({ dateRange, view: "accounts-job-cards" }),
      label: "Job Cards Pending",
      oldest: oldestByType("accounts"),
      owner: "Accounts",
      value: urgentActions.filter((item) => item.type === "accounts").length,
    },
    has(P.VIEW_CONTRACTING) && {
      href: buildDashboardListUrl({ dateRange, view: "contracting" }),
      label: "Proposal with Contracting",
      oldest: null,
      owner: "Contracting",
      value: summary.departmentWorkflow?.find((item) => item.label.startsWith("Contracting"))
        ?.value,
    },
    has(P.VIEW_VISA) && {
      href: buildDashboardListUrl({ dateRange, view: "visa" }),
      label: "Visa Follow-ups",
      oldest: null,
      owner: "Visa",
      value: summary.metrics.visaPending,
    },
    has(P.VIEW_OPERATIONS) &&
      roomingPending > 0 && {
        href: buildDashboardListUrl({ dateRange, view: "hotels" }),
        label: "Rooming Follow-ups",
        oldest: null,
        owner: "Operations",
        value: roomingPending,
      },
    has(P.VIEW_FINANCE) && {
      href: buildDashboardListUrl({
        dateRange,
        listFilters: { status: "Pending" },
        view: "approvals",
      }),
      label: "Finance Approvals",
      oldest: oldestByType("finance"),
      owner: "Accounts",
      value: summary.metrics.pendingApprovals,
    },
    has(P.VIEW_TICKETING) && {
      href: buildDashboardListUrl({ dateRange, view: "tickets" }),
      label: "Ticketing Follow-ups",
      oldest: oldestByType("ticketing"),
      owner: "Ticketing",
      value: summary.ticketAttentionQueue?.length || summary.metrics.ticketsPending || 0,
    },
  ]
    .filter(Boolean)
    .map((row) => ({
      ...row,
      oldestLabel: formatOldestDays(row.oldest),
    }));

  const sections = {
    activity: null,
    collapsible: (
      <DashboardCollapsibleSection
        departmentWorkflow={departmentWorkflow}
        myTeam={summary.myTeam}
        showTeam={has(P.VIEW_TEAM)}
        showWorkflow={persona.id === "director"}
      />
    ),
    hero: (
      <DashboardHero dateRange={dateRange} displayName={access?.name} generatedAt={generatedAt} />
    ),
    inbox: <DashboardActionInbox actions={urgentActions} dateRange={dateRange} />,
    periodPresets: <DashboardPeriodControls dateRange={dateRange} setDateRange={setDateRange} />,
    pipeline: (
      <DashboardPipelineSnapshot
        dateRange={dateRange}
        pipelineSnapshot={summary.pipelineSnapshot}
      />
    ),
    queryTypes: persona.showQueryTypes ? (
      <DashboardQueryTypeTabs
        activeQueryTotal={activeQueryTotal}
        closedQueryTotal={closedQueryTotal}
        closedQueryTypeCounts={closedQueryTypeCounts}
        confirmedQueryTotal={confirmedQueryTotal}
        confirmedQueryTypeCounts={confirmedQueryTypeCounts}
        dateRange={dateRange}
        defaultTab={persona.defaultQueryTab}
        queryTypeCounts={queryTypeCounts}
      />
    ) : null,
    quickActions: <DashboardQuickActions has={has} openModal={openModal} />,
    readiness: (
      <DashboardOpsReadiness
        dateRange={dateRange}
        has={has}
        personaId={persona.id}
        showAggregateProgress={showOpsProgress}
        summary={summary}
      />
    ),
    stats: (
      <DashboardStatGrid
        dateRange={dateRange}
        featuredLabel={persona.featuredMetricLabel}
        metrics={metrics}
      />
    ),
    ticketingQueue: (
      <DashboardTicketingQueue
        dateRange={dateRange}
        metricTrends={summary.metricTrends}
        queue={summary.ticketAttentionQueue}
        stats={summary.ticketingStats}
      />
    ),
    workQueue: (
      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <DashboardWorkQueuesSummary rows={workQueueRows} />
          {persona.sections.includes("activity") ? (
            <DashboardActivityStrip
              activities={summary.recentActivity}
              canView={has(P.VIEW_ACTIVITY)}
            />
          ) : has(P.VIEW_FINANCE) ? (
            <DashboardFinanceOverdue dateRange={dateRange} invoices={summary.overdueInvoices} />
          ) : null}
        </div>
        {has(P.VIEW_JOB_CARDS) ? (
          <DashboardUpcomingDepartures
            dateRange={dateRange}
            departures={summary.upcomingDepartures}
            hasJobCards={has(P.VIEW_JOB_CARDS)}
          />
        ) : null}
      </div>
    ),
  };

  const hasSection = (id) => persona.sections.includes(id) && sections[id];
  const isDirector = persona.id === "director";
  const isHeadRole = access?.roles?.some((role) => role.includes("Head"));
  const leftSections = isDirector
    ? ["queryTypes", "pipeline", "workQueue", "collapsible"].filter(hasSection)
    : ["workQueue", "collapsible"].filter(hasSection);
  const rightSections = ["inbox", "ticketingQueue", "readiness"].filter(hasSection);
  const showCombinedPipelineTypes =
    !isDirector && (hasSection("pipeline") || hasSection("queryTypes"));
  const renderedTopSections = new Set(["hero", "quickActions", "periodPresets", "stats"]);
  for (const id of [...leftSections, ...rightSections]) {
    renderedTopSections.add(id);
  }
  if (showCombinedPipelineTypes) {
    renderedTopSections.add("pipeline");
    renderedTopSections.add("queryTypes");
  }

  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <DashboardSectionBlock id="hero" persona={persona} sections={sections} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-brand-border/70 border-b pb-4">
        <DashboardSectionBlock id="quickActions" persona={persona} sections={sections} />
        <DashboardSectionBlock id="periodPresets" persona={persona} sections={sections} />
      </div>

      {hasSection("stats") ? (
        <div className="border-brand-border/70 border-b pb-4">
          <DashboardSectionBlock id="stats" persona={persona} sections={sections} />
        </div>
      ) : null}

      <div
        className={
          rightSections.length ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]" : "grid gap-4"
        }
      >
        <div className="space-y-4">
          {showCombinedPipelineTypes ? (
            <DashboardPipelineTypesCollapsible
              defaultOpen={false}
              pipeline={sections.pipeline}
              queryTypes={sections.queryTypes}
            />
          ) : null}
          {leftSections.map((id) => (
            <DashboardSectionBlock id={id} key={id} persona={persona} sections={sections} />
          ))}
        </div>
        {rightSections.length ? (
          <aside className="hidden space-y-4 xl:block">
            {rightSections.map((id) => (
              <DashboardSectionBlock id={id} key={id} persona={persona} sections={sections} />
            ))}
          </aside>
        ) : null}
      </div>

      {rightSections.length ? (
        <div className="space-y-4 xl:hidden">
          {rightSections.map((id) => (
            <DashboardSectionBlock id={id} key={id} persona={persona} sections={sections} />
          ))}
        </div>
      ) : null}

      {has(P.VIEW_TEAM) || isHeadRole ? (
        <DashboardCapacityHeatmap defaultOpen={Boolean(isHeadRole)} rows={summary.capacity} />
      ) : null}

      {persona.sections.flatMap((id) => {
        if (renderedTopSections.has(id)) {
          return [];
        }
        return [<DashboardSectionBlock id={id} key={id} persona={persona} sections={sections} />];
      })}
    </m.div>
  );
}
