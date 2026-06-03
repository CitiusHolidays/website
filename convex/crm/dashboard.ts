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

const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

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
  types: readonly string[] = QUERY_TYPES,
) {
  return types.map((type) => ({
    type,
    count: records.filter((query) => query.queryType === type).length,
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
  approvals: Array<{ _id: string; status: string; requestCode: string; summary: string }>;
  invoices: Array<{
    _id: string;
    invoiceNumber: string;
    balanceAmount: number;
    dueDate?: string;
  }>;
  queries: Array<{ _id: string; salesStatus: string; queryCode: string }>;
  jobCards: Array<{ queryId?: string }>;
  tickets: Array<{ _id: string; ticketNumber?: string; ticketStatus: string }>;
  nowDate: string;
}) {
  const actions: Array<{
    id: string;
    label: string;
    type: "approvals" | "finance" | "accounts" | "ticketing";
    entityType: string;
    entityId: string;
    href: string;
  }> = [];
  const queryIdsWithJobCards = new Set(
    jobCards.flatMap((job) => (job.queryId ? [job.queryId] : [])),
  );

  for (const approval of approvals) {
    if (approval.status !== "Pending") continue;
    const entityId = approval._id;
    actions.push({
      id: approval._id,
      label: `${approval.requestCode} approval pending: ${approval.summary}`,
      type: "approvals",
      entityType: "approval",
      entityId,
      href: getNotificationHref({ entityType: "approval", entityId, title: "" }),
    });
  }

  for (const invoice of invoices) {
    if (!(invoice.balanceAmount > 0 && invoice.dueDate && invoice.dueDate < nowDate)) continue;
    actions.push({
      id: invoice._id,
      label: `${invoice.invoiceNumber} has overdue balance`,
      type: "finance",
      entityType: "invoice",
      entityId: invoice._id,
      href: "/portal/finance",
    });
  }

  for (const query of queries) {
    if (query.salesStatus !== "Order Confirmed" || queryIdsWithJobCards.has(query._id)) continue;
    const entityId = query._id;
    actions.push({
      id: query._id,
      label: `${query.queryCode} needs Job Card creation`,
      type: "accounts",
      entityType: "query",
      entityId,
      href: getNotificationHref({
        entityType: "query",
        entityId,
        title: "Order confirmed",
      }),
    });
  }

  for (const ticket of tickets) {
    if (!TICKET_ATTENTION_STATUSES.has(ticket.ticketStatus)) continue;
    const entityId = ticket._id;
    actions.push({
      id: ticket._id,
      label: `Ticket ${ticket.ticketNumber || ticket._id} needs attention`,
      type: "ticketing",
      entityType: "ticket",
      entityId,
      href: getNotificationHref({ entityType: "ticket", entityId, title: "" }),
    });
  }

  return actions.slice(0, 8);
}

export function buildPipelineSnapshot(queries: Array<{ leadStage?: string }>) {
  return SALES_PIPELINE_STAGES.map((stage) => ({
    stage,
    count: queries.filter((q) => (q.leadStage || "Inquiry") === stage).length,
  }));
}

export function buildTicketAttentionQueue(
  tickets: Array<{ _id: string; ticketNumber?: string; ticketStatus: string }>,
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
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: job?.clientName ?? "",
        balanceAmount: invoice.balanceAmount,
        dueDate: invoice.dueDate ?? "",
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
    let queries = filterRecordsByDateRange(await ctx.db.query("queries").collect(), dateRange);
    let proposals = filterRecordsByDateRange(await ctx.db.query("proposals").collect(), dateRange);
    const proposalQueryLinks = await ctx.db.query("proposalQueryLinks").collect();
    let jobCards = filterRecordsByDateRange(await ctx.db.query("jobCards").collect(), dateRange);
    let travellers = filterRecordsByDateRange(
      await ctx.db.query("travellers").collect(),
      dateRange,
    );
    let tickets = filterRecordsByDateRange(await ctx.db.query("tickets").collect(), dateRange);
    let visas = filterRecordsByDateRange(await ctx.db.query("visaRecords").collect(), dateRange);
    let invoices = filterRecordsByDateRange(await ctx.db.query("invoices").collect(), dateRange);
    const approvals = filterRecordsByDateRange(
      await ctx.db.query("approvalRequests").collect(),
      dateRange,
    );
    const staff = await ctx.db.query("staffUsers").collect();
    const activities = filterRecordsByDateRange(
      await ctx.db.query("activityLogs").collect(),
      dateRange,
    );

    const scopedRecords = applyCementPortalScope(access, {
      queries,
      proposals,
      jobCards,
      travellers,
      tickets,
      visas,
      invoices,
      proposalQueryLinks,
    });
    queries = scopedRecords.queries;
    proposals = scopedRecords.proposals;
    jobCards = scopedRecords.jobCards;
    travellers = scopedRecords.travellers;
    tickets = scopedRecords.tickets;
    visas = scopedRecords.visas;
    invoices = scopedRecords.invoices;

    const queryTypesForCounts = shouldApplyCementScope(access)
      ? [...CEMENT_QUERY_TYPES]
      : QUERY_TYPES;

    const activeJobs = jobCards.filter((job) => job.status !== "Closed");
    const ticketsIssued = tickets.filter((ticket) => ticket.ticketStatus === "Issued").length;
    const visaApproved = visas.filter((visa) =>
      ["Approved", "Not Required"].includes(visa.status),
    ).length;
    const roomingDone = travellers.filter((traveller) => traveller.hotelAllocation).length;
    const guestDataDone = travellers.filter(
      (traveller) => traveller.fullName && traveller.travelHub && traveller.foodPreference,
    ).length;
    const expectedPayment = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const receivedPayment = invoices.reduce((sum, invoice) => sum + invoice.receivedAmount, 0);
    const outstandingAmount = invoices.reduce(
      (sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0),
      0,
    );
    const nowDate = new Date().toISOString().slice(0, 10);
    const revenuePipeline = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const activeQueryRecords = queries.filter(isActiveQuery);
    const confirmedQueryRecords = queries.filter(isConfirmedQuery);
    const closedQueryRecords = queries.filter(isClosedQuery);

    const ticketAttentionQueue = buildTicketAttentionQueue(tickets);
    const overdueInvoices = buildOverdueInvoices({ invoices, jobCards, nowDate });

    return {
      generatedAt: new Date().toISOString(),
      pipelineSnapshot: buildPipelineSnapshot(queries),
      ticketAttentionQueue,
      overdueInvoices,
      metrics: {
        activeQueries: activeQueryRecords.length,
        proposalsSent: proposals.filter((proposal) => proposal.status === "Sent").length,
        confirmedJobs: confirmedQueryRecords.length,
        jobCardsOpen: activeJobs.length,
        ticketsIssued,
        ticketsPending: tickets.filter((ticket) => ticket.ticketStatus === "Pending Issue").length,
        visaPending: visas.filter((visa) =>
          ["Not Started", "Checklist Shared", "Documents Pending", "Awaiting"].includes(
            visa.status,
          ),
        ).length,
        paymentPending: invoices.filter((invoice) => invoice.balanceAmount > 0).length,
        outstandingAmount,
        pendingApprovals: approvals.filter((approval) => approval.status === "Pending").length,
        revenuePipeline,
      },
      queriesByType: countQueriesByType(activeQueryRecords, queryTypesForCounts),
      confirmedQueriesByType: countQueriesByType(confirmedQueryRecords, queryTypesForCounts),
      closedQueriesByType: countQueriesByType(closedQueryRecords, queryTypesForCounts),
      departmentWorkflow: [
        {
          label: "Sales open leads",
          value: queries.filter(
            (query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus),
          ).length,
          percent: percent(
            queries.filter(
              (query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus),
            ).length,
            Math.max(queries.length, 1),
          ),
        },
        {
          label: "Contracting in progress",
          value: queries.filter((query) =>
            ["Query Received", "Proposal in progress"].includes(query.contractingStatus),
          ).length,
          percent: percent(
            queries.filter((query) =>
              ["Query Received", "Proposal in progress"].includes(query.contractingStatus),
            ).length,
            Math.max(queries.length, 1),
          ),
        },
        {
          label: "Ops active groups",
          value: activeJobs.length,
          percent: percent(activeJobs.length, Math.max(jobCards.length, 1)),
        },
        {
          label: "Ticketing issued",
          value: ticketsIssued,
          percent: percent(ticketsIssued, travellers.length),
        },
        {
          label: "Finance pending",
          value: outstandingAmount,
          percent: percent(receivedPayment, expectedPayment),
        },
      ],
      myTeam: staff
        .filter(
          (member) => member.active && member.roles.some((role) => access.roles.includes(role)),
        )
        .slice(0, 6)
        .map((member) => ({
          id: member._id,
          name: member.name,
          email: member.email,
          department: member.department ?? member.roles[0] ?? "",
          function: member.function ?? member.roles.join(", "),
          location: member.location ?? "",
        })),
      progress: {
        tickets: {
          done: ticketsIssued,
          total: travellers.length,
          percent: percent(ticketsIssued, travellers.length),
        },
        visas: {
          done: visaApproved,
          total: travellers.length,
          percent: percent(visaApproved, travellers.length),
        },
        guestData: {
          done: guestDataDone,
          total: travellers.length,
          percent: percent(guestDataDone, travellers.length),
        },
        rooming: {
          done: roomingDone,
          total: travellers.length,
          percent: percent(roomingDone, travellers.length),
        },
        payment: {
          done: receivedPayment,
          total: expectedPayment,
          percent: percent(receivedPayment, expectedPayment),
        },
      },
      urgentActions: buildUrgentActions({
        approvals,
        invoices,
        queries,
        jobCards,
        tickets,
        nowDate,
      }),
      activeTours: activeJobs.slice(0, 6).map((job) => {
        const jobTravellers = travellers.filter((traveller) => traveller.jobCardId === job._id);
        const jobTicketsIssued = jobTravellers.filter(
          (traveller) => traveller.ticketStatus === "Issued",
        ).length;
        const jobVisasApproved = jobTravellers.filter((traveller) =>
          ["Approved", "Not Required"].includes(traveller.visaStatus),
        ).length;
        return {
          id: job._id,
          jobCode: job.jobCode,
          clientName: job.clientName,
          destination: job.destination ?? "",
          pax: job.confirmedPax,
          status: job.status,
          ticketProgress: percent(jobTicketsIssued, jobTravellers.length),
          visaProgress: percent(jobVisasApproved, jobTravellers.length),
        };
      }),
      upcomingDepartures: activeJobs
        .filter((job) => job.travelStartDate && job.travelStartDate >= nowDate)
        .sort((a, b) => String(a.travelStartDate).localeCompare(String(b.travelStartDate)))
        .slice(0, 6)
        .map((job) => {
          const jobTravellers = travellers.filter((traveller) => traveller.jobCardId === job._id);
          const ticketProgress = percent(
            jobTravellers.filter((traveller) => traveller.ticketStatus === "Issued").length,
            jobTravellers.length,
          );
          const visaProgress = percent(
            jobTravellers.filter((traveller) =>
              ["Approved", "Not Required"].includes(traveller.visaStatus),
            ).length,
            jobTravellers.length,
          );
          return {
            id: job._id,
            jobCode: job.jobCode,
            clientName: job.clientName,
            destination: job.destination ?? "",
            pax: job.confirmedPax,
            travelStartDate: job.travelStartDate,
            tourManagerName: job.tourManagerName ?? "",
            readiness:
              ticketProgress >= 100 && visaProgress >= 100
                ? "Ready"
                : visaProgress < 100
                  ? "Docs pending"
                  : "Ticketing",
          };
        }),
      recentActivity: activities
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 8)
        .map((activity) => ({
          id: activity._id,
          action: activity.action,
          message: activity.message,
          actorName: activity.actorName,
          entityType: activity.entityType,
          entityId: activity.entityId,
          createdAt: new Date(activity.createdAt).toISOString(),
        })),
    };
  },
});
