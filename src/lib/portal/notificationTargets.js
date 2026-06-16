import { getNotificationHref } from "./notificationPaths.js";
import { proposalLinkedQueryIds, proposalPrimaryQuery } from "./proposalLinks.js";

export { getNotificationHref };

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
        status: "resolved",
        modal: "expense",
        entityId: approval.entityId,
        queryId: null,
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
      status: "resolved",
      modal: "jobCard",
      entityId: null,
      queryId,
    };
  }

  if (!id && !queryId) {
    return { status: "missing" };
  }

  return {
    status: "resolved",
    modal: open,
    entityId: id || null,
    queryId: queryId || null,
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

export function buildModalInitial(modal, { entityId, queryId }, collections) {
  switch (modal) {
    case "query": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        clientName: row.clientName,
        contactPerson: row.contactPerson,
        contactMobile: row.contactMobile,
        destination: row.destination,
        paxCount: String(row.paxCount),
        travelStartDate: row.travelStartDate,
        travelEndDate: row.travelEndDate,
        queryType: row.queryType,
        travelType: row.travelType,
        budgetAmount: String(row.budgetAmount || ""),
        source: row.source,
        salesOwnerName: row.salesOwnerName,
        notes: row.notes,
      };
    }
    case "queryStatus": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        queryId: row.id,
        salesStatus: row.salesStatus,
        leadStage: row.leadStage || "Inquiry",
        contractingStatus: row.contractingStatus,
        budgetAmount: String(row.budgetAmount || ""),
        contractingLandCost: String(row.contractingLandCost ?? ""),
        contractingAirlinesCost: String(row.contractingAirlinesCost ?? ""),
        contractingVisaCost: String(row.contractingVisaCost ?? ""),
        approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
      };
    }
    case "salesDecision": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        queryId: row.id,
        salesStatus: row.salesStatus,
        salesDecision: row.salesStatus || "Proposal in discussion",
        leadStage: row.leadStage || "Inquiry",
        contractingStatus: row.contractingStatus,
        approxMargin: row.approxMargin != null ? String(row.approxMargin) : "",
        lostReason: row.lostReason || "",
      };
    }
    case "proposal": {
      const row = collections.proposals?.find((entry) => entry.id === entityId);
      if (!row) return null;
      const queryIds = proposalLinkedQueryIds(row);
      const primaryQuery = proposalPrimaryQuery(row);
      return {
        entityId: row.id,
        queryId: row.queryId || "",
        queryIds,
        clientName: row.clientName,
        landCostPerPax: String(row.landCostPerPax ?? ""),
        airfarePerPax: String(row.airfarePerPax ?? ""),
        sellingPrice: String(row.sellingPrice ?? ""),
        paxCount: String(primaryQuery?.paxCount ?? 1),
        itinerarySummary: row.itinerarySummary || "",
      };
    }
    case "jobCard": {
      if (queryId && !entityId) {
        const row = collections.queries?.find((entry) => entry.id === queryId);
        if (!row) return null;
        return {
          queryId: row.id,
          clientName: row.clientName,
          destination: row.destination,
          confirmedPax: String(row.paxCount),
          travelStartDate: row.travelStartDate,
          travelEndDate: row.travelEndDate,
        };
      }
      const row = collections.jobCards?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        queryId: row.queryId || "",
        proposalId: row.proposalId || "",
        clientName: row.clientName,
        confirmedPax: String(row.confirmedPax),
        roomCount: String(row.roomCount || ""),
        destination: row.destination,
        travelStartDate: row.travelStartDate,
        travelEndDate: row.travelEndDate,
        tourManagerName: row.tourManagerName,
      };
    }
    case "assignQueryTeams": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) return null;
      return { queryId: row.id, staffId: "", ticketingStaffId: "" };
    }
    case "assignContracting": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) return null;
      return { queryId: row.id, staffId: "" };
    }
    case "assignQueryTicketing": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) return null;
      return { queryId: row.id, ticketingStaffId: "" };
    }
    case "assignContractingOwner":
    case "assignOperationsOwner":
    case "assignTicketingOwner": {
      const row = collections.jobCards?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return { jobCardId: row.id };
    }
    case "ticket": {
      const row = collections.tickets?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        jobCardId: row.jobCardId,
        travellerId: row.travellerId || "",
        pnrId: row.pnrId || "",
        ticketNumber: row.ticketNumber,
        ticketType: row.ticketType,
        ticketStatus: row.ticketStatus,
        paymentType: row.paymentType,
        cabinClass: row.cabinClass,
        foodPreference: row.mealPreference,
        seatPreference: row.seatPreference,
        seatNumber: row.seatNumber,
      };
    }
    case "leave_create": {
      const row = collections.leaves?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        staffId: row.staffId,
        leaveType: row.leaveType || "Casual",
        startDate: row.startDate,
        endDate: row.endDate,
        reason: row.reason,
        status: row.status,
      };
    }
    case "expense": {
      const row = collections.expenses?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        jobCardId: row.jobCardId,
        tourManagerName: row.tourManagerName,
        category: row.category,
        expenseDate: row.expenseDate,
        particulars: row.particulars,
        currency: row.currency,
        cardAmount: String(row.cardAmount),
        cashAmount: String(row.cashAmount),
        epayAmount: String(row.epayAmount),
        amount: String(row.amount),
        paidBy: row.paidBy,
        notes: row.notes,
      };
    }
    default:
      return null;
  }
}
