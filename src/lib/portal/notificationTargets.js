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

export function buildModalInitial(modal, { entityId, queryId }, collections) {
  switch (modal) {
    case "query": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
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
    case "queryStatus": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
      if (!row) {
        return null;
      }
      return {
        approxMargin: row.approxMargin == null ? "" : String(row.approxMargin),
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
    case "salesDecision": {
      const row = collections.queries?.find((entry) => entry.id === entityId);
      if (!row) {
        return null;
      }
      return {
        approxMargin: row.approxMargin == null ? "" : String(row.approxMargin),
        contractingStatus: row.contractingStatus,
        leadStage: row.leadStage || "Inquiry",
        lostReason: row.lostReason || "",
        queryId: row.id,
        salesDecision: row.salesStatus || "Proposal in discussion",
        salesStatus: row.salesStatus,
      };
    }
    case "proposal": {
      const row = collections.proposals?.find((entry) => entry.id === entityId);
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
    case "jobCard": {
      if (queryId && !entityId) {
        const row = collections.queries?.find((entry) => entry.id === queryId);
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
      const row = collections.jobCards?.find((entry) => entry.id === entityId);
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
    case "assignQueryTeams": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) {
        return null;
      }
      return { queryId: row.id, staffId: "", ticketingStaffId: "" };
    }
    case "assignContracting": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) {
        return null;
      }
      return { queryId: row.id, staffId: "" };
    }
    case "assignQueryTicketing": {
      const row = collections.queries?.find((entry) => entry.id === (entityId || queryId));
      if (!row) {
        return null;
      }
      return { queryId: row.id, ticketingStaffId: "" };
    }
    case "assignContractingOwner":
    case "assignOperationsOwner":
    case "assignTicketingOwner": {
      const row = collections.jobCards?.find((entry) => entry.id === entityId);
      if (!row) {
        return null;
      }
      return { jobCardId: row.id };
    }
    case "ticket": {
      const row = collections.tickets?.find((entry) => entry.id === entityId);
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
    case "leave_create": {
      const row = collections.leaves?.find((entry) => entry.id === entityId);
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
    case "expense": {
      const row = collections.expenses?.find((entry) => entry.id === entityId);
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
    default:
      return null;
  }
}
