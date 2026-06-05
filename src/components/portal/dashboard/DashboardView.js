"use client";

import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Plane,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { m as motion } from "motion/react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
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
import { DashboardUpcomingDepartures } from "./DashboardWorkQueue";
import { formatMoney } from "./utils";

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

  const metrics = [
    {
      label: "Active Queries",
      value: summary.metrics.activeQueries,
      Icon: ClipboardList,
      permission: P.VIEW_QUERIES,
    },
    {
      label: "Proposals Sent",
      value: summary.metrics.proposalsSent,
      Icon: FileText,
      permission: P.VIEW_PROPOSALS,
    },
    {
      label: "Confirmed Jobs",
      value: summary.metrics.confirmedJobs,
      Icon: CheckCircle2,
      permission: P.VIEW_QUERIES,
    },
    {
      label: "Open Job Cards",
      value: summary.metrics.jobCardsOpen,
      Icon: BriefcaseIcon,
      permission: P.VIEW_JOB_CARDS,
    },
    {
      label: "Tickets Issued",
      value: summary.metrics.ticketsIssued,
      Icon: Ticket,
      permission: P.VIEW_TICKETING,
    },
    {
      label: "Tickets Pending",
      value: summary.metrics.ticketsPending,
      Icon: Plane,
      permission: P.VIEW_TICKETING,
    },
    {
      label: "Visa Pending",
      value: summary.metrics.visaPending,
      Icon: ShieldCheck,
      permission: P.VIEW_VISA,
    },
    {
      label: "Outstanding",
      value: formatMoney(summary.metrics.outstandingAmount),
      Icon: CircleDollarSign,
      permission: P.VIEW_FINANCE,
    },
    {
      label: "Pending Approvals",
      value: summary.metrics.pendingApprovals,
      Icon: CheckCircle2,
      permission: P.VIEW_APPROVALS,
    },
    {
      label: "Revenue Pipeline",
      value: formatMoney(summary.metrics.revenuePipeline),
      Icon: CircleDollarSign,
      permission: P.VIEW_FINANCE,
    },
  ].filter((metric) => has(metric.permission));

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
      <div className="grid gap-5 xl:grid-cols-2">
        <DashboardUpcomingDepartures
          departures={summary.upcomingDepartures}
          dateRange={dateRange}
          hasJobCards={has(P.VIEW_JOB_CARDS)}
        />
        {has(P.VIEW_FINANCE) ? (
          <DashboardFinanceOverdue invoices={summary.overdueInvoices} dateRange={dateRange} />
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
      <DashboardTicketingQueue queue={summary.ticketAttentionQueue} dateRange={dateRange} />
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
    activity: (
      <DashboardActivityStrip activities={summary.recentActivity} canView={has(P.VIEW_ACTIVITY)} />
    ),
    collapsible: (
      <DashboardCollapsibleSection
        departmentWorkflow={departmentWorkflow}
        myTeam={summary.myTeam}
        showWorkflow={persona.id === "director"}
        showTeam={has(P.VIEW_TEAM)}
      />
    ),
  };

  const showStatsInboxRow =
    persona.sections.includes("stats") && persona.sections.includes("inbox");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8"
    >
      <DashboardSectionBlock id="hero" sections={sections} persona={persona} />
      {(persona.sections.includes("quickActions") ||
        persona.sections.includes("periodPresets")) && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 shrink">
            <DashboardSectionBlock id="quickActions" sections={sections} persona={persona} />
          </div>
          <div className="shrink-0 lg:ml-auto">
            <DashboardSectionBlock id="periodPresets" sections={sections} persona={persona} />
          </div>
        </div>
      )}
      {showStatsInboxRow ? (
        <div className="grid gap-5 max-sm:grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="max-sm:order-2">{sections.stats}</div>
          <div className="max-sm:order-1">{sections.inbox}</div>
        </div>
      ) : null}
      {persona.sections.flatMap((id) => {
        if (id === "hero" || id === "quickActions" || id === "periodPresets") return [];
        if (showStatsInboxRow && (id === "stats" || id === "inbox")) return [];
        return [<DashboardSectionBlock key={id} id={id} sections={sections} persona={persona} />];
      })}
    </motion.div>
  );
}
