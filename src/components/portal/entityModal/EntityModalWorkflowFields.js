"use client";

import {
  ContractingCostFields,
  Input,
  isQueryConfirmed,
  Select,
} from "@/components/portal/PortalModalForm";
import {
  CONTRACTING_STATUS_SELECT_OPTIONS,
  LOST_REASONS,
  PORTAL_PERMISSIONS as P,
  SALES_DECISION_OPTIONS,
} from "@/lib/portal/constants";
import { proposalLinkedQueryIds } from "@/lib/portal/proposalLinks";

function salesDecisionProfitPerPax(form) {
  const selling = Number(form.sellingPricePerPax) || 0;
  const costs =
    (Number(form.landCostPerPax) || 0) +
    (Number(form.airfarePerPax) || 0) +
    (Number(form.visaCostPerPax) || 0);
  return selling - costs;
}

function linkedProposalOptions(proposals, queryId) {
  return proposals.reduce((options, proposal) => {
    const linkedQueryIds = new Set(proposalLinkedQueryIds(proposal));
    if (
      (!queryId || linkedQueryIds.has(queryId)) &&
      ["Accepted", "Sent"].includes(proposal.status)
    ) {
      options.push({
        label: `${proposal.proposalCode} - ${proposal.status}`,
        value: proposal.id,
      });
    }
    return options;
  }, []);
}

export function EntityModalWorkflowFields({
  modal,
  form,
  updateForm,
  patchForm,
  has,
  access,
  queries,
  proposals,
  jobCards,
  team,
  contractingTeamOptions,
  operationsTeamOptions,
  ticketingTeamOptions,
  pendingQueryFiles,
  setPendingQueryFiles,
  pendingProposalFiles,
  setPendingProposalFiles,
  generateQueryUploadUrl,
  attachQueryFile,
  getQueryAttachmentUrl,
  removeQueryAttachment,
  generateProposalUploadUrl,
  attachProposalFile,
  getProposalAttachmentUrl,
  removeProposalAttachment,
  generateFinalizedPdfUploadUrl,
  attachFinalizedPdf,
  getFinalizedPdfUrl,
  removeFinalizedPdf,
  handleProposalQuerySelect,
  handleJobQuerySelect,
  handleJobCardSelect,
  handleTravellerSelect,
}) {
  const handleSalesDecisionProposalSelect = (proposalId) => {
    const proposal = proposals.find((entry) => String(entry.id) === String(proposalId));
    if (!proposal) {
      updateForm("proposalId", proposalId);
      return;
    }
    patchForm({
      airfarePerPax: String(proposal.airfarePerPax ?? ""),
      landCostPerPax: String(proposal.landCostPerPax ?? ""),
      proposalId,
      sellingPricePerPax: String(proposal.sellingPrice ?? ""),
      visaCostPerPax: String(proposal.visaCostPerPax ?? ""),
    });
  };

  return (
    <>
      {modal === "queryStatus" && (
        <>
          {has(P.MANAGE_QUERIES) && !has(P.MANAGE_CONTRACTING) && (
            <p className="text-brand-muted text-sm">
              Sales outcomes are recorded from the Queries list using{" "}
              <strong>Sales Decision</strong> (proposal discussion, revision, confirm, or lost).
            </p>
          )}
          {has(P.MANAGE_CONTRACTING) && (
            <Select
              label="Contracting Status"
              onChange={(v) => updateForm("contractingStatus", v)}
              options={CONTRACTING_STATUS_SELECT_OPTIONS}
              value={form.contractingStatus}
            />
          )}
          {has(P.MANAGE_CONTRACTING) && (
            <ContractingCostFields form={form} updateForm={updateForm} />
          )}
        </>
      )}
      {modal === "salesDecision" && (
        <>
          <Select
            label="Sales Decision"
            onChange={(v) => updateForm("salesDecision", v)}
            options={SALES_DECISION_OPTIONS}
            value={form.salesDecision}
          />
          {form.salesDecision === "Order Lost" && (
            <Select
              label="Lost Reason"
              onChange={(v) => updateForm("lostReason", v)}
              options={LOST_REASONS}
              value={form.lostReason}
            />
          )}
          {form.salesDecision === "Date/Destination Change Required" && (
            <>
              <Input
                label="Destination"
                onChange={(v) => updateForm("destination", v)}
                value={form.destination}
              />
              <Input
                label="Travel Start Date"
                onChange={(v) => updateForm("travelStartDate", v)}
                type="date"
                value={form.travelStartDate}
              />
              <Input
                label="Travel End Date"
                onChange={(v) => updateForm("travelEndDate", v)}
                type="date"
                value={form.travelEndDate}
              />
              <div className="rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 text-brand-muted text-sm md:col-span-2">
                Contracting and ticketing teams will be notified to prepare a revised proposal for
                the changed dates or destination.
              </div>
            </>
          )}
          {form.salesDecision === "Order Confirmed" && (
            <>
              <Select
                label="Accepted Proposal"
                onChange={handleSalesDecisionProposalSelect}
                options={[
                  { label: "Select proposal…", value: "" },
                  ...linkedProposalOptions(proposals, form.queryId),
                ]}
                required
                value={form.proposalId}
              />
              <Input
                label="Confirmed Pax"
                onChange={(v) => updateForm("confirmedPax", v)}
                type="number"
                value={form.confirmedPax}
              />
              <Input
                label="Destination"
                onChange={(v) => updateForm("destination", v)}
                value={form.destination}
              />
              <Input
                label="Travel Start Date"
                onChange={(v) => updateForm("travelStartDate", v)}
                type="date"
                value={form.travelStartDate}
              />
              <Input
                label="Travel End Date"
                onChange={(v) => updateForm("travelEndDate", v)}
                type="date"
                value={form.travelEndDate}
              />
              <Input
                label="Land Cost per Person"
                onChange={(v) => updateForm("landCostPerPax", v)}
                type="number"
                value={form.landCostPerPax}
              />
              <Input
                label="Airfare per Person"
                onChange={(v) => updateForm("airfarePerPax", v)}
                type="number"
                value={form.airfarePerPax}
              />
              <Input
                label="Visa Cost per Person"
                onChange={(v) => updateForm("visaCostPerPax", v)}
                type="number"
                value={form.visaCostPerPax}
              />
              <Input
                label="Selling Price per Person (pre-tax)"
                onChange={(v) => updateForm("sellingPricePerPax", v)}
                type="number"
                value={form.sellingPricePerPax}
              />
              <Input
                label="Profit per Person (pre-tax)"
                readOnly
                type="number"
                value={String(salesDecisionProfitPerPax(form))}
              />
            </>
          )}
          {(form.salesDecision === "Order Confirmed" || isQueryConfirmed(form)) && (
            <Input
              label="Approx. Margin (INR)"
              onChange={(v) => updateForm("approxMargin", v)}
              placeholder="Enter margin after confirmation"
              type="number"
              value={form.approxMargin}
            />
          )}
        </>
      )}
    </>
  );
}
