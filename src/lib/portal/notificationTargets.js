import { getNotificationHref as resolveNotificationHref } from "./notificationPaths.js";
import { proposalLinkedQueryIds, proposalPrimaryQuery } from "./proposalLinks.js";

export const getNotificationHref = resolveNotificationHref;

export function resolveDeepLink({ open, id, queryId }, collections) {
  if (!open) {
    return { status: "none" };
  }

  if (open === "approval") {
    if (!id) {
      return { status: "missing" };
    }
    if (collections.approvals === undefined) {
      return { status: "loading" };
    }
    const approval = collections.approvals.find((row) => row.id === id);
    if (!approval) {
      return { status: "missing" };
    }
    if (approval.entityType === "expense") {
      return {
        entityId: approval.entityId,
        modal: "expense",
        queryId: null,
        status: "resolved",
      };
    }
    return { status: "missing" };
  }

  if (open === "jobCard" && queryId && !id) {
    if (collections.queries === undefined) {
      return { status: "loading" };
    }
    const query = collections.queries.find((row) => row.id === queryId);
    if (!query) {
      return { status: "missing" };
    }
    return {
      entityId: null,
      modal: "jobCard",
      queryId,
      status: "resolved",
    };
  }

  if (!(id || queryId)) {
    return { status: "missing" };
  }

  return {
    entityId: id || null,
    modal: open,
    queryId: queryId || null,
    status: "resolved",
  };
}

function getDeepLinkCollectionKeys(modal) {
  switch (modal) {
    case "query":
    case "queryStatus":
    case "salesDecision":
    case "assignContracting":
    case "assignQueryTicketing":
    case "assignQueryTeams":
      return ["queries"];
    case "jobCard":
      return ["queries", "jobCards", "proposals"];
    case "assignContractingOwner":
    case "assignOperationsOwner":
    case "assignTicketingOwner":
      return ["jobCards"];
    case "proposal":
      return ["proposals"];
    case "ticket":
      return ["tickets"];
    case "leave_create":
      return ["leaves"];
    case "expense":
      return ["expenses", "approvals"];
    case "approval":
      return ["approvals"];
    default:
      return [];
  }
}

export function isDeepLinkDataReady(modal, collections) {
  const keys = getDeepLinkCollectionKeys(modal);
  if (keys.length === 0) {
    return true;
  }
  return keys.every((key) => collections[key] !== undefined);
}

function findById(rows, id) {
  return rows?.find((entry) => entry.id === id);
}

function buildQueryInitial({ entityId }, collections) {
  const row = findById(collections.queries, entityId);
  if (!row) {
    return null;
  }
  return {
    budgetAmount: String(row.budgetAmount || ""),
    clientName: row.clientName,
    contactMobile: row.contactMobile,
    contactPerson: row.contactPerson,
    destination: row.destination,
    entityId: row.id,
    notes: row.notes,
    paxCount: String(row.paxCount),
    queryType: row.queryType,
    salesOwnerName: row.salesOwnerName,
    source: row.source,
    travelEndDate: row.travelEndDate,
    travelStartDate: row.travelStartDate,
    travelType: row.travelType,
  };
}

function buildQueryStatusInitial({ entityId }, collections) {
  const row = findById(collections.queries, entityId);
  if (!row) {
    return null;
  }
  return {
    approxMargin: row.approxMargin === null ? "" : String(row.approxMargin),
    budgetAmount: String(row.budgetAmount || ""),
    contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
    contractingLandCost: String(row.contractingLandCost ?? ""),
    contractingStatus: row.contractingStatus,
    contractingVisaCost: String(row.contractingVisaCost ?? ""),
    leadStage: row.leadStage || "Inquiry",
    queryId: row.id,
    salesStatus: row.salesStatus,
  };
}

function buildSalesDecisionInitial({ entityId }, collections) {
  const row = findById(collections.queries, entityId);
  if (!row) {
    return null;
  }
  return {
    approxMargin: row.approxMargin === null ? "" : String(row.approxMargin),
    contractingStatus: row.contractingStatus,
    leadStage: row.leadStage || "Inquiry",
    lostReason: row.lostReason || "",
    queryId: row.id,
    salesDecision: row.salesStatus || "Proposal in discussion",
    salesStatus: row.salesStatus,
  };
}

function buildProposalInitial({ entityId }, collections) {
  const row = findById(collections.proposals, entityId);
  if (!row) {
    return null;
  }
  const queryIds = proposalLinkedQueryIds(row);
  const primaryQuery = proposalPrimaryQuery(row);
  return {
    airfarePerPax: String(row.airfarePerPax ?? ""),
    clientName: row.clientName,
    entityId: row.id,
    itinerarySummary: row.itinerarySummary || "",
    landCostPerPax: String(row.landCostPerPax ?? ""),
    paxCount: String(primaryQuery?.paxCount ?? 1),
    queryId: row.queryId || "",
    queryIds,
    sellingPrice: String(row.sellingPrice ?? ""),
  };
}

function buildJobCardInitial({ entityId, queryId }, collections) {
  if (queryId && !entityId) {
    const row = findById(collections.queries, queryId);
    if (!row) {
      return null;
    }
    return {
      clientName: row.clientName,
      confirmedPax: String(row.paxCount),
      destination: row.destination,
      queryId: row.id,
      travelEndDate: row.travelEndDate,
      travelStartDate: row.travelStartDate,
    };
  }
  const row = findById(collections.jobCards, entityId);
  if (!row) {
    return null;
  }
  return {
    clientName: row.clientName,
    confirmedPax: String(row.confirmedPax),
    destination: row.destination,
    entityId: row.id,
    proposalId: row.proposalId || "",
    queryId: row.queryId || "",
    roomCount: String(row.roomCount || ""),
    tourManagerName: row.tourManagerName,
    travelEndDate: row.travelEndDate,
    travelStartDate: row.travelStartDate,
  };
}

function linkedQuery({ entityId, queryId }, collections) {
  return findById(collections.queries, entityId || queryId);
}

function buildAssignQueryTeamsInitial(link, collections) {
  const row = linkedQuery(link, collections);
  return row ? { queryId: row.id, staffId: "", ticketingStaffId: "" } : null;
}

function buildAssignContractingInitial(link, collections) {
  const row = linkedQuery(link, collections);
  return row ? { queryId: row.id, staffId: "" } : null;
}

function buildAssignQueryTicketingInitial(link, collections) {
  const row = linkedQuery(link, collections);
  return row ? { queryId: row.id, ticketingStaffId: "" } : null;
}

function buildAssignJobCardOwnerInitial({ entityId }, collections) {
  const row = findById(collections.jobCards, entityId);
  return row ? { jobCardId: row.id } : null;
}

function buildTicketInitial({ entityId }, collections) {
  const row = findById(collections.tickets, entityId);
  if (!row) {
    return null;
  }
  return {
    cabinClass: row.cabinClass,
    entityId: row.id,
    foodPreference: row.mealPreference,
    jobCardId: row.jobCardId,
    paymentType: row.paymentType,
    pnrId: row.pnrId || "",
    seatNumber: row.seatNumber,
    seatPreference: row.seatPreference,
    ticketNumber: row.ticketNumber,
    ticketStatus: row.ticketStatus,
    ticketType: row.ticketType,
    travellerId: row.travellerId || "",
  };
}

function buildLeaveInitial({ entityId }, collections) {
  const row = findById(collections.leaves, entityId);
  if (!row) {
    return null;
  }
  return {
    endDate: row.endDate,
    entityId: row.id,
    leaveType: row.leaveType || "Casual",
    reason: row.reason,
    staffId: row.staffId,
    startDate: row.startDate,
    status: row.status,
  };
}

function buildExpenseInitial({ entityId }, collections) {
  const row = findById(collections.expenses, entityId);
  if (!row) {
    return null;
  }
  return {
    amount: String(row.amount),
    cardAmount: String(row.cardAmount),
    cashAmount: String(row.cashAmount),
    category: row.category,
    currency: row.currency,
    entityId: row.id,
    epayAmount: String(row.epayAmount),
    expenseDate: row.expenseDate,
    jobCardId: row.jobCardId,
    notes: row.notes,
    paidBy: row.paidBy,
    particulars: row.particulars,
    tourManagerName: row.tourManagerName,
  };
}

const MODAL_INITIAL_BUILDERS = {
  assignContracting: buildAssignContractingInitial,
  assignContractingOwner: buildAssignJobCardOwnerInitial,
  assignOperationsOwner: buildAssignJobCardOwnerInitial,
  assignQueryTeams: buildAssignQueryTeamsInitial,
  assignQueryTicketing: buildAssignQueryTicketingInitial,
  assignTicketingOwner: buildAssignJobCardOwnerInitial,
  expense: buildExpenseInitial,
  jobCard: buildJobCardInitial,
  leave_create: buildLeaveInitial,
  proposal: buildProposalInitial,
  query: buildQueryInitial,
  queryStatus: buildQueryStatusInitial,
  salesDecision: buildSalesDecisionInitial,
  ticket: buildTicketInitial,
};

export function buildModalInitial(modal, link, collections) {
  const builder = MODAL_INITIAL_BUILDERS[modal];
  return builder ? builder(link, collections) : null;
}
