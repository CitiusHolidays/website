import { v } from "convex/values";
import { query } from "../_generated/server";
import {
  PERMISSIONS,
  filterRecordsByCreatedAt,
  portalPeriodValidator,
  requireStaff,
  type PortalPeriod,
} from "./lib";

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

const isActiveQuery = (query: { salesStatus: string }) =>
  query.salesStatus !== "Order Confirmed" && query.salesStatus !== "Order Lost";

const isConfirmedQuery = (query: { salesStatus: string }) =>
  query.salesStatus === "Order Confirmed";

function countQueriesByType<T extends { queryType: string }>(records: T[]) {
  return QUERY_TYPES.map((type) => ({
    type,
    count: records.filter((query) => query.queryType === type).length,
  }));
}

export const getPortalSummary = query({
  args: {
    period: v.optional(portalPeriodValidator),
  },
  handler: async (ctx, args) => {
    const access = await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const period = (args.period ?? "all") as PortalPeriod;
    const queries = filterRecordsByCreatedAt(await ctx.db.query("queries").collect(), period);
    const proposals = filterRecordsByCreatedAt(await ctx.db.query("proposals").collect(), period);
    const jobCards = filterRecordsByCreatedAt(await ctx.db.query("jobCards").collect(), period);
    const travellers = filterRecordsByCreatedAt(await ctx.db.query("travellers").collect(), period);
    const tickets = filterRecordsByCreatedAt(await ctx.db.query("tickets").collect(), period);
    const visas = filterRecordsByCreatedAt(await ctx.db.query("visaRecords").collect(), period);
    const invoices = filterRecordsByCreatedAt(await ctx.db.query("invoices").collect(), period);
    const approvals = filterRecordsByCreatedAt(await ctx.db.query("approvalRequests").collect(), period);
    const staff = await ctx.db.query("staffUsers").collect();
    const activities = filterRecordsByCreatedAt(await ctx.db.query("activityLogs").collect(), period);

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
    const outstandingAmount = invoices.reduce((sum, invoice) => sum + Math.max(invoice.balanceAmount ?? 0, 0), 0);
    const nowDate = new Date().toISOString().slice(0, 10);
    const revenuePipeline = invoices.reduce((sum, invoice) => sum + invoice.expectedAmount, 0);
    const activeQueryRecords = queries.filter(isActiveQuery);
    const confirmedQueryRecords = queries.filter(isConfirmedQuery);

    return {
      metrics: {
        activeQueries: activeQueryRecords.length,
        proposalsSent: proposals.filter((proposal) => proposal.status === "Sent").length,
        confirmedJobs: confirmedQueryRecords.length,
        jobCardsOpen: activeJobs.length,
        ticketsIssued,
        ticketsPending: tickets.filter((ticket) => ticket.ticketStatus === "Pending Issue")
          .length,
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
      queriesByType: countQueriesByType(activeQueryRecords),
      confirmedQueriesByType: countQueriesByType(confirmedQueryRecords),
      departmentWorkflow: [
        {
          label: "Sales open leads",
          value: queries.filter((query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus)).length,
          percent: percent(queries.filter((query) => !["Order Confirmed", "Order Lost"].includes(query.salesStatus)).length, Math.max(queries.length, 1)),
        },
        {
          label: "Contracting in progress",
          value: queries.filter((query) => ["Query Received", "Proposal in progress"].includes(query.contractingStatus)).length,
          percent: percent(queries.filter((query) => ["Query Received", "Proposal in progress"].includes(query.contractingStatus)).length, Math.max(queries.length, 1)),
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
        .filter((member) => member.active && member.roles.some((role) => access.roles.includes(role)))
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
        tickets: { done: ticketsIssued, total: travellers.length, percent: percent(ticketsIssued, travellers.length) },
        visas: { done: visaApproved, total: travellers.length, percent: percent(visaApproved, travellers.length) },
        guestData: { done: guestDataDone, total: travellers.length, percent: percent(guestDataDone, travellers.length) },
        rooming: { done: roomingDone, total: travellers.length, percent: percent(roomingDone, travellers.length) },
        payment: { done: receivedPayment, total: expectedPayment, percent: percent(receivedPayment, expectedPayment) },
      },
      urgentActions: [
        ...approvals
          .filter((approval) => approval.status === "Pending")
          .map((approval) => ({
            id: approval._id,
            label: `${approval.requestCode} approval pending: ${approval.summary}`,
            type: "approvals",
          })),
        ...invoices
          .filter((invoice) => invoice.balanceAmount > 0 && invoice.dueDate && invoice.dueDate < nowDate)
          .map((invoice) => ({
            id: invoice._id,
            label: `${invoice.invoiceNumber} has overdue balance`,
            type: "finance",
          })),
        ...queries
          .filter((query) => query.salesStatus === "Order Confirmed")
          .filter((query) => !jobCards.some((job) => job.queryId === query._id))
          .map((query) => ({
            id: query._id,
            label: `${query.queryCode} needs Job Card creation`,
            type: "accounts",
          })),
        ...tickets
          .filter((ticket) =>
            ["Name Change Required", "Reissue Required", "Refund Pending"].includes(
              ticket.ticketStatus,
            ),
          )
          .map((ticket) => ({
            id: ticket._id,
            label: `Ticket ${ticket.ticketNumber || ticket._id} needs attention`,
            type: "ticketing",
          })),
      ].slice(0, 8),
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
          const ticketProgress = percent(jobTravellers.filter((traveller) => traveller.ticketStatus === "Issued").length, jobTravellers.length);
          const visaProgress = percent(jobTravellers.filter((traveller) => ["Approved", "Not Required"].includes(traveller.visaStatus)).length, jobTravellers.length);
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
          createdAt: new Date(activity.createdAt).toISOString(),
        })),
    };
  },
});
