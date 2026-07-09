export const CAPACITY_THRESHOLDS = {
  busy: 6,
  overloaded: 10,
  staleHours: 24,
};

function severity(load) {
  if (load >= CAPACITY_THRESHOLDS.overloaded) {
    return "overloaded";
  }
  if (load >= CAPACITY_THRESHOLDS.busy) {
    return "busy";
  }
  return "normal";
}

export function buildStaffCapacityRows({
  staff = [],
  queries = [],
  jobCards = [],
  tickets = [],
  visas = [],
  approvals = [],
  invoices = [],
} = {}) {
  const closedSalesStatuses = new Set(["Order Confirmed", "Order Lost"]);
  const ticketAttentionStatuses = new Set([
    "Name Change Required",
    "Reissue Required",
    "Refund Pending",
  ]);
  const clearedVisaStatuses = new Set(["Approved", "Not Required"]);
  return staff.map((member) => {
    const staffId = String(member.id ?? member._id);
    const activeSalesQueries = queries.filter(
      (row) => String(row.salesOwnerId) === staffId && !closedSalesStatuses.has(row.salesStatus)
    ).length;
    const activeContractingQueries = queries.filter(
      (row) =>
        String(row.contractingOwnerId) === staffId && !closedSalesStatuses.has(row.salesStatus)
    ).length;
    const activeJobCards = jobCards.filter((row) => {
      const ownerIds = new Set(
        [row.contractingOwnerId, row.operationsOwnerId, row.ticketingOwnerId].map(String)
      );
      return ownerIds.has(staffId) && row.status !== "Closed";
    }).length;
    const ticketAttention = tickets.filter(
      (row) =>
        String(row.ownerId ?? row.ticketingOwnerId ?? "") === staffId &&
        ticketAttentionStatuses.has(row.ticketStatus)
    ).length;
    const financeItems =
      invoices.filter((row) => (row.balanceAmount ?? 0) > 0).length +
      approvals.filter((row) => row.status === "Pending").length;
    const visaBlockers = visas.filter((row) => !clearedVisaStatuses.has(row.status)).length;
    const load =
      activeSalesQueries +
      activeContractingQueries +
      activeJobCards +
      ticketAttention +
      financeItems +
      visaBlockers;
    return {
      activeContractingQueries,
      activeJobCards,
      activeSalesQueries,
      financeItems,
      id: staffId,
      load,
      name: member.name,
      roles: member.roles ?? [],
      severity: severity(load),
      ticketAttention,
      visaBlockers,
    };
  });
}

export function buildRoleCapacitySummary(rows = []) {
  const byRole = new Map();
  for (const row of rows) {
    for (const role of row.roles ?? ["Unassigned"]) {
      const current = byRole.get(role) ?? { load: 0, overloaded: 0, role, staffCount: 0 };
      current.staffCount += 1;
      current.load += row.load;
      if (row.severity === "overloaded") {
        current.overloaded += 1;
      }
      byRole.set(role, current);
    }
  }
  return [...byRole.values()].map((row) => ({
    ...row,
    averageLoad: row.staffCount ? Math.round(row.load / row.staffCount) : 0,
  }));
}

export function buildOwnerSuggestions(rows = []) {
  return rows
    .filter((row) => row.severity === "normal")
    .toSorted((a, b) => a.load - b.load)
    .slice(0, 5);
}
