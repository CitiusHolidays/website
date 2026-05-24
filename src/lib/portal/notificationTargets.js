const CONTRACTING_QUERY_TITLES = new Set([
  "New query received",
  "Query submitted to Contracting",
]);

export function getNotificationHref({ entityType, entityId, title }) {
  if (!entityType || !entityId) {
    return "/portal/activity";
  }

  const params = new URLSearchParams();

  switch (entityType) {
    case "query": {
      if (title === "Order confirmed") {
        params.set("open", "jobCard");
        params.set("queryId", entityId);
        return `/portal/accounts/job-cards?${params}`;
      }
      if (CONTRACTING_QUERY_TITLES.has(title)) {
        params.set("open", "queryStatus");
        params.set("id", entityId);
        return `/portal/contracting?${params}`;
      }
      params.set("open", "query");
      params.set("id", entityId);
      return `/portal/queries?${params}`;
    }
    case "proposal":
      params.set("open", "proposal");
      params.set("id", entityId);
      return `/portal/proposals?${params}`;
    case "jobCard":
      params.set("open", "jobCard");
      params.set("id", entityId);
      return `/portal/job-cards?${params}`;
    case "ticket":
      params.set("open", "ticket");
      params.set("id", entityId);
      return `/portal/tickets?${params}`;
    case "leave":
      params.set("open", "leave_create");
      params.set("id", entityId);
      return `/portal/employees-on-leave?${params}`;
    case "approval":
      params.set("open", "approval");
      params.set("id", entityId);
      return `/portal/approvals?${params}`;
    default:
      return "/portal/activity";
  }
}

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

export function getDeepLinkCollectionKeys(modal) {
  switch (modal) {
    case "query":
    case "queryStatus":
      return ["queries"];
    case "jobCard":
      return ["queries", "jobCards", "proposals"];
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
    case "proposal": {
      const row = collections.proposals?.find((entry) => entry.id === entityId);
      if (!row) return null;
      return {
        entityId: row.id,
        queryId: row.queryId || "",
        clientName: row.clientName,
        landCostPerPax: String(row.landCostPerPax ?? ""),
        airfarePerPax: String(row.airfarePerPax ?? ""),
        sellingPrice: String(row.sellingPrice ?? ""),
        paxCount: String(row.query?.paxCount ?? 1),
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
