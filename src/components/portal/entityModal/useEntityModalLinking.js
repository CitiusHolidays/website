"use client";

import {
  applyJobCardLink,
  applyPnrLink,
  applyQueryLink,
  applyStaffLink,
  applyTravellerLink,
  applyVisaRecordLink,
  reconcileLinkedSelections,
} from "@/lib/portal/entityModalLinks";
import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";

export function useEntityModalLinking({
  modal,
  form,
  updateForm,
  patchForm,
  queries,
  proposals,
  jobCards,
  travellers,
  travellersWithoutVisa,
  pnrs,
  visas,
  team,
}) {
  const handleStaffSelect = (field, staffId) => {
    const member = team.find((entry) => entry.id === staffId);
    if (field === "staffId") {
      patchForm(applyStaffLink(staffId, member, modal));
      return;
    }
    updateForm(field, staffId);
  };

  const handleProposalQuerySelect = (queryIds) => {
    const nextQueryIds = Array.isArray(queryIds) ? queryIds : queryIds ? [queryIds] : [];
    const primaryQueryId = nextQueryIds[0] || "";
    if (!primaryQueryId) {
      patchForm({ queryId: "", queryIds: [] });
      return;
    }
    const linkedQuery = queries.find((query) => query.id === primaryQueryId);
    patchForm({
      ...applyQueryLink(form, linkedQuery),
      queryId: primaryQueryId,
      queryIds: nextQueryIds,
    });
  };

  const handleJobQuerySelect = (queryId) => {
    if (!queryId) {
      patchForm({ proposalId: "", queryId: "" });
      return;
    }
    const linkedQuery = queries.find((query) => query.id === queryId);
    const patch = applyQueryLink(form, linkedQuery);
    const confirmedProposalId = linkedQuery?.confirmedOffer?.proposalId;
    const linkedProposal = proposals.reduce((latest, proposal) => {
      const linkedQueryIds = new Set(proposalLinkedQueryIds(proposal));
      if (!linkedQueryIds.has(queryId)) {
        return latest;
      }
      if (!latest) {
        return proposal;
      }
      return new Date(proposal.updatedAt) > new Date(latest.updatedAt) ? proposal : latest;
    }, null);
    patch.proposalId = confirmedProposalId || linkedProposal?.id || "";
    patchForm(patch);
  };

  const handleJobCardSelect = (jobCardId) => {
    const linkedJob = jobCards.find((job) => job.id === jobCardId);
    const patch = linkedJob
      ? applyJobCardLink({ ...form, jobCardId }, linkedJob, modal)
      : {
          jobCardId: jobCardId || "",
          ...(modal === "traveller" ? { travelBatchId: "" } : {}),
        };
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs, jobCards),
    });
  };

  const handleTravellerSelect = (travellerId) => {
    const linkedTraveller =
      travellers.find((traveller) => traveller.id === travellerId) ||
      travellersWithoutVisa.find((traveller) => traveller.id === travellerId);
    const patch = applyTravellerLink(form, linkedTraveller, modal);
    if (linkedTraveller?.jobCardId) {
      const linkedJob = jobCards.find((job) => job.id === linkedTraveller.jobCardId);
      Object.assign(
        patch,
        applyJobCardLink({ ...form, ...patch }, linkedJob, modal, { onlyEmpty: true })
      );
    }
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs, jobCards),
    });
  };

  const handlePnrSelect = (pnrId) => {
    const linkedPnr = pnrs.find((pnr) => pnr.id === pnrId);
    const patch = applyPnrLink(form, linkedPnr, modal);
    if (linkedPnr?.jobCardId) {
      const linkedJob = jobCards.find((job) => job.id === linkedPnr.jobCardId);
      Object.assign(patch, applyJobCardLink({ ...form, ...patch }, linkedJob, modal));
    }
    patchForm({
      ...patch,
      ...reconcileLinkedSelections({ ...form, ...patch }, travellers, pnrs, jobCards),
    });
  };

  const handleVisaRecordSelect = (visaRecordId) => {
    const linkedVisa = visas.find((visa) => visa.id === visaRecordId);
    patchForm(
      linkedVisa ? applyVisaRecordLink(form, linkedVisa) : { visaRecordId: visaRecordId || "" }
    );
  };
  return {
    handleJobCardSelect,
    handleJobQuerySelect,
    handlePnrSelect,
    handleProposalQuerySelect,
    handleStaffSelect,
    handleTravellerSelect,
    handleVisaRecordSelect,
  };
}
