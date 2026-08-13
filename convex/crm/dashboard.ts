import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import type { JobCardStatus } from "./jobCardConstants";
import {
  CEMENT_QUERY_TYPES,
  canSeeAllPortalRecords,
  filterRecordsByDateRange,
  isHead,
  PERMISSIONS,
  type PortalDateRange,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import {
  aggregateMetric,
  loadMetricCoverage,
  loadMetricTotals,
  type MetricValues,
} from "./metricAggregates";
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
    errorSummary: aggregate.readiness.errorSummary,
    freshnessMinutes: 15,
    generation: aggregate.readiness.generation,
    lastCompletedAt: aggregate.readiness.lastCompletedAt
      ? new Date(aggregate.readiness.lastCompletedAt).toISOString()
      : null,
    state: aggregate.readiness.state as "pending" | "ready" | "reconciling" | "stale",
    updatedAt: aggregate.updatedAt ? new Date(aggregate.updatedAt).toISOString() : null,
    version: aggregate.readiness.version,
  };
}

export const getPortalMetricCoverage = query({
  args: {
    dateRange: portalDateRangeValidator,
    referenceNow: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
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
  const capacityByRole = staff.reduce((map, member) => {
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
    capacity: (
      Array.from(capacityByRole.values()) as Array<{
        load: number;
        role: string;
        staffCount: number;
      }>
    )
      .map((row) => ({
        ...row,
        averageLoad: row.staffCount ? Math.round(row.load / row.staffCount) : 0,
        severity: (row.staffCount && row.load / row.staffCount >= 10
          ? "overloaded"
          : row.staffCount && row.load / row.staffCount >= 6
            ? "busy"
            : "normal") as "overloaded" | "busy" | "normal",
      }))
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

export const getPortalDashboardCapacity = query({
  args: { dateRange: portalDateRangeValidator },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    if (!access.permissions.includes(PERMISSIONS.VIEW_TEAM)) {
      return { capacity: [], myTeam: [] };
    }
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const snapshot = await loadDashboardCapacitySnapshot(ctx, access, dateRange);
    return buildDashboardPeople(access, snapshot.queries, snapshot.jobCards, snapshot.staff);
  },
  returns: portalDashboardCapacityResultValidator,
});

export const getPortalDashboardActivity = query({
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

const PIPELINE_STAGE_WEIGHTS: Record<(typeof SALES_PIPELINE_STAGES)[number], number> = {
  Confirmation: 0.9,
  Inquiry: 0.1,
  Lost: 0,
  Negotiation: 0.5,
  Proposal: 0.25,
};

function daysFromIso(iso: string, offsetDays: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildMetricTrend(current: number, prior: number) {
  const delta = current - prior;
  return {
    delta: Math.abs(delta),
    direction: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("flat" as const),
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
    type: type as QueryType,
  }));
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
  const actions: Array<{
    id: string;
    label: string;
    type: "approvals" | "finance" | "accounts" | "ticketing";
    entityType: string;
    entityId: string;
    href: string;
    createdAt?: string;
  }> = [];
  const queryIdsWithJobCards = new Set(
    jobCards.flatMap((job) => (job.queryId ? [job.queryId] : []))
  );

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
  const typeLabels: Record<string, string> = {
    accounts: "Job cards to open",
    approvals: "Approvals pending",
    finance: "Overdue invoices",
    ticketing: "Ticketing follow-ups",
  };
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
  if (!isHead(access as Parameters<typeof isHead>[0])) {
    return [];
  }
  const items: Array<{
    count: number;
    entityId: string;
    entityType: "query" | "jobCard";
    href: string;
    label: string;
    oldestDays: null;
  }> = [];
  const closedSales = new Set(["Order Confirmed", "Order Lost"]);
  const roles = new Set(access.roles);

  if (roles.has("Contracting Head") || roles.has("Admin") || roles.has("Directors")) {
    for (const query of queries) {
      if (items.length >= 5) {
        break;
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

  if (roles.has("Operations Head") || roles.has("Admin") || roles.has("Directors")) {
    for (const job of jobCards) {
      if (items.length >= 5) {
        break;
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

  if (roles.has("Head of Ticketing") || roles.has("Admin") || roles.has("Directors")) {
    for (const query of queries) {
      if (items.length >= 5) {
        break;
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
        id: invoice._id as Id<"invoices">,
        invoiceNumber: invoice.invoiceNumber,
      };
    });
}

export const getPortalSummary = query({
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
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
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

    const queryTypesForCounts = shouldApplyCementScope(access)
      ? [...CEMENT_QUERY_TYPES]
      : QUERY_TYPES;

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
    const jobAggregateEntries = aggregate.complete
      ? await Promise.all(
          progressJobs.map(
            async (job) =>
              [
                String(job._id),
                await loadMetricTotals(ctx, `job:${String(job._id)}`, dateRange, referenceNow),
              ] as const
          )
        )
      : [];
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

    const canUseAggregateKey = (key: string) => {
      if (!(aggregate.complete && canUseOrganizationAggregates)) {
        return false;
      }
      const domain = key.split(".")[0];
      return (
        (domain === "queries" && canViewQueries) ||
        (domain === "proposals" && canViewProposals) ||
        (domain === "jobCards" && canViewJobCards) ||
        (domain === "travellers" && canViewTravellers) ||
        (domain === "tickets" && canViewTickets) ||
        (domain === "visas" && canViewVisa) ||
        (domain === "invoices" && canViewFinance) ||
        (domain === "approvals" && canViewApprovals)
      );
    };
    const aggregateValue = (key: string, fallback: number) =>
      canUseAggregateKey(key) ? aggregateMetric(aggregate.values, key, fallback) : fallback;
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
    const jobProgress = (jobId: string, key: string, fallback: number) => {
      const jobAggregate = jobAggregateById.get(String(jobId));
      return jobAggregate?.complete
        ? aggregateMetric(jobAggregate.values, key, fallback)
        : fallback;
    };

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
    const visibleUrgentActions = canViewFinance
      ? urgentActions
      : urgentActions.filter((action) => action.type !== "finance");
    const ownedWorkSla = buildOwnedWorkSla(
      visibleUrgentActions,
      referenceNow,
      buildHeadAssignmentSlaItems(access, queries, jobCards)
    );

    return {
      activeTours: activeJobs.slice(0, 6).map((job) => {
        const linkedQuery = job.queryId ? queriesById.get(String(job.queryId)) : null;
        const jobTravellers = travellersByJobCard.get(job._id) ?? [];
        const jobTravellerTotal = jobProgress(job._id, "travellers.total", jobTravellers.length);
        const jobTicketsIssued = jobProgress(
          job._id,
          "travellers.ticketIssued",
          jobTravellers.filter((traveller) => traveller.ticketStatus === "Issued").length
        );
        const jobVisasApproved = jobProgress(
          job._id,
          "travellers.visaApproved",
          jobTravellers.filter((traveller) =>
            ["Approved", "Not Required"].includes(traveller.visaStatus)
          ).length
        );
        return {
          clientName: job.clientName,
          contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
          destination: job.destination ?? "",
          id: job._id as Id<"jobCards">,
          jobCode: job.jobCode,
          pax: job.confirmedPax,
          queryCode: linkedQuery?.queryCode ?? "",
          status: job.status as JobCardStatus,
          ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
          ticketProgress: percent(jobTicketsIssued, jobTravellerTotal),
          travelStartDate: job.travelStartDate ?? "",
          visaProgress: percent(jobVisasApproved, jobTravellerTotal),
        };
      }),
      aggregateCoverage: formatAggregateCoverage(aggregate),
      capacity: [],
      closedQueriesByType: canUseAggregateKey("queries.active")
        ? queryTypesForCounts.map((type) => ({
            count: aggregateMetric(aggregate.values, `queries.type.${type}.lost`),
            type: type as QueryType,
          }))
        : countQueriesByType(closedQueryRecords, queryTypesForCounts),
      confirmedQueriesByType: canUseAggregateKey("queries.active")
        ? queryTypesForCounts.map((type) => ({
            count: aggregateMetric(aggregate.values, `queries.type.${type}.confirmed`),
            type: type as QueryType,
          }))
        : countQueriesByType(confirmedQueryRecords, queryTypesForCounts),
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
          canUseAggregateKey("queries.active") && last30Aggregate.complete
            ? aggregateMetric(last30Aggregate.values, "queries.active")
            : last30ActiveQueries.length,
          canUseAggregateKey("queries.active") && prior30Aggregate.complete
            ? aggregateMetric(prior30Aggregate.values, "queries.active")
            : prior30ActiveQueries.length
        ),
        confirmedJobs: buildMetricTrend(
          canUseAggregateKey("queries.active") && last30Aggregate.complete
            ? aggregateMetric(last30Aggregate.values, "queries.confirmed")
            : last30Confirmed.length,
          canUseAggregateKey("queries.active") && prior30Aggregate.complete
            ? aggregateMetric(prior30Aggregate.values, "queries.confirmed")
            : prior30Confirmed.length
        ),
        departures30d: buildMetricTrend(
          departures30d,
          allActiveJobs.filter(
            (job) =>
              job.travelStartDate &&
              job.travelStartDate >= daysFromIso(nowDate, -60) &&
              job.travelStartDate <= daysFromIso(nowDate, -31)
          ).length
        ),
        jobCardsOpen: buildMetricTrend(
          canUseAggregateKey("jobCards.open") && last30Aggregate.complete
            ? aggregateMetric(last30Aggregate.values, "jobCards.open")
            : last30OpenJobs.length,
          canUseAggregateKey("jobCards.open") && prior30Aggregate.complete
            ? aggregateMetric(prior30Aggregate.values, "jobCards.open")
            : prior30OpenJobs.length
        ),
        proposalsSent: buildMetricTrend(
          canUseAggregateKey("proposals.sent") && last30Aggregate.complete
            ? aggregateMetric(last30Aggregate.values, "proposals.sent")
            : last30ProposalsSent.length,
          canUseAggregateKey("proposals.sent") && prior30Aggregate.complete
            ? aggregateMetric(prior30Aggregate.values, "proposals.sent")
            : prior30ProposalsSent.length
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
      queriesByType: canUseAggregateKey("queries.active")
        ? queryTypesForCounts.map((type) => ({
            count: aggregateMetric(aggregate.values, `queries.type.${type}.active`),
            type: type as QueryType,
          }))
        : countQueriesByType(activeQueryRecords, queryTypesForCounts),
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
      upcomingDepartures: activeJobs
        .filter((job) => job.travelStartDate && job.travelStartDate >= nowDate)
        .sort((a, b) => String(a.travelStartDate).localeCompare(String(b.travelStartDate)))
        .slice(0, 6)
        .map((job) => {
          const linkedQuery = job.queryId ? queriesById.get(String(job.queryId)) : null;
          const jobTravellers = travellersByJobCard.get(job._id) ?? [];
          const jobTravellerTotal = jobProgress(job._id, "travellers.total", jobTravellers.length);
          const ticketProgress = percent(
            jobProgress(
              job._id,
              "travellers.ticketIssued",
              jobTravellers.filter((traveller) => traveller.ticketStatus === "Issued").length
            ),
            jobTravellerTotal
          );
          const visaProgress = percent(
            jobProgress(
              job._id,
              "travellers.visaApproved",
              jobTravellers.filter((traveller) =>
                ["Approved", "Not Required"].includes(traveller.visaStatus)
              ).length
            ),
            jobTravellerTotal
          );
          return {
            clientName: job.clientName,
            contractingOwnerName: linkedQuery?.contractingOwnerName ?? "",
            destination: job.destination ?? "",
            id: job._id as Id<"jobCards">,
            jobCode: job.jobCode,
            pax: job.confirmedPax,
            queryCode: linkedQuery?.queryCode ?? "",
            readiness: (ticketProgress >= 100 && visaProgress >= 100
              ? "Ready"
              : visaProgress < 100
                ? "Docs pending"
                : "Ticketing") as "Ready" | "Docs pending" | "Ticketing",
            ticketingOwnerName: linkedQuery?.ticketingOwnerName ?? "",
            tourManagerName: job.tourManagerName ?? "",
            travelStartDate: job.travelStartDate ?? "",
          };
        }),
      urgentActions: visibleUrgentActions,
    };
  },
  returns: portalSummaryResultValidator,
});
