import { api } from "@convex/_generated/api";
import { useQuery } from "convex/react";
import { PORTAL_PERMISSIONS } from "@/lib/portal/constants";
import { fiscalYearForDate } from "@/lib/portal/leavePolicy";
import { canUseTeamPicker } from "@/lib/portal/permissions";
import type { AnyRecord } from "./workspaceStateTypes";

const P = PORTAL_PERMISSIONS;

interface UsePortalWorkspaceDataInput {
  access: AnyRecord | null | undefined;
  canFetch: boolean | undefined;
  dateRangeArg: { from?: string; to?: string } | undefined;
  deepLinkOpen: null | string;
  form: AnyRecord;
  has: (permission: string) => boolean;
  modal: null | string;
  view: string;
}

export function usePortalWorkspaceData({
  access,
  canFetch,
  dateRangeArg,
  deepLinkOpen,
  form,
  has,
  modal,
  view,
}: UsePortalWorkspaceDataInput) {
  const queries = useQuery(
    api.crm.queries.list,
    canFetch && (has(P.VIEW_QUERIES) || has(P.VIEW_CONTRACTING) || has(P.MANAGE_JOB_CARDS))
      ? {}
      : "skip"
  );
  const proposals = useQuery(
    api.crm.proposals.list,
    canFetch && (has(P.VIEW_PROPOSALS) || has(P.VIEW_CONTRACTING)) ? {} : "skip"
  );
  const jobCards = useQuery(api.crm.jobCards.list, canFetch && has(P.VIEW_JOB_CARDS) ? {} : "skip");
  const travellers = useQuery(
    api.crm.travellers.list,
    canFetch && has(P.VIEW_TRAVELLERS) ? {} : "skip"
  );
  const visas = useQuery(api.crm.visa.list, canFetch && has(P.VIEW_VISA) ? {} : "skip");
  const ticketDashboard = useQuery(
    api.crm.ticketing.dashboard,
    canFetch && has(P.VIEW_TICKETING) ? { dateRange: dateRangeArg } : "skip"
  );
  const pnrs = useQuery(
    api.crm.ticketing.listPnrs,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const tickets = useQuery(
    api.crm.ticketing.listTickets,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const seats = useQuery(
    api.crm.ticketing.listSeatAllocations,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const flightItinerary = useQuery(
    api.crm.imports.listFlightItinerary,
    canFetch && has(P.VIEW_TICKETING) ? {} : "skip"
  );
  const hotels = useQuery(api.crm.ops.listHotels, canFetch && has(P.VIEW_OPERATIONS) ? {} : "skip");
  const tourManagers = useQuery(
    api.crm.ops.listTourManagers,
    canFetch && has(P.VIEW_TOUR_MANAGERS) ? {} : "skip"
  );
  const invoices = useQuery(
    api.crm.finance.listInvoices,
    canFetch && has(P.VIEW_FINANCE) ? {} : "skip"
  );
  const expenses = useQuery(
    api.crm.finance.listExpenses,
    canFetch && (has(P.VIEW_EXPENSES) || deepLinkOpen === "approval") ? {} : "skip"
  );
  const financeOverview = useQuery(
    api.crm.finance.getFinanceOverview,
    canFetch && has(P.VIEW_FINANCE) && view === "finance" ? { dateRange: dateRangeArg } : "skip"
  );
  const approvals = useQuery(
    api.crm.approvals.list,
    canFetch && has(P.VIEW_APPROVALS) ? {} : "skip"
  );
  const reports = useQuery(
    api.crm.reports.overview,
    canFetch && has(P.VIEW_REPORTS) && view === "reports" ? { dateRange: dateRangeArg } : "skip"
  );
  const teamDirectory = useQuery(
    api.crm.staff.listDirectory,
    canFetch && has(P.VIEW_TEAM) ? {} : "skip"
  );
  const teamPicker = useQuery(
    api.crm.staff.listTeamOptions,
    canFetch && !has(P.VIEW_TEAM) && canUseTeamPicker(access) ? {} : "skip"
  );
  const team = teamDirectory ?? teamPicker ?? [];
  const activity = useQuery(
    api.crm.activity.listActivity,
    canFetch && has(P.VIEW_ACTIVITY) ? { limit: 80 } : "skip"
  );
  const leaves = useQuery(api.crm.leave.list, canFetch && has(P.VIEW_LEAVE) ? {} : "skip");
  const leaveBalanceArgs =
    canFetch && has(P.VIEW_LEAVE)
      ? {
          ...(has(P.MANAGE_LEAVE) && modal === "leave_create" && form.staffId
            ? { staffId: form.staffId }
            : {}),
          ...(modal === "leave_create" && form.startDate
            ? { fiscalYear: fiscalYearForDate(form.startDate) }
            : {}),
        }
      : null;
  const leaveBalances = useQuery(api.crm.leave.balances, leaveBalanceArgs ?? "skip");
  const notifications = useQuery(
    api.crm.activity.listNotifications,
    canFetch ? { limit: 80 } : "skip"
  );
  const dropdowns = useQuery(
    api.crm.settings.listDropdowns,
    canFetch && view === "settings" && has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const staff = useQuery(api.crm.staff.listStaff, canFetch && has(P.MANAGE_STAFF) ? {} : "skip");
  const accountsJobCardCreators = useQuery(
    api.crm.staff.listAccountsForJobCards,
    canFetch && view === "accounts-job-cards" && has(P.MANAGE_JOB_CARDS) ? {} : "skip"
  );
  const leaveHeadApproverCandidates = useQuery(
    api.crm.leaveApprovers.listHeadApproverCandidates,
    canFetch && has(P.MANAGE_STAFF) ? {} : "skip"
  );
  const travellersWithoutVisa = useQuery(
    api.crm.visa.listTravellersWithoutVisa,
    canFetch && has(P.VIEW_VISA) && (modal === "visa_create" || view === "visa") ? {} : "skip"
  );

  return {
    accountsJobCardCreators,
    activity,
    approvals,
    dropdowns,
    expenses,
    financeOverview,
    flightItinerary,
    hotels,
    invoices,
    jobCards,
    leaveBalances,
    leaveHeadApproverCandidates,
    leaves,
    notifications,
    pnrs,
    proposals,
    queries,
    reports,
    seats,
    staff,
    team,
    ticketDashboard,
    tickets,
    tourManagers,
    travellers,
    travellersWithoutVisa,
    visas,
  };
}
