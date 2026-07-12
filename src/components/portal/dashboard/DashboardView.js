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
import { useCallback, useState } from "react";
import { PORTAL_PERMISSIONS as P } from "@/lib/portal/constants";
import { groupDashboardSections, resolveDashboardPersona } from "@/lib/portal/dashboardPersona";
import { DashboardSectionSkeleton, DashboardStatsSkeleton } from "./DashboardSkeleton";
import {
  buildDashboardSections,
  buildQueryTypeCounts,
  buildWorkQueueRows,
} from "./dashboardViewHelpers";
import { formatMetricTrend, formatMoney } from "./utils";

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

function capacitySeverityClass(severity) {
  if (severity === "overloaded") {
    return "bg-red-100 text-red-700";
  }
  if (severity === "busy") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-emerald-100 text-emerald-700";
}

function DashboardCapacityHeatmap({ rows = EMPTY_CAPACITY_ROWS, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleOpen = useCallback(() => setOpen((value) => !value), []);
  if (!rows.length) {
    return null;
  }
  return (
    <section className="border-brand-border/70 border-b pb-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={toggleOpen}
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
                  className={`rounded-full px-2 py-0.5 font-sans text-[length:var(--portal-label-size)] ${capacitySeverityClass(row.severity)}`}
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
  const toggleOpen = useCallback(() => setOpen((value) => !value), []);
  if (!(pipeline || queryTypes)) {
    return null;
  }
  return (
    <section className="border-brand-border/70 border-b pb-4">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={toggleOpen}
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

function DashboardSectionList({ ids, persona, sections, className = "space-y-4" }) {
  if (!ids.length) {
    return null;
  }
  return (
    <div className={className}>
      {ids.map((id) => (
        <DashboardSectionBlock id={id} key={id} persona={persona} sections={sections} />
      ))}
    </div>
  );
}

function DashboardActionBar({ visible, persona, sections }) {
  if (!visible) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-brand-border/70 border-b pb-5">
      <DashboardSectionBlock id="quickActions" persona={persona} sections={sections} />
      <DashboardSectionBlock id="periodPresets" persona={persona} sections={sections} />
    </div>
  );
}

function urgentAlertLabel(count) {
  if (!count) {
    return "No urgent alerts";
  }
  return `${count} urgent ${count === 1 ? "alert" : "alerts"}`;
}

function DashboardToday({
  attentionSections,
  ownedWorkSections,
  persona,
  sections,
  urgentActionCount,
}) {
  const hasAttention = attentionSections.length > 0;
  const hasOwnedWork = ownedWorkSections.length > 0;
  if (!(hasAttention || hasOwnedWork)) {
    return null;
  }
  const splitLayout = hasAttention && hasOwnedWork;
  const gridClassName = splitLayout
    ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
    : "grid gap-4";
  return (
    <section aria-labelledby="dashboard-today-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-bold text-[length:var(--portal-label-size)] text-citius-orange uppercase tracking-[0.16em]">
            Command center
          </p>
          <h2
            className="mt-1 font-heading font-semibold text-brand-dark text-xl sm:text-2xl"
            id="dashboard-today-heading"
          >
            My work today
          </h2>
          <p className="mt-1 max-w-2xl text-brand-muted text-sm leading-relaxed">
            Start with urgent exceptions and owned work before the wider workspace picture.
          </p>
        </div>
        <span className="inline-flex min-h-8 w-fit items-center rounded-full bg-citius-orange/10 px-3 font-semibold text-citius-orange text-xs">
          {urgentAlertLabel(urgentActionCount)}
        </span>
      </div>

      <div className={gridClassName}>
        <DashboardSectionList
          className={`space-y-4 ${splitLayout ? "xl:order-2" : ""}`}
          ids={attentionSections}
          persona={persona}
          sections={sections}
        />
        <DashboardSectionList
          className={`space-y-4 ${splitLayout ? "xl:order-1" : ""}`}
          ids={ownedWorkSections}
          persona={persona}
          sections={sections}
        />
      </div>
    </section>
  );
}

function DashboardOverview({ ids, persona, sections }) {
  if (!ids.length) {
    return null;
  }
  return (
    <section
      aria-labelledby="dashboard-overview-heading"
      className="space-y-3 border-brand-border/70 border-b pb-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          className="font-heading font-semibold text-base text-brand-dark sm:text-lg"
          id="dashboard-overview-heading"
        >
          Workspace overview
        </h2>
        <p className="text-brand-muted text-xs">Supporting signals for the selected period</p>
      </div>
      <DashboardSectionList className="space-y-3" ids={ids} persona={persona} sections={sections} />
    </section>
  );
}

function DashboardReporting({ expanded, ids, persona, sections }) {
  if (!ids.length) {
    return null;
  }
  return (
    <section aria-labelledby="dashboard-reporting-heading" className="space-y-4">
      <div>
        <h2
          className="font-heading font-semibold text-base text-brand-dark sm:text-lg"
          id="dashboard-reporting-heading"
        >
          Performance & planning
        </h2>
        <p className="mt-1 text-brand-muted text-xs">
          Pipeline, mix, and trend context after today's priorities.
        </p>
      </div>
      {expanded ? (
        <DashboardSectionList ids={ids} persona={persona} sections={sections} />
      ) : (
        <DashboardPipelineTypesCollapsible
          defaultOpen={false}
          pipeline={sections.pipeline}
          queryTypes={sections.queryTypes}
        />
      )}
    </section>
  );
}

const OPS_PROGRESS_PERMISSIONS = [
  P.VIEW_JOB_CARDS,
  P.VIEW_TRAVELLERS,
  P.VIEW_TICKETING,
  P.VIEW_VISA,
  P.VIEW_OPERATIONS,
  P.VIEW_FINANCE,
];

function resolveDashboardLayout({ access, has, persona, sections }) {
  const availableSectionIds = Object.entries(sections).flatMap(([id, node]) =>
    node && persona.sections.includes(id) ? [id] : []
  );
  const groups = groupDashboardSections(persona, availableSectionIds);
  const isHeadRole = Boolean(access?.roles?.some((role) => role.includes("Head")));
  return {
    attentionSections: groups.today.filter((id) => id !== "workQueue"),
    groups,
    hasActionBar: ["quickActions", "periodPresets"].some((id) => availableSectionIds.includes(id)),
    isHeadRole,
    ownedWorkSections: groups.today.filter((id) => id === "workQueue"),
    showCapacity: has(P.VIEW_TEAM) || isHeadRole,
    showExpandedReporting: persona.id === "director" || isHeadRole,
  };
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
  const queryTypeData = buildQueryTypeCounts(summary, has, access);
  const showOpsProgress = OPS_PROGRESS_PERMISSIONS.some(has);
  const workQueueRows = buildWorkQueueRows({ dateRange, has, summary, urgentActions });
  const sections = buildDashboardSections({
    access,
    dateRange,
    departmentWorkflow,
    has,
    metrics,
    openModal,
    persona,
    queryTypeData,
    setDateRange,
    showOpsProgress,
    summary,
    urgentActions,
    workQueueRows,
  });

  const layout = resolveDashboardLayout({ access, has, persona, sections });

  return (
    <div className="space-y-6">
      <DashboardSectionBlock id="hero" persona={persona} sections={sections} />

      <DashboardActionBar persona={persona} sections={sections} visible={layout.hasActionBar} />

      <DashboardToday
        attentionSections={layout.attentionSections}
        ownedWorkSections={layout.ownedWorkSections}
        persona={persona}
        sections={sections}
        urgentActionCount={urgentActions.length}
      />

      <DashboardOverview ids={layout.groups.overview} persona={persona} sections={sections} />

      {layout.showCapacity ? (
        <DashboardCapacityHeatmap defaultOpen={layout.isHeadRole} rows={summary.capacity} />
      ) : null}

      <DashboardReporting
        expanded={layout.showExpandedReporting}
        ids={layout.groups.reporting}
        persona={persona}
        sections={sections}
      />

      <DashboardSectionList ids={layout.groups.supporting} persona={persona} sections={sections} />
    </div>
  );
}
