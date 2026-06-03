"use client";

import {
  ContractingCostFields,
  FinalizedProposalPdfPanel,
  Input,
  isQueryConfirmed,
  MAX_QUERY_NOTES_WORDS,
  MultiSelect,
  money,
  proposalCostPerPax,
  QueryAttachmentsPanel,
  QueryFilePicker,
  Select,
  Textarea,
} from "@/components/portal/PortalModalForm";
import {
  CONTRACTING_STATUS_SELECT_OPTIONS,
  LOST_REASONS,
  QUERY_SOURCES,
  SALES_DECISION_OPTIONS,
  TRAVEL_TYPES,
} from "@/lib/portal/constants";
import { jobCardSelectOptions } from "@/lib/portal/entityModalLinks";
import {
  canAssignContracting,
  canAssignQueryTicketing,
  canAssignTicketing,
  getQueryTypeOptions,
} from "@/lib/portal/permissions";

export function EntityModalProposalFields({
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
  return (
    <>
      {modal === "proposal" && (
        <>
          <MultiSelect
            label="Linked Queries"
            value={
              Array.isArray(form.queryIds) ? form.queryIds : form.queryId ? [form.queryId] : []
            }
            options={queries.map((q) => ({
              value: q.id,
              label: `${q.queryCode} - ${q.clientName}`,
            }))}
            onChange={handleProposalQuerySelect}
          />
          <Input
            label="Client Name"
            value={form.clientName}
            onChange={(v) => updateForm("clientName", v)}
          />
          <Input
            label="Land Cost/Pax"
            type="number"
            value={form.landCostPerPax}
            onChange={(v) => updateForm("landCostPerPax", v)}
          />
          <Input
            label="Airfare/Pax"
            type="number"
            value={form.airfarePerPax}
            onChange={(v) => updateForm("airfarePerPax", v)}
          />
          <Input
            label="Visa Cost/Pax"
            type="number"
            value={form.visaCostPerPax}
            onChange={(v) => updateForm("visaCostPerPax", v)}
          />
          <Input
            label="Selling Price"
            type="number"
            value={form.sellingPrice}
            onChange={(v) => updateForm("sellingPrice", v)}
          />
          <Input
            label="Tax (%)"
            type="number"
            value={form.taxRate}
            onChange={(v) => updateForm("taxRate", v)}
            placeholder="e.g. 5, 18, or custom"
            min="0"
            step="0.01"
          />
          <div className="rounded-lg border border-brand-border bg-brand-light/60 px-3 py-2 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Cost Price (CP) per person
            </div>
            <div className="mt-1 font-semibold text-brand-dark">
              {money(
                proposalCostPerPax(form.landCostPerPax, form.airfarePerPax, form.visaCostPerPax),
              )}
            </div>
            <div className="mt-1 text-xs text-brand-muted">
              Trip total:{" "}
              {money(
                proposalCostPerPax(form.landCostPerPax, form.airfarePerPax, form.visaCostPerPax) *
                  Math.max(Number(form.paxCount) || 1, 1),
              )}{" "}
              ({Math.max(Number(form.paxCount) || 1, 1)} pax)
            </div>
          </div>
          <Textarea
            label="Itinerary Summary"
            value={form.itinerarySummary}
            onChange={(v) => updateForm("itinerarySummary", v)}
          />
          <div className="md:col-span-2">
            <QueryFilePicker
              files={pendingProposalFiles}
              onChange={setPendingProposalFiles}
              inputId="proposal-files"
            />
          </div>
        </>
      )}
    </>
  );
}
