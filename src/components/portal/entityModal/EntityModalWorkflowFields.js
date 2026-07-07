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
          {(form.salesDecision === "Order Confirmed" || isQueryConfirmed(form)) && (
            <Input
              label="Approx. Margin (INR)"
              onChange={(v) => updateForm("approxMargin", v)}
              placeholder="Enter margin after confirmation"
              type="number"
              value={form.approxMargin}
            />
          )}
          {form.salesDecision === "Date/Destination Change Required" && (
            <div className="rounded-xl border border-brand-border bg-brand-light/70 px-4 py-3 text-brand-muted text-sm md:col-span-2">
              Contracting and ticketing teams will be notified to prepare a revised proposal for the
              changed dates or destination.
            </div>
          )}
        </>
      )}
    </>
  );
}
