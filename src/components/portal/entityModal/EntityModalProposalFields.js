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
  const selectedQueryIds = Array.isArray(form.queryIds)
    ? form.queryIds
    : form.queryId
      ? [form.queryId]
      : [];
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
            label="Client Name"
            onChange={(v) => updateForm("clientName", v)}
            value={form.clientName}
          />
          <Input
            label="Land Cost/Pax"
            onChange={(v) => updateForm("landCostPerPax", v)}
            type="number"
            value={form.landCostPerPax}
          />
          <Input
            label="Airfare/Pax"
            onChange={(v) => updateForm("airfarePerPax", v)}
            type="number"
            value={form.airfarePerPax}
          />
          <Input
            label="Visa Cost/Pax"
            onChange={(v) => updateForm("visaCostPerPax", v)}
            type="number"
            value={form.visaCostPerPax}
          />
          <Input
            label="Selling Price"
            onChange={(v) => updateForm("sellingPrice", v)}
            type="number"
            value={form.sellingPrice}
          />
          <Input
            label="Tax (%)"
            min="0"
            onChange={(v) => updateForm("taxRate", v)}
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
            label="Itinerary Summary"
            onChange={(v) => updateForm("itinerarySummary", v)}
            value={form.itinerarySummary}
          />
        </>
      )}
    </>
  );
}
