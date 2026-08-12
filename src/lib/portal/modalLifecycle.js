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

/**
 * @typedef {{ id: string, queryId?: string, queryIds?: string[], updatedAt?: string | number | Date }} LinkedProposal
 */

/**
 * @param {LinkedProposal[]} proposals
 * @param {string} queryId
 */
export function resolveLinkedProposalForQuery(proposals, queryId) {
  return proposals.reduce((latest, proposal) => {
    const linkedQueryIds = new Set(proposalLinkedQueryIds(proposal));
    if (!linkedQueryIds.has(queryId)) {
      return latest;
    }
    if (!latest) {
      return proposal;
    }
    return new Date(proposal.updatedAt) > new Date(latest.updatedAt) ? proposal : latest;
  }, null);
}

/**
 * @param {{ form: Record<string, any>, modal: string | null, proposals?: LinkedProposal[], queries?: Record<string, any>[] }} args
 */
export function jobCardProposalLinkPatch({ form, modal, proposals = [], queries = [] }) {
  if (modal !== "jobCard" || form.entityId || !form.queryId) {
    return null;
  }
  const linkedQuery = queries.find((query) => query.id === form.queryId);
  const patch = linkedQuery ? applyQueryLink(form, linkedQuery, { onlyEmpty: true }) : {};
  if (!form.proposalId) {
    const linkedProposal = resolveLinkedProposalForQuery(proposals, form.queryId);
    patch.proposalId =
      linkedQuery?.confirmedOffer?.proposalId ||
      linkedQuery?.proposalPreview?.proposalId ||
      linkedProposal?.id ||
      "";
  }
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
      taxRate: detail.taxRate == null ? "" : String(detail.taxRate),
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

export function createInitialModalForm({
  type,
  initial = {},
  initialForm,
  queries = [],
  proposals = [],
  jobCards = [],
  travellers = [],
  travellersWithoutVisa = [],
  pnrs = [],
  visas = [],
  access,
}) {
  const next = { ...initialForm, ...initial };
  if (type === "proposal") {
    if (!Array.isArray(next.queryIds)) {
      next.queryIds = next.queryId ? [next.queryId] : [];
    }
    next.queryId = next.queryIds[0] || next.queryId || "";
  }
  if (next.queryId && (type === "jobCard" || type === "proposal")) {
    const linkedQuery = queries.find((query) => query.id === next.queryId);
    if (linkedQuery) {
      Object.assign(next, applyQueryLink(next, linkedQuery, { onlyEmpty: true }));
    }
    if (type === "jobCard" && !next.proposalId) {
      next.proposalId =
        linkedQuery?.confirmedOffer?.proposalId ||
        linkedQuery?.proposalPreview?.proposalId ||
        resolveLinkedProposalForQuery(proposals, next.queryId)?.id ||
        "";
    }
  }
  if (JOB_CARD_MODALS.has(type) && !next.jobCardId && jobCards?.length === 1) {
    Object.assign(next, applyJobCardLink(next, jobCards[0], type, { onlyEmpty: true }));
  }
  if (JOB_CARD_MODALS.has(type) && next.jobCardId) {
    const linkedJob = jobCards.find((job) => job.id === next.jobCardId);
    if (linkedJob) {
      Object.assign(next, applyJobCardLink(next, linkedJob, type, { onlyEmpty: true }));
    }
  }
  if (next.travellerId && ["ticket", "seat", "visa_create"].includes(type)) {
    const linkedTraveller =
      travellers.find((traveller) => traveller.id === next.travellerId) ||
      travellersWithoutVisa.find((traveller) => traveller.id === next.travellerId);
    if (linkedTraveller) {
      Object.assign(next, applyTravellerLink(next, linkedTraveller, type, { onlyEmpty: true }));
    }
  }
  if (next.pnrId && ["ticket", "seat"].includes(type)) {
    const linkedPnr = pnrs.find((pnr) => pnr.id === next.pnrId);
    if (linkedPnr) {
      Object.assign(next, applyPnrLink(next, linkedPnr, type, { onlyEmpty: true }));
    }
  }
  if (next.visaRecordId && type === "visa") {
    const linkedVisa = visas.find((visa) => visa.id === next.visaRecordId);
    if (linkedVisa) {
      Object.assign(next, applyVisaRecordLink(next, linkedVisa, { onlyEmpty: true }));
    }
  }
  Object.assign(next, reconcileLinkedSelections(next, travellers, pnrs, jobCards));
  if (type === "query" && !initial.queryType && isCementScopedUser(access)) {
    next.queryType = "Cement";
  }
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
  return next;
}
