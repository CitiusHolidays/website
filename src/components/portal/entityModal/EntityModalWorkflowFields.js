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
  PORTAL_PERMISSIONS as P,
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
  return (
    <>
      {modal === "queryStatus" && (
        <>
          {has(P.MANAGE_QUERIES) && !has(P.MANAGE_CONTRACTING) && (
            <p className="text-sm text-brand-muted">
              Sales outcomes are recorded from the Queries list using{" "}
              <strong>Sales Decision</strong> (proposal discussion, revision, confirm, or lost).
            </p>
          )}
          {has(P.MANAGE_CONTRACTING) && (
            <Select
              label="Contracting Status"
              value={form.contractingStatus}
              options={CONTRACTING_STATUS_SELECT_OPTIONS}
              onChange={(v) => updateForm("contractingStatus", v)}
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
            value={form.salesDecision}
            options={SALES_DECISION_OPTIONS}
            onChange={(v) => updateForm("salesDecision", v)}
          />
          {form.salesDecision === "Order Lost" && (
            <Select
              label="Lost Reason"
              value={form.lostReason}
              options={LOST_REASONS}
              onChange={(v) => updateForm("lostReason", v)}
            />
          )}
          {(form.salesDecision === "Order Confirmed" || isQueryConfirmed(form)) && (
            <Input
              label="Approx. Margin (INR)"
              type="number"
              value={form.approxMargin}
              onChange={(v) => updateForm("approxMargin", v)}
              placeholder="Enter margin after confirmation"
            />
          )}
          {form.salesDecision === "Date/Destination Change Required" && (
            <div className="md:col-span-2 rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 text-sm text-brand-muted">
              Contracting and ticketing teams will be notified to prepare a revised proposal for the
              changed dates or destination.
            </div>
          )}
        </>
      )}
    </>
  );
}
