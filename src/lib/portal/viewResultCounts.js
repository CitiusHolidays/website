export function getViewResultCount(view, rowsByView) {
  const rows = rowsByView[view];
  return Array.isArray(rows) ? rows.length : null;
}

export function buildViewResultCountMap(workspaceRows) {
  return {
    queries: workspaceRows.filteredQueries,
    pipeline: workspaceRows.filteredPipelineQueries,
    contracting: workspaceRows.filteredContractingQueries,
    proposals: workspaceRows.filteredProposals,
    "accounts-job-cards": workspaceRows.filteredAccountsQueries,
    "job-cards": workspaceRows.filteredJobCards,
    travellers: workspaceRows.filteredTravellers,
    passport: workspaceRows.filteredPassportTravellers,
    visa: workspaceRows.filteredVisas,
    ticketing: workspaceRows.filteredTickets,
    flights: workspaceRows.filteredPnrs,
    tickets: workspaceRows.filteredAllTickets,
    "seat-allocation": workspaceRows.filteredSeats,
    hotels: workspaceRows.filteredRoomingTravellers,
    "tour-managers": workspaceRows.filteredTourManagers,
    finance: workspaceRows.filteredInvoices,
    expenses: workspaceRows.filteredExpenses,
    approvals: workspaceRows.filteredApprovals,
    "employees-on-leave": workspaceRows.filteredLeaves,
    team: workspaceRows.filteredTeam,
    activity: workspaceRows.filteredActivity,
  };
}
