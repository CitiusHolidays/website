"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { m as motion } from "motion/react";
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
      label: "Active queries",
      value: m.activeQueries,
      Icon: ClipboardList,
      permission: P.VIEW_QUERIES,
      trendKey: "activeQueries",
    },
    {
      label: "Proposals sent",
      value: m.proposalsSent,
      Icon: FileText,
      permission: P.VIEW_PROPOSALS,
      trendKey: "proposalsSent",
    },
    {
      label: "Confirmed jobs",
      value: m.confirmedJobs,
      Icon: CheckCircle2,
      permission: P.VIEW_QUERIES,
      trendKey: "confirmedJobs",
    },
    {
      label: "Open job cards",
      value: m.jobCardsOpen,
      Icon: BriefcaseIcon,
      permission: P.VIEW_JOB_CARDS,
      trendKey: "jobCardsOpen",
    },
    {
      label: "Departures (30d)",
      value: m.departures30d ?? 0,
      Icon: CalendarDays,
      permission: P.VIEW_JOB_CARDS,
      trendKey: "departures30d",
    },
  ];

  if (persona.id === "director") {
    return directorMetrics.reduce((metrics, metric) => {
      if (!has(metric.permission)) return metrics;
      metrics.push({
        ...metric,
        trend: metricTrend(summary, metric.trendKey),
      });
      return metrics;
    }, []);
  }

  return [
    {
      label: "Active queries",
      value: m.activeQueries,
      Icon: ClipboardList,
      permission: P.VIEW_QUERIES,
      trendKey: "activeQueries",
    },
    {
      label: "Proposals sent",
      value: m.proposalsSent,
      Icon: FileText,
      permission: P.VIEW_PROPOSALS,
      trendKey: "proposalsSent",
    },
    {
      label: "Confirmed jobs",
      value: m.confirmedJobs,
      Icon: CheckCircle2,
      permission: P.VIEW_QUERIES,
      trendKey: "confirmedJobs",
    },
    {
      label: "Open job cards",
      value: m.jobCardsOpen,
      Icon: BriefcaseIcon,
      permission: P.VIEW_JOB_CARDS,
      trendKey: "jobCardsOpen",
    },
    {
      label: "Tickets pending",
      value: m.ticketsPending,
      Icon: Ticket,
      permission: P.VIEW_TICKETING,
    },
    {
      label: "Visa pending",
      value: m.visaPending,
      Icon: ShieldCheck,
      permission: P.VIEW_VISA,
    },
    {
      label: "Outstanding",
      value: formatMoney(m.outstandingAmount),
      Icon: CircleDollarSign,
      permission: P.VIEW_FINANCE,
    },
    {
      label: "Pending approvals",
      value: m.pendingApprovals,
      Icon: CheckCircle2,
      permission: P.VIEW_APPROVALS,
    },
    {
      label: "Revenue pipeline",
      value: formatMoney(m.revenuePipeline),
      Icon: CircleDollarSign,
      permission: P.VIEW_FINANCE,
    },
  ].reduce((metrics, metric) => {
    if (!has(metric.permission)) return metrics;
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
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M10 2h4a2 2 0 0 1 2 2v2H8V4a2 2 0 0 1 2-2z" />
      <path d="M4 8h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
    </svg>
  );
}

function filterUrgentActions(summary, has) {
  return (summary.urgentActions || []).filter((item) => {
    if (item.type === "approvals") return has(P.VIEW_APPROVALS);
    if (item.type === "finance") return has(P.VIEW_FINANCE);
    if (item.type === "accounts") return has(P.MANAGE_JOB_CARDS);
    if (item.type === "ticketing") return has(P.VIEW_TICKETING);
    return has(P.VIEW_QUERIES);
  });
}

function filterDepartmentWorkflow(summary, has) {
  return (summary.departmentWorkflow || []).filter((item) => {
    if (item.label.startsWith("Sales")) return has(P.VIEW_QUERIES);
    if (item.label.startsWith("Contracting")) return has(P.VIEW_CONTRACTING);
    if (item.label.startsWith("Ops")) return has(P.VIEW_JOB_CARDS);
    if (item.label.startsWith("Ticketing")) return has(P.VIEW_TICKETING);
    if (item.label.startsWith("Finance")) return has(P.VIEW_FINANCE);
    return true;
  });
}

function DashboardSectionBlock({ id, sections, persona }) {
  const node = sections[id];
  if (!node || !persona.sections.includes(id)) return null;
  return <div>{node}</div>;
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
      <div className="space-y-8" aria-busy="true">
        <DashboardSectionSkeleton lines={1} />
        <DashboardStatsSkeleton />
        <DashboardSectionSkeleton lines={4} />
      </div>
    );
  }

  if (!summary) return null;

  const metrics = buildDashboardMetrics(summary, has, persona);

  const urgentActions = filterUrgentActions(summary, has);
  const departmentWorkflow = filterDepartmentWorkflow(summary, has);

  const queryTypeOptions = getQueryTypeOptions(access);
  const emptyQueryTypeCounts = () => queryTypeOptions.map((type) => ({ type, count: 0 }));
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
      if (item.type !== type || !item.createdAt) continue;
      if (oldest === null || item.createdAt < oldest) {
        oldest = item.createdAt;
      }
    }
    return oldest;
  };

  const roomingPending = Math.max(
    0,
    (summary.progress?.rooming?.total || 0) - (summary.progress?.rooming?.done || 0),
  );

  const workQueueRows = [
    has(P.MANAGE_JOB_CARDS) && {
      label: "Job Cards Pending",
      value: urgentActions.filter((item) => item.type === "accounts").length,
      oldest: oldestByType("accounts"),
      owner: "Accounts",
      href: buildDashboardListUrl({ view: "accounts-job-cards", dateRange }),
    },
    has(P.VIEW_CONTRACTING) && {
      label: "Proposal with Contracting",
      value: summary.departmentWorkflow?.find((item) => item.label.startsWith("Contracting"))
        ?.value,
      oldest: null,
      owner: "Contracting",
      href: buildDashboardListUrl({ view: "contracting", dateRange }),
    },
    has(P.VIEW_VISA) && {
      label: "Visa Follow-ups",
      value: summary.metrics.visaPending,
      oldest: null,
      owner: "Visa",
      href: buildDashboardListUrl({ view: "visa", dateRange }),
    },
    has(P.VIEW_OPERATIONS) &&
      roomingPending > 0 && {
        label: "Rooming Follow-ups",
        value: roomingPending,
        oldest: null,
        owner: "Operations",
        href: buildDashboardListUrl({ view: "hotels", dateRange }),
      },
    has(P.VIEW_FINANCE) && {
      label: "Finance Approvals",
      value: summary.metrics.pendingApprovals,
      oldest: oldestByType("finance"),
      owner: "Accounts",
      href: buildDashboardListUrl({
        view: "approvals",
        listFilters: { status: "Pending" },
        dateRange,
      }),
    },
    has(P.VIEW_TICKETING) && {
      label: "Ticketing Follow-ups",
      value: summary.ticketAttentionQueue?.length || summary.metrics.ticketsPending || 0,
      oldest: oldestByType("ticketing"),
      owner: "Ticketing",
      href: buildDashboardListUrl({ view: "tickets", dateRange }),
    },
  ]
    .filter(Boolean)
    .map((row) => ({
      ...row,
      oldestLabel: formatOldestDays(row.oldest),
    }));

  const sections = {
    hero: (
      <DashboardHero displayName={access?.name} dateRange={dateRange} generatedAt={generatedAt} />
    ),
    quickActions: <DashboardQuickActions has={has} openModal={openModal} />,
    periodPresets: <DashboardPeriodControls dateRange={dateRange} setDateRange={setDateRange} />,
    stats: (
      <DashboardStatGrid
        metrics={metrics}
        featuredLabel={persona.featuredMetricLabel}
        dateRange={dateRange}
      />
    ),
    inbox: <DashboardActionInbox actions={urgentActions} dateRange={dateRange} />,
    pipeline: (
      <DashboardPipelineSnapshot
        pipelineSnapshot={summary.pipelineSnapshot}
        dateRange={dateRange}
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
            <DashboardFinanceOverdue invoices={summary.overdueInvoices} dateRange={dateRange} />
          ) : null}
        </div>
        {has(P.VIEW_JOB_CARDS) ? (
          <DashboardUpcomingDepartures
            departures={summary.upcomingDepartures}
            dateRange={dateRange}
            hasJobCards={has(P.VIEW_JOB_CARDS)}
          />
        ) : null}
      </div>
    ),
    readiness: (
      <DashboardOpsReadiness
        summary={summary}
        has={has}
        dateRange={dateRange}
        showAggregateProgress={showOpsProgress}
        personaId={persona.id}
      />
    ),
    ticketingQueue: (
      <DashboardTicketingQueue
        queue={summary.ticketAttentionQueue}
        dateRange={dateRange}
        stats={summary.ticketingStats}
        metricTrends={summary.metricTrends}
      />
    ),
    queryTypes: persona.showQueryTypes ? (
      <DashboardQueryTypeTabs
        queryTypeCounts={queryTypeCounts}
        confirmedQueryTypeCounts={confirmedQueryTypeCounts}
        closedQueryTypeCounts={closedQueryTypeCounts}
        activeQueryTotal={activeQueryTotal}
        confirmedQueryTotal={confirmedQueryTotal}
        closedQueryTotal={closedQueryTotal}
        defaultTab={persona.defaultQueryTab}
        dateRange={dateRange}
      />
    ) : null,
    activity: null,
    collapsible: (
      <DashboardCollapsibleSection
        departmentWorkflow={departmentWorkflow}
        myTeam={summary.myTeam}
        showWorkflow={persona.id === "director"}
        showTeam={has(P.VIEW_TEAM)}
      />
    ),
  };

  const hasSection = (id) => persona.sections.includes(id) && sections[id];
  const leftSections = ["queryTypes", "pipeline", "workQueue", "collapsible"].filter(hasSection);
  const rightSections = ["inbox", "ticketingQueue", "readiness"].filter(hasSection);
  const renderedTopSections = new Set(["hero", "quickActions", "periodPresets", "stats"]);
  for (const id of [...leftSections, ...rightSections]) renderedTopSections.add(id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-5"
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-brand-border bg-white p-4 shadow-sm shadow-brand-dark/[0.03] md:p-6">
          <DashboardSectionBlock id="hero" sections={sections} persona={persona} />

          <div className="mt-5 flex flex-col gap-4 border-t border-brand-border/70 pt-5 lg:flex-row lg:items-end lg:justify-between">
            <DashboardSectionBlock id="quickActions" sections={sections} persona={persona} />
            <DashboardSectionBlock id="periodPresets" sections={sections} persona={persona} />
          </div>

          {hasSection("stats") ? (
            <div className="mt-6 border-t border-brand-border/70 pt-6">
              <DashboardSectionBlock id="stats" sections={sections} persona={persona} />
            </div>
          ) : null}
        </section>

        <div
          className={
            rightSections.length ? "grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]" : "grid gap-5"
          }
        >
          <div className="space-y-5">
            {leftSections.map((id) => (
              <DashboardSectionBlock key={id} id={id} sections={sections} persona={persona} />
            ))}
          </div>
          {rightSections.length ? (
            <aside className="space-y-5">
              {rightSections.map((id) => (
                <DashboardSectionBlock key={id} id={id} sections={sections} persona={persona} />
              ))}
            </aside>
          ) : null}
        </div>

        {persona.sections.flatMap((id) => {
          if (renderedTopSections.has(id)) return [];
          return [<DashboardSectionBlock key={id} id={id} sections={sections} persona={persona} />];
        })}
      </div>
    </motion.div>
  );
}
