import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query as convexQuery } from "../_generated/server";
import {
  CEMENT_QUERY_TYPES,
  canSeeAllPortalRecords,
  filterRecordsByDateRange,
  isHead,
  PERMISSIONS,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import { aggregateMetric, loadMetricCoverage, loadMetricTotals } from "./metricAggregates";
import type { MetricValues } from "./metricTypes";
import { getNotificationHref } from "./notificationPaths";
import {
  loadDashboardActivitySnapshot,
  loadDashboardCapacitySnapshot,
  loadDashboardSummarySnapshot,
  OPERATIONAL_DETAIL_LIMIT,
} from "./operationalSnapshots";
import type { QueryType } from "./queryValidators";
import {
  aggregateCoverageValidator,
  portalDashboardActivityResultValidator,
  portalDashboardCapacityResultValidator,
  portalSummaryResultValidator,
} from "./returnContracts";
import { queryNeedsTicketingHeadIntakeAlert } from "./ticketingIntakePolicy";

function formatAggregateCoverage(aggregate: Awaited<ReturnType<typeof loadMetricCoverage>>) {
  return {
    bucketCount: aggregate.bucketCount,
    complete: aggregate.complete,
    completedSources: aggregate.readiness.completedSources,
    detailRowLimit: OPERATIONAL_DETAIL_LIMIT,
    dirty: {
      hasPending: aggregate.readiness.dirty.hasPending,
      oldestUpdatedAt: aggregate.readiness.dirty.oldestUpdatedAt
        ? new Date(aggregate.readiness.dirty.oldestUpdatedAt).toISOString()
        : null,
    },
    errorSummary: aggregate.readiness.errorSummary,
    freshnessMinutes: 15,
    generation: aggregate.readiness.generation,
    lastCompletedAt: aggregate.readiness.lastCompletedAt
      ? new Date(aggregate.readiness.lastCompletedAt).toISOString()
      : null,
    // SAFETY: aggregate readiness is emitted by the closed metric-readiness state machine.
    state: aggregate.readiness.state as "pending" | "ready" | "reconciling" | "stale",
    updatedAt: aggregate.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
    version: aggregate.readiness.version,
  };
}

export const getPortalMetricCoverage = convexQuery({
  args: {
    dateRange: portalDateRangeValidator,
    referenceNow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const dateRange = args.dateRange ?? undefined;
    const aggregate = await loadMetricCoverage(
      ctx,
      shouldApplyCementScope(access) ? "cement" : "all",
      dateRange,
      args.referenceNow
    );
    return formatAggregateCoverage(aggregate);
  },
  returns: aggregateCoverageValidator,
});

function buildDashboardPeople(access: any, queries: any[], jobCards: any[], staff: any[]) {
  const closedSalesStatuses = new Set(["Order Confirmed", "Order Lost"]);
  const capacityByRole = staff.reduce<
    Map<string, { load: number; role: string; staffCount: number }>
  >((map, member) => {
    if (!member.active) {
      return map;
    }
    const staffId = String(member._id);
    const load =
      queries.filter(
        (query) =>
          String(query.salesOwnerId) === staffId && !closedSalesStatuses.has(query.salesStatus)
      ).length +
      queries.filter(
        (query) =>
          String(query.contractingOwnerId) === staffId &&
          !closedSalesStatuses.has(query.salesStatus)
      ).length +
      jobCards.filter((job) => {
        const ownerIds = new Set(
          [job.contractingOwnerId, job.operationsOwnerId, job.ticketingOwnerId].map(String)
        );
        return ownerIds.has(staffId) && job.status !== "Closed";
      }).length;
    for (const role of member.roles) {
      const current = map.get(role) ?? { load: 0, role, staffCount: 0 };
      current.staffCount += 1;
      current.load += load;
      map.set(role, current);
    }
    return map;
  }, new Map<string, { role: string; staffCount: number; load: number }>());
  return {
    capacity: Array.from(capacityByRole.values())
      .map((row) => {
        let severity: "busy" | "normal" | "overloaded" = "normal";
        if (row.staffCount && row.load / row.staffCount >= 10) {
          severity = "overloaded";
        } else if (row.staffCount && row.load / row.staffCount >= 6) {
          severity = "busy";
        }
        return {
          ...row,
          averageLoad: row.staffCount ? Math.round(row.load / row.staffCount) : 0,
          severity,
        };
      })
      .sort((a, b) => b.averageLoad - a.averageLoad)
      .slice(0, 8),
    myTeam: staff
      .filter((member) => {
        if (!member.active) {
          return false;
        }
        const accessRoles = new Set(access.roles);
        return member.roles.some((role: string) => accessRoles.has(role));
      })
      .slice(0, 6)
      .map((member) => ({
        department: member.department ?? member.roles[0] ?? "",
        email: member.email,
        function: member.function ?? member.roles.join(", "),
        id: member._id,
        location: member.location ?? "",
        name: member.name,
      })),
  };
}

export const getPortalDashboardCapacity = convexQuery({
  args: { dateRange: portalDateRangeValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    if (!access.permissions.includes(PERMISSIONS.VIEW_TEAM)) {
      return { capacity: [], myTeam: [] };
    }
    const dateRange = args.dateRange ?? undefined;
    const snapshot = await loadDashboardCapacitySnapshot(ctx, access, dateRange);
    return buildDashboardPeople(access, snapshot.queries, snapshot.jobCards, snapshot.staff);
  },
  returns: portalDashboardCapacityResultValidator,
});

export const getPortalDashboardActivity = convexQuery({
  args: { dateRange: portalDateRangeValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    if (!access.permissions.includes(PERMISSIONS.VIEW_ACTIVITY)) {
      return [];
    }
    const rows = await loadDashboardActivitySnapshot(ctx, access, args.dateRange ?? undefined);
    return rows.map((activity) => ({
      action: activity.action,
      actorName: activity.actorName,
      createdAt: new Date(activity.createdAt).toISOString(),
      entityId: activity.entityId ?? "",
      entityType: activity.entityType,
      id: activity._id,
      message: activity.message,
    }));
  },
  returns: portalDashboardActivityResultValidator,
});

function aggregatePipelineSnapshot(values: MetricValues) {
  return SALES_PIPELINE_STAGES.map((stage) => {
    const count = aggregateMetric(values, `queries.stage.${stage}.count`);
    const value = aggregateMetric(values, `queries.stage.${stage}.budget`);
    return {
      count,
      stage,
      value,
      weighted: Math.round(value * PIPELINE_STAGE_WEIGHTS[stage]),
    };
  });
}

export function groupByJobCardId<T extends { jobCardId: Id<"jobCards"> }>(rows: T[]) {
  const grouped = new Map<Id<"jobCards">, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.jobCardId) ?? [];
    bucket.push(row);
    grouped.set(row.jobCardId, bucket);
  }
  return grouped;
}

const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

const PIPELINE_STAGE_WEIGHTS = {
  Confirmation: 0.9,
  Inquiry: 0.1,
  Lost: 0,
  Negotiation: 0.5,
  Proposal: 0.25,
} satisfies Record<(typeof SALES_PIPELINE_STAGES)[number], number>;

function daysFromIso(iso: string, offsetDays: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildMetricTrend(current: number, prior: number) {
  const delta = current - prior;
  let direction: "down" | "flat" | "up" = "flat";
  if (delta > 0) {
    direction = "up";
  } else if (delta < 0) {
    direction = "down";
  }
  return {
    delta: Math.abs(delta),
    direction,
  };
}

const QUERY_TYPES = [
  "MICE",
  "MICE Bidding",
  "Cement",
  "Cement Bidding",
  "FIT",
  "Family Group",
  "B2B",
  "Spiritual",
] as const;

const SALES_PIPELINE_STAGES = [
  "Inquiry",
  "Proposal",
  "Negotiation",
  "Confirmation",
  "Lost",
] as const;

const TICKET_ATTENTION_STATUSES = new Set([
  "Name Change Required",
  "Reissue Required",
  "Refund Pending",
]);

const isActiveQuery = (query: { salesStatus: string }) =>
  query.salesStatus !== "Order Confirmed" && query.salesStatus !== "Order Lost";

const isConfirmedQuery = (query: { salesStatus: string }) =>
  query.salesStatus === "Order Confirmed";

const isClosedQuery = (query: { salesStatus: string }) => query.salesStatus === "Order Lost";

function countQueriesByType<T extends { queryType: string }>(
  records: T[],
  types: readonly string[] = QUERY_TYPES
) {
  return types.map((type) => ({
    count: records.filter((query) => query.queryType === type).length,
    // SAFETY: types defaults to QUERY_TYPES and custom callers pass only QueryType values.
    type: type as QueryType,
  }));
}

interface UrgentAction {
  createdAt?: string;
  entityId: string;
  entityType: string;
  href: string;
  id: string;
  label: string;
  type: "approvals" | "finance" | "accounts" | "ticketing";
}

function addPendingApprovalActions(actions: UrgentAction[], approvals: any[]) {
  for (const approval of approvals) {
    if (approval.status !== "Pending") {
      continue;
    }
    const entityId = approval._id;
    actions.push({
      createdAt: approval.createdAt ? new Date(approval.createdAt).toISOString() : undefined,
      entityId,
      entityType: "approval",
      href: getNotificationHref({ entityId, entityType: "approval", title: "" }),
      id: approval._id,
      label: `${approval.requestCode} approval pending: ${approval.summary}`,
      type: "approvals",
    });
  }
}

function addOverdueInvoiceActions(actions: UrgentAction[], invoices: any[], nowDate: string) {
  for (const invoice of invoices) {
    if (!(invoice.balanceAmount > 0 && invoice.dueDate && invoice.dueDate < nowDate)) {
      continue;
    }
    actions.push({
      createdAt: invoice.updatedAt ? new Date(invoice.updatedAt).toISOString() : undefined,
      entityId: invoice._id,
      entityType: "invoice",
      href: "/portal/finance",
      id: invoice._id,
      label: `${invoice.invoiceNumber} has overdue balance`,
      type: "finance",
    });
  }
}

function addMissingJobCardActions(
  actions: UrgentAction[],
  queries: any[],
  queryIdsWithJobCards: Set<string>
) {
  for (const query of queries) {
    if (query.salesStatus !== "Order Confirmed" || queryIdsWithJobCards.has(query._id)) {
      continue;
    }
    const entityId = query._id;
    actions.push({
      createdAt: query.confirmedAt ? new Date(query.confirmedAt).toISOString() : undefined,
      entityId,
      entityType: "query",
      href: getNotificationHref({
        entityId,
        entityType: "query",
        title: "Order confirmed",
      }),
      id: query._id,
      label: `${query.queryCode} needs Job Card creation`,
      type: "accounts",
    });
  }
}

function addTicketAttentionActions(actions: UrgentAction[], tickets: any[]) {
  for (const ticket of tickets) {
    if (!TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus)) {
      continue;
    }
    const entityId = ticket._id;
    actions.push({
      createdAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : undefined,
      entityId,
      entityType: "ticket",
      href: getNotificationHref({ entityId, entityType: "ticket", title: "" }),
      id: ticket._id,
      label: `Ticket ${ticket.ticketNumber || ticket._id} needs attention`,
      type: "ticketing",
    });
  }
}

export function buildUrgentActions({
  approvals,
  invoices,
  queries,
  jobCards,
  tickets,
  nowDate,
}: {
  approvals: Array<{
    _id: string;
    status: string;
    requestCode: string;
    summary: string;
    createdAt?: number;
  }>;
  invoices: Array<{
    _id: string;
    invoiceNumber: string;
    balanceAmount: number;
    dueDate?: string;
    updatedAt?: number;
  }>;
  queries: Array<{
    _id: string;
    confirmedAt?: number;
    salesStatus: string;
    queryCode: string;
    updatedAt?: number;
  }>;
  jobCards: Array<{ queryId?: string }>;
  tickets: Array<{ _id: string; ticketNumber?: string; ticketStatus: string; updatedAt?: number }>;
  nowDate: string;
}) {
  const actions: UrgentAction[] = [];
  const queryIdsWithJobCards = new Set(
    jobCards.flatMap((job) => (job.queryId ? [job.queryId] : []))
  );

  addPendingApprovalActions(actions, approvals);
  addOverdueInvoiceActions(actions, invoices, nowDate);
  addMissingJobCardActions(actions, queries, queryIdsWithJobCards);
  addTicketAttentionActions(actions, tickets);

  return actions.slice(0, 8);
}

function daysSinceIso(iso: string | undefined, referenceNow: number) {
  if (!iso) {
    return null;
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.floor((referenceNow - timestamp) / 86_400_000));
}

export function buildOwnedWorkSla(
  urgentActions: ReturnType<typeof buildUrgentActions>,
  referenceNow: number,
  headItems: Array<{
    count: number;
    href: string;
    label: string;
    oldestDays: number | null;
  }> = []
) {
  const typeLabels = {
    accounts: "Job cards to open",
    approvals: "Approvals pending",
    finance: "Overdue invoices",
    ticketing: "Ticketing follow-ups",
  } satisfies Record<string, string>;
  const buckets = new Map<
    string,
    { count: number; href: string; label: string; oldestDays: number | null }
  >();

  for (const action of urgentActions) {
    const existing = buckets.get(action.type);
    const oldestDays = daysSinceIso(action.createdAt, referenceNow);
    if (!existing) {
      buckets.set(action.type, {
        count: 1,
        href: action.href,
        label: typeLabels[action.type] ?? action.type,
        oldestDays,
      });
      continue;
    }
    existing.count += 1;
    if (oldestDays !== null && (existing.oldestDays === null || oldestDays > existing.oldestDays)) {
      existing.oldestDays = oldestDays;
    }
  }

  const items = [
    ...headItems,
    ...Array.from(buckets.values()).sort((left, right) => right.count - left.count),
  ].slice(0, 5);
  const oldestDays = items.reduce<number | null>((oldest, item) => {
    if (item.oldestDays === null) {
      return oldest;
    }
    return oldest === null ? item.oldestDays : Math.max(oldest, item.oldestDays);
  }, null);

  return {
    items,
    oldestDays,
    totalOpen: items.reduce((sum, item) => sum + item.count, 0),
  };
}

interface HeadAssignmentSlaItem {
  count: number;
  entityId: string;
  entityType: "query" | "jobCard";
  href: string;
  label: string;
  oldestDays: null;
}

function hasAnyDashboardRole(roles: Set<string>, expected: string[]) {
  return expected.some((role) => roles.has(role));
}

function appendContractingAssignments(
  items: HeadAssignmentSlaItem[],
  queries: any[],
  closedSales: Set<string>
) {
  for (const query of queries) {
    if (items.length >= 5) {
      return;
    }
    if (closedSales.has(query.salesStatus) || query.contractingOwnerId) {
      continue;
    }
    const entityId = String(query._id);
    items.push({
      count: 1,
      entityId,
      entityType: "query",
      href: getNotificationHref({
        entityId,
        entityType: "query",
        title: "Query ready for assignment",
      }),
      label: `${query.queryCode} — assign Contracting SPOC`,
      oldestDays: null,
    });
  }
}

function appendOperationsAssignments(items: HeadAssignmentSlaItem[], jobCards: any[]) {
  for (const job of jobCards) {
    if (items.length >= 5) {
      return;
    }
    if (job.status === "Closed" || job.operationsOwnerId) {
      continue;
    }
    const entityId = String(job._id);
    items.push({
      count: 1,
      entityId,
      entityType: "jobCard",
      href: getNotificationHref({
        entityId,
        entityType: "jobCard",
        title: "Assign operations owner",
      }),
      label: `${job.jobCode} — assign Operations owner`,
      oldestDays: null,
    });
  }
}

function appendTicketingAssignments(items: HeadAssignmentSlaItem[], queries: any[]) {
  for (const query of queries) {
    if (items.length >= 5) {
      return;
    }
    if (!queryNeedsTicketingHeadIntakeAlert(query)) {
      continue;
    }
    const entityId = String(query._id);
    items.push({
      count: 1,
      entityId,
      entityType: "query",
      href: getNotificationHref({
        entityId,
        entityType: "query",
        title: "Assign Ticketing SPOC",
      }),
      label: `${query.queryCode} — assign Ticketing SPOC`,
      oldestDays: null,
    });
  }
}

export function buildHeadAssignmentSlaItems(
  access: { roles: string[] },
  queries: Array<{
    _id: string;
    queryCode: string;
    salesStatus: string;
    contractingOwnerId?: string;
    ticketingOwnerId?: string;
    ticketingScope?: string;
  }>,
  jobCards: Array<{
    _id: string;
    jobCode: string;
    status: string;
    operationsOwnerId?: string;
  }>
) {
  // SAFETY: this helper needs only roles, which is the complete portion of PortalAccess read by isHead.
  if (!isHead(access as Parameters<typeof isHead>[0])) {
    return [];
  }
  const items: HeadAssignmentSlaItem[] = [];
  const closedSales = new Set(["Order Confirmed", "Order Lost"]);
  const roles = new Set(access.roles);

  if (hasAnyDashboardRole(roles, ["Contracting Head", "Admin", "Directors"])) {
    appendContractingAssignments(items, queries, closedSales);
  }

  if (hasAnyDashboardRole(roles, ["Operations Head", "Admin", "Directors"])) {
    appendOperationsAssignments(items, jobCards);
  }

  if (hasAnyDashboardRole(roles, ["Head of Ticketing", "Admin", "Directors"])) {
    appendTicketingAssignments(items, queries);
  }

  return items;
}

export function buildPipelineSnapshot(
  queries: Array<{ leadStage?: string; budgetAmount?: number; paxCount?: number }>
) {
  return SALES_PIPELINE_STAGES.map((stage) => {
    const stageQueries = queries.filter((q) => (q.leadStage || "Inquiry") === stage);
    const value = stageQueries.reduce(
      (sum, query) => sum + (query.budgetAmount ?? 0) * Math.max(query.paxCount ?? 1, 1),
      0
    );
    const weight = PIPELINE_STAGE_WEIGHTS[stage];
    return {
      count: stageQueries.length,
      stage,
      value,
      weighted: Math.round(value * weight),
    };
  });
}

export function buildTicketAttentionQueue(
  tickets: Array<{ _id: string; ticketNumber?: string; ticketStatus: string }>
) {
  return tickets
    .filter((ticket) => TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus))
    .slice(0, 8)
    .map((ticket) => ({
      // SAFETY: tickets is populated exclusively from the tickets table query above.
      id: ticket._id as Id<"tickets">,
      ticketNumber: ticket.ticketNumber || ticket._id,
      ticketStatus: ticket.ticketStatus,
    }));
}

export function buildOverdueInvoices({
  invoices,
  jobCards,
  nowDate,
}: {
  invoices: Array<{
    _id: string;
    jobCardId?: string;
    invoiceNumber: string;
    balanceAmount: number;
    dueDate?: string;
  }>;
  jobCards: Array<{ _id: string; clientName?: string }>;
  nowDate: string;
}) {
  const jobCardById = new Map(jobCards.map((job) => [job._id, job]));

  return invoices
    .filter((invoice) => invoice.balanceAmount > 0 && invoice.dueDate && invoice.dueDate < nowDate)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
    .slice(0, 8)
    .map((invoice) => {
      const job = invoice.jobCardId ? jobCardById.get(invoice.jobCardId) : null;
      return {
        balanceAmount: invoice.balanceAmount,
        clientName: job?.clientName ?? "",
        dueDate: invoice.dueDate ?? "",
        // SAFETY: invoices is populated exclusively from the invoices table query above.
        id: invoice._id as Id<"invoices">,
        invoiceNumber: invoice.invoiceNumber,
      };
    });
}

type SummaryMetricDomain =
  | "approvals"
  | "invoices"
  | "jobCards"
  | "proposals"
  | "queries"
  | "tickets"
  | "travellers"
  | "visas";

function isSummaryMetricDomain(value: string): value is SummaryMetricDomain {
  switch (value) {
    case "approvals":
    case "invoices":
    case "jobCards":
    case "proposals":
    case "queries":
    case "tickets":
    case "travellers":
    case "visas":
      return true;
    default:
      return false;
  }
}

function createSummaryAggregateReader({
  aggregate,
  canUseOrganizationAggregates,
  permissions,
}: any) {
  const domainAccess = {
    approvals: permissions.approvals,
    invoices: permissions.finance,
    jobCards: permissions.jobCards,
    proposals: permissions.proposals,
    queries: permissions.queries,
    tickets: permissions.tickets,
    travellers: permissions.travellers,
    visas: permissions.visas,
  } satisfies Record<SummaryMetricDomain, boolean>;
  const canUseKey = (key: string) => {
    const [domain] = key.split(".");
    return Boolean(
      aggregate.complete &&
        canUseOrganizationAggregates &&
        domain &&
        isSummaryMetricDomain(domain) &&
        domainAccess[domain]
    );
  };
  return {
    canUseKey,
    value: (key: string, fallback: number) =>
      canUseKey(key) ? aggregateMetric(aggregate.values, key, fallback) : fallback,
  };
}

function jobProgressValue(
  jobAggregateById: Map<string, any>,
  jobId: string,
  key: string,
  fallback: number
) {
  const jobAggregate = jobAggregateById.get(String(jobId));
  return jobAggregate?.complete ? aggregateMetric(jobAggregate.values, key, fallback) : fallback;
}

function buildActiveTourRows({
  activeJobs,
  jobAggregateById,
  queriesById,
  travellersByJobCard,
}: any) {
  return activeJobs.slice(0, 6).map((job: any) => {
    const linkedQuery = job.queryId ? queriesById.get(String(job.queryId)) : null;
    const jobTravellers = travellersByJobCard.get(job._id) ?? [];
    const jobTravellerTotal = jobProgressValue(
      jobAggregateById,
      job._id,
      "travellers.total",
      jobTravellers.length
    );
    const jobTicketsIssued = jobProgressValue(
      jobAggregateById,
      job._id,
      "travellers.ticketIssued",
      jobTravellers.filter((traveller: any) => traveller.ticketStatus === "Issued").length
    );
    const jobVisasApproved = jobProgressValue(
      jobAggregateById,
      job._id,
      "travellers.visaApproved",
      jobTravellers.filter((traveller: any) =>
        ["Approved", "Not Required"].includes(traveller.visaStatus)
      ).length
    );
    return {
      clientName: job.clientName,
      contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
      destination: job.destination ?? "",
      id: job._id,
      jobCode: job.jobCode,
      pax: job.confirmedPax,
      queryCode: linkedQuery?.queryCode ?? "",
      status: job.status,
      ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
      ticketProgress: percent(jobTicketsIssued, jobTravellerTotal),
      travelStartDate: job.travelStartDate ?? "",
      visaProgress: percent(jobVisasApproved, jobTravellerTotal),
    };
  });
}

function departureReadiness(ticketProgress: number, visaProgress: number) {
  if (ticketProgress >= 100 && visaProgress >= 100) {
    return "Ready" as const;
  }
  return visaProgress < 100 ? ("Docs pending" as const) : ("Ticketing" as const);
}

function buildUpcomingDepartureRows({
  activeJobs,
  jobAggregateById,
  nowDate,
  queriesById,
  travellersByJobCard,
}: any) {
  return activeJobs
    .filter((job: any) => job.travelStartDate && job.travelStartDate >= nowDate)
    .sort((a: any, b: any) => String(a.travelStartDate).localeCompare(String(b.travelStartDate)))
    .slice(0, 6)
    .map((job: any) => {
      const linkedQuery = job.queryId ? queriesById.get(String(job.queryId)) : null;
      const jobTravellers = travellersByJobCard.get(job._id) ?? [];
      const jobTravellerTotal = jobProgressValue(
        jobAggregateById,
        job._id,
        "travellers.total",
        jobTravellers.length
      );
      const ticketProgress = percent(
        jobProgressValue(
          jobAggregateById,
          job._id,
          "travellers.ticketIssued",
          jobTravellers.filter((traveller: any) => traveller.ticketStatus === "Issued").length
        ),
        jobTravellerTotal
      );
      const visaProgress = percent(
        jobProgressValue(
          jobAggregateById,
          job._id,
          "travellers.visaApproved",
          jobTravellers.filter((traveller: any) =>
            ["Approved", "Not Required"].includes(traveller.visaStatus)
          ).length
        ),
        jobTravellerTotal
      );
      return {
        clientName: job.clientName,
        contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
        destination: job.destination ?? "",
        id: job._id,
        jobCode: job.jobCode,
        pax: job.confirmedPax,
        queryCode: linkedQuery?.queryCode ?? "",
        readiness: departureReadiness(ticketProgress, visaProgress),
        ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
        tourManagerName: job.tourManagerName ?? "",
        travelStartDate: job.travelStartDate ?? "",
      };
    });
}

function metricPeriodValue(
  canUseAggregateKey: (key: string) => boolean,
  key: string,
  aggregate: any,
  fallback: number
) {
  return canUseAggregateKey(key) && aggregate.complete
    ? aggregateMetric(aggregate.values, key)
    : fallback;
}

function previousDepartureCount(allActiveJobs: any[], nowDate: string) {
  return allActiveJobs.filter(
    (job) =>
      job.travelStartDate &&
      job.travelStartDate >= daysFromIso(nowDate, -60) &&
      job.travelStartDate <= daysFromIso(nowDate, -31)
  ).length;
}

function summaryQueryTypes(cementScope: boolean) {
  return cementScope ? [...CEMENT_QUERY_TYPES] : QUERY_TYPES;
}

function loadJobProgressAggregates(
  ctx: any,
  aggregateComplete: boolean,
  progressJobs: any[],
  dateRange: any,
  referenceNow: number
) {
  if (!aggregateComplete) {
    return [];
  }
  return Promise.all(
    progressJobs.map(
      async (job) =>
        [
          String(job._id),
          await loadMetricTotals(ctx, `job:${String(job._id)}`, dateRange, referenceNow),
        ] as const
    )
  );
}

function visibleUrgentActions(actions: UrgentAction[], canViewFinance: boolean) {
  return canViewFinance ? actions : actions.filter((action) => action.type !== "finance");
}

function summaryQueryCounts(
  canUseAggregates: boolean,
  queryTypes: readonly QueryType[],
  aggregate: any,
  records: Array<{ queryType: string }>,
  metricSuffix: "active" | "confirmed" | "lost"
) {
  if (!canUseAggregates) {
    return countQueriesByType(records, queryTypes);
  }
  return queryTypes.map((type) => ({
    count: aggregateMetric(aggregate.values, `queries.type.${type}.${metricSuffix}`),
    type,
  }));
}

export const getPortalSummary = convexQuery({
  args: {
    dateRange: portalDateRangeValidator,
    referenceNow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const canViewApprovals = access.permissions.includes(PERMISSIONS.VIEW_APPROVALS);
    const canViewFinance = access.permissions.includes(PERMISSIONS.VIEW_FINANCE);
    const canViewJobCards = access.permissions.includes(PERMISSIONS.VIEW_JOB_CARDS);
    const canViewProposals = access.permissions.includes(PERMISSIONS.VIEW_PROPOSALS);
    const canViewQueries = access.permissions.includes(PERMISSIONS.VIEW_QUERIES);
    const canViewTickets = access.permissions.includes(PERMISSIONS.VIEW_TICKETING);
    const canViewTravellers = access.permissions.includes(PERMISSIONS.VIEW_TRAVELLERS);
    const canViewVisa = access.permissions.includes(PERMISSIONS.VIEW_VISA);
    const dateRange = args.dateRange ?? undefined;
    const aggregateScope = shouldApplyCementScope(access) ? "cement" : "all";
    const aggregate = await loadMetricTotals(ctx, aggregateScope, dateRange, args.referenceNow);
    const canUseOrganizationAggregates = canSeeAllPortalRecords(access) || isHead(access);
    const needsFallbackRows = !(aggregate.complete && canUseOrganizationAggregates);
    const snapshot = await loadDashboardSummarySnapshot(ctx, access, dateRange, needsFallbackRows);
    const referenceNow =
      args.referenceNow ?? aggregate.updatedAt ?? aggregate.readiness.lastCompletedAt ?? 0;
    const { approvals, invoices, jobCards, proposals, queries, tickets, travellers, visas } =
      snapshot;

    const jobCardByIdForTravellers = new Map(jobCards.map((job) => [job._id, job]));
    const travellersByJobCard = groupByJobCardId(travellers);

    const scopedAllQueries = snapshot.allQueries;
    const scopedAllProposals = snapshot.allProposals;
    const scopedAllJobCards = snapshot.allJobCards;
    const scopedAllTickets = snapshot.allTickets;

    const queryTypesForCounts = summaryQueryTypes(shouldApplyCementScope(access));

    const activeJobs = jobCards.filter((job) => job.status !== "Closed");
    const nowDate = new Date(referenceNow).toISOString().slice(0, 10);
    const progressJobs = Array.from(
      new Map(
        [
          ...activeJobs.slice(0, 6),
          ...activeJobs
            .filter((job) => job.travelStartDate && job.travelStartDate >= nowDate)
            .sort((a, b) => String(a.travelStartDate).localeCompare(String(b.travelStartDate)))
            .slice(0, 6),
        ].map((job) => [String(job._id), job])
      ).values()
    );
    const jobAggregateEntries = await loadJobProgressAggregates(
      ctx,
      aggregate.complete,
      progressJobs,
      dateRange,
      referenceNow
    );
    const jobAggregateById = new Map(jobAggregateEntries);
    const queriesById = new Map(queries.map((queryRow) => [String(queryRow._id), queryRow]));
    const ticketsIssued = tickets.filter((ticket) => ticket.ticketStatus === "Issued").length;
    const visaApproved = visas.filter((visa) =>
      ["Approved", "Not Required"].includes(visa.status)
    ).length;
    const roomingDone = travellers.filter((traveller) => traveller.hotelAllocation).length;
    const guestDataDone = travellers.filter(
      (traveller) => traveller.fullName && traveller.travelHub && traveller.foodPreference
    ).length;
    const expectedPayment = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const receivedPayment = invoices.reduce((sum, invoice) => sum + invoice.receivedAmount, 0);
    const outstandingAmount = invoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0),
      0
    );
    const revenuePipeline = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const activeQueryRecords = queries.filter(isActiveQuery);
    const confirmedQueryRecords = queries.filter(isConfirmedQuery);
    const closedQueryRecords = queries.filter(isClosedQuery);
    const allActiveJobs = scopedAllJobCards.filter((job) => job.status !== "Closed");
    const departures30d = allActiveJobs.filter(
      (job) =>
        job.travelStartDate &&
        job.travelStartDate >= nowDate &&
        job.travelStartDate <= daysFromIso(nowDate, 30)
    ).length;
    const passportDone = travellers.filter(
      (traveller) => traveller.passportStatus === "Received"
    ).length;
    const tourManagerDone = travellers.filter((traveller) => {
      const job = jobCardByIdForTravellers.get(traveller.jobCardId);
      return Boolean(job?.tourManagerName || job?.tourManagerId);
    }).length;

    const { canUseKey: canUseAggregateKey, value: aggregateValue } = createSummaryAggregateReader({
      aggregate,
      canUseOrganizationAggregates,
      permissions: {
        approvals: canViewApprovals,
        finance: canViewFinance,
        jobCards: canViewJobCards,
        proposals: canViewProposals,
        queries: canViewQueries,
        tickets: canViewTickets,
        travellers: canViewTravellers,
        visas: canViewVisa,
      },
    });
    const aggregateActiveQueries = aggregateValue("queries.active", activeQueryRecords.length);
    const aggregateConfirmedQueries = aggregateValue(
      "queries.confirmed",
      confirmedQueryRecords.length
    );
    const aggregateJobCardsOpen = aggregateValue("jobCards.open", activeJobs.length);
    const aggregateTravellerTotal = aggregateValue("travellers.total", travellers.length);
    const aggregateGuestDataDone = aggregateValue("travellers.guestDataDone", guestDataDone);
    const aggregatePassportDone = aggregateValue("travellers.passportDone", passportDone);
    const aggregateRoomingDone = aggregateValue("travellers.roomingDone", roomingDone);
    const aggregateTravellerTicketsIssued = aggregateValue(
      "travellers.ticketIssued",
      ticketsIssued
    );
    const aggregateTourManagerDone = aggregateValue("travellers.tourManagerDone", tourManagerDone);
    const aggregateVisaApproved = aggregateValue("travellers.visaApproved", visaApproved);
    const aggregateExpectedPayment = aggregateValue("invoices.expected", expectedPayment);
    const aggregateReceivedPayment = aggregateValue("invoices.received", receivedPayment);
    const aggregateOutstandingAmount = aggregateValue("invoices.outstanding", outstandingAmount);
    const aggregateTicketsIssued = aggregateValue("tickets.issued", ticketsIssued);
    const last30Range = { from: daysFromIso(nowDate, -30), to: nowDate };
    const prior30Range = { from: daysFromIso(nowDate, -60), to: daysFromIso(nowDate, -31) };
    const [last30Aggregate, prior30Aggregate] = await Promise.all([
      loadMetricTotals(ctx, aggregateScope, last30Range, referenceNow || undefined),
      loadMetricTotals(ctx, aggregateScope, prior30Range, referenceNow || undefined),
    ]);
    const last30ActiveQueries = filterRecordsByDateRange(scopedAllQueries, last30Range).filter(
      isActiveQuery
    );
    const prior30ActiveQueries = filterRecordsByDateRange(scopedAllQueries, prior30Range).filter(
      isActiveQuery
    );
    const last30ProposalsSent = filterRecordsByDateRange(scopedAllProposals, last30Range).filter(
      (proposal) => proposal.status === "Sent"
    );
    const prior30ProposalsSent = filterRecordsByDateRange(scopedAllProposals, prior30Range).filter(
      (proposal) => proposal.status === "Sent"
    );
    const last30Confirmed = filterRecordsByDateRange(scopedAllQueries, last30Range).filter(
      isConfirmedQuery
    );
    const prior30Confirmed = filterRecordsByDateRange(scopedAllQueries, prior30Range).filter(
      isConfirmedQuery
    );
    const last30OpenJobs = filterRecordsByDateRange(allActiveJobs, last30Range);
    const prior30OpenJobs = filterRecordsByDateRange(allActiveJobs, prior30Range);

    const ticketAttentionQueue = buildTicketAttentionQueue(tickets);
    const overdueInvoices = buildOverdueInvoices({ invoices, jobCards, nowDate });
    const urgentActions = buildUrgentActions({
      approvals,
      invoices,
      jobCards,
      nowDate,
      queries,
      tickets,
    });
    const permittedUrgentActions = visibleUrgentActions(urgentActions, canViewFinance);
    const ownedWorkSla = buildOwnedWorkSla(
      permittedUrgentActions,
      referenceNow,
      buildHeadAssignmentSlaItems(access, queries, jobCards)
    );

    return {
      activeTours: buildActiveTourRows({
        activeJobs,
        jobAggregateById,
        queriesById,
        travellersByJobCard,
      }),
      aggregateCoverage: formatAggregateCoverage(aggregate),
      capacity: [],
      closedQueriesByType: summaryQueryCounts(
        canUseAggregateKey("queries.active"),
        queryTypesForCounts,
        aggregate,
        closedQueryRecords,
        "lost"
      ),
      confirmedQueriesByType: summaryQueryCounts(
        canUseAggregateKey("queries.active"),
        queryTypesForCounts,
        aggregate,
        confirmedQueryRecords,
        "confirmed"
      ),
      departmentWorkflow: [
        {
          label: "Sales open leads",
          percent: percent(
            aggregateActiveQueries,
            Math.max(aggregateValue("queries.total", queries.length), 1)
          ),
          value: aggregateActiveQueries,
        },
        {
          label: "Contracting in progress",
          percent: percent(
            queries.filter((query) =>
              ["Query Received", "Proposal in progress"].includes(query.contractingStatus)
            ).length,
            Math.max(queries.length, 1)
          ),
          value: queries.filter((query) =>
            ["Query Received", "Proposal in progress"].includes(query.contractingStatus)
          ).length,
        },
        {
          label: "Ops active groups",
          percent: percent(
            aggregateJobCardsOpen,
            Math.max(aggregateValue("jobCards.total", jobCards.length), 1)
          ),
          value: aggregateJobCardsOpen,
        },
        {
          label: "Ticketing issued",
          percent: percent(aggregateTravellerTicketsIssued, aggregateTravellerTotal),
          value: aggregateTravellerTicketsIssued,
        },
        {
          label: "Finance pending",
          percent: canViewFinance ? percent(aggregateReceivedPayment, aggregateExpectedPayment) : 0,
          value: canViewFinance ? aggregateOutstandingAmount : 0,
        },
      ],
      generatedAt: new Date(referenceNow).toISOString(),
      metrics: {
        activeQueries: aggregateActiveQueries,
        confirmedJobs: aggregateConfirmedQueries,
        departures30d,
        jobCardsOpen: aggregateJobCardsOpen,
        outstandingAmount: canViewFinance ? aggregateOutstandingAmount : 0,
        paymentPending: canViewFinance
          ? aggregateValue(
              "invoices.pending",
              invoices.filter((invoice) => invoice.balanceAmount > 0).length
            )
          : 0,
        pendingApprovals: aggregateValue(
          "approvals.pending",
          approvals.filter((approval) => approval.status === "Pending").length
        ),
        proposalsSent: aggregateValue(
          "proposals.sent",
          proposals.filter((proposal) => proposal.status === "Sent").length
        ),
        revenuePipeline: canViewFinance ? aggregateValue("invoices.expected", revenuePipeline) : 0,
        ticketsIssued: aggregateTicketsIssued,
        ticketsPending: aggregateValue(
          "tickets.pending",
          tickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length
        ),
        visaPending: aggregateValue(
          "visas.pending",
          visas.filter((visa) =>
            ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"].includes(
              visa.status
            )
          ).length
        ),
      },
      metricTrends: {
        activeQueries: buildMetricTrend(
          metricPeriodValue(
            canUseAggregateKey,
            "queries.active",
            last30Aggregate,
            last30ActiveQueries.length
          ),
          metricPeriodValue(
            canUseAggregateKey,
            "queries.active",
            prior30Aggregate,
            prior30ActiveQueries.length
          )
        ),
        confirmedJobs: buildMetricTrend(
          metricPeriodValue(
            canUseAggregateKey,
            "queries.active",
            last30Aggregate,
            last30Confirmed.length
          ),
          metricPeriodValue(
            canUseAggregateKey,
            "queries.active",
            prior30Aggregate,
            prior30Confirmed.length
          )
        ),
        departures30d: buildMetricTrend(
          departures30d,
          previousDepartureCount(allActiveJobs, nowDate)
        ),
        jobCardsOpen: buildMetricTrend(
          metricPeriodValue(
            canUseAggregateKey,
            "jobCards.open",
            last30Aggregate,
            last30OpenJobs.length
          ),
          metricPeriodValue(
            canUseAggregateKey,
            "jobCards.open",
            prior30Aggregate,
            prior30OpenJobs.length
          )
        ),
        proposalsSent: buildMetricTrend(
          metricPeriodValue(
            canUseAggregateKey,
            "proposals.sent",
            last30Aggregate,
            last30ProposalsSent.length
          ),
          metricPeriodValue(
            canUseAggregateKey,
            "proposals.sent",
            prior30Aggregate,
            prior30ProposalsSent.length
          )
        ),
      },
      myTeam: [],
      overdueInvoices: canViewFinance ? overdueInvoices : [],
      ownedWorkSla,
      pipelineSnapshot: canUseAggregateKey("queries.active")
        ? aggregatePipelineSnapshot(aggregate.values)
        : buildPipelineSnapshot(queries),
      progress: {
        guestData: {
          done: aggregateGuestDataDone,
          percent: percent(aggregateGuestDataDone, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
        passport: {
          done: aggregatePassportDone,
          percent: percent(aggregatePassportDone, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
        payment: {
          done: canViewFinance ? aggregateReceivedPayment : 0,
          percent: canViewFinance ? percent(aggregateReceivedPayment, aggregateExpectedPayment) : 0,
          total: canViewFinance ? aggregateExpectedPayment : 0,
        },
        rooming: {
          done: aggregateRoomingDone,
          percent: percent(aggregateRoomingDone, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
        tickets: {
          done: aggregateTravellerTicketsIssued,
          percent: percent(aggregateTravellerTicketsIssued, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
        tourManager: {
          done: aggregateTourManagerDone,
          percent: percent(aggregateTourManagerDone, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
        visas: {
          done: aggregateVisaApproved,
          percent: percent(aggregateVisaApproved, aggregateTravellerTotal),
          total: aggregateTravellerTotal,
        },
      },
      queriesByType: summaryQueryCounts(
        canUseAggregateKey("queries.active"),
        queryTypesForCounts,
        aggregate,
        activeQueryRecords,
        "active"
      ),
      recentActivity: [],
      ticketAttentionQueue,
      ticketingStats: {
        cancelReq: canUseAggregateKey("tickets.pending")
          ? aggregateMetric(aggregate.values, "tickets.status.Refund Pending") +
            aggregateMetric(aggregate.values, "tickets.status.Cancelled")
          : scopedAllTickets.filter((ticket) =>
              ["Refund Pending", "Cancelled"].includes(ticket.ticketStatus)
            ).length,
        onHold: aggregateValue(
          "tickets.status.Pending Issue",
          scopedAllTickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length
        ),
        reissue: aggregateValue(
          "tickets.status.Reissue Required",
          scopedAllTickets.filter((ticket) => ticket.ticketStatus === "Reissue Required").length
        ),
        upcomingDep: departures30d,
      },
      upcomingDepartures: buildUpcomingDepartureRows({
        activeJobs,
        jobAggregateById,
        nowDate,
        queriesById,
        travellersByJobCard,
      }),
      urgentActions: permittedUrgentActions,
    };
  },
  returns: portalSummaryResultValidator,
});
