import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { buildDashboardListUrl } from "@/lib/portal/dashboardLinks";
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
import { DashboardStatGrid } from "./DashboardStatGrid";
import { DashboardTicketingQueue } from "./DashboardTicketingQueue";
import { DashboardUpcomingDepartures, DashboardWorkQueuesSummary } from "./DashboardWorkQueue";
import { formatOldestDays } from "./utils";

export function buildQueryTypeCounts(summary, has, access) {
  const queryTypeOptions = getQueryTypeOptions(access);
  const emptyQueryTypeCounts = () => queryTypeOptions.map((type) => ({ count: 0, type }));
  if (!has(P.VIEW_QUERIES)) {
    return {
      activeQueryTotal: 0,
      closedQueryTotal: 0,
      closedQueryTypeCounts: [],
      confirmedQueryTotal: 0,
      confirmedQueryTypeCounts: [],
      queryTypeCounts: [],
    };
  }
  const queryTypeCounts = summary.queriesByType?.length
    ? summary.queriesByType
    : emptyQueryTypeCounts();
  const confirmedQueryTypeCounts = summary.confirmedQueriesByType?.length
    ? summary.confirmedQueriesByType
    : emptyQueryTypeCounts();
  const closedQueryTypeCounts = summary.closedQueriesByType?.length
    ? summary.closedQueriesByType
    : emptyQueryTypeCounts();
  return {
    activeQueryTotal: queryTypeCounts.reduce((sum, item) => sum + item.count, 0),
    closedQueryTotal: closedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0),
    closedQueryTypeCounts,
    confirmedQueryTotal: confirmedQueryTypeCounts.reduce((sum, item) => sum + item.count, 0),
    confirmedQueryTypeCounts,
    queryTypeCounts,
  };
}

export function buildWorkQueueRows({ summary, has, dateRange, urgentActions }) {
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

  return [
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
}

export function buildDashboardSections({
  summary,
  has,
  access,
  dateRange,
  setDateRange,
  openModal,
  persona,
  metrics,
  urgentActions,
  departmentWorkflow,
  showOpsProgress,
  queryTypeData,
  workQueueRows,
}) {
  const {
    activeQueryTotal,
    closedQueryTotal,
    closedQueryTypeCounts,
    confirmedQueryTotal,
    confirmedQueryTypeCounts,
    queryTypeCounts,
  } = queryTypeData;

  return {
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
      <DashboardHero
        dateRange={dateRange}
        displayName={access?.name}
        generatedAt={summary?.generatedAt}
        ownedWorkSla={summary?.ownedWorkSla}
        showSlaStrip={persona.id === "director" || access?.roles?.some((role) => role.includes("Head"))}
      />
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
    stats: <DashboardStatGrid featuredMetricId={persona.featuredMetricId} metrics={metrics} />,
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
        <div className="grid gap-5 2xl:grid-cols-2">
          <DashboardWorkQueuesSummary rows={workQueueRows} />
          {persona.sections.includes("activity") && (
            <DashboardActivityStrip
              activities={summary.recentActivity}
              canView={has(P.VIEW_ACTIVITY)}
            />
          )}
          {!persona.sections.includes("activity") && has(P.VIEW_FINANCE) && (
            <DashboardFinanceOverdue dateRange={dateRange} invoices={summary.overdueInvoices} />
          )}
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
}
