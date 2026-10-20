"use client";

import {
  Input,
  MultiSelect,
  money,
  proposalCostPerPax,
  Textarea,
} from "@/components/portal/PortalModalForm";
import { proposalLinkedQueryOptions } from "@/lib/portal/proposalLinkedQueryOptions";
import { EntityModalFieldSection } from "./EntityModalFieldSection";

export function EntityModalProposalFields({
  modal,
  disabled = false,
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
        <div className="space-y-6 md:col-span-2">
          <EntityModalFieldSection title="Linked trip">
            <MultiSelect
              disabled={disabled}
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
          </EntityModalFieldSection>
          <EntityModalFieldSection title="Costs and selling price">
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
            <div className="border-brand-border border-t py-3 text-sm">
              <div className="font-medium text-brand-muted text-xs">Cost Price (CP) per person</div>
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
          </EntityModalFieldSection>
          <EntityModalFieldSection title="Itinerary">
            <Textarea
              formField="itinerarySummary"
              label="Itinerary Summary"
              onChange={updateForm}
              value={form.itinerarySummary}
            />
          </EntityModalFieldSection>
        </div>
      )}
    </>
  );
}
