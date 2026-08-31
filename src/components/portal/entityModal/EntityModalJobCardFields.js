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
  const openingVarianceFields = form.entityId
    ? []
    : [
        {
          baseline: form._openingSourceConfirmedPax,
          field: "confirmedPax",
          formField: "openingConfirmedPaxReason",
          label: "Confirmed pax variance reason",
        },
        {
          baseline: form._openingSourceDestination,
          field: "destination",
          formField: "openingDestinationReason",
          label: "Destination variance reason",
        },
        {
          baseline: form._openingSourceTravelStartDate,
          field: "travelStartDate",
          formField: "openingTravelStartDateReason",
          label: "Travel start variance reason",
        },
        {
          baseline: form._openingSourceTravelEndDate,
          field: "travelEndDate",
          formField: "openingTravelEndDateReason",
          label: "Travel end variance reason",
        },
      ].filter(
        ({ baseline, field }) =>
          baseline !== undefined && String(form[field] ?? "") !== String(baseline)
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
          {!form.entityId && form.queryId && form._confirmedOfferState === "inexact" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm md:col-span-2">
              This legacy Confirmed Offer does not identify an exact Proposal handoff revision.
              Accounts cannot open a Job Card until the commercial chain is reviewed.
            </div>
          )}
          <Input
            formField="clientName"
            label="Client"
            onChange={updateForm}
            readOnly={!form.entityId}
            value={form.clientName}
          />
          <Input
            formField="confirmedPax"
            label="Confirmed Pax"
            onChange={updateForm}
            type="number"
            value={form.confirmedPax}
          />
          <Input
            formField="roomCount"
            label="Room Count"
            onChange={updateForm}
            type="number"
            value={form.roomCount}
          />
          <Input
            formField="destination"
            label="Destination"
            onChange={updateForm}
            value={form.destination}
          />
          <Input
            formField="travelStartDate"
            label="Travel Start"
            onChange={updateForm}
            type="date"
            value={form.travelStartDate}
          />
          <Input
            formField="travelEndDate"
            label="Travel End"
            onChange={updateForm}
            type="date"
            value={form.travelEndDate}
          />
          {!form.entityId && openingVarianceFields.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 text-sm md:col-span-2">
              The fields below differ from the immutable Confirmed Offer. Give each change its own
              opening reason; it will be recorded with the Job Card.
            </div>
          )}
          {openingVarianceFields.map(({ formField, label }) => (
            <Input
              formField={formField}
              key={formField}
              label={label}
              onChange={updateForm}
              required
              value={form[formField]}
            />
          ))}
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
