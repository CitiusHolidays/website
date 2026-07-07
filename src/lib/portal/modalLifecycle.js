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

function latestProposalForQuery(proposals = [], queryId) {
  return proposals.reduce((latest, proposal) => {
    if (!proposalLinkedQueryIds(proposal).includes(queryId)) {
      return latest;
    }
    if (!latest) {
      return proposal;
    }
    return new Date(proposal.updatedAt) > new Date(latest.updatedAt) ? proposal : latest;
  }, null);
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
    next.queryIds = Array.isArray(next.queryIds)
      ? next.queryIds
      : next.queryId
        ? [next.queryId]
        : [];
    next.queryId = next.queryIds[0] || next.queryId || "";
  }
  if (next.queryId && (type === "jobCard" || type === "proposal")) {
    const linkedQuery = queries.find((query) => query.id === next.queryId);
    if (linkedQuery) {
      Object.assign(next, applyQueryLink(next, linkedQuery, { onlyEmpty: true }));
    }
    if (type === "jobCard" && !next.proposalId) {
      next.proposalId = latestProposalForQuery(proposals, next.queryId)?.id || "";
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
