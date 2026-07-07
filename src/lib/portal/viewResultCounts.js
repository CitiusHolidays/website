export function getViewResultCount(view, rowsByView) {
  const rows = rowsByView[view];
  return Array.isArray(rows) ? rows.length : null;
}

export function buildViewResultCountMap(workspaceRows) {
  return {
    "accounts-job-cards": workspaceRows.filteredAccountsQueries,
    activity: workspaceRows.filteredActivity,
    approvals: workspaceRows.filteredApprovals,
    contracting: workspaceRows.filteredContractingQueries,
    "employees-on-leave": workspaceRows.filteredLeaves,
    expenses: workspaceRows.filteredExpenses,
    finance: workspaceRows.filteredInvoices,
    flights: workspaceRows.filteredPnrs,
    hotels: workspaceRows.filteredRoomingTravellers,
    "job-cards": workspaceRows.filteredJobCards,
    passport: workspaceRows.filteredPassportTravellers,
    pipeline: workspaceRows.filteredPipelineQueries,
    proposals: workspaceRows.filteredProposals,
    queries: workspaceRows.filteredQueries,
    "seat-allocation": workspaceRows.filteredSeats,
    team: workspaceRows.filteredTeam,
    ticketing: workspaceRows.filteredTickets,
    tickets: workspaceRows.filteredAllTickets,
    "tour-managers": workspaceRows.filteredTourManagers,
    travellers: workspaceRows.filteredTravellers,
    visa: workspaceRows.filteredVisas,
  };
}
