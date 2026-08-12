"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";

export function EntityModalJobCardFields({
  modal,
  form,
  updateForm,
  queries,
  proposals,
  handleJobQuerySelect,
}) {
  const confirmedProposal = proposals.find(
    (proposal) => String(proposal.id) === String(form.proposalId)
  );
  return (
    <>
      {modal === "jobCard" && (
        <>
          <Select
            label="Confirmed Query"
            onChange={handleJobQuerySelect}
            options={[
              { label: "Select confirmed query…", value: "" },
              ...queries.reduce((options, q) => {
                if (
                  q.salesStatus === "Order Confirmed" ||
                  q.contractingStatus === "Order Confirmed"
                ) {
                  options.push({
                    label: `${q.queryCode} - ${q.clientName}`,
                    value: q.id,
                  });
                }
                return options;
              }, []),
            ]}
            required={!form.entityId}
            value={form.queryId}
          />
          <Input
            label="Confirmed Proposal"
            readOnly
            value={
              confirmedProposal
                ? `${confirmedProposal.proposalCode} - revision ${confirmedProposal.proposalRevision}`
                : form.proposalId
            }
          />
          {!form.entityId && form.queryId && form._confirmedOfferState === "loading" && (
            <div className="rounded-xl border border-brand-border bg-brand-light/60 px-4 py-3 text-brand-muted text-sm md:col-span-2">
              Loading the immutable Confirmed Offer…
            </div>
          )}
          {!form.entityId && form.queryId && form._confirmedOfferState === "missing" && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm md:col-span-2">
              This Query has no Confirmed Offer. Sales must confirm an exact handed-off Proposal
              revision before Accounts can open a Job Card.
            </div>
          )}
          <Input
            label="Client"
            onChange={(v) => updateForm("clientName", v)}
            value={form.clientName}
          />
          <Input
            label="Confirmed Pax"
            onChange={(v) => updateForm("confirmedPax", v)}
            type="number"
            value={form.confirmedPax}
          />
          <Input
            label="Room Count"
            onChange={(v) => updateForm("roomCount", v)}
            type="number"
            value={form.roomCount}
          />
          <Input
            label="Destination"
            onChange={(v) => updateForm("destination", v)}
            value={form.destination}
          />
          <Input
            label="Travel Start"
            onChange={(v) => updateForm("travelStartDate", v)}
            type="date"
            value={form.travelStartDate}
          />
          <Input
            label="Travel End"
            onChange={(v) => updateForm("travelEndDate", v)}
            type="date"
            value={form.travelEndDate}
          />
          <div className="rounded-xl border border-brand-border bg-brand-light/60 px-4 py-3 text-brand-muted text-sm md:col-span-2">
            Commercial amounts come from the Confirmed Offer and cannot be changed on the Job Card.
          </div>
          <Input label="Land Cost per Person" readOnly type="number" value={form.landCostPerPax} />
          <Input label="Airfare per Person" readOnly type="number" value={form.airfarePerPax} />
          <Input label="Visa Cost per Person" readOnly type="number" value={form.visaCostPerPax} />
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
            value={form.profitPerPax}
          />
        </>
      )}
    </>
  );
}
