import { getListFilterConfig } from "@/lib/portal/listFilterConfig";
import { EMPTY_DATE_RANGE, filterByDateRange } from "@/lib/portal/periodFilter";
import { filterRows, pipeViewRows } from "@/lib/portal/pipeViewRows";
import { buildViewResultCountMap, getViewResultCount } from "@/lib/portal/viewResultCounts";
import type {
  AnyRecord,
  DateRangeState,
  ListFiltersState,
  WorkspaceJobCardRow,
  WorkspaceProposalRow,
  WorkspaceQueryRow,
} from "./workspaceStateTypes";
import { compactRows } from "./workspaceStateTypes";

interface BuildPortalWorkspaceRowsInput {
  activity: readonly (AnyRecord | null | undefined)[] | null | undefined;
  approvals: readonly (AnyRecord | null | undefined)[] | null | undefined;
  dateRange: DateRangeState;
  expenses: readonly (AnyRecord | null | undefined)[] | null | undefined;
  flightItinerary: readonly (AnyRecord | null | undefined)[] | null | undefined;
  hotels: readonly (AnyRecord | null | undefined)[] | null | undefined;
  invoices: readonly (AnyRecord | null | undefined)[] | null | undefined;
  jobCardFilter: string;
  jobCards: readonly (WorkspaceJobCardRow | null | undefined)[] | null | undefined;
  leaves: readonly (AnyRecord | null | undefined)[] | null | undefined;
  listFilterConfig: unknown;
  listFilters: ListFiltersState;
  notifications: readonly (AnyRecord | null | undefined)[] | null | undefined;
  pnrs: readonly (AnyRecord | null | undefined)[] | null | undefined;
  proposals: readonly (WorkspaceProposalRow | null | undefined)[] | null | undefined;
  queries: readonly (WorkspaceQueryRow | null | undefined)[] | null | undefined;
  search: string;
  seats: readonly (AnyRecord | null | undefined)[] | null | undefined;
  staff: readonly (AnyRecord | null | undefined)[] | null | undefined;
  team: readonly (AnyRecord | null | undefined)[] | null | undefined;
  tickets: readonly (AnyRecord | null | undefined)[] | null | undefined;
  tourManagers: readonly (AnyRecord | null | undefined)[] | null | undefined;
  travellersWithPassportExpiry: readonly AnyRecord[];
  view: string;
  visas: readonly (AnyRecord | null | undefined)[] | null | undefined;
}

export function buildPortalWorkspaceRows({
  activity,
  approvals,
  dateRange,
  expenses,
  flightItinerary,
  hotels,
  invoices,
  jobCardFilter,
  jobCards,
  leaves,
  listFilterConfig,
  listFilters,
  notifications,
  pnrs,
  proposals,
  queries,
  search,
  seats,
  staff,
  team,
  tickets,
  tourManagers,
  travellersWithPassportExpiry,
  view,
  visas,
}: BuildPortalWorkspaceRowsInput) {
  const periodFiltered = {
    activity: filterByDateRange(compactRows(activity), dateRange, "createdAt"),
    approvals: filterByDateRange(compactRows(approvals), dateRange, "createdAt"),
    expenses: filterByDateRange(
      compactRows(expenses).map((row) => ({
        ...row,
        periodDate: row.expenseDate || row.createdAt,
      })),
      dateRange,
      "periodDate"
    ),
    flightItinerary: filterByDateRange(compactRows(flightItinerary), dateRange, "departureDate"),
    hotels: filterByDateRange(compactRows(hotels), dateRange, "createdAt"),
    invoices: filterByDateRange(compactRows(invoices), dateRange, "createdAt"),
    jobCards: filterByDateRange(compactRows(jobCards), dateRange, "createdAt"),
    leaves: filterByDateRange(compactRows(leaves), dateRange, "createdAt"),
    notifications: filterByDateRange(compactRows(notifications), dateRange, "createdAt"),
    pnrs: filterByDateRange(compactRows(pnrs), dateRange, "createdAt"),
    proposals: filterByDateRange(compactRows(proposals), dateRange, "createdAt"),
    queries: filterByDateRange(compactRows(queries), dateRange, "createdAt"),
    seats: filterByDateRange(compactRows(seats), dateRange, "createdAt"),
    tickets: filterByDateRange(compactRows(tickets), dateRange, "createdAt"),
    tourManagers: filterByDateRange(compactRows(tourManagers), dateRange, "createdAt"),
    travellers: filterByDateRange(travellersWithPassportExpiry, dateRange, "createdAt"),
    visas: filterByDateRange(compactRows(visas), dateRange, "createdAt"),
  };

  const filteredQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: listFilterConfig,
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
    view: "queries",
  });
  const filteredPipelineQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: listFilterConfig,
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType", "salesOwnerName"],
    view: "pipeline",
  });
  const filteredContractingQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: getListFilterConfig("contracting"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination", "queryType"],
    view: "contracting",
  });
  const filteredProposals = pipeViewRows(periodFiltered.proposals, {
    dateRange,
    filterConfig: getListFilterConfig("proposals"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["proposalCode", "clientName", "preparedBy"],
    view: "proposals",
  });
  const filteredAccountsQueries = pipeViewRows(periodFiltered.queries, {
    dateRange,
    filterConfig: getListFilterConfig("accounts-job-cards"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["queryCode", "clientName", "destination"],
    view: "accounts-job-cards",
  });
  const filteredJobCards = pipeViewRows(periodFiltered.jobCards, {
    dateRange,
    filterConfig: getListFilterConfig("job-cards"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["jobCode", "clientName", "destination"],
    view: "job-cards",
  });
  const filteredTravellers = pipeViewRows(periodFiltered.travellers, {
    dateRange,
    filterConfig: getListFilterConfig("travellers"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "sourceDealerName", "travelBatchReference"],
    view: "travellers",
  });
  const filteredPassportTravellers = pipeViewRows(periodFiltered.travellers, {
    dateRange,
    filterConfig: getListFilterConfig("passport"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["fullName", "jobCode", "travelHub", "passportStatus", "travelBatchReference"],
    view: "passport",
  });
  const filteredVisas = pipeViewRows(periodFiltered.visas, {
    dateRange,
    filterConfig: getListFilterConfig("visa"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["travellerName", "jobCode", "travelHub", "status"],
    view: "visa",
  });
  const filteredTickets = pipeViewRows(periodFiltered.tickets, {
    dateRange,
    filterConfig: getListFilterConfig("ticketing"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["travellerName", "jobCode", "ticketNumber", "pnrCode"],
    view: "ticketing",
  });
  const filteredPnrs = pipeViewRows(periodFiltered.pnrs, {
    dateRange,
    filterConfig: getListFilterConfig("flights"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["pnrCode", "airline", "route", "jobCode"],
    view: "flights",
  });
  const filteredAllTickets = pipeViewRows(periodFiltered.tickets, {
    dateRange,
    filterConfig: getListFilterConfig("tickets"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["ticketNumber", "travellerName", "jobCode", "pnrCode"],
    view: "tickets",
  });
  const filteredSeats = pipeViewRows(periodFiltered.seats, {
    dateRange,
    filterConfig: getListFilterConfig("seat-allocation"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["seatNumber", "jobCode"],
    view: "seat-allocation",
  });
  const filteredHotels = pipeViewRows(periodFiltered.hotels, {
    dateRange,
    filterConfig: [],
    jobCardFilter,
    listFilters: {},
    search,
    searchKeys: ["name", "city", "jobCode"],
    view: "hotels",
  });
  const filteredRoomingTravellers = pipeViewRows(
    periodFiltered.travellers.filter((row: AnyRecord) => row.roomType || row.hotelAllocation),
    {
      dateRange,
      filterConfig: getListFilterConfig("hotels"),
      jobCardFilter,
      listFilters,
      search,
      searchKeys: [
        "fullName",
        "jobCode",
        "travelHub",
        "hotelAllocation",
        "roomType",
        "travelBatchReference",
      ],
      view: "hotels",
    }
  );
  const filteredTourManagers = pipeViewRows(periodFiltered.tourManagers, {
    dateRange,
    filterConfig: getListFilterConfig("tour-managers"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["name", "email", "phone", "jobCode"],
    view: "tour-managers",
  });
  const filteredInvoices = pipeViewRows(periodFiltered.invoices, {
    dateRange,
    filterConfig: getListFilterConfig("finance"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["invoiceNumber", "jobCode"],
    view: "finance",
  });
  const filteredExpenses = pipeViewRows(periodFiltered.expenses, {
    dateRange,
    filterConfig: getListFilterConfig("expenses"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["particulars", "paidBy", "tourManagerName", "jobCode"],
    view: "expenses",
  });
  const filteredApprovals = pipeViewRows(periodFiltered.approvals, {
    dateRange,
    filterConfig: getListFilterConfig("approvals"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["requestCode", "summary", "requestedByName", "type"],
    view: "approvals",
  });
  const filteredLeaves = pipeViewRows(periodFiltered.leaves, {
    dateRange,
    filterConfig: getListFilterConfig("employees-on-leave"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["staffName", "staffEmail", "department", "reason", "leaveType", "status"],
    view: "employees-on-leave",
  });
  const filteredActivity = pipeViewRows(periodFiltered.activity, {
    dateRange,
    filterConfig: getListFilterConfig("activity"),
    jobCardFilter,
    listFilters,
    search,
    searchKeys: ["action", "summary", "entityType", "actorName"],
    view: "activity",
  });
  const filteredTeam = pipeViewRows(compactRows(team), {
    dateRange: EMPTY_DATE_RANGE,
    filterConfig: getListFilterConfig("team"),
    jobCardFilter: "",
    listFilters,
    search,
    searchKeys: ["name", "email", "department", "function", "location", "mobile", "roles"],
    view: "team",
  });
  const filteredStaff = staff
    ? filterRows(compactRows(staff), search, [
        "name",
        "email",
        "department",
        "function",
        "location",
        "mobile",
        "roles",
        "onboardingStatus",
      ])
    : staff;

  const viewResultCountMap = buildViewResultCountMap({
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
  });
  const viewResultCount = getViewResultCount(view, viewResultCountMap);

  const workspaceRows = {
    accountsQueries: filteredAccountsQueries,
    activity: filteredActivity,
    allTickets: filteredAllTickets,
    approvals: filteredApprovals,
    contractingQueries: filteredContractingQueries,
    expenses: filteredExpenses,
    hotels: filteredHotels,
    invoices: filteredInvoices,
    jobCards: filteredJobCards,
    leaves: filteredLeaves,
    passportTravellers: filteredPassportTravellers,
    pipelineQueries: filteredPipelineQueries,
    pnrs: filteredPnrs,
    proposals: filteredProposals,
    queries: filteredQueries,
    roomingTravellers: filteredRoomingTravellers,
    seats: filteredSeats,
    staff: filteredStaff,
    team: filteredTeam,
    tickets: filteredTickets,
    tourManagers: filteredTourManagers,
    travellers: filteredTravellers,
    visas: filteredVisas,
  };

  return {
    filteredAccountsQueries,
    filteredActivity,
    filteredAllTickets,
    filteredApprovals,
    filteredContractingQueries,
    filteredExpenses,
    filteredHotels,
    filteredInvoices,
    filteredJobCards,
    filteredLeaves,
    filteredPassportTravellers,
    filteredPipelineQueries,
    filteredPnrs,
    filteredProposals,
    filteredQueries,
    filteredRoomingTravellers,
    filteredSeats,
    filteredStaff,
    filteredTeam,
    filteredTickets,
    filteredTourManagers,
    filteredTravellers,
    filteredVisas,
    periodFiltered,
    viewResultCount,
    viewResultCountMap,
    workspaceRows,
  };
}
