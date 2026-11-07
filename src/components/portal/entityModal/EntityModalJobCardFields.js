"use client";

import { Input, Select } from "@/components/portal/PortalModalForm";

const OFFER_NOTICES = {
  loading: {
    className:
      "rounded-xl border border-brand-border bg-brand-light/60 px-4 py-3 text-brand-muted text-sm md:col-span-2",
    text: "Loading the immutable Confirmed Offer…",
  },
  missing: {
    className:
      "rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-800 text-sm md:col-span-2",
    text: "This Query has no Confirmed Offer. Sales must confirm an exact handed-off Proposal revision before Accounts can open a Job Card.",
  },
};

function confirmedQueryOptions(queries) {
  return [
    { label: "Select confirmed query…", value: "" },
    ...queries.reduce((options, q) => {
      if (q.salesStatus === "Order Confirmed" || q.contractingStatus === "Order Confirmed") {
        options.push({
          label: `${q.queryCode} - ${q.clientName}`,
          value: q.id,
        });
      }
      return options;
    }, []),
  ];
}

function confirmedProposalLabel(proposals, proposalId) {
  const confirmedProposal = proposals.find(
    (proposal) => String(proposal.id) === String(proposalId)
  );
  return confirmedProposal
    ? `${confirmedProposal.proposalCode} - revision ${confirmedProposal.proposalRevision}`
    : proposalId;
}

/** Shown only while a new Job Card waits on, or lacks, the query's Confirmed Offer. */
function ConfirmedOfferNotice({ form, state }) {
  if (form.entityId || !form.queryId || form._confirmedOfferState !== state) {
    return null;
  }
  const notice = OFFER_NOTICES[state];
  return <div className={notice.className}>{notice.text}</div>;
}

function JobCardCommercialFields({ form }) {
  const creationOfferReady = form._confirmedOfferState === "ready";
  return (
    <>
      <div className="rounded-xl border border-brand-border bg-brand-light/60 px-4 py-3 text-brand-muted text-sm md:col-span-2">
        Commercial amounts come from the Confirmed Offer and cannot be changed on the Job Card.
      </div>
      <Input
        label="Land Cost per Person"
        readOnly
        type="number"
        value={form.landCostPerPax ?? ""}
      />
      <Input label="Airfare per Person" readOnly type="number" value={form.airfarePerPax ?? ""} />
      <Input
        label="Visa Cost per Person"
        readOnly
        type="number"
        value={form.visaCostPerPax ?? ""}
      />
      <Input
        label="Selling Price per Person (pre-tax)"
        readOnly
        type="number"
        value={form.sellingPricePerPax ?? ""}
      />
      <Input
        label="Profit per Person (pre-tax)"
        readOnly
        type="number"
        value={form.entityId || creationOfferReady ? form.profitPerPax : ""}
      />
      {!form.entityId && (
        <Input
          label="Approx. Margin (INR)"
          readOnly
          type="number"
          value={creationOfferReady ? (form.approxMargin ?? "") : ""}
        />
      )}
    </>
  );
}

export function EntityModalJobCardFields({
  modal,
  form,
  updateForm,
  queries,
  proposals,
  handleJobQuerySelect,
}) {
  if (modal !== "jobCard") {
    return null;
  }
  return (
    <>
      <Select
        label="Confirmed Query"
        onChange={handleJobQuerySelect}
        options={confirmedQueryOptions(queries)}
        required={!form.entityId}
        value={form.queryId}
      />
      <Input
        label="Confirmed Proposal"
        readOnly
        value={confirmedProposalLabel(proposals, form.proposalId)}
      />
      <ConfirmedOfferNotice form={form} state="loading" />
      <ConfirmedOfferNotice form={form} state="missing" />
      <Input formField="clientName" label="Client" onChange={updateForm} value={form.clientName} />
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
      <JobCardCommercialFields form={form} />
    </>
  );
}
