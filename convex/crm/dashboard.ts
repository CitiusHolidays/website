import { query } from "../_generated/server";
import { PERMISSIONS, requireStaff } from "./lib";

const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export const getPortalSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, PERMISSIONS.VIEW_DASHBOARD);
    const queries = await ctx.db.query("queries").collect();
    const proposals = await ctx.db.query("proposals").collect();
    const jobCards = await ctx.db.query("jobCards").collect();
    const travellers = await ctx.db.query("travellers").collect();
    const tickets = await ctx.db.query("tickets").collect();
    const visas = await ctx.db.query("visaRecords").collect();
    const invoices = await ctx.db.query("invoices").collect();
    const activities = await ctx.db.query("activityLogs").collect();

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

    return {
      metrics: {
        activeQueries: queries.filter(
          (item) =>
            item.salesStatus !== "Order Confirmed" && item.salesStatus !== "Order Lost",
        ).length,
        proposalsSent: proposals.filter((proposal) => proposal.status === "Sent").length,
        confirmedJobs: queries.filter((query) => query.salesStatus === "Order Confirmed")
          .length,
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
      },
      progress: {
        tickets: { done: ticketsIssued, total: travellers.length, percent: percent(ticketsIssued, travellers.length) },
        visas: { done: visaApproved, total: travellers.length, percent: percent(visaApproved, travellers.length) },
        guestData: { done: guestDataDone, total: travellers.length, percent: percent(guestDataDone, travellers.length) },
        rooming: { done: roomingDone, total: travellers.length, percent: percent(roomingDone, travellers.length) },
        payment: { done: receivedPayment, total: expectedPayment, percent: percent(receivedPayment, expectedPayment) },
      },
      urgentActions: [
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
