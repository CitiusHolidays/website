"use client";

import {
  Input,
  MultiSelect,
  money,
  proposalCostPerPax,
  Textarea,
} from "@/components/portal/PortalModalForm";
import { proposalLinkedQueryOptions } from "@/lib/portal/proposalLinkedQueryOptions";

export function EntityModalProposalFields({
  modal,
  form,
  updateForm,
  queries,
  proposals,
  handleProposalQuerySelect,
}) {
  let selectedQueryIds = [];
  if (Array.isArray(form.queryIds)) {
    selectedQueryIds = form.queryIds;
  } else if (form.queryId) {
    selectedQueryIds = [form.queryId];
  }
  const linkedQueryOptions = proposalLinkedQueryOptions(
    queries,
    proposals,
    selectedQueryIds,
    form.entityId
  );

  return (
    <>
      {modal === "proposal" && (
        <>
          <MultiSelect
            label="Linked Queries"
            onChange={handleProposalQuerySelect}
            options={linkedQueryOptions.map((q) => ({
              label: `${q.queryCode} - ${q.clientName}`,
              value: q.id,
            }))}
            value={selectedQueryIds}
          />
          <Input
            formField="clientName"
            label="Client Name"
            onChange={updateForm}
            value={form.clientName}
          />
          <Input
            formField="landCostPerPax"
            label="Land Cost/Pax"
            onChange={updateForm}
            type="number"
            value={form.landCostPerPax}
          />
          <Input
            formField="airfarePerPax"
            label="Airfare/Pax"
            onChange={updateForm}
            type="number"
            value={form.airfarePerPax}
          />
          <Input
            formField="visaCostPerPax"
            label="Visa Cost/Pax"
            onChange={updateForm}
            type="number"
            value={form.visaCostPerPax}
          />
          <Input
            formField="sellingPrice"
            label="Selling Price per Person (pre-tax)"
            onChange={updateForm}
            type="number"
            value={form.sellingPrice}
          />
          <Input
            formField="taxRate"
            label="Tax (%)"
            min="0"
            onChange={updateForm}
            placeholder="e.g. 5, 18, or custom"
            step="0.01"
            type="number"
            value={form.taxRate}
          />
          <div className="rounded-lg border border-brand-border bg-brand-light/60 px-3 py-2 text-sm">
            <div className="font-semibold text-brand-muted text-xs uppercase tracking-wide">
              Cost Price (CP) per person
            </div>
            <div className="mt-1 font-semibold text-brand-dark">
              {money(
                proposalCostPerPax(form.landCostPerPax, form.airfarePerPax, form.visaCostPerPax)
              )}
            </div>
            <div className="mt-1 text-brand-muted text-xs">
              Trip total:{" "}
              {money(
                proposalCostPerPax(form.landCostPerPax, form.airfarePerPax, form.visaCostPerPax) *
                  Math.max(Number(form.paxCount) || 1, 1)
              )}{" "}
              ({Math.max(Number(form.paxCount) || 1, 1)} pax)
            </div>
          </div>
          <Textarea
            formField="itinerarySummary"
            label="Itinerary Summary"
            onChange={updateForm}
            value={form.itinerarySummary}
          />
        </>
      )}
    </>
  );
}
