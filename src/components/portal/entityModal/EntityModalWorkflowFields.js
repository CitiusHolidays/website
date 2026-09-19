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
    if ((!queryId || linkedQueryIds.has(queryId)) && proposal.status === "Sent") {
      options.push({
        label: `${proposal.proposalCode} - revision ${proposal.proposalRevision}`,
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

  proposals,
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
      proposalRevision: proposal.proposalRevision,
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
              formField="contractingStatus"
              label="Contracting Status"
              onChange={updateForm}
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
            formField="salesDecision"
            label="Sales Decision"
            onChange={updateForm}
            options={SALES_DECISION_OPTIONS}
            value={form.salesDecision}
          />
          {form.salesDecision === "Order Lost" && (
            <>
              <Select
                formField="lostReason"
                label="Lost Reason"
                onChange={updateForm}
                options={LOST_REASONS}
                value={form.lostReason}
              />
              {form.lostReason === "Other" && (
                <Input
                  formField="lostReasonOther"
                  label="Other Lost Reason"
                  onChange={updateForm}
                  value={form.lostReasonOther}
                />
              )}
            </>
          )}
          {form.salesDecision === "Date/Destination Change Required" && (
            <>
              <Input
                formField="destination"
                label="Destination"
                onChange={updateForm}
                value={form.destination}
              />
              <Input
                formField="travelStartDate"
                label="Travel Start Date"
                onChange={updateForm}
                type="date"
                value={form.travelStartDate}
              />
              <Input
                formField="travelEndDate"
                label="Travel End Date"
                onChange={updateForm}
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
                formField="confirmedPax"
                label="Confirmed Pax"
                onChange={updateForm}
                type="number"
                value={form.confirmedPax}
              />
              <Input
                formField="destination"
                label="Destination"
                onChange={updateForm}
                value={form.destination}
              />
              <Input
                formField="travelStartDate"
                label="Travel Start Date"
                onChange={updateForm}
                type="date"
                value={form.travelStartDate}
              />
              <Input
                formField="travelEndDate"
                label="Travel End Date"
                onChange={updateForm}
                type="date"
                value={form.travelEndDate}
              />
              <Input
                label="Land Cost per Person"
                readOnly
                type="number"
                value={form.landCostPerPax}
              />
              <Input label="Airfare per Person" readOnly type="number" value={form.airfarePerPax} />
              <Input
                label="Visa Cost per Person"
                readOnly
                type="number"
                value={form.visaCostPerPax}
              />
              <Input
                label="Selling Price per Person (pre-tax)"
                readOnly
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
              formField="approxMargin"
              label="Approx. Margin (INR)"
              onChange={updateForm}
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
