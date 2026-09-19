import {
  applyJobCardLink,
  applyPnrLink,
  applyQueryLink,
  applyTravellerLink,
  applyVisaRecordLink,
  reconcileLinkedSelections,
} from "@/lib/portal/entityModalLinks";
import { isCementScopedUser } from "@/lib/portal/permissions";
import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";

export const JOB_CARD_MODALS = new Set([
  "traveller",
  "pnr",
  "ticket",
  "seat",
  "hotel",
  "invoice",
  "expense",
]);

export function createModalActionOwnership() {
  let activeInstance = null;
  let inFlightInstance = null;
  let nextInstance = 0;

  return {
    begin() {
      if (activeInstance === null || inFlightInstance === activeInstance) {
        return null;
      }
      inFlightInstance = activeInstance;
      return activeInstance;
    },
    close(expectedInstance = activeInstance) {
      if (expectedInstance === null || expectedInstance !== activeInstance) {
        if (inFlightInstance === expectedInstance) {
          inFlightInstance = null;
        }
        return false;
      }
      activeInstance = null;
      if (inFlightInstance === expectedInstance) {
        inFlightInstance = null;
      }
      return true;
    },
    current() {
      return activeInstance;
    },
    isCurrent(instance) {
      return instance !== null && instance === activeInstance;
    },
    open() {
      nextInstance += 1;
      activeInstance = nextInstance;
      return activeInstance;
    },
    release(instance) {
      if (inFlightInstance === instance) {
        inFlightInstance = null;
      }
      return instance !== null && instance === activeInstance;
    },
  };
}

/**
 * @typedef {{ id: string, queryId?: string, queryIds?: string[], updatedAt?: string | number | Date }} LinkedProposal
 */

/**
 * @param {{ form: Record<string, any>, modal: string | null, proposals?: LinkedProposal[], queries?: Record<string, any>[] }} args
 */
export function jobCardProposalLinkPatch({ form, modal, queries = [] }) {
  if (modal !== "jobCard" || form.entityId || !form.queryId) {
    return null;
  }
  const linkedQuery = queries.find((query) => query.id === form.queryId);
  if (!linkedQuery) {
    return form._confirmedOfferState === "loading" ? null : { _confirmedOfferState: "loading" };
  }
  if (!linkedQuery.confirmedOffer) {
    return form._confirmedOfferState === "missing"
      ? null
      : { _confirmedOfferState: "missing", proposalId: "" };
  }
  if (form._confirmedOfferQueryId === form.queryId) {
    return null;
  }
  const patch = applyQueryLink(form, linkedQuery);
  patch._confirmedOfferQueryId = form.queryId;
  patch._confirmedOfferState = "ready";
  patch.proposalId = linkedQuery.confirmedOffer.proposalId;
  const changedPatch = Object.fromEntries(
    Object.entries(patch).filter(([field, value]) => form[field] !== value)
  );
  return Object.keys(changedPatch).length > 0 ? changedPatch : null;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this adapter maps three focused entity contracts explicitly.
export function createFocusedEditModalForm(type, detail) {
  if (type === "query") {
    return {
      batchingNotes: detail.batchingNotes || "",
      budgetAmount: String(detail.budgetAmount || ""),
      clientName: detail.clientName || "",
      contactMobile: detail.contactMobile || "",
      contactPerson: detail.contactPerson || "",
      destination: detail.destination || "",
      entityId: detail.id,
      notes: detail.notes || "",
      paxCount: String(detail.paxCount || 1),
      queryType: detail.queryType || "MICE",
      salesOwnerName: detail.salesOwnerName || "",
      salesOwnerStaffId: detail.salesOwnerId || "",
      source: detail.source || "",
      staffId: detail.contractingOwnerId || "",
      ticketingScope: detail.ticketingScope || "",
      travelEndDate: detail.travelEndDate || "",
      travelInBatches: detail.travelInBatches ? "Yes" : "No",
      travelStartDate: detail.travelStartDate || "",
      travelType: detail.travelType || "International Travel",
    };
  }
  if (type === "proposal") {
    return {
      airfarePerPax: String(detail.airfarePerPax ?? ""),
      clientName: detail.clientName || "",
      entityId: detail.id,
      itinerarySummary: detail.itinerarySummary || "",
      landCostPerPax: String(detail.landCostPerPax ?? ""),
      paxCount: String(detail.query?.paxCount ?? 1),
      queryId: detail.queryId || "",
      queryIds: proposalLinkedQueryIds(detail),
      sellingPrice: String(detail.sellingPrice ?? ""),
      taxRate:
        detail.taxRate === null || detail.taxRate === undefined ? "" : String(detail.taxRate),
      visaCostPerPax: String(detail.visaCostPerPax ?? ""),
    };
  }
  if (type === "jobCard") {
    return {
      clientName: detail.clientName || "",
      confirmedPax: String(detail.confirmedPax || 1),
      destination: detail.destination || "",
      entityId: detail.id,
      proposalId: detail.proposalId || "",
      queryId: detail.queryId || "",
      roomCount: String(detail.roomCount || ""),
      tourManagerName: detail.tourManagerName || "",
      travelEndDate: detail.travelEndDate || "",
      travelStartDate: detail.travelStartDate || "",
    };
  }
  return null;
}

function initializeProposalSelection(next, type) {
  if (type === "proposal") {
    if (!Array.isArray(next.queryIds)) {
      next.queryIds = next.queryId ? [next.queryId] : [];
    }
    next.queryId = next.queryIds[0] || next.queryId || "";
  }
}

function applyInitialQueryLink(next, type, queries) {
  if (next.queryId && (type === "jobCard" || type === "proposal")) {
    const linkedQuery = queries.find((query) => query.id === next.queryId);
    if (linkedQuery) {
      Object.assign(next, applyQueryLink(next, linkedQuery, { onlyEmpty: true }));
    }
    if (type === "jobCard" && linkedQuery?.confirmedOffer) {
      next.proposalId = linkedQuery.confirmedOffer.proposalId;
      next._confirmedOfferQueryId = next.queryId;
      next._confirmedOfferState = "ready";
    }
  }
}

function applyInitialJobCardLink(next, type, jobCards) {
  if (JOB_CARD_MODALS.has(type) && !next.jobCardId && jobCards?.length === 1) {
    Object.assign(next, applyJobCardLink(next, jobCards[0], type, { onlyEmpty: true }));
  }
  if (JOB_CARD_MODALS.has(type) && next.jobCardId) {
    const linkedJob = jobCards.find((job) => job.id === next.jobCardId);
    if (linkedJob) {
      Object.assign(next, applyJobCardLink(next, linkedJob, type, { onlyEmpty: true }));
    }
  }
}

function applyInitialTravellerLink(next, type, travellers, travellersWithoutVisa) {
  if (next.travellerId && ["ticket", "seat", "visa_create"].includes(type)) {
    const linkedTraveller =
      travellers.find((traveller) => traveller.id === next.travellerId) ||
      travellersWithoutVisa.find((traveller) => traveller.id === next.travellerId);
    if (linkedTraveller) {
      Object.assign(next, applyTravellerLink(next, linkedTraveller, type, { onlyEmpty: true }));
    }
  }
}

function applyInitialPnrLink(next, type, pnrs) {
  if (next.pnrId && ["ticket", "seat"].includes(type)) {
    const linkedPnr = pnrs.find((pnr) => pnr.id === next.pnrId);
    if (linkedPnr) {
      Object.assign(next, applyPnrLink(next, linkedPnr, type, { onlyEmpty: true }));
    }
  }
}

function applyInitialVisaLink(next, type, visas) {
  if (next.visaRecordId && type === "visa") {
    const linkedVisa = visas.find((visa) => visa.id === next.visaRecordId);
    if (linkedVisa) {
      Object.assign(next, applyVisaRecordLink(next, linkedVisa, { onlyEmpty: true }));
    }
  }
}

function applyInitialQueryDefaults(next, type, initial, access) {
  if (type === "query" && !initial.queryType && isCementScopedUser(access)) {
    next.queryType = "Cement";
  }
}

function applyInitialTeamAssignment(next, type, queries) {
  if (type === "assignQueryTeams" && next.queryId) {
    const linkedQuery = queries.find((query) => query.id === next.queryId);
    if (linkedQuery) {
      if (linkedQuery.contractingOwnerId) {
        next.staffId = linkedQuery.contractingOwnerId;
      }
      if (linkedQuery.ticketingOwnerId) {
        next.ticketingStaffId = linkedQuery.ticketingOwnerId;
      }
      if (linkedQuery.ticketingScope) {
        next.ticketingScope = linkedQuery.ticketingScope;
      }
    }
  }
}

export function createInitialModalForm({
  type,
  initial = {},
  initialForm,
  queries = [],
  jobCards = [],
  travellers = [],
  travellersWithoutVisa = [],
  pnrs = [],
  visas = [],
  access,
}) {
  const next = { ...initialForm, ...initial };
  initializeProposalSelection(next, type);
  applyInitialQueryLink(next, type, queries);
  applyInitialJobCardLink(next, type, jobCards);
  applyInitialTravellerLink(next, type, travellers, travellersWithoutVisa);
  applyInitialPnrLink(next, type, pnrs);
  applyInitialVisaLink(next, type, visas);
  Object.assign(next, reconcileLinkedSelections(next, travellers, pnrs, jobCards));
  applyInitialQueryDefaults(next, type, initial, access);
  applyInitialTeamAssignment(next, type, queries);
  return next;
}
