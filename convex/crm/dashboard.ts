import type { Id } from "../_generated/dataModel";
import { query } from "../_generated/server";
import {
  applyCementPortalScope,
  CEMENT_QUERY_TYPES,
  filterRecordsByDateRange,
  PERMISSIONS,
  type PortalDateRange,
  portalDateRangeValidator,
  requireStaff,
  shouldApplyCementScope,
} from "./lib";
import { getNotificationHref } from "./notificationPaths";

const RECENT_ACTIVITY_LIMIT = 8;

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
    type,
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
      createdAt: query.updatedAt ? new Date(query.updatedAt).toISOString() : undefined,
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

export function buildPipelineSnapshot(
  queries: Array<{ leadStage?: string; budgetAmount?: number }>
) {
  return SALES_PIPELINE_STAGES.map((stage) => {
    const stageQueries = queries.filter((q) => (q.leadStage || "Inquiry") === stage);
    const value = stageQueries.reduce((sum, query) => sum + (query.budgetAmount ?? 0), 0);
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
      id: ticket._id,
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
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
      };
    });
}

export const getPortalSummary = query({
  args: {
    dateRange: portalDateRangeValidator,
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const dateRange = (args.dateRange ?? undefined) as PortalDateRange | undefined;
    const [allQueriesRaw, allProposalsRaw, allJobCardsRaw, allTicketsRaw] = await Promise.all([
      ctx.db.query("queries").collect(),
      ctx.db.query("proposals").collect(),
      ctx.db.query("jobCards").collect(),
      ctx.db.query("tickets").collect(),
    ]);
    let queries = filterRecordsByDateRange(allQueriesRaw, dateRange);
    let proposals = filterRecordsByDateRange(allProposalsRaw, dateRange);
    const proposalQueryLinks = await ctx.db.query("proposalQueryLinks").collect();
    let jobCards = filterRecordsByDateRange(allJobCardsRaw, dateRange);
    let travellers = filterRecordsByDateRange(
      await ctx.db.query("travellers").collect(),
      dateRange
    );
    let tickets = filterRecordsByDateRange(allTicketsRaw, dateRange);
    let visas = filterRecordsByDateRange(await ctx.db.query("visaRecords").collect(), dateRange);
    let invoices = filterRecordsByDateRange(await ctx.db.query("invoices").collect(), dateRange);
    const approvals = filterRecordsByDateRange(
      await ctx.db.query("approvalRequests").collect(),
      dateRange
    );
    const staff = await ctx.db.query("staffUsers").collect();
    const activities = filterRecordsByDateRange(
      await ctx.db
        .query("activityLogs")
        .withIndex("by_createdAt")
        .order("desc")
        .take(RECENT_ACTIVITY_LIMIT),
      dateRange
    );

    const scopedRecords = applyCementPortalScope(access, {
      invoices,
      jobCards,
      proposalQueryLinks,
      proposals,
      queries,
      tickets,
      travellers,
      visas,
    });
    queries = scopedRecords.queries;
    proposals = scopedRecords.proposals;
    jobCards = scopedRecords.jobCards;
    travellers = scopedRecords.travellers;
    tickets = scopedRecords.tickets;
    visas = scopedRecords.visas;
    invoices = scopedRecords.invoices;

    const jobCardByIdForTravellers = new Map(jobCards.map((job) => [job._id, job]));
    const travellersByJobCard = groupByJobCardId(travellers);

    const scopedAllQueries = applyCementPortalScope(access, {
      invoices: [],
      jobCards: allJobCardsRaw,
      proposalQueryLinks,
      proposals: allProposalsRaw,
      queries: allQueriesRaw,
      tickets: allTicketsRaw,
      travellers: [],
      visas: [],
    }).queries;
    const scopedAllProposals = applyCementPortalScope(access, {
      invoices: [],
      jobCards: allJobCardsRaw,
      proposalQueryLinks,
      proposals: allProposalsRaw,
      queries: allQueriesRaw,
      tickets: allTicketsRaw,
      travellers: [],
      visas: [],
    }).proposals;
    const scopedAllJobCards = applyCementPortalScope(access, {
      invoices: [],
      jobCards: allJobCardsRaw,
      proposalQueryLinks,
      proposals: allProposalsRaw,
      queries: allQueriesRaw,
      tickets: allTicketsRaw,
      travellers: [],
      visas: [],
    }).jobCards;
    const scopedAllTickets = applyCementPortalScope(access, {
      invoices: [],
      jobCards: allJobCardsRaw,
      proposalQueryLinks,
      proposals: allProposalsRaw,
      queries: allQueriesRaw,
      tickets: allTicketsRaw,
      travellers: [],
      visas: [],
    }).tickets;

    const queryTypesForCounts = shouldApplyCementScope(access)
      ? [...CEMENT_QUERY_TYPES]
      : QUERY_TYPES;

    const activeJobs = jobCards.filter((job) => job.status !== "Closed");
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
    const nowDate = new Date().toISOString().slice(0, 10);
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

    const last30Range = { from: daysFromIso(nowDate, -30), to: nowDate };
    const prior30Range = { from: daysFromIso(nowDate, -60), to: daysFromIso(nowDate, -31) };
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
    const capacityByRole = staff.reduce((map, member) => {
      if (!member.active) {
        return map;
      }
      const staffId = String(member._id);
      const load =
        queries.filter(
          (query) =>
            String(query.salesOwnerId) === staffId &&
            !["Order Confirmed", "Order Lost"].includes(query.salesStatus)
        ).length +
        queries.filter(
          (query) =>
            String(query.contractingOwnerId) === staffId &&
            !["Order Confirmed", "Order Lost"].includes(query.salesStatus)
        ).length +
        jobCards.filter(
          (job) =>
            [job.contractingOwnerId, job.operationsOwnerId, job.ticketingOwnerId]
              .map(String)
              .includes(staffId) && job.status !== "Closed"
        ).length;
      for (const role of member.roles) {
        const current = map.get(role) ?? { load: 0, role, staffCount: 0 };
        current.staffCount += 1;
        current.load += load;
        map.set(role, current);
      }
      return map;
    }, new Map<string, { role: string; staffCount: number; load: number }>());

    return {
      activeTours: activeJobs.slice(0, 6).map((job) => {
        const jobTravellers = travellersByJobCard.get(job._id) ?? [];
        const jobTicketsIssued = jobTravellers.filter(
          (traveller) => traveller.ticketStatus === "Issued"
        ).length;
        const jobVisasApproved = jobTravellers.filter((traveller) =>
          ["Approved", "Not Required"].includes(traveller.visaStatus)
        ).length;
        return {
          clientName: job.clientName,
          destination: job.destination ?? "",
          id: job._id,
          jobCode: job.jobCode,
          pax: job.confirmedPax,
          status: job.status,
          ticketProgress: percent(jobTicketsIssued, jobTravellers.length),
          visaProgress: percent(jobVisasApproved, jobTravellers.length),
        };
      }),
      capacity: Array.from(capacityByRole.values())
        .map((row) => ({
          ...row,
          averageLoad: row.staffCount ? Math.round(row.load / row.staffCount) : 0,
          severity:
            row.staffCount && row.load / row.staffCount >= 10
              ? "overloaded"
              : row.staffCount && row.load / row.staffCount >= 6
                ? "busy"
                : "normal",
        }))
        .sort((a, b) => b.averageLoad - a.averageLoad)
        .slice(0, 8),
      closedQueriesByType: countQueriesByType(closedQueryRecords, queryTypesForCounts),
      confirmedQueriesByType: countQueriesByType(confirmedQueryRecords, queryTypesForCounts),
      departmentWorkflow: [
        {
          label: "Sales open leads",
          percent: percent(
            queries.filter(
              (query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus)
            ).length,
            Math.max(queries.length, 1)
          ),
          value: queries.filter(
            (query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus)
          ).length,
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
          percent: percent(activeJobs.length, Math.max(jobCards.length, 1)),
          value: activeJobs.length,
        },
        {
          label: "Ticketing issued",
          percent: percent(ticketsIssued, travellers.length),
          value: ticketsIssued,
        },
        {
          label: "Finance pending",
          percent: percent(receivedPayment, expectedPayment),
          value: outstandingAmount,
        },
      ],
      generatedAt: new Date().toISOString(),
      metrics: {
        activeQueries: activeQueryRecords.length,
        confirmedJobs: confirmedQueryRecords.length,
        departures30d,
        jobCardsOpen: activeJobs.length,
        outstandingAmount,
        paymentPending: invoices.filter((invoice) => invoice.balanceAmount > 0).length,
        pendingApprovals: approvals.filter((approval) => approval.status === "Pending").length,
        proposalsSent: proposals.filter((proposal) => proposal.status === "Sent").length,
        revenuePipeline,
        ticketsIssued,
        ticketsPending: tickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length,
        visaPending: visas.filter((visa) =>
          ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"].includes(visa.status)
        ).length,
      },
      metricTrends: {
        activeQueries: buildMetricTrend(last30ActiveQueries.length, prior30ActiveQueries.length),
        confirmedJobs: buildMetricTrend(last30Confirmed.length, prior30Confirmed.length),
        departures30d: buildMetricTrend(
          departures30d,
          allActiveJobs.filter(
            (job) =>
              job.travelStartDate &&
              job.travelStartDate >= daysFromIso(nowDate, -60) &&
              job.travelStartDate <= daysFromIso(nowDate, -31)
          ).length
        ),
        jobCardsOpen: buildMetricTrend(last30OpenJobs.length, prior30OpenJobs.length),
        proposalsSent: buildMetricTrend(last30ProposalsSent.length, prior30ProposalsSent.length),
      },
      myTeam: staff
        .filter(
          (member) => member.active && member.roles.some((role) => access.roles.includes(role))
        )
        .slice(0, 6)
        .map((member) => ({
          department: member.department ?? member.roles[0] ?? "",
          email: member.email,
          function: member.function ?? member.roles.join(", "),
          id: member._id,
          location: member.location ?? "",
          name: member.name,
        })),
      overdueInvoices,
      pipelineSnapshot: buildPipelineSnapshot(queries),
      progress: {
        guestData: {
          done: guestDataDone,
          percent: percent(guestDataDone, travellers.length),
          total: travellers.length,
        },
        passport: {
          done: passportDone,
          percent: percent(passportDone, travellers.length),
          total: travellers.length,
        },
        payment: {
          done: receivedPayment,
          percent: percent(receivedPayment, expectedPayment),
          total: expectedPayment,
        },
        rooming: {
          done: roomingDone,
          percent: percent(roomingDone, travellers.length),
          total: travellers.length,
        },
        tickets: {
          done: ticketsIssued,
          percent: percent(ticketsIssued, travellers.length),
          total: travellers.length,
        },
        tourManager: {
          done: tourManagerDone,
          percent: percent(tourManagerDone, travellers.length),
          total: travellers.length,
        },
        visas: {
          done: visaApproved,
          percent: percent(visaApproved, travellers.length),
          total: travellers.length,
        },
      },
      queriesByType: countQueriesByType(activeQueryRecords, queryTypesForCounts),
      recentActivity: activities.map((activity) => ({
        action: activity.action,
        actorName: activity.actorName,
        createdAt: new Date(activity.createdAt).toISOString(),
        entityId: activity.entityId,
        entityType: activity.entityType,
        id: activity._id,
        message: activity.message,
      })),
      ticketAttentionQueue,
      ticketingStats: {
        cancelReq: scopedAllTickets.filter((ticket) =>
          ["Refund Pending", "Cancelled"].includes(ticket.ticketStatus)
        ).length,
        onHold: scopedAllTickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length,
        reissue: scopedAllTickets.filter((ticket) => ticket.ticketStatus === "Reissue Required")
          .length,
        upcomingDep: departures30d,
      },
      upcomingDepartures: activeJobs
        .filter((job) => job.travelStartDate && job.travelStartDate >= nowDate)
        .sort((a, b) => String(a.travelStartDate).localeCompare(String(b.travelStartDate)))
        .slice(0, 6)
        .map((job) => {
          const jobTravellers = travellersByJobCard.get(job._id) ?? [];
          const ticketProgress = percent(
            jobTravellers.filter((traveller) => traveller.ticketStatus === "Issued").length,
            jobTravellers.length
          );
          const visaProgress = percent(
            jobTravellers.filter((traveller) =>
              ["Approved", "Not Required"].includes(traveller.visaStatus)
            ).length,
            jobTravellers.length
          );
          return {
            clientName: job.clientName,
            destination: job.destination ?? "",
            id: job._id,
            jobCode: job.jobCode,
            pax: job.confirmedPax,
            readiness:
              ticketProgress >= 100 && visaProgress >= 100
                ? "Ready"
                : visaProgress < 100
                  ? "Docs pending"
                  : "Ticketing",
            tourManagerName: job.tourManagerName ?? "",
            travelStartDate: job.travelStartDate,
          };
        }),
      urgentActions: buildUrgentActions({
        approvals,
        invoices,
        jobCards,
        nowDate,
        queries,
        tickets,
      }),
    };
  },
});
